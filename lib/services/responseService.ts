import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { auditLogger, PrismaTransactionClient } from './auditLogger';
import { SubmitResponsesInput } from '@/lib/validators/schemas';
import { sanitise } from '@/lib/utils';

/**
 * Reveal stage controls what level of detail is shown in results.
 */
export type RevealStage = 'HIDDEN' | 'COUNTS' | 'DETAILS';

/**
 * Options for fetching aggregated results.
 */
export interface ResultOptions {
  includeTest: boolean;
  revealStage: RevealStage;
  anonymise: boolean;
}

/**
 * A single option's aggregated result.
 */
export interface OptionResult {
  label: string;
  count: number;
  percentage: number;
}

/**
 * A custom/free-text response entry.
 */
export interface CustomResponse {
  text: string;
  participantLabel: string;
}

/**
 * Aggregated results for a single question.
 */
export interface QuestionResult {
  questionId: string;
  questionText: string;
  options: OptionResult[];
  customResponses: CustomResponse[];
  totalResponses: number;
}

/**
 * Full aggregated results for a poll.
 */
export interface AggregatedResults {
  questions: QuestionResult[];
  participantCount: number;
  submissionCount: number;
}

/**
 * Interface for the Response Service.
 */
export interface ResponseService {
  submitResponses(pollId: string, data: SubmitResponsesInput): Promise<void>;
  hasSubmitted(pollId: string, sessionToken: string): Promise<boolean>;
  getResults(pollId: string, options: ResultOptions): Promise<AggregatedResults>;
  clearTestResponses(pollId: string): Promise<void>;
}

/**
 * Creates a ResponseService instance with all response management operations.
 */
export function createResponseService(): ResponseService {
  return {
    async submitResponses(pollId: string, data: SubmitResponsesInput): Promise<void> {
      await prisma.$transaction(async (tx: PrismaTransactionClient) => {
        // 1. Fetch the poll and its questions
        const poll = await tx.poll.findUniqueOrThrow({
          where: { id: pollId },
          include: { questions: true },
        });

        // 2. Check voting is open
        const facilitatorState = poll.facilitatorState as Record<string, unknown>;
        if (!facilitatorState.votingOpen) {
          const error = new Error('Voting is currently closed');
          (error as any).code = 'VOTING_CLOSED';
          throw error;
        }

        // 3. Check for duplicate session token (already submitted for this poll)
        const existingResponse = await tx.response.findFirst({
          where: { pollId, sessionToken: data.sessionToken },
        });
        if (existingResponse) {
          const error = new Error('Already submitted for this poll');
          (error as any).code = 'CONFLICT';
          throw error;
        }

        // 4. Validate all questions are answered
        const questionIds = poll.questions.map((q) => q.id);
        const answeredIds = data.answers.map((a) => a.questionId);
        const allAnswered = questionIds.every((qId) => answeredIds.includes(qId));
        if (!allAnswered || answeredIds.length !== questionIds.length) {
          const error = new Error('All questions must be answered');
          (error as any).code = 'VALIDATION_ERROR';
          throw error;
        }

        // 5. Persist responses (sanitise customText to prevent XSS)
        await tx.response.createMany({
          data: data.answers.map((answer) => ({
            pollId,
            questionId: answer.questionId,
            participantName: data.participantName,
            sessionToken: data.sessionToken,
            selectedOption: answer.selectedOption,
            customText: answer.customText ? sanitise(answer.customText) : null,
            isTest: data.isTest ?? false,
          })),
        });

        // 6. Log audit
        await auditLogger.log(
          {
            pollId,
            action: 'RESPONSES_SUBMITTED',
            actor: data.participantName,
            metadata: {
              sessionToken: data.sessionToken,
              questionCount: data.answers.length,
              isTest: data.isTest ?? false,
            },
          },
          tx,
        );
      });
    },

    async hasSubmitted(pollId: string, sessionToken: string): Promise<boolean> {
      const response = await prisma.response.findFirst({
        where: { pollId, sessionToken },
      });
      return response !== null;
    },

    async getResults(pollId: string, options: ResultOptions): Promise<AggregatedResults> {
      // If reveal stage is HIDDEN, return empty results
      if (options.revealStage === 'HIDDEN') {
        return {
          questions: [],
          participantCount: 0,
          submissionCount: 0,
        };
      }

      // Fetch questions for this poll
      const questions = await prisma.question.findMany({
        where: { pollId },
        orderBy: { displayOrder: 'asc' },
      });

      // Fetch responses, filtering test responses based on includeTest option
      const whereClause: Prisma.ResponseWhereInput = { pollId };
      if (!options.includeTest) {
        whereClause.isTest = false;
      }

      const responses = await prisma.response.findMany({
        where: whereClause,
      });

      // Compute participant count (unique session tokens)
      const uniqueSessionTokens = new Set(responses.map((r) => r.sessionToken));
      const participantCount = uniqueSessionTokens.size;
      const submissionCount = responses.length;

      // Build per-question results
      const questionResults: QuestionResult[] = questions.map((question) => {
        const questionResponses = responses.filter((r) => r.questionId === question.id);
        const totalResponses = questionResponses.length;
        const questionOptions = question.options as string[];

        // Compute option counts
        const optionCounts = new Map<string, number>();
        for (const opt of questionOptions) {
          optionCounts.set(opt, 0);
        }
        for (const resp of questionResponses) {
          const current = optionCounts.get(resp.selectedOption) ?? 0;
          optionCounts.set(resp.selectedOption, current + 1);
        }

        // Compute percentages
        const optionResults: OptionResult[] = questionOptions.map((label) => {
          const count = optionCounts.get(label) ?? 0;
          const percentage = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;
          return { label, count, percentage };
        });

        // Collect custom/free-text responses
        let customResponses: CustomResponse[] = [];
        if (options.revealStage === 'DETAILS') {
          const customEntries = questionResponses.filter((r) => r.customText != null && r.customText.length > 0);

          if (options.anonymise) {
            // Build a stable participant index based on unique session tokens
            const tokenList = Array.from(uniqueSessionTokens);
            customResponses = customEntries.map((r) => ({
              text: r.customText!,
              participantLabel: `Participant ${tokenList.indexOf(r.sessionToken) + 1}`,
            }));
          } else {
            customResponses = customEntries.map((r) => ({
              text: r.customText!,
              participantLabel: r.participantName,
            }));
          }
        }

        return {
          questionId: question.id,
          questionText: question.text,
          options: optionResults,
          customResponses,
          totalResponses,
        };
      });

      return {
        questions: questionResults,
        participantCount,
        submissionCount,
      };
    },

    async clearTestResponses(pollId: string): Promise<void> {
      await prisma.response.deleteMany({
        where: { pollId, isTest: true },
      });
    },
  };
}

/**
 * Singleton response service instance for use across the application.
 */
export const responseService = createResponseService();
