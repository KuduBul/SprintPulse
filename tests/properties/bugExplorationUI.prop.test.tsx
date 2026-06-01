import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';

/**
 * Bug Condition Exploration Tests - UI Components (Bugs 1, 2)
 *
 * Property 1: Bug Condition - E2E Test Bugfixes (Bugs 1, 2)
 *
 * These tests encode the EXPECTED (correct) behavior for each UI bug.
 * They are written BEFORE implementing fixes and are EXPECTED TO FAIL
 * on unfixed code — failure confirms the bugs exist.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 */

// ─── Mocks for AuthForm (Bug 1) ─────────────────────────────────────────────

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    session: null,
    isAuthenticated: false,
    isLoaded: true,
    signIn: mockSignIn,
    signUp: mockSignUp,
    signOut: mockSignOut,
    resetPassword: vi.fn(),
  }),
}));

// ─── Mocks for EditPollPage (Bug 2) ─────────────────────────────────────────

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDel = vi.fn();

vi.mock('@/lib/hooks/useApi', () => ({
  useApi: () => ({
    get: mockGet,
    post: mockPost,
    patch: mockPatch,
    del: mockDel,
    isLoaded: true,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  useParams: () => ({
    id: 'test-poll-id',
  }),
}));

vi.mock('@/components/canvas/ResponsivePollCanvas', () => ({
  ResponsivePollCanvas: ({ pollId }: any) => (
    <div data-testid="canvas-editor">Canvas Editor for {pollId}</div>
  ),
}));

vi.mock('@/components/admin/TeamSelector', () => ({
  TeamSelector: ({ value, onChange }: any) => (
    <select data-testid="team-selector" value={value} onChange={(e: any) => onChange(e.target.value)}>
      <option value="">Select team</option>
      <option value="team-1">Team 1</option>
    </select>
  ),
}));

// Import components after mocks
import { AuthForm } from '@/components/auth/AuthForm';

// ─── Bug 1: No Password Reset on Login Page ─────────────────────────────────

/**
 * Bug 1 Exploration: Password Reset Flow Available
 *
 * Bug Condition: page == login AND userAction == forgot_password AND NOT passwordResetLinkExists()
 *
 * Expected behavior: The AuthForm component SHALL render a "Forgot password?" link
 * that is visible in login mode.
 *
 * On UNFIXED code: AuthForm only has login and register modes, no forgot password link exists.
 *
 * **Validates: Requirements 1.1, 1.2**
 */
describe('Bug 1 Exploration: AuthForm should have Forgot password link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AuthForm in login mode renders a Forgot password link', () => {
    // This is a concrete test (not property-based) because the bug condition
    // is simply: render the login form and check for the link
    fc.assert(
      fc.property(
        fc.constant(null), // No random input needed - the bug is deterministic
        () => {
          const { unmount } = render(<AuthForm />);

          // Expected: A "Forgot password?" link should be visible in login mode
          // Bug: On unfixed code, no such link exists
          const forgotLink = screen.queryByText(/forgot password/i);
          expect(forgotLink).not.toBeNull();
          expect(forgotLink).toBeInTheDocument();

          unmount();
        }
      ),
      { numRuns: 1 }
    );
  });
});

// ─── Bug 2: Edit Poll Page Layout — Save Button Above Questions/Canvas ───────

/**
 * Bug 2 Exploration: Edit Poll Page Section Order
 *
 * Bug Condition: page == edit_poll AND saveButtonRendersBeforeQuestionsSection()
 *
 * Expected behavior: The Save button SHALL render AFTER the Questions section
 * and Canvas section in the DOM order.
 *
 * On UNFIXED code: PollForm (containing the Save button) renders before Questions
 * and Canvas sections.
 *
 * **Validates: Requirements 1.3, 1.4**
 */
describe('Bug 2 Exploration: Save button should be AFTER Questions and Canvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock API responses for EditPollPage
    mockGet.mockImplementation(async (url: string) => {
      if (url.includes('/questions')) {
        return {
          data: [
            {
              id: 'q1',
              text: 'Test Question 1',
              options: ['Option A', 'Option B'],
              allowCustom: false,
              position: { x: 10, y: 10, width: 30, height: 20 },
              displayOrder: 0,
            },
          ],
          error: null,
        };
      }
      // Poll data
      return {
        data: {
          id: 'test-poll-id',
          title: 'Test Poll',
          description: 'A test poll',
          backgroundImageUrl: null,
          teamId: 'team-1',
        },
        error: null,
      };
    });
  });

  it('Save/Submit button appears after the Questions section and Canvas in DOM order', async () => {
    // Dynamic import to avoid hoisting issues with mocks
    const { default: EditPollPage } = await import('@/app/admin/polls/[id]/edit/page.tsx');

    const { container } = render(<EditPollPage />);

    // Wait for data to load
    await vi.waitFor(() => {
      expect(screen.queryByText('Loading poll...')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Find the sections by their aria-labels
    const editPollSection = container.querySelector('[aria-label="Edit poll"]');
    const questionsSection = container.querySelector('[aria-label="Manage questions"]');
    const canvasSection = container.querySelector('[aria-label="Visual canvas editor"]');

    // Find the submit/save button
    const saveButton = screen.queryByRole('button', { name: /save changes/i });

    expect(editPollSection).toBeInTheDocument();
    expect(questionsSection).toBeInTheDocument();
    expect(canvasSection).toBeInTheDocument();
    expect(saveButton).toBeInTheDocument();

    // The save button should appear AFTER the canvas section in DOM order
    // Bug: On unfixed code, the save button is inside PollForm which is BEFORE questions/canvas
    if (saveButton && canvasSection) {
      // compareDocumentPosition: if canvas is BEFORE save button, bit 4 (DOCUMENT_POSITION_FOLLOWING) is set
      const position = canvasSection.compareDocumentPosition(saveButton);
      // Bit 4 = DOCUMENT_POSITION_FOLLOWING means saveButton comes after canvasSection
      const saveButtonIsAfterCanvas = (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      expect(saveButtonIsAfterCanvas).toBe(true);
    }
  });
});
