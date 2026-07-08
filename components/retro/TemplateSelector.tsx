'use client';

import { getAllTemplates, RetroTemplateDefinition } from '@/lib/retro/templateRegistry';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface TemplateSelectorProps {
  selectedTemplate: string | null;
  onSelect: (id: string) => void;
}

// --------------------------------------------------------------------------
// TemplateSelector
// --------------------------------------------------------------------------

/**
 * Visual template selector displaying icon-enriched cards for each built-in
 * retro template plus a "Create Your Own" option. Replaces the plain dropdown
 * with an engaging card-based selection UI.
 */
export function TemplateSelector({ selectedTemplate, onSelect }: TemplateSelectorProps) {
  const templates = getAllTemplates();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 'var(--space-3)',
        width: '100%',
      }}
      role="radiogroup"
      aria-label="Select a retro board template"
    >
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          isSelected={selectedTemplate === template.id}
          onSelect={onSelect}
        />
      ))}

      {/* Create Your Own card */}
      <button
        type="button"
        onClick={() => onSelect('custom')}
        aria-checked={selectedTemplate === 'custom'}
        role="radio"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-4)',
          border: selectedTemplate === 'custom'
            ? '2px solid var(--color-primary-600)'
            : '2px dashed var(--color-border-strong)',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: selectedTemplate === 'custom'
            ? 'var(--color-primary-50, rgba(59, 130, 246, 0.05))'
            : 'var(--color-bg-primary)',
          cursor: 'pointer',
          transition: 'border-color var(--transition-fast), background-color var(--transition-fast), box-shadow var(--transition-fast)',
          boxShadow: selectedTemplate === 'custom' ? 'var(--shadow-md)' : 'var(--shadow-sm)',
          minHeight: '120px',
          fontFamily: 'var(--font-family-sans)',
          outline: 'none',
        }}
        onFocus={(e) => {
          if (selectedTemplate !== 'custom') {
            e.currentTarget.style.borderColor = 'var(--color-primary-400)';
          }
        }}
        onBlur={(e) => {
          if (selectedTemplate !== 'custom') {
            e.currentTarget.style.borderColor = 'var(--color-border-strong)';
          }
        }}
      >
        <span
          style={{
            fontSize: 'var(--font-size-2xl)',
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          ➕
        </span>
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-text-primary)',
            textAlign: 'center',
          }}
        >
          Create Your Own
        </span>
      </button>
    </div>
  );
}

// --------------------------------------------------------------------------
// Template Card
// --------------------------------------------------------------------------

interface TemplateCardProps {
  template: RetroTemplateDefinition;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function TemplateCard({ template, isSelected, onSelect }: TemplateCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(template.id)}
      aria-checked={isSelected}
      role="radio"
      aria-label={`Template: ${template.name}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-4)',
        border: isSelected
          ? '2px solid var(--color-primary-600)'
          : '2px solid var(--color-border-default)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: isSelected
          ? 'var(--color-primary-50, rgba(59, 130, 246, 0.05))'
          : 'var(--color-bg-primary)',
        cursor: 'pointer',
        transition: 'border-color var(--transition-fast), background-color var(--transition-fast), box-shadow var(--transition-fast)',
        boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        minHeight: '120px',
        fontFamily: 'var(--font-family-sans)',
        outline: 'none',
      }}
      onFocus={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'var(--color-primary-400)';
        }
      }}
      onBlur={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'var(--color-border-default)';
        }
      }}
    >
      {/* Column icons row */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          fontSize: 'var(--font-size-xl)',
          lineHeight: 1,
        }}
        aria-hidden="true"
      >
        {template.columns.map((col, idx) => (
          <span key={idx} title={col.title}>
            {col.icon}
          </span>
        ))}
      </div>

      {/* Template name */}
      <span
        style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-medium)',
          color: 'var(--color-text-primary)',
          textAlign: 'center',
          lineHeight: 'var(--line-height-tight)',
        }}
      >
        {template.name}
      </span>
    </button>
  );
}
