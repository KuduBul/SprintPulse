'use client';

import { useState, useCallback } from 'react';
import { EmojiPicker } from './EmojiPicker';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface ColumnConfig {
  title: string;
  icon: string;
  color: string;
}

interface BackgroundConfig {
  file: File;
  opacity: number;
  displayMode: 'cover' | 'contain';
}

interface CustomTemplateBuilderProps {
  onComplete: (config: {
    columns: Array<{ title: string; icon: string; color: string }>;
    background?: { file: File; opacity: number; displayMode: 'cover' | 'contain' };
  }) => void;
  onCancel: () => void;
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const PRESET_COLORS = [
  '#4CAF50',
  '#F44336',
  '#2196F3',
  '#FF9800',
  '#9C27B0',
  '#FFEB3B',
  '#795548',
  '#03A9F4',
];

const MAX_COLUMNS = 8;

// --------------------------------------------------------------------------
// CustomTemplateBuilder
// --------------------------------------------------------------------------

/**
 * Builder UI for creating a custom retro board template. Allows adding
 * columns with title, emoji icon, and color. Also supports optional
 * background image configuration.
 */
export function CustomTemplateBuilder({ onComplete, onCancel }: CustomTemplateBuilderProps) {
  const [columns, setColumns] = useState<ColumnConfig[]>([
    { title: '', icon: '', color: PRESET_COLORS[0] },
  ]);
  const [emojiPickerIndex, setEmojiPickerIndex] = useState<number | null>(null);
  const [customColorIndex, setCustomColorIndex] = useState<number | null>(null);
  const [customColorValue, setCustomColorValue] = useState('');

  // Background state
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundOpacity, setBackgroundOpacity] = useState(80);
  const [backgroundDisplayMode, setBackgroundDisplayMode] = useState<'cover' | 'contain'>('cover');

  // Validation: at least 1 column with a non-empty title
  const isValid = columns.some((col) => col.title.trim().length > 0);

  // ---- Column handlers ----
  const updateColumn = useCallback((index: number, field: keyof ColumnConfig, value: string) => {
    setColumns((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const addColumn = useCallback(() => {
    setColumns((prev) => {
      if (prev.length >= MAX_COLUMNS) return prev;
      const nextColor = PRESET_COLORS[prev.length % PRESET_COLORS.length];
      return [...prev, { title: '', icon: '', color: nextColor }];
    });
  }, []);

  const removeColumn = useCallback((index: number) => {
    setColumns((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
    // Close any open pickers for this column
    setEmojiPickerIndex(null);
    setCustomColorIndex(null);
  }, []);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      if (emojiPickerIndex !== null) {
        updateColumn(emojiPickerIndex, 'icon', emoji);
        setEmojiPickerIndex(null);
      }
    },
    [emojiPickerIndex, updateColumn]
  );

  const handleCustomColorApply = useCallback(
    (index: number) => {
      // Validate hex color
      const hex = customColorValue.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
        updateColumn(index, 'color', hex);
      }
      setCustomColorIndex(null);
      setCustomColorValue('');
    },
    [customColorValue, updateColumn]
  );

  // ---- Submit ----
  const handleCreate = () => {
    if (!isValid) return;

    const background: BackgroundConfig | undefined = backgroundFile
      ? { file: backgroundFile, opacity: backgroundOpacity, displayMode: backgroundDisplayMode }
      : undefined;

    onComplete({
      columns: columns.map((col) => ({
        title: col.title.trim(),
        icon: col.icon,
        color: col.color,
      })),
      background,
    });
  };

  return (
    <div
      style={{
        padding: 'var(--space-5)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--color-bg-primary)',
        fontFamily: 'var(--font-family-sans)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-5)',
      }}
    >
      {/* Header */}
      <div>
        <h3
          style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
            margin: 0,
          }}
        >
          Create Custom Template
        </h3>
        <p
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            margin: 'var(--space-1) 0 0 0',
          }}
        >
          Configure your columns, then optionally add a background image.
        </p>
      </div>

