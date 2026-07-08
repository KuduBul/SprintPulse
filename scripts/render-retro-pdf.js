#!/usr/bin/env node
/**
 * Standalone retro PDF renderer.
 *
 * Runs OUTSIDE the Next.js/webpack module graph so that @react-pdf/renderer and
 * its reconciler use a single, consistent React instance. When the PDF document
 * is built inside a webpack-compiled module, Next's JSX runtime produces React
 * elements whose internal shape differs from what @react-pdf/reconciler expects,
 * throwing "Minified React error #31" at render time. Rendering here — via a
 * plain `node` child process — avoids that entirely.
 *
 * Protocol:
 *   - Reads PdfExportData as JSON from stdin.
 *   - Writes the resulting PDF bytes to stdout.
 *   - Exits non-zero and writes an error message to stderr on failure.
 */

const React = require('react');
const {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} = require('@react-pdf/renderer');

const h = React.createElement;

// --- Branding constants (kept in sync with lib/retro/pdfExportService.ts) ---
const BRAND_COLOR = '#1E40AF';
const BRAND_COLOR_LIGHT = '#DBEAFE';
const TEXT_PRIMARY = '#1F2937';
const TEXT_SECONDARY = '#6B7280';
const BORDER_COLOR = '#E5E7EB';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: TEXT_PRIMARY },
  header: { marginBottom: 24, borderBottomWidth: 2, borderBottomColor: BRAND_COLOR, paddingBottom: 12 },
  headerBrand: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: BRAND_COLOR, marginBottom: 4 },
  headerTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: TEXT_PRIMARY, marginBottom: 4 },
  headerDate: { fontSize: 9, color: TEXT_SECONDARY },
  laneSection: { marginBottom: 16 },
  laneHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 4, marginBottom: 8 },
  laneTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  laneIcon: { fontSize: 12, marginRight: 6, color: '#FFFFFF' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 5, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  cardText: { fontSize: 10, flex: 1, paddingRight: 8 },
  cardAuthor: { fontSize: 9, color: TEXT_SECONDARY, width: 80, paddingRight: 8 },
  cardVotes: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: BRAND_COLOR, width: 40, textAlign: 'right' },
  noCards: { fontSize: 9, color: TEXT_SECONDARY, fontStyle: 'italic', paddingHorizontal: 10, paddingVertical: 4 },
  actionItemsSection: { marginTop: 24 },
  actionItemsTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: BRAND_COLOR, marginBottom: 10, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: BRAND_COLOR },
  tableHeader: { flexDirection: 'row', backgroundColor: BRAND_COLOR_LIGHT, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 2, marginBottom: 4 },
  tableHeaderText: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: BRAND_COLOR },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  colAction: { flex: 1, paddingRight: 8 },
  colAssignee: { width: 100, paddingRight: 8 },
  colDueDate: { width: 80 },
  noActionItems: { fontSize: 9, color: TEXT_SECONDARY, fontStyle: 'italic', paddingHorizontal: 10, paddingVertical: 4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: TEXT_SECONDARY, borderTopWidth: 1, borderTopColor: BORDER_COLOR, paddingTop: 8 },
});

function formatDate(date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDueDate(dueDate) {
  if (!dueDate) return '—';
  const date = new Date(dueDate);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function resolveLaneColor(color) {
  return color || BRAND_COLOR;
}

function buildDocument(data) {
  const generationDate = formatDate(new Date());
  return h(
    Document,
    null,
    h(
      Page,
      { size: 'A4', style: styles.page },
      h(
        View,
        { style: styles.header },
        h(Text, { style: styles.headerBrand }, 'SprintPulse'),
        h(Text, { style: styles.headerTitle }, data.boardTitle),
        h(Text, { style: styles.headerDate }, `Generated on ${generationDate}`)
      ),
      ...data.lanes.map((lane, laneIndex) => {
        const sortedCards = [...lane.cards].sort((a, b) => b.voteCount - a.voteCount);
        return h(
          View,
          { key: `lane-${laneIndex}`, style: styles.laneSection },
          h(
            View,
            { style: { ...styles.laneHeader, backgroundColor: resolveLaneColor(lane.color) } },
            lane.icon ? h(Text, { style: styles.laneIcon }, lane.icon) : null,
            h(Text, { style: styles.laneTitle }, lane.title)
          ),
          sortedCards.length > 0
            ? sortedCards.map((card, cardIndex) =>
                h(
                  View,
                  { key: `card-${laneIndex}-${cardIndex}`, style: styles.cardRow },
                  h(Text, { style: styles.cardText }, card.text),
                  h(Text, { style: styles.cardAuthor }, card.authorName || '—'),
                  h(Text, { style: styles.cardVotes }, `${card.voteCount} vote${card.voteCount !== 1 ? 's' : ''}`)
                )
              )
            : h(Text, { style: styles.noCards }, 'No cards in this lane')
        );
      }),
      data.actionItems.length > 0
        ? h(
            View,
            { style: styles.actionItemsSection },
            h(Text, { style: styles.actionItemsTitle }, 'Action Items'),
            h(
              View,
              { style: styles.tableHeader },
              h(Text, { style: { ...styles.tableHeaderText, ...styles.colAction } }, 'Action'),
              h(Text, { style: { ...styles.tableHeaderText, ...styles.colAssignee } }, 'Assignee'),
              h(Text, { style: { ...styles.tableHeaderText, ...styles.colDueDate } }, 'Due Date')
            ),
            ...data.actionItems.map((item, itemIndex) =>
              h(
                View,
                { key: `action-${itemIndex}`, style: styles.tableRow },
                h(Text, { style: styles.colAction }, item.text),
                h(Text, { style: styles.colAssignee }, item.owner || '—'),
                h(Text, { style: styles.colDueDate }, formatDueDate(item.dueDate))
              )
            )
          )
        : null,
      h(Text, { style: styles.footer, fixed: true }, 'Generated by SprintPulse')
    )
  );
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  try {
    const input = await readStdin();
    const data = JSON.parse(input);
    const buffer = await renderToBuffer(buildDocument(data));
    process.stdout.write(buffer);
  } catch (err) {
    process.stderr.write(err && err.stack ? err.stack : String(err));
    process.exit(1);
  }
}

main();
