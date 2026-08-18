// Load .env for standalone execution (tsx does not auto-load it like the
// Prisma CLI does). In containers env is already injected, so this no-ops.
import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Seeds the platform Admin and the single Coach (Flary). Idempotent: safe to
// re-run. Passwords come from env so no secrets are committed.
async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@lcwh.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "changeme-admin";
  const coachEmail = process.env.SEED_COACH_EMAIL ?? "flary@lcwh.local";
  const coachPassword = process.env.SEED_COACH_PASSWORD ?? "changeme-coach";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Platform Admin",
      role: Role.admin,
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });

  const coachUser = await prisma.user.upsert({
    where: { email: coachEmail },
    update: {},
    create: {
      email: coachEmail,
      name: "Flary Elsy Selva",
      role: Role.coach,
      passwordHash: await bcrypt.hash(coachPassword, 10),
      coach: { create: {} },
    },
    include: { coach: true },
  });

  // Default AI report prompt template, linked to the coach so generateReport
  // has a body + model without the Admin having to open the editor first.
  const coachId = coachUser.coach!.id;
  const existingSettings = await prisma.programSettings.findUnique({
    where: { coachId },
    select: { promptTemplateId: true },
  });
  if (!existingSettings?.promptTemplateId) {
    const template = await prisma.promptTemplate.create({
      data: {
        name: "Daily report",
        modelId: process.env.OPENROUTER_DEFAULT_MODEL ?? "openai/gpt-4o-mini",
        body:
          "You are a supportive wellness coach's assistant. Using the client's " +
          "daily check-in below, write a short, encouraging daily report (3-5 " +
          "sentences). Note progress toward their goals and one concrete, kind " +
          "suggestion for tomorrow. Do not invent data that is not provided.",
      },
    });
    await prisma.programSettings.upsert({
      where: { coachId },
      update: { promptTemplateId: template.id },
      create: { coachId, promptTemplateId: template.id },
    });
    console.log("Seeded prompt template:", template.id);
  }

  console.log("Seeded admin:", admin.email);
  console.log("Seeded coach:", coachUser.email, "coachId:", coachId);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
