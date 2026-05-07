-- Shoprite-X Polling App - Database Schema
-- Run this in Supabase SQL Editor to create all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Poll table
CREATE TABLE "Poll" (
  "id" TEXT NOT NULL DEFAULT uuid_generate_v4()::text,
  "title" VARCHAR(200) NOT NULL,
  "description" VARCHAR(1000),
  "backgroundImageUrl" TEXT,
  "facilitatorState" JSONB NOT NULL DEFAULT '{"_v":1,"votingOpen":false,"liveResults":false,"anonymise":true,"revealStage":"HIDDEN"}',
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- Create Question table
CREATE TABLE "Question" (
  "id" TEXT NOT NULL DEFAULT uuid_generate_v4()::text,
  "pollId" TEXT NOT NULL,
  "text" VARCHAR(500) NOT NULL,
  "options" JSONB NOT NULL,
  "allowCustom" BOOLEAN NOT NULL DEFAULT false,
  "position" JSONB,
  "displayOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- Create Response table
CREATE TABLE "Response" (
  "id" TEXT NOT NULL DEFAULT uuid_generate_v4()::text,
  "pollId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "participantName" VARCHAR(50) NOT NULL,
  "sessionToken" TEXT NOT NULL,
  "selectedOption" TEXT NOT NULL,
  "customText" TEXT,
  "isTest" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- Create AuditLog table
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL DEFAULT uuid_generate_v4()::text,
  "pollId" TEXT,
  "action" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "Question" ADD CONSTRAINT "Question_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Response" ADD CONSTRAINT "Response_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Response" ADD CONSTRAINT "Response_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "Question_pollId_idx" ON "Question"("pollId");
CREATE INDEX "Response_pollId_idx" ON "Response"("pollId");
CREATE INDEX "Response_questionId_idx" ON "Response"("questionId");
CREATE INDEX "Response_sessionToken_idx" ON "Response"("sessionToken");
CREATE INDEX "AuditLog_pollId_idx" ON "AuditLog"("pollId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- Add unique constraint for deduplication
CREATE UNIQUE INDEX "Response_pollId_questionId_sessionToken_key" ON "Response"("pollId", "questionId", "sessionToken");

-- Create Prisma migrations table (so Prisma knows the schema is in sync)
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMP WITH TIME ZONE,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMP WITH TIME ZONE,
  "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

-- Insert a migration record so Prisma considers the DB in sync
INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "finished_at", "applied_steps_count")
VALUES (
  uuid_generate_v4()::text,
  'manual_init',
  '20240101000000_init',
  NOW(),
  1
);
