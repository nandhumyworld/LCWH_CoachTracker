import { env } from "@/lib/env";

// OpenRouter chat-completions client for AI daily reports (spec §6, NFR-1).
// The model id is passed in (resolved from the DB PromptTemplate / env default)
// so models can change without a redeploy. Pure request/response helpers are
// exported separately so they can be unit-tested without hitting the network.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface CallOpenRouterInput {
  modelId: string;
  prompt: string;
  /** Vision inputs as `data:` URLs (built from authenticated image bytes). */
  images?: string[];
}

export interface CallOpenRouterResult {
  text: string;
  tokensIn: number | null;
  tokensOut: number | null;
  costEstimate: number | null;
}

// --- Pure helpers (unit-tested) -------------------------------------------

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "user";
  content: ContentPart[];
}

// Builds the vision-capable message array: the prompt text followed by one
// image_url part per data URL.
export function buildMessages(prompt: string, imageUrls: string[]): ChatMessage[] {
  const content: ContentPart[] = [{ type: "text", text: prompt }];
  for (const url of imageUrls) {
    content.push({ type: "image_url", image_url: { url } });
  }
  return [{ role: "user", content }];
}

// Encodes raw image bytes as a `data:` URL for the vision channel.
export function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

// Chooses the mime type to send to the vision API. The DB-recorded mime
// (StoredImage.mimeType, validated as an image at upload) is authoritative;
// local-disk storage hands back a generic "application/octet-stream" blob mime,
// which OpenRouter rejects ("Only image types are supported"). Prefer the
// recorded mime, fall back to the blob mime only when it is itself an image
// type, and otherwise default to image/jpeg so the call never fails on mime.
export function pickImageMime(
  recorded: string | null | undefined,
  blob: string | null | undefined,
): string {
  const isImage = (m: string | null | undefined): m is string =>
    typeof m === "string" && m.startsWith("image/");
  if (isImage(recorded)) return recorded;
  if (isImage(blob)) return blob;
  return "image/jpeg";
}

interface CompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
  };
}

// Extracts the assistant text + token/cost usage from a chat completion.
// Throws when no message content is present (treated as a generation failure).
export function parseCompletion(json: CompletionResponse): CallOpenRouterResult {
  const text = json.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("OpenRouter response contained no message content.");
  }
  const usage = json.usage ?? {};
  return {
    text,
    tokensIn: usage.prompt_tokens ?? null,
    tokensOut: usage.completion_tokens ?? null,
    costEstimate: usage.cost ?? null,
  };
}

// --- Network call ----------------------------------------------------------

export async function callOpenRouter(
  input: CallOpenRouterInput,
): Promise<CallOpenRouterResult> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured.");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.modelId,
      messages: buildMessages(input.prompt, input.images ?? []),
      // Ask OpenRouter to include cost in the usage block when available.
      usage: { include: true },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `OpenRouter request failed (${res.status}): ${detail.slice(0, 500)}`,
    );
  }

  return parseCompletion((await res.json()) as CompletionResponse);
}
