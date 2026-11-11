import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock the feature flag module so we can toggle it per test.
const mockRetroEnabled = vi.fn(() => true);
vi.mock('@/lib/featureFlags', () => ({
  get RETRO_ENABLED() {
    return mockRetroEnabled();
  },
  isRetroEnabled: () => mockRetroEnabled(),
}));

import {
  ActivityTypeSelector,
  ActivityType,
  RetroConfig,
} from '@/components/admin/ActivityTypeSelector';

describe('ActivityTypeSelector', () => {
  const defaultRetroConfig: RetroConfig = {
    template: 'start_stop_continue',
    customLanes: [''],
    votesPerUser: 3,
  };

  let activityType: ActivityType;
  let retroConfig: RetroConfig;
  // Typed as the component's callback signatures. vitest 4's Mock type no
  // longer flows the inline arg types to the assignment target, so annotate
  // explicitly to satisfy the component props.
  let onActivityTypeChange: (type: ActivityType) => void;
  let onRetroConfigChange: (config: RetroConfig) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRetroEnabled.mockReturnValue(true);
    activityType = 'pulse';
    retroConfig = { ...defaultRetroConfig, customLanes: [''] };
    onActivityTypeChange = vi.fn((type: ActivityType) => { activityType = type; });
    onRetroConfigChange = vi.fn((config: RetroConfig) => { retroConfig = config; });
  });

  function renderSelector(overrides: Partial<{
    activityType: ActivityType;
    retroConfig: RetroConfig;
  }> = {}) {
    return render(
      <ActivityTypeSelector
        activityType={overrides.activityType ?? activityType}
        onActivityTypeChange={onActivityTypeChange}
        retroConfig={overrides.retroConfig ?? retroConfig}
        onRetroConfigChange={onRetroConfigChange}
      />
    );
  }

  describe('when feature flag is OFF', () => {
    it('renders nothing (Requirement 1.1)', () => {
      mockRetroEnabled.mockReturnValue(false);
      const { container } = renderSelector();
      expect(container.innerHTML).toBe('');
    });
  });

  describe('when feature flag is ON', () => {
    it('renders the Pulse/Retro radio options (Requirement 2.1)', () => {
      renderSelector();
      expect(screen.getByLabelText(/pulse/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/retro/i)).toBeInTheDocument();
    });

    it('defaults to Pulse selected', () => {
      renderSelector();
      const pulseRadio = screen.getByLabelText(/pulse/i) as HTMLInputElement;
      expect(pulseRadio.checked).toBe(true);
    });

    it('calls onActivityTypeChange when Retro is selected (Requirement 2.1)', () => {
      renderSelector();
      fireEvent.click(screen.getByLabelText(/retro/i));
      expect(onActivityTypeChange).toHaveBeenCalledWith('retro');
    });

    it('does NOT show retro config when Pulse is selected (Requirement 2.2)', () => {
      renderSelector({ activityType: 'pulse' });
      expect(screen.queryByLabelText(/template/i)).not.toBeInTheDocument();
    });

    it('shows template selector when Retro is selected (Requirement 2.3)', () => {
      renderSelector({ activityType: 'retro' });
      expect(screen.getByLabelText(/template/i)).toBeInTheDocument();
    });

    it('shows votes per user field when Retro is selected', () => {
      renderSelector({ activityType: 'retro' });
      expect(screen.getByLabelText(/votes per user/i)).toBeInTheDocument();
    });

    it('shows custom lanes when template is custom', () => {
      renderSelector({
        activityType: 'retro',
        retroConfig: { ...defaultRetroConfig, template: 'custom', customLanes: ['Lane A'] },
      });
      expect(screen.getByLabelText(/lane 1 title/i)).toBeInTheDocument();
    });

    it('does NOT show custom lanes for built-in templates', () => {
      renderSelector({
        activityType: 'retro',
        retroConfig: { ...defaultRetroConfig, template: 'start_stop_continue' },
      });
      expect(screen.queryByLabelText(/lane 1 title/i)).not.toBeInTheDocument();
    });

    it('allows adding lanes up to 8', () => {
      const lanes = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      renderSelector({
        activityType: 'retro',
        retroConfig: { ...defaultRetroConfig, template: 'custom', customLanes: lanes },
      });
      // Should show the "Add Lane" button since we have 7 lanes (< 8)
      expect(screen.getByText('+ Add Lane')).toBeInTheDocument();
    });

    it('hides Add Lane button at 8 lanes', () => {
      const lanes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      renderSelector({
        activityType: 'retro',
        retroConfig: { ...defaultRetroConfig, template: 'custom', customLanes: lanes },
      });
      expect(screen.queryByText('+ Add Lane')).not.toBeInTheDocument();
    });
  });
});
