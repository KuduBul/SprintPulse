/**
 * PDF Export Service — generates a styled PDF report of a retro board.
 *
 * IMPORTANT: The actual rendering runs in a standalone Node child process
 * (scripts/render-retro-pdf.js), NOT inline here. @react-pdf/renderer breaks
 * when its document is constructed inside a Next.js/webpack-compiled module:
 * Next's JSX runtime produces React elements whose internal shape differs from
 * what @react-pdf/reconciler expects, throwing "Minified React error #31" at
 * render time. Running the renderer as a plain `node` subprocess guarantees a
 * single, consistent React instance and sidesteps webpack entirely.
 *
 * This module keeps the same public API (`generateRetroPdf`) and data shape so
 * callers are unaffected.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */
import { spawn } from 'child_process';
import path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PdfExportData {
  boardTitle: string;
  template: string;
  lanes: Array<{
    title: string;
    icon: string | null;
    color: string | null;
    cards: Array<{ text: string; authorName: string; voteCount: number }>;
  }>;
  actionItems: Array<{ text: string; owner: string | null; dueDate: string | null }>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const RENDERER_SCRIPT = path.join(process.cwd(), 'scripts', 'render-retro-pdf.js');

/**
 * Generates a styled PDF buffer from the provided board export data.
 *
 * Delegates rendering to a standalone Node process to avoid the webpack/React
 * element-shape mismatch described in the module header. The child receives the
 * export data as JSON on stdin and returns the PDF bytes on stdout.
 *
 * @param data The structured board data to render into the PDF
 * @returns A Buffer containing the PDF document bytes
 */
export async function generateRetroPdf(data: PdfExportData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn(process.execPath, [RENDERER_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    child.on('error', (err) => {
      reject(new Error(`Failed to start PDF renderer: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdoutChunks));
      } else {
        const details = Buffer.concat(stderrChunks).toString('utf8').trim();
        reject(new Error(`PDF renderer exited with code ${code}: ${details}`));
      }
    });

    // Send the data and close stdin.
    child.stdin.write(JSON.stringify(data));
    child.stdin.end();
  });
}
