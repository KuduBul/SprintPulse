import { describe, it, expect } from 'vitest';
import { generateRetroPdf } from '@/lib/retro/pdfExportService';

/**
 * Smoke test for real PDF generation. This actually runs @react-pdf/renderer's
 * renderToBuffer (no mocks) to catch runtime failures — the kind that surface
 * as "Export failed (500)" in the UI but pass every mocked test.
 */
describe('PDF export (real @react-pdf/renderer)', () => {
  it('generates a non-empty PDF buffer for a representative board', async () => {
    const buffer = await generateRetroPdf({
      boardTitle: 'Sprint 42 Retro',
      template: 'start_stop_continue',
      lanes: [
        {
          title: 'Start',
          icon: '🚀',
          color: '#4CAF50',
          cards: [
            { text: 'Pair programming', authorName: 'Alice', voteCount: 3 },
            { text: 'Earlier standups', authorName: 'Bob', voteCount: 1 },
          ],
        },
        { title: 'Stop', icon: '🛑', color: '#F44336', cards: [] },
      ],
      actionItems: [
        { text: 'Set up CI cache', owner: 'Carol', dueDate: '2026-07-15' },
        { text: 'Document deploy', owner: null, dueDate: null },
      ],
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    // PDF magic bytes: %PDF
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('generates a PDF when lanes carry emoji icons (font glyph coverage)', async () => {
    const buffer = await generateRetroPdf({
      boardTitle: 'Emoji Retro',
      template: '4ls',
      lanes: [
        { title: 'Liked', icon: '❤️', color: '#E91E63', cards: [{ text: 'Good vibes', authorName: 'X', voteCount: 2 }] },
        { title: 'Longed For', icon: '⭐', color: '#FFC107', cards: [] },
      ],
      actionItems: [],
    });
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });
});
