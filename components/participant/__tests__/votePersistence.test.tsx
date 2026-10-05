/**
 * Regression tests for the retro vote-loss bug (reported Oct 2026).
 *
 * Symptom: "They'll click to vote, the system will show their vote and then a
 * few seconds after their vote would simply disappear."
 *
 * Root cause (see diagnosis): the participant view treated the retro board as a
 * frozen snapshot —
 *   1. the 3s poll fetched the whole public poll but discarded `questions`, so
 *      cards added mid-session never appeared; the only way to see them was a
 *      reload, and
 *   2. selections lived only in React state, so that reload (or a mobile tab
 *      eviction) wiped every unsubmitted vote.
 *
 * Desired behaviour asserted here:
 *   - cards added or removed mid-session are reconciled live, without losing
 *     votes already cast on other cards;
 *   - unsubmitted votes are persisted per (poll, session) and survive a reload;
 *   - a completed submission leaves no draft behind;
 *   - the payload sent to the server covers cards added after page load.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { ParticipantForm, ParticipantFormProps } from '../ParticipantForm';

type Q = ParticipantFormProps['poll']['questions'][number];

const OPEN_STATE = { votingOpen: true, liveResults: false, anonymise: false, revealStage: 'none' };

const SESSION_A = '11111111-1111-4111-8111-111111111111';
const SESSION_B = '22222222-2222-4222-8222-222222222222';

function card(id: string, text: string, order: number, options = ['Red', 'Blue']): Q {
  return { id, text, options, allowCustom: false, position: null, displayOrder: order };
}

/** The board as it stood when the participant opened the page. */
const CARDS_AT_LOAD: Q[] = [
  card('card-1', 'What went well?', 1),
  card('card-2', 'What to improve?', 2),
];
/** Facilitator adds a third card while voting is open. */
const CARDS_AFTER_ADD: Q[] = [...CARDS_AT_LOAD, card('card-3', 'Action items?', 3)];

function props(questions: Q[], overrides: Partial<ParticipantFormProps> = {}): ParticipantFormProps {
  return {
    poll: {
      id: 'poll-1',
      title: 'Sprint Retro',
      description: null,
      backgroundImageUrl: null,
      facilitatorState: OPEN_STATE,
      questions,
    },
    facilitatorState: OPEN_STATE,
    onSubmit: vi.fn().mockResolvedValue(undefined),
    participantName: 'Test User',
    sessionToken: SESSION_A,
    pollId: 'poll-1',
    ...overrides,
  };
}

/** What the server returns for GET /api/polls/:id/public — the live board. */
function mockPoll(questions: Q[], state: typeof OPEN_STATE = OPEN_STATE) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'poll-1', facilitatorState: state, questions }),
    } as unknown as Response),
  );
}

function mobileViewport() {
  Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
  window.dispatchEvent(new Event('resize'));
}

/**
 * This jsdom environment exposes no localStorage, so install an in-memory one —
 * the same approach the repo already uses in tests/properties/session.prop.test.ts.
 */
function installLocalStorage(): Storage {
  const store = new Map<string, string>();
  const mock: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
  vi.stubGlobal('localStorage', mock);
  return mock;
}

function clickOption(option: string, cardIndex = 0) {
  const radio = screen.getAllByRole('radio', { name: option })[cardIndex] as HTMLInputElement;
  act(() => {
    radio.click();
  });
}

function isChecked(option: string, cardIndex = 0): boolean {
  return (screen.getAllByRole('radio', { name: option })[cardIndex] as HTMLInputElement).checked;
}

/** Advance the 3-second facilitator poll `n` times. */
async function pollTicks(n = 1) {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
  }
}

const draftKey = (pollId: string, token: string) => `sp_draft_${pollId}_${token}`;

