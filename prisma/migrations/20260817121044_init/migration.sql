-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'coach', 'student');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('invited', 'active', 'paused');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('short_text', 'number', 'date', 'paragraph', 'multiple_choice', 'checkboxes', 'linear_scale', 'image');

-- CreateEnum
CREATE TYPE "DailyEntryStatus" AS ENUM ('open', 'submitted', 'auto_submitted', 'missed');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('pending', 'done', 'failed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "joinedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StudentStatus" NOT NULL DEFAULT 'invited',
    "heightCm" DOUBLE PRECISION,
    "currentWeightKg" DOUBLE PRECISION,
    "targetWeightKg" DOUBLE PRECISION,
    "intakeAt" TIMESTAMP(3),

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfilePanel" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "bmi" DOUBLE PRECISION,
    "bmr" DOUBLE PRECISION,
    "weightToLoseKg" DOUBLE PRECISION,
    "computed" JSONB,
    "narrative" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfilePanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sectionTitle" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB,
    "points" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "allowsImage" BOOLEAN NOT NULL DEFAULT false,
    "helpText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramSettings" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "formDescription" TEXT,
    "submissionMessage" TEXT,
    "promptTemplateId" TEXT,

    CONSTRAINT "ProgramSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyEntry" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "status" "DailyEntryStatus" NOT NULL DEFAULT 'open',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "dailyEntryId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" JSONB,
    "imageRefId" TEXT,
    "note" TEXT,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredImage" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "ownerStudentId" TEXT NOT NULL,
    "dailyEntryId" TEXT,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StoredImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "dailyEntryId" TEXT NOT NULL,
    "body" TEXT,
    "modelId" TEXT,
    "promptTemplateId" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "costEstimate" DOUBLE PRECISION,
    "status" "ReportStatus" NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyGateMessage" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "bodyText" TEXT NOT NULL,
    "imageRefId" TEXT,
    "ackButtonLabel" TEXT NOT NULL DEFAULT 'I acknowledge',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyGateMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateAcknowledgement" (
    "id" TEXT NOT NULL,
    "gateMessageId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GateAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Coach_userId_key" ON "Coach"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE INDEX "Student_coachId_idx" ON "Student"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "InviteToken_tokenHash_key" ON "InviteToken"("tokenHash");

-- CreateIndex
CREATE INDEX "InviteToken_userId_idx" ON "InviteToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfilePanel_studentId_key" ON "ProfilePanel"("studentId");

-- CreateIndex
CREATE INDEX "Question_coachId_orderIndex_idx" ON "Question"("coachId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Question_coachId_key_key" ON "Question"("coachId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramSettings_coachId_key" ON "ProgramSettings"("coachId");

-- CreateIndex
CREATE INDEX "DailyEntry_status_idx" ON "DailyEntry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DailyEntry_studentId_localDate_key" ON "DailyEntry"("studentId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_dailyEntryId_questionId_key" ON "Answer"("dailyEntryId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "StoredImage_storageKey_key" ON "StoredImage"("storageKey");

-- CreateIndex
CREATE INDEX "StoredImage_ownerStudentId_idx" ON "StoredImage"("ownerStudentId");

-- CreateIndex
CREATE INDEX "StoredImage_expiresAt_idx" ON "StoredImage"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_dailyEntryId_key" ON "Report"("dailyEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyGateMessage_coachId_scheduledDate_key" ON "DailyGateMessage"("coachId", "scheduledDate");

-- CreateIndex
CREATE INDEX "GateAcknowledgement_studentId_idx" ON "GateAcknowledgement"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "GateAcknowledgement_gateMessageId_studentId_key" ON "GateAcknowledgement"("gateMessageId", "studentId");

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteToken" ADD CONSTRAINT "InviteToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfilePanel" ADD CONSTRAINT "ProfilePanel_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramSettings" ADD CONSTRAINT "ProgramSettings_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramSettings" ADD CONSTRAINT "ProgramSettings_promptTemplateId_fkey" FOREIGN KEY ("promptTemplateId") REFERENCES "PromptTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyEntry" ADD CONSTRAINT "DailyEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_dailyEntryId_fkey" FOREIGN KEY ("dailyEntryId") REFERENCES "DailyEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_imageRefId_fkey" FOREIGN KEY ("imageRefId") REFERENCES "StoredImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredImage" ADD CONSTRAINT "StoredImage_ownerStudentId_fkey" FOREIGN KEY ("ownerStudentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredImage" ADD CONSTRAINT "StoredImage_dailyEntryId_fkey" FOREIGN KEY ("dailyEntryId") REFERENCES "DailyEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_dailyEntryId_fkey" FOREIGN KEY ("dailyEntryId") REFERENCES "DailyEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_promptTemplateId_fkey" FOREIGN KEY ("promptTemplateId") REFERENCES "PromptTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyGateMessage" ADD CONSTRAINT "DailyGateMessage_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateAcknowledgement" ADD CONSTRAINT "GateAcknowledgement_gateMessageId_fkey" FOREIGN KEY ("gateMessageId") REFERENCES "DailyGateMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateAcknowledgement" ADD CONSTRAINT "GateAcknowledgement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