      {/* Columns section */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        <label
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text-primary)',
          }}
        >
          Columns ({columns.length}/{MAX_COLUMNS})
        </label>

        {columns.map((col, index) => (
          <ColumnRow
            key={index}
            index={index}
            column={col}
            canRemove={columns.length > 1}
            isEmojiPickerOpen={emojiPickerIndex === index}
            isCustomColorOpen={customColorIndex === index}
            customColorValue={customColorIndex === index ? customColorValue : ''}
            onTitleChange={(value) => updateColumn(index, 'title', value)}
            onColorSelect={(color) => updateColumn(index, 'color', color)}
            onEmojiPickerToggle={() =>
              setEmojiPickerIndex(emojiPickerIndex === index ? null : index)
            }
            onEmojiSelect={handleEmojiSelect}
            onEmojiPickerClose={() => setEmojiPickerIndex(null)}
            onCustomColorToggle={() => {
              if (customColorIndex === index) {
                setCustomColorIndex(null);
                setCustomColorValue('');
              } else {
                setCustomColorIndex(index);
                setCustomColorValue(col.color);
              }
            }}
            onCustomColorChange={(val) => setCustomColorValue(val)}
            onCustomColorApply={() => handleCustomColorApply(index)}
            onRemove={() => removeColumn(index)}
          />
        ))}

        {/* Add Column button */}
        <button
          type="button"
          onClick={addColumn}
          disabled={columns.length >= MAX_COLUMNS}
          style={{
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)',
            border: '1px dashed var(--color-border-strong)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'transparent',
            color:
              columns.length >= MAX_COLUMNS
                ? 'var(--color-text-muted)'
                : 'var(--color-primary-700)',
            cursor: columns.length >= MAX_COLUMNS ? 'not-allowed' : 'pointer',
            transition: 'background-color var(--transition-fast)',
            minHeight: '44px',
          }}
          aria-label="Add column"
        >
          + Add Column
        </button>
      </div>

      {/* Background section */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          padding: 'var(--space-4)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-bg-secondary)',
        }}
      >
        <label
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text-primary)',
          }}
        >
          Background Image (optional)
        </label>

        {/* File upload */}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            setBackgroundFile(file);
          }}
          aria-label="Upload background image"
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
          }}
        />

        {backgroundFile && (
          <>
            {/* Opacity slider */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
              }}
            >
              <label
                htmlFor="bg-opacity"
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                  minWidth: '60px',
                }}
              >
                Opacity
              </label>
              <input
                id="bg-opacity"
                type="range"
                min={0}
                max={100}
                value={backgroundOpacity}
                onChange={(e) => setBackgroundOpacity(parseInt(e.target.value, 10))}
                style={{ flex: 1 }}
                aria-label={`Opacity: ${backgroundOpacity}%`}
              />
              <span
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                  minWidth: '36px',
                  textAlign: 'right',
                }}
              >
                {backgroundOpacity}%
              </span>
            </div>

            {/* Display mode */}
            <fieldset
              style={{
                border: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
              }}
            >
              <legend
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Display Mode
              </legend>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  fontSize: 'var(--font-size-sm)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="bg-display-mode"
                  value="cover"
                  checked={backgroundDisplayMode === 'cover'}
                  onChange={() => setBackgroundDisplayMode('cover')}
                />
                Cover
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  fontSize: 'var(--font-size-sm)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="bg-display-mode"
                  value="contain"
                  checked={backgroundDisplayMode === 'contain'}
                  onChange={() => setBackgroundDisplayMode('contain')}
                />
                Contain
              </label>
            </fieldset>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          justifyContent: 'flex-end',
          paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--color-border-default)',
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: 'var(--space-3) var(--space-5)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            minHeight: '44px',
            transition: 'background-color var(--transition-fast)',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={!isValid}
          style={{
            padding: 'var(--space-3) var(--space-5)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            backgroundColor: isValid ? 'var(--color-primary-600)' : 'var(--color-neutral-300)',
            color: 'var(--color-text-inverse)',
            cursor: isValid ? 'pointer' : 'not-allowed',
            minHeight: '44px',
            transition: 'background-color var(--transition-fast)',
          }}
          aria-label="Create board"
        >
          Create Board
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Column Row sub-component
// --------------------------------------------------------------------------

