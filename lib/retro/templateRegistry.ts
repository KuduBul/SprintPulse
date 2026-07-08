/**
 * Template Registry — defines the built-in retro board templates with icons
 * and colors for visual identity. Replaces the flat TEMPLATE_LANES map in
 * retroService with a richer data structure that includes emoji icons and
 * CSS colors per column.
 *
 * Templates are static config stored in code (not DB). User-saved templates
 * will be handled in Phase 2C.
 */

/**
 * A single column definition within a template, including its visual identity.
 */
export interface TemplateColumnDef {
  title: string;
  icon: string; // emoji character, e.g. "🚀"
  color: string; // CSS hex color, e.g. "#4CAF50"
}

/**
 * A complete template definition with metadata and ordered column definitions.
 */
export interface RetroTemplateDefinition {
  id: string; // e.g. "start_stop_continue"
  name: string; // Human-readable display name
  columns: TemplateColumnDef[]; // Ordered column definitions
}

/**
 * All built-in templates available for retro board creation.
 * Each template includes column definitions with title, icon, and color.
 */
export const BUILT_IN_TEMPLATES: RetroTemplateDefinition[] = [
  {
    id: 'start_stop_continue',
    name: 'Start / Stop / Continue',
    columns: [
      { title: 'Start', icon: '🚀', color: '#4CAF50' },
      { title: 'Stop', icon: '🛑', color: '#F44336' },
      { title: 'Continue', icon: '✅', color: '#2196F3' },
    ],
  },
  {
    id: '4ls',
    name: '4Ls',
    columns: [
      { title: 'Liked', icon: '❤️', color: '#E91E63' },
      { title: 'Learned', icon: '📚', color: '#9C27B0' },
      { title: 'Lacked', icon: '🕳️', color: '#FF9800' },
      { title: 'Longed For', icon: '⭐', color: '#FFC107' },
    ],
  },
  {
    id: 'mad_sad_glad',
    name: 'Mad / Sad / Glad',
    columns: [
      { title: 'Mad', icon: '😡', color: '#F44336' },
      { title: 'Sad', icon: '😢', color: '#3F51B5' },
      { title: 'Glad', icon: '😊', color: '#4CAF50' },
    ],
  },
  {
    id: 'sailboat',
    name: 'Sailboat',
    columns: [
      { title: 'Wind (propelling us)', icon: '💨', color: '#03A9F4' },
      { title: 'Anchor (holding us back)', icon: '⚓', color: '#795548' },
      { title: 'Rocks (risks ahead)', icon: '🪨', color: '#9E9E9E' },
      { title: 'Island (our goal)', icon: '🏝️', color: '#FFEB3B' },
    ],
  },
];

/**
 * Retrieves a template definition by its ID.
 * Returns undefined if no template matches the given ID.
 */
export function getTemplateById(id: string): RetroTemplateDefinition | undefined {
  return BUILT_IN_TEMPLATES.find((template) => template.id === id);
}

/**
 * Returns all available built-in templates.
 */
export function getAllTemplates(): RetroTemplateDefinition[] {
  return BUILT_IN_TEMPLATES;
}
