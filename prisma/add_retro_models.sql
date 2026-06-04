-- Migration: add_retro_models (Retro Board Phase 2A)
-- Spec: .kiro/specs/retro-board-phase-2
--
-- STATUS: GENERATED OFFLINE, NOT YET APPLIED.
-- The DATABASE_URL/DIRECT_URL point at a remote Supabase instance
-- (aws-1-eu-central-1.pooler.supabase.com), so this was NOT applied automatically.
-- The owner should apply it against the correct (non-production) database, e.g. via
-- the Supabase SQL Editor, or `prisma db execute --file prisma/add_retro_models.sql`.
--
-- This migration is ADDITIVE and zero-downtime:
--   * Poll gains one defaulted column ("type" DEFAULT 'pulse') => all existing pulse
--     rows automatically read back as type 'pulse' with no backfill.
--   * New Retro* tables are created. Question and Response are UNCHANGED.

-- AlterTable
ALTER TABLE "Poll" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'pulse';

-- CreateTable
CREATE TABLE "RetroBoard" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'gather',
    "votesPerUser" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetroBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetroLane" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "position" JSONB,

    CONSTRAINT "RetroLane_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetroCard" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "laneId" TEXT NOT NULL,
    "authorToken" TEXT NOT NULL,
    "authorName" VARCHAR(50) NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetroCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetroVote" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "voterToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetroVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetroActionItem" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "owner" VARCHAR(100),
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetroActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RetroBoard_pollId_key" ON "RetroBoard"("pollId");

-- CreateIndex
CREATE INDEX "RetroBoard_pollId_idx" ON "RetroBoard"("pollId");

-- CreateIndex
CREATE INDEX "RetroLane_boardId_idx" ON "RetroLane"("boardId");

-- CreateIndex
CREATE INDEX "RetroCard_boardId_idx" ON "RetroCard"("boardId");

-- CreateIndex
CREATE INDEX "RetroCard_laneId_idx" ON "RetroCard"("laneId");

-- CreateIndex
CREATE INDEX "RetroCard_authorToken_idx" ON "RetroCard"("authorToken");

-- CreateIndex
CREATE INDEX "RetroVote_boardId_idx" ON "RetroVote"("boardId");

-- CreateIndex
CREATE INDEX "RetroVote_voterToken_idx" ON "RetroVote"("voterToken");

-- CreateIndex
CREATE UNIQUE INDEX "RetroVote_cardId_voterToken_key" ON "RetroVote"("cardId", "voterToken");

-- CreateIndex
CREATE INDEX "RetroActionItem_boardId_idx" ON "RetroActionItem"("boardId");

-- AddForeignKey
ALTER TABLE "RetroBoard" ADD CONSTRAINT "RetroBoard_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetroLane" ADD CONSTRAINT "RetroLane_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "RetroBoard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetroCard" ADD CONSTRAINT "RetroCard_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "RetroBoard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetroCard" ADD CONSTRAINT "RetroCard_laneId_fkey" FOREIGN KEY ("laneId") REFERENCES "RetroLane"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetroVote" ADD CONSTRAINT "RetroVote_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "RetroBoard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetroVote" ADD CONSTRAINT "RetroVote_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "RetroCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
