'use client';

import { RETRO_ENABLED } from '@/lib/featureFlags';

export type ActivityType = 'pulse' | 'retro';

export type RetroTemplate = 'start_stop_continue' | '4ls' | 'mad_sad_glad' | 'custom';

export interface RetroConfig {
  template: RetroTemplate;
  customLanes: string[];
  votesPerUser: number;
}

interface ActivityTypeSelectorProps {
  activityType: ActivityType;
  onActivityTypeChange: (type: ActivityType) => void;
  retroConfig: RetroConfig;
  onRetroConfigChange: (config: RetroConfig) => void;
}

const TEMPLATE_OPTIONS: { value: RetroTemplate; label: string }[] = [
  { value: 'start_stop_continue', label: 'Start / Stop / Continue' },
  { value: '4ls', label: '4Ls (Liked, Learned, Lacked, Longed For)' },
  { value: 'mad_sad_glad', label: 'Mad / Sad / Glad' },
  { value: 'custom', label: 'Custom' },
];

/**
 * Activity type selector that allows the facilitator to choose between
 * Pulse (existing poll) and Retro (new board). Only renders when the
 * RETRO_ENABLED feature flag is true.
 *
 * When the flag is false or unset, this component returns null and the
 * existing pulse-only flow remains unchanged (Requirement 1.1).
 */
export function ActivityTypeSelector({
  activityType,
  onActivityTypeChange,
  retroConfig,
  onRetroConfigChange,
}: ActivityTypeSelectorProps) {
  if (!RETRO_ENABLED) {
    return null;
  }

  function handleCustomLaneChange(index: number, value: string) {
    const updated = [...retroConfig.customLanes];
    updated[index] = value;
    onRetroConfigChange({ ...retroConfig, customLanes: updated });
  }

  function addCustomLane() {
    if (retroConfig.customLanes.length >= 8) return;
    onRetroConfigChange({
      ...retroConfig,
      customLanes: [...retroConfig.customLanes, ''],
    });
  }

  function removeCustomLane(index: number) {
    if (retroConfig.customLanes.length <= 1) return;
    const updated = retroConfig.customLanes.filter((_, i) => i !== index);
    onRetroConfigChange({ ...retroConfig, customLanes: updated });
  }

  return (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      {/* Activity type toggle */}
      <fieldset
        style={{
          border: 'none',
          padding: 0,
          margin: 0,
          marginBottom: 'var(--space-4)',
        }}
      >
        <legend
          style={{
            display: 'block',
            fontWeight: 'var(--font-weight-medium)',
            marginBottom: 'var(--space-2)',
          }}
        >
          Activity Type
        </legend>
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-3)',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-3) var(--space-4)',
              border: `2px solid ${activityType === 'pulse' ? 'var(--color-primary-700)' : 'var(--color-border-strong)'}`,
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              backgroundColor: activityType === 'pulse' ? 'var(--color-primary-50, rgba(59, 130, 246, 0.05))' : 'transparent',
            }}
          >
            <input
              type="radio"
              name="activity-type"
              value="pulse"
              checked={activityType === 'pulse'}
              onChange={() => onActivityTypeChange('pulse')}
              style={{ margin: 0 }}
            />
            <span style={{ fontWeight: 'var(--font-weight-medium)' }}>Pulse</span>
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-3) var(--space-4)',
              border: `2px solid ${activityType === 'retro' ? 'var(--color-primary-700)' : 'var(--color-border-strong)'}`,
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              backgroundColor: activityType === 'retro' ? 'var(--color-primary-50, rgba(59, 130, 246, 0.05))' : 'transparent',
            }}
          >
            <input
              type="radio"
              name="activity-type"
              value="retro"
              checked={activityType === 'retro'}
              onChange={() => onActivityTypeChange('retro')}
              style={{ margin: 0 }}
            />
            <span style={{ fontWeight: 'var(--font-weight-medium)' }}>Retro</span>
          </label>
        </div>
      </fieldset>

      {/* Retro configuration fields — only shown when "Retro" is selected */}
      {activityType === 'retro' && (
        <div
          style={{
            padding: 'var(--space-4)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-bg-secondary, var(--color-bg-primary))',
          }}
        >
          {/* Template selector */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label
              htmlFor="retro-template"
              style={{
                display: 'block',
                fontWeight: 'var(--font-weight-medium)',
                marginBottom: 'var(--space-2)',
              }}
            >
              Template <span aria-hidden="true">*</span>
            </label>
            <select
              id="retro-template"
              value={retroConfig.template}
              onChange={(e) =>
                onRetroConfigChange({
                  ...retroConfig,
                  template: e.target.value as RetroTemplate,
                })
              }
              aria-required="true"
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-base)',
                backgroundColor: 'var(--color-bg-primary)',
              }}
            >
              {TEMPLATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom lanes — only visible when template is "custom" */}
          {retroConfig.template === 'custom' && (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label
                style={{
                  display: 'block',
                  fontWeight: 'var(--font-weight-medium)',
                  marginBottom: 'var(--space-2)',
                }}
              >
                Lanes (1–8) <span aria-hidden="true">*</span>
              </label>
              {retroConfig.customLanes.map((lane, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    gap: 'var(--space-2)',
                    marginBottom: 'var(--space-2)',
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="text"
                    value={lane}
                    onChange={(e) => handleCustomLaneChange(index, e.target.value)}
                    placeholder={`Lane ${index + 1} title`}
                    maxLength={100}
                    aria-label={`Lane ${index + 1} title`}
                    style={{
                      flex: 1,
                      padding: 'var(--space-2) var(--space-3)',
                      border: '1px solid var(--color-border-strong)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  />
                  {retroConfig.customLanes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCustomLane(index)}
                      aria-label={`Remove lane ${index + 1}`}
                      style={{
                        padding: 'var(--space-2)',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-error-600)',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {retroConfig.customLanes.length < 8 && (
                <button
                  type="button"
                  onClick={addCustomLane}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-primary-700)',
                  }}
                >
                  + Add Lane
                </button>
              )}
            </div>
          )}

          {/* Votes per user */}
          <div>
            <label
              htmlFor="retro-votes-per-user"
              style={{
                display: 'block',
                fontWeight: 'var(--font-weight-medium)',
                marginBottom: 'var(--space-2)',
              }}
            >
              Votes Per User
            </label>
            <input
              id="retro-votes-per-user"
              type="number"
              min={1}
              max={20}
              value={retroConfig.votesPerUser}
              onChange={(e) =>
                onRetroConfigChange({
                  ...retroConfig,
                  votesPerUser: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 3)),
                })
              }
              style={{
                width: '80px',
                padding: 'var(--space-2) var(--space-3)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-base)',
              }}
            />
            <p
              style={{
                color: 'var(--color-text-muted)',
                fontSize: 'var(--font-size-xs)',
                marginTop: 'var(--space-1)',
                marginBottom: 0,
              }}
            >
              Maximum votes each participant can cast (default: 3).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
