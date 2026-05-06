import { z } from 'zod';

/**
 * Position schema for canvas-placed questions.
 * All values are percentages (0–100) relative to canvas dimensions.
 */
export const PositionSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(0).max(100),
  height: z.number().min(0).max(100),
});

/**
 * Schema for creating a new poll.
 * Title: 1–200 chars (required), Description: 0–1000 chars (optional).
 */
export const CreatePollSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

/**
 * Schema for updating an existing poll.
 * All fields optional; title must be 1–200 chars if provided.
 */
export const UpdatePollSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  backgroundImageUrl: z.string().url().optional(),
});

/**
 * Schema for creating a new question within a poll.
 * Text: 1–500 chars, Options: 2–10 items, each non-empty.
 */
export const CreateQuestionSchema = z.object({
  text: z.string().min(1).max(500),
  options: z.array(z.string().min(1)).min(2).max(10),
  allowCustom: z.boolean().default(false),
  position: PositionSchema.nullable().default(null),
  displayOrder: z.number().int().min(0),
});

/**
 * Schema for updating an existing question.
 * All fields optional; constraints enforced when provided.
 */
export const UpdateQuestionSchema = z.object({
  text: z.string().min(1).max(500).optional(),
  options: z.array(z.string().min(1)).min(2).max(10).optional(),
  allowCustom: z.boolean().optional(),
  position: PositionSchema.nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

/**
 * Schema for a single answer within a response submission.
 */
export const AnswerSchema = z.object({
  questionId: z.string().uuid(),
  selectedOption: z.string().min(1),
  customText: z.string().max(2000).optional(),
});

/**
 * Schema for submitting responses to a poll.
 * Participant name: 2–50 chars, session token: UUID, answers: 1+ items.
 */
export const SubmitResponsesSchema = z.object({
  participantName: z.string().min(2).max(50),
  sessionToken: z.string().uuid(),
  answers: z.array(AnswerSchema).min(1),
  isTest: z.boolean().default(false),
});

/**
 * Schema for facilitator state updates (partial).
 * All fields optional for PATCH-style updates.
 */
export const FacilitatorStateSchema = z.object({
  votingOpen: z.boolean().optional(),
  liveResults: z.boolean().optional(),
  anonymise: z.boolean().optional(),
  revealStage: z.enum(['HIDDEN', 'COUNTS', 'DETAILS']).optional(),
});

// Inferred TypeScript types
export type Position = z.infer<typeof PositionSchema>;
export type CreatePollInput = z.infer<typeof CreatePollSchema>;
export type UpdatePollInput = z.infer<typeof UpdatePollSchema>;
export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof UpdateQuestionSchema>;
export type Answer = z.infer<typeof AnswerSchema>;
export type SubmitResponsesInput = z.infer<typeof SubmitResponsesSchema>;
export type FacilitatorState = z.infer<typeof FacilitatorStateSchema>;
