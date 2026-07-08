#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const comment = (process.env.ORCHESTRATOR_COMMENT || '').trim();
const appRoot = path.resolve(__dirname, '..');
const responsePath = path.join(appRoot, '.orchestrator_response.md');

function runCommand(command) {
  const result = spawnSync(command, {
    cwd: appRoot,
    shell: true,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function writeResponse(lines) {
  fs.writeFileSync(responsePath, lines.join('\n'), 'utf8');
}

const normalized = comment.replace(/^\s*@orchestrator\s*/i, '').trim();
const lines = [
  '### Orchestrator Command Received',
  '',
  `> ${comment}`,
  '',
];
let exitCode = 0;

if (!normalized) {
  lines.push('No command was detected after `@orchestrator`.');
  lines.push('');
  lines.push('Use commands like:');
  lines.push('- `@orchestrator run review`');
  lines.push('- `@orchestrator delegate implementation`');
  writeResponse(lines);
  process.exit(0);
}

const isReview = /\b(run|execute)\s+(review|audit|quality)\b/i.test(normalized) || /\breview\b/i.test(normalized);
const isDelegate = /\b(delegate|handoff|hand off|implement|develop|build|feature|design)\b/i.test(normalized);

if (isReview) {
  lines.push('**Action:** Running a code quality review using the `code-quality-reviewer` flow.');
  lines.push('');
  const review = runCommand('npm run quality:review');
  lines.push(`- **Review exit code:** ${review.status}`);
  lines.push('- **Artifacts:** `Polling_App/.cq_artifacts` has been generated and will be uploaded as workflow artifacts.');
  lines.push('');

  if (review.stdout) {
    lines.push('#### Review stdout');
    lines.push('```');
    lines.push(review.stdout.trim().slice(0, 8000));
    lines.push('```');
    lines.push('');
  }
  if (review.stderr) {
    lines.push('#### Review stderr');
    lines.push('```');
    lines.push(review.stderr.trim().slice(0, 8000));
    lines.push('```');
    lines.push('');
  }

  if (review.status !== 0) {
    lines.push('⚠️ The quality review completed with failures. Inspect the uploaded artifacts and logs for details.');
    exitCode = 2;
  } else {
    lines.push('✅ Quality review completed successfully.');
  }
} else if (isDelegate) {
  lines.push('**Action:** Delegating implementation planning to the `senior-react-developer` agent.');
  lines.push('');
  lines.push('This orchestrator does not write code directly. Please invoke the senior developer agent with a detailed feature request.');
  lines.push('');
  lines.push('Example: `@senior-react-developer build a new poll analytics dashboard with charts and export support.`');
} else {
  lines.push('Could not map this command to a supported orchestrator action.');
  lines.push('');
  lines.push('Supported commands include:');
  lines.push('- `@orchestrator run review`');
  lines.push('- `@orchestrator run audit`');
  lines.push('- `@orchestrator delegate implementation`');
  lines.push('- `@orchestrator plan feature`');
}

writeResponse(lines);
process.exit(exitCode);
