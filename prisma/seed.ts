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

  console.log("Seeded admin:", admin.email);
  console.log("Seeded coach:", coachUser.email, "coachId:", coachUser.coach?.id);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