interface ColumnRowProps {
  index: number;
  column: ColumnConfig;
  canRemove: boolean;
  isEmojiPickerOpen: boolean;
  isCustomColorOpen: boolean;
  customColorValue: string;
  onTitleChange: (value: string) => void;
  onColorSelect: (color: string) => void;
  onEmojiPickerToggle: () => void;
  onEmojiSelect: (emoji: string) => void;
  onEmojiPickerClose: () => void;
  onCustomColorToggle: () => void;
  onCustomColorChange: (value: string) => void;
  onCustomColorApply: () => void;
  onRemove: () => void;
}

function ColumnRow({
  index,
  column,
  canRemove,
  isEmojiPickerOpen,
  isCustomColorOpen,
  customColorValue,
  onTitleChange,
  onColorSelect,
  onEmojiPickerToggle,
  onEmojiSelect,
  onEmojiPickerClose,
  onCustomColorToggle,
  onCustomColorChange,
  onCustomColorApply,
  onRemove,
}: ColumnRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-2)',
        padding: 'var(--space-3)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--color-bg-secondary)',
      }}
    >
      {/* Title input */}
      <div style={{ flex: 1 }}>
        <input
          type="text"
          value={column.title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={`Column ${index + 1} title`}
          maxLength={100}
          aria-label={`Column ${index + 1} title`}
          style={{
            width: '100%',
            padding: 'var(--space-2) var(--space-3)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-family-sans)',
            outline: 'none',
            backgroundColor: 'var(--color-bg-primary)',
          }}
        />
      </div>

      {/* Emoji picker button */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={onEmojiPickerToggle}
          aria-label={`Pick emoji for column ${index + 1}${column.icon ? `: ${column.icon}` : ''}`}
          aria-expanded={isEmojiPickerOpen}
          style={{
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--color-border-strong)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-bg-primary)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-lg)',
            transition: 'border-color var(--transition-fast)',
          }}
        >
          {column.icon || '😀'}
        </button>
        {isEmojiPickerOpen && (
          <EmojiPicker onSelect={onEmojiSelect} onClose={onEmojiPickerClose} />
        )}
      </div>

      {/* Color selector */}
      <div style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            gap: '4px',
            flexWrap: 'wrap',
            maxWidth: '140px',
          }}
        >
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onColorSelect(color)}
              aria-label={`Color ${color}`}
              aria-pressed={column.color === color}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: 'var(--radius-sm)',
                border:
                  column.color === color
                    ? '2px solid var(--color-text-primary)'
                    : '2px solid transparent',
                backgroundColor: color,
                cursor: 'pointer',
                transition: 'border-color var(--transition-fast)',
                outline: 'none',
              }}
            />
          ))}
          {/* Custom hex button */}
          <button
            type="button"
            onClick={onCustomColorToggle}
            aria-label="Custom color"
            aria-expanded={isCustomColorOpen}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: 'var(--radius-sm)',
              border: '2px dashed var(--color-border-strong)',
              backgroundColor: 'var(--color-bg-primary)',
              cursor: 'pointer',
              fontSize: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-muted)',
            }}
          >
            #
          </button>
        </div>

        {/* Custom hex input */}
        {isCustomColorOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 'var(--space-1)',
              display: 'flex',
              gap: 'var(--space-1)',
              zIndex: 10,
              backgroundColor: 'var(--color-bg-primary)',
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-default)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <input
              type="text"
              value={customColorValue}
              onChange={(e) => onCustomColorChange(e.target.value)}
              placeholder="#FF5733"
              maxLength={7}
              aria-label="Custom hex color"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onCustomColorApply();
                }
              }}
              style={{
                width: '80px',
                padding: 'var(--space-1) var(--space-2)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-xs)',
                fontFamily: 'var(--font-family-mono)',
              }}
            />
            <button
              type="button"
              onClick={onCustomColorApply}
              style={{
                padding: 'var(--space-1) var(--space-2)',
                fontSize: 'var(--font-size-xs)',
                border: '1px solid var(--color-primary-600)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-primary-600)',
                color: 'var(--color-text-inverse)',
                cursor: 'pointer',
              }}
            >
              OK
            </button>
          </div>
        )}
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={`Remove column ${index + 1}`}
        style={{
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'transparent',
          color: canRemove ? 'var(--color-error-600)' : 'var(--color-text-muted)',
          cursor: canRemove ? 'pointer' : 'not-allowed',
          fontSize: 'var(--font-size-sm)',
          transition: 'color var(--transition-fast)',
        }}
      >
        ✕
      </button>
    </div>
  );
}
