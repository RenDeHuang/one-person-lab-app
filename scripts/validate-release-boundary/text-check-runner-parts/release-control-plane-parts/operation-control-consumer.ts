import { parseWorkflow, reportFailure } from '../report.ts';

export function validateStableOperationControlArtifactConsumer(appRoot: string): number {
  const id = 'stable_operation_control_artifact_consumer';
  const parsed = parseWorkflow(appRoot, '.github/workflows/_release-bundle.yml', id);
  if (!parsed) return 1;
  const { text } = parsed;
  let failures = 0;
  for (const required of [
    'stable_operation_control_artifact:',
    'stable_operation_control_digest:',
    'Download protected Stable operation control',
    'Consume one protected Stable operation control before cold work',
    'stable-operation-control.ts consume',
    'opl-stable-operation-consumption-${{ github.run_id }}',
    'Require one matching consumed Stable operation control',
    '--input "$consumption"',
  ]) {
    if (!text.includes(required)) {
      failures += reportFailure(id, `Stable Bundle is missing durable control consumption ${required}`);
    }
  }
  if (
    text.includes('validate-release-source-gate.ts')
    || text.includes('release-dispatch-guard.ts preflight')
    || text.includes('release-source-qualification.yml')
  ) {
    failures += reportFailure(
      id,
      'Stable Bundle must consume the protected control artifact and must not rerun source-gate, pre-nonce guard, or source qualification.',
    );
  }
  return failures;
}
