import fs from 'node:fs';

const diagnosticsPath = 'artifacts/opl-first-run-vm/app-wrapper-diagnostics.json';
const commandPreview = process.env.COMMAND_PREVIEW;
const stdoutPath = process.env.STDOUT_LOG;
const stderrPath = process.env.STDERR_LOG;
const diagnostics = JSON.parse(fs.readFileSync(diagnosticsPath, 'utf8'));
diagnostics.smoke_command = {
  command_preview_path: commandPreview,
  command_preview: fs.readFileSync(commandPreview, 'utf8').trim(),
  stdout_path: stdoutPath,
  stderr_path: stderrPath,
  exit_code: Number(process.env.SMOKE_STATUS),
};
diagnostics.phase_timings = {
  ...(diagnostics.phase_timings || {}),
  app_wrapper_smoke: {
    started_at: process.env.SMOKE_STARTED_AT,
    ended_at: process.env.SMOKE_ENDED_AT,
    duration_ms: Number(process.env.SMOKE_DURATION_MS),
    exit_code: Number(process.env.SMOKE_STATUS),
  },
};
fs.writeFileSync(diagnosticsPath, `${JSON.stringify(diagnostics, null, 2)}\n`);
