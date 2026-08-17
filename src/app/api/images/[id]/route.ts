import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-guards";
import { getStorage } from "@/lib/storage";
import { canViewImage } from "@/lib/images";

// Serves an image only to authorized users (owner student, their coach, admin).
// Never a public directory — access is checked per request (NFR-4).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const image = await prisma.storedImage.findUnique({ where: { id } });
  if (!image || image.deletedAt) return new Response("Not found", { status: 404 });

  if (!(await canViewImage(user, image.ownerStudentId)))
    return new Response("Forbidden", { status: 403 });

  const file = await getStorage().get(image.storageKey);
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
