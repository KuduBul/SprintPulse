import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ParticipantLandingPage from '@/app/poll/page';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

// localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Helper to create mock fetch responses
function mockFetchResponse(status: number, data?: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response);
}

describe('Participant Page PIN Flow', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('localStorage read/write behavior', () => {
    it('reads stored PIN from localStorage on mount', async () => {
      localStorageMock.setItem('team_pin', 'AB3X');

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url === '/api/teams/validate-pin') {
          return mockFetchResponse(200, { teamId: 'team-1', teamName: 'Sprint Team' });
        }
        if (url.includes('/api/polls/public')) {
          return mockFetchResponse(200, []);
        }
        return mockFetchResponse(404);
      });

      await act(async () => {
        render(<ParticipantLandingPage />);
      });

      expect(localStorageMock.getItem).toHaveBeenCalledWith('team_pin');
    });

    it('stores PIN in localStorage after successful validation', async () => {
      // No stored PIN initially
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url === '/api/teams/validate-pin') {
          return mockFetchResponse(200, { teamId: 'team-1', teamName: 'Sprint Team' });
        }
        if (url.includes('/api/polls/public')) {
          return mockFetchResponse(200, []);
        }
        return mockFetchResponse(404);
      });

      await act(async () => {
        render(<ParticipantLandingPage />);
      });

      // Should show PIN form since no stored PIN
      const input = screen.getByLabelText('Enter Team PIN');
      const submitButton = screen.getByRole('button', { name: /join team/i });

      await act(async () => {
        fireEvent.change(input, { target: { value: 'AB3X' } });
      });

      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith('team_pin', 'AB3X');
      });
    });

    it('clears localStorage when stored PIN is invalid (team deleted)', async () => {
      localStorageMock.setItem('team_pin', 'OLDPIN');

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url === '/api/teams/validate-pin') {
          return mockFetchResponse(404, { error: { message: 'PIN not recognized' } });
        }
        return mockFetchResponse(200, []);
      });

      await act(async () => {
        render(<ParticipantLandingPage />);
      });

      await waitFor(() => {
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('team_pin');
      });
    });

    it('shows PinEntryForm when no stored PIN exists', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
        return mockFetchResponse(200, []);
      });

      await act(async () => {
        render(<ParticipantLandingPage />);
      });

      await waitFor(() => {
        expect(screen.getByLabelText('Enter Team PIN')).toBeInTheDocument();
      });
    });
  });

  describe('PIN validation success and error states', () => {
    it('displays polls after successful PIN validation', async () => {
      const mockPolls = [
        { id: 'poll-1', title: 'Sprint Retro', description: 'How was the sprint?', teamId: 'team-1', votingOpen: true },
        { id: 'poll-2', title: 'Team Health', description: null, teamId: 'team-1', votingOpen: false },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url === '/api/teams/validate-pin') {
          return mockFetchResponse(200, { teamId: 'team-1', teamName: 'Sprint Team' });
        }
        if (url.includes('/api/polls/public')) {
          return mockFetchResponse(200, mockPolls);
        }
        return mockFetchResponse(404);
      });

      await act(async () => {
        render(<ParticipantLandingPage />);
      });

      // Submit PIN
      const input = screen.getByLabelText('Enter Team PIN');
      const submitButton = screen.getByRole('button', { name: /join team/i });

      await act(async () => {
        fireEvent.change(input, { target: { value: 'AB3X' } });
      });

      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Sprint Retro')).toBeInTheDocument();
        expect(screen.getByText('Team Health')).toBeInTheDocument();
      });
    });

    it('shows team name badge after successful validation', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url === '/api/teams/validate-pin') {
          return mockFetchResponse(200, { teamId: 'team-1', teamName: 'Sprint Team' });
        }
        if (url.includes('/api/polls/public')) {
          return mockFetchResponse(200, []);
        }
        return mockFetchResponse(404);
      });

      await act(async () => {
        render(<ParticipantLandingPage />);
      });

      const input = screen.getByLabelText('Enter Team PIN');
      const submitButton = screen.getByRole('button', { name: /join team/i });

      await act(async () => {
        fireEvent.change(input, { target: { value: 'AB3X' } });
      });

      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Team: Sprint Team')).toBeInTheDocument();
      });
    });

    it('displays error message for invalid PIN', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url === '/api/teams/validate-pin') {
          return mockFetchResponse(404, { error: { message: 'PIN not recognized' } });
        }
        return mockFetchResponse(200, []);
      });

      await act(async () => {
        render(<ParticipantLandingPage />);
      });

      const input = screen.getByLabelText('Enter Team PIN');
      const submitButton = screen.getByRole('button', { name: /join team/i });

      await act(async () => {
        fireEvent.change(input, { target: { value: 'ZZZZ' } });
      });

      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('PIN not recognized. Please check with your facilitator.')).toBeInTheDocument();
      });
    });

    it('does not store PIN in localStorage on failed validation', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url === '/api/teams/validate-pin') {
          return mockFetchResponse(404, { error: { message: 'PIN not recognized' } });
        }
        return mockFetchResponse(200, []);
      });

      await act(async () => {
        render(<ParticipantLandingPage />);
      });

      const input = screen.getByLabelText('Enter Team PIN');
      const submitButton = screen.getByRole('button', { name: /join team/i });

      await act(async () => {
        fireEvent.change(input, { target: { value: 'ZZZZ' } });
      });

      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('PIN not recognized. Please check with your facilitator.')).toBeInTheDocument();
      });

      // setItem should not have been called with team_pin after the failed validation
      const setItemCalls = (localStorageMock.setItem as ReturnType<typeof vi.fn>).mock.calls
        .filter((call: string[]) => call[0] === 'team_pin');
      expect(setItemCalls).toHaveLength(0);
    });

    it('auto-validates stored PIN and loads polls on mount', async () => {
      localStorageMock.setItem('team_pin', 'AB3X');

      const mockPolls = [
        { id: 'poll-1', title: 'Auto-loaded Poll', description: null, teamId: 'team-1', votingOpen: true },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url === '/api/teams/validate-pin') {
          return mockFetchResponse(200, { teamId: 'team-1', teamName: 'Sprint Team' });
        }
        if (url.includes('/api/polls/public')) {
          return mockFetchResponse(200, mockPolls);
        }
        return mockFetchResponse(404);
      });

      await act(async () => {
        render(<ParticipantLandingPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Auto-loaded Poll')).toBeInTheDocument();
      });

      // Should not show PIN form
      expect(screen.queryByLabelText('Enter Team PIN')).not.toBeInTheDocument();
    });
  });

  describe('Switch Team functionality', () => {
    it('shows Switch Team button when team is active', async () => {
      localStorageMock.setItem('team_pin', 'AB3X');

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url === '/api/teams/validate-pin') {
          return mockFetchResponse(200, { teamId: 'team-1', teamName: 'Sprint Team' });
        }
        if (url.includes('/api/polls/public')) {
          return mockFetchResponse(200, []);
        }
        return mockFetchResponse(404);
      });

      await act(async () => {
        render(<ParticipantLandingPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Switch Team')).toBeInTheDocument();
      });
    });

    it('clears localStorage and shows PIN form when Switch Team is clicked', async () => {
      localStorageMock.setItem('team_pin', 'AB3X');

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url === '/api/teams/validate-pin') {
          return mockFetchResponse(200, { teamId: 'team-1', teamName: 'Sprint Team' });
        }
        if (url.includes('/api/polls/public')) {
          return mockFetchResponse(200, []);
        }
        return mockFetchResponse(404);
      });

      await act(async () => {
        render(<ParticipantLandingPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Switch Team')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Switch Team'));
      });

      // Should clear localStorage
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('team_pin');

      // Should show PIN form again
      await waitFor(() => {
        expect(screen.getByLabelText('Enter Team PIN')).toBeInTheDocument();
      });
    });

    it('hides team name and polls after switching team', async () => {
      localStorageMock.setItem('team_pin', 'AB3X');

      const mockPolls = [
        { id: 'poll-1', title: 'Team Poll', description: null, teamId: 'team-1', votingOpen: true },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url === '/api/teams/validate-pin') {
          return mockFetchResponse(200, { teamId: 'team-1', teamName: 'Sprint Team' });
        }
        if (url.includes('/api/polls/public')) {
          return mockFetchResponse(200, mockPolls);
        }
        return mockFetchResponse(404);
      });

      await act(async () => {
        render(<ParticipantLandingPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Team Poll')).toBeInTheDocument();
        expect(screen.getByText('Team: Sprint Team')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Switch Team'));
      });

      // Team name and polls should be gone
      await waitFor(() => {
        expect(screen.queryByText('Team: Sprint Team')).not.toBeInTheDocument();
        expect(screen.queryByText('Team Poll')).not.toBeInTheDocument();
      });
    });

    it('allows joining a new team after switching', async () => {
      localStorageMock.setItem('team_pin', 'AB3X');

      let callCount = 0;

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/api/teams/validate-pin') {
          const body = options?.body ? JSON.parse(options.body as string) : {};
          if (body.pin === 'AB3X' || callCount === 0) {
            callCount++;
            return mockFetchResponse(200, { teamId: 'team-1', teamName: 'Sprint Team' });
          }
          // Second team validation
          return mockFetchResponse(200, { teamId: 'team-2', teamName: 'New Team' });
        }
        if (url.includes('/api/polls/public?teamId=team-2')) {
          return mockFetchResponse(200, [
            { id: 'poll-2', title: 'New Team Poll', description: null, teamId: 'team-2', votingOpen: true },
          ]);
        }
        if (url.includes('/api/polls/public')) {
          return mockFetchResponse(200, []);
        }
        return mockFetchResponse(404);
      });

      await act(async () => {
        render(<ParticipantLandingPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Switch Team')).toBeInTheDocument();
      });

      // Switch team
      await act(async () => {
        fireEvent.click(screen.getByText('Switch Team'));
      });

      // Enter new PIN
      await waitFor(() => {
        expect(screen.getByLabelText('Enter Team PIN')).toBeInTheDocument();
      });

      const input = screen.getByLabelText('Enter Team PIN');
      const submitButton = screen.getByRole('button', { name: /join team/i });

      await act(async () => {
        fireEvent.change(input, { target: { value: 'XY9Z' } });
      });

      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Team: New Team')).toBeInTheDocument();
      });
    });
  });
});
