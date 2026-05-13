import { describe, it, expect } from 'vitest';
import {
  CreatePollSchema,
  UpdatePollSchema,
  CreateQuestionSchema,
  UpdateQuestionSchema,
  PositionSchema,
  SubmitResponsesSchema,
  AnswerSchema,
  FacilitatorStateSchema,
} from '@/lib/validators/schemas';

describe('CreatePollSchema', () => {
  const validTeamId = '00000000-0000-0000-0000-000000000001';

  it('accepts a valid poll with title and teamId', () => {
    const result = CreatePollSchema.safeParse({ title: 'My Poll', teamId: validTeamId });
    expect(result.success).toBe(true);
  });

  it('accepts a valid poll with title, description, and teamId', () => {
    const result = CreatePollSchema.safeParse({
      title: 'My Poll',
      description: 'A description',
      teamId: validTeamId,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = CreatePollSchema.safeParse({ title: '', teamId: validTeamId });
    expect(result.success).toBe(false);
  });

  it('rejects title exceeding 200 characters', () => {
    const result = CreatePollSchema.safeParse({ title: 'a'.repeat(201), teamId: validTeamId });
    expect(result.success).toBe(false);
  });

  it('accepts title at exactly 200 characters', () => {
    const result = CreatePollSchema.safeParse({ title: 'a'.repeat(200), teamId: validTeamId });
    expect(result.success).toBe(true);
  });

  it('rejects description exceeding 1000 characters', () => {
    const result = CreatePollSchema.safeParse({
      title: 'Valid',
      description: 'a'.repeat(1001),
      teamId: validTeamId,
    });
    expect(result.success).toBe(false);
  });

  it('accepts description at exactly 1000 characters', () => {
    const result = CreatePollSchema.safeParse({
      title: 'Valid',
      description: 'a'.repeat(1000),
      teamId: validTeamId,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing teamId for new polls', () => {
    const result = CreatePollSchema.safeParse({ title: 'My Poll' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid teamId format', () => {
    const result = CreatePollSchema.safeParse({ title: 'My Poll', teamId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});

describe('UpdatePollSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = UpdatePollSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts valid title update', () => {
    const result = UpdatePollSchema.safeParse({ title: 'Updated Title' });
    expect(result.success).toBe(true);
  });

  it('rejects empty title string', () => {
    const result = UpdatePollSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });

  it('accepts valid backgroundImageUrl', () => {
    const result = UpdatePollSchema.safeParse({
      backgroundImageUrl: 'https://example.com/image.png',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid backgroundImageUrl', () => {
    const result = UpdatePollSchema.safeParse({
      backgroundImageUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });
});

describe('PositionSchema', () => {
  it('accepts valid position with all values in range', () => {
    const result = PositionSchema.safeParse({ x: 25.5, y: 10, width: 20, height: 15 });
    expect(result.success).toBe(true);
  });

  it('accepts boundary values (0 and 100)', () => {
    const result = PositionSchema.safeParse({ x: 0, y: 0, width: 100, height: 100 });
    expect(result.success).toBe(true);
  });

  it('rejects negative values', () => {
    const result = PositionSchema.safeParse({ x: -1, y: 10, width: 20, height: 15 });
    expect(result.success).toBe(false);
  });

  it('rejects values exceeding 100', () => {
    const result = PositionSchema.safeParse({ x: 25, y: 101, width: 20, height: 15 });
    expect(result.success).toBe(false);
  });
});

describe('CreateQuestionSchema', () => {
  const validQuestion = {
    text: 'What is your favourite colour?',
    options: ['Red', 'Blue'],
    displayOrder: 0,
  };

  it('accepts a valid question', () => {
    const result = CreateQuestionSchema.safeParse(validQuestion);
    expect(result.success).toBe(true);
  });

  it('defaults allowCustom to false', () => {
    const result = CreateQuestionSchema.safeParse(validQuestion);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allowCustom).toBe(false);
    }
  });

  it('defaults position to null', () => {
    const result = CreateQuestionSchema.safeParse(validQuestion);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.position).toBeNull();
    }
  });

  it('rejects empty text', () => {
    const result = CreateQuestionSchema.safeParse({ ...validQuestion, text: '' });
    expect(result.success).toBe(false);
  });

  it('rejects text exceeding 500 characters', () => {
    const result = CreateQuestionSchema.safeParse({ ...validQuestion, text: 'a'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('rejects fewer than 2 options', () => {
    const result = CreateQuestionSchema.safeParse({ ...validQuestion, options: ['Only one'] });
    expect(result.success).toBe(false);
  });

  it('rejects more than 10 options', () => {
    const options = Array.from({ length: 11 }, (_, i) => `Option ${i + 1}`);
    const result = CreateQuestionSchema.safeParse({ ...validQuestion, options });
    expect(result.success).toBe(false);
  });

  it('accepts exactly 10 options', () => {
    const options = Array.from({ length: 10 }, (_, i) => `Option ${i + 1}`);
    const result = CreateQuestionSchema.safeParse({ ...validQuestion, options });
    expect(result.success).toBe(true);
  });

  it('rejects options with empty strings', () => {
    const result = CreateQuestionSchema.safeParse({ ...validQuestion, options: ['Valid', ''] });
    expect(result.success).toBe(false);
  });

  it('rejects negative displayOrder', () => {
    const result = CreateQuestionSchema.safeParse({ ...validQuestion, displayOrder: -1 });
    expect(result.success).toBe(false);
  });
});

describe('UpdateQuestionSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = UpdateQuestionSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts partial update with text only', () => {
    const result = UpdateQuestionSchema.safeParse({ text: 'Updated question' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid options count when provided', () => {
    const result = UpdateQuestionSchema.safeParse({ options: ['Only one'] });
    expect(result.success).toBe(false);
  });
});

describe('AnswerSchema', () => {
  it('accepts a valid answer', () => {
    const result = AnswerSchema.safeParse({
      questionId: '550e8400-e29b-41d4-a716-446655440000',
      selectedOption: 'Option A',
    });
    expect(result.success).toBe(true);
  });

  it('accepts answer with customText', () => {
    const result = AnswerSchema.safeParse({
      questionId: '550e8400-e29b-41d4-a716-446655440000',
      selectedOption: 'Other',
      customText: 'My custom answer',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID questionId', () => {
    const result = AnswerSchema.safeParse({
      questionId: 'not-a-uuid',
      selectedOption: 'Option A',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty selectedOption', () => {
    const result = AnswerSchema.safeParse({
      questionId: '550e8400-e29b-41d4-a716-446655440000',
      selectedOption: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects customText exceeding 2000 characters', () => {
    const result = AnswerSchema.safeParse({
      questionId: '550e8400-e29b-41d4-a716-446655440000',
      selectedOption: 'Other',
      customText: 'a'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe('SubmitResponsesSchema', () => {
  const validSubmission = {
    participantName: 'John',
    sessionToken: '550e8400-e29b-41d4-a716-446655440000',
    answers: [
      {
        questionId: '550e8400-e29b-41d4-a716-446655440001',
        selectedOption: 'Option A',
      },
    ],
  };

  it('accepts a valid submission', () => {
    const result = SubmitResponsesSchema.safeParse(validSubmission);
    expect(result.success).toBe(true);
  });

  it('defaults isTest to false', () => {
    const result = SubmitResponsesSchema.safeParse(validSubmission);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isTest).toBe(false);
    }
  });

  it('rejects participant name shorter than 2 characters', () => {
    const result = SubmitResponsesSchema.safeParse({
      ...validSubmission,
      participantName: 'J',
    });
    expect(result.success).toBe(false);
  });

  it('rejects participant name longer than 50 characters', () => {
    const result = SubmitResponsesSchema.safeParse({
      ...validSubmission,
      participantName: 'a'.repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it('accepts participant name at exactly 2 characters', () => {
    const result = SubmitResponsesSchema.safeParse({
      ...validSubmission,
      participantName: 'Jo',
    });
    expect(result.success).toBe(true);
  });

  it('accepts participant name at exactly 50 characters', () => {
    const result = SubmitResponsesSchema.safeParse({
      ...validSubmission,
      participantName: 'a'.repeat(50),
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID session token', () => {
    const result = SubmitResponsesSchema.safeParse({
      ...validSubmission,
      sessionToken: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty answers array', () => {
    const result = SubmitResponsesSchema.safeParse({
      ...validSubmission,
      answers: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('FacilitatorStateSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = FacilitatorStateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts full state update', () => {
    const result = FacilitatorStateSchema.safeParse({
      votingOpen: true,
      liveResults: true,
      anonymise: false,
      revealStage: 'DETAILS',
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial state update', () => {
    const result = FacilitatorStateSchema.safeParse({ votingOpen: true });
    expect(result.success).toBe(true);
  });

  it('rejects invalid revealStage value', () => {
    const result = FacilitatorStateSchema.safeParse({ revealStage: 'INVALID' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid revealStage values', () => {
    for (const stage of ['HIDDEN', 'COUNTS', 'DETAILS']) {
      const result = FacilitatorStateSchema.safeParse({ revealStage: stage });
      expect(result.success).toBe(true);
    }
  });
});