describe('participant voting — live board reconciliation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mobileViewport();
    installLocalStorage();
    mockPoll(CARDS_AT_LOAD);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    installLocalStorage();
  });

  it('shows a card added mid-session within one poll tick (no reload needed)', async () => {
    render(<ParticipantForm {...props(CARDS_AT_LOAD)} />);
    expect(screen.queryByText('Action items?')).toBeNull();

    mockPoll(CARDS_AFTER_ADD); // facilitator adds the card
    await pollTicks(1);

    expect(screen.getByText('Action items?')).toBeTruthy();
  });

  it('keeps votes already cast when the card list refreshes', async () => {
    render(<ParticipantForm {...props(CARDS_AT_LOAD)} />);
    clickOption('Red', 0);
    expect(isChecked('Red', 0)).toBe(true);

    mockPoll(CARDS_AFTER_ADD);
    await pollTicks(2);

    expect(isChecked('Red', 0)).toBe(true); // vote survives the refresh
    expect(screen.getByText('Action items?')).toBeTruthy();
  });

  it('drops a card removed by the facilitator, along with its stale vote', async () => {
    render(<ParticipantForm {...props(CARDS_AFTER_ADD)} />);
    clickOption('Blue', 2); // vote on the third card
    expect(isChecked('Blue', 2)).toBe(true);

    mockPoll(CARDS_AT_LOAD); // facilitator removes it again
    await pollTicks(1);

    expect(screen.queryByText('Action items?')).toBeNull();
    // Only the two surviving cards' option groups remain.
    expect(screen.getAllByRole('radio', { name: 'Blue' })).toHaveLength(2);
  });

  it('never clears a vote from polling alone (loop stays exonerated)', async () => {
    render(<ParticipantForm {...props(CARDS_AT_LOAD)} />);
    clickOption('Red', 0);

    await pollTicks(3);

    expect(isChecked('Red', 0)).toBe(true);
  });

  it('submits responses for cards added after the page was opened', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ParticipantForm {...props(CARDS_AT_LOAD, { onSubmit })} />);

    mockPoll(CARDS_AFTER_ADD);
    await pollTicks(1);

    clickOption('Red', 0);
    clickOption('Blue', 1);
    clickOption('Red', 2); // the newly added card

    await act(async () => {
      screen.getByRole('button', { name: /submit/i }).click();
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const ids = onSubmit.mock.calls[0][0].answers.map((a: { questionId: string }) => a.questionId);
    expect(ids).toEqual(['card-1', 'card-2', 'card-3']);
  });
});

describe('participant voting — draft persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mobileViewport();
    installLocalStorage();
    mockPoll(CARDS_AT_LOAD);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    installLocalStorage();
  });

  it('restores unsubmitted votes after a reload (remount)', () => {
    const view = render(<ParticipantForm {...props(CARDS_AT_LOAD)} />);
    clickOption('Red', 0);
    clickOption('Blue', 1);
    expect(isChecked('Red', 0)).toBe(true);

    // Phone reloads the page / the tab was evicted and restored.
    view.unmount();
    render(<ParticipantForm {...props(CARDS_AT_LOAD)} />);

    expect(isChecked('Red', 0)).toBe(true);
    expect(isChecked('Blue', 1)).toBe(true);
  });

  it('does not leak one participant’s draft to another session on the same device', () => {
    const view = render(<ParticipantForm {...props(CARDS_AT_LOAD)} />);
    clickOption('Red', 0);

    view.unmount();
    render(<ParticipantForm {...props(CARDS_AT_LOAD, { sessionToken: SESSION_B })} />);

    expect(isChecked('Red', 0)).toBe(false);
  });

  it('keeps drafts isolated per poll', () => {
    const view = render(<ParticipantForm {...props(CARDS_AT_LOAD)} />);
    clickOption('Red', 0);

    view.unmount();
    render(
      <ParticipantForm
        {...props(CARDS_AT_LOAD, {
          pollId: 'poll-2',
          poll: { ...props(CARDS_AT_LOAD).poll, id: 'poll-2' },
        })}
      />,
    );

    expect(isChecked('Red', 0)).toBe(false);
  });

  it('clears the draft once the submission succeeds', async () => {
    const view = render(<ParticipantForm {...props(CARDS_AT_LOAD)} />);
    clickOption('Red', 0);
    clickOption('Blue', 1);
    expect(localStorage.getItem(draftKey('poll-1', SESSION_A))).toBeTruthy();

    await act(async () => {
      screen.getByRole('button', { name: /submit/i }).click();
    });

    expect(localStorage.getItem(draftKey('poll-1', SESSION_A))).toBeNull();

    // A later visit must not resurrect the submitted answers.
    view.unmount();
    render(<ParticipantForm {...props(CARDS_AT_LOAD)} />);
    expect(isChecked('Red', 0)).toBe(false);
  });
});
