import { FULL_RUNTIME_FORBIDDEN_FRAMEWORK_CODEX_PATHS } from "../full-first-install-package.ts";

export function assertFrameworkCodexCarrierBoundary(boundary, label, studio = false) {
  if (
    boundary?.aioncore_codex_carrier_present !== !studio
    || boundary?.aioncore_codex_only_projection_present !== !studio
    || boundary?.aioncore_claude_payload_absent !== true
    || boundary?.framework_codex_payload_absent !== true
  ) {
    throw new Error(
      `${label} must prove the AionCore Codex-only projection is present and both Claude and Framework Codex payloads are absent.`,
    );
  }
  const projectionAudit = boundary.aioncore_codex_only_projection_audit;
  const expectedAbsenceChecks = [
    "managed_claude_subtree",
    "claude_executable_or_symlink",
    "anthropic_package_or_archive",
    "claude_distribution_cache_entry",
    "raw_producer_manifest",
  ];
  if (studio) {
    if (projectionAudit?.schema !== 'opl_codex_native_carrier_audit.v1' || projectionAudit.runtime_count !== 0
      || !Array.isArray(projectionAudit.runtimes) || projectionAudit.runtimes.length !== 0
      || projectionAudit.projection_present !== false || projectionAudit.claude_payload_absent !== true) {
      throw new Error(`${label} Studio native Codex carrier evidence is incomplete.`);
    }
  } else if (
    projectionAudit?.schema !== "opl_aioncore_codex_only_projection_audit.v1"
    || !Number.isSafeInteger(projectionAudit?.runtime_count)
    || projectionAudit.runtime_count < 1
    || !Array.isArray(projectionAudit?.runtimes)
    || projectionAudit.runtimes.length !== projectionAudit.runtime_count
    || projectionAudit.runtimes.some((runtime) => runtime?.projection_valid !== true)
    || !Array.isArray(projectionAudit?.required_absence_checks)
    || JSON.stringify(projectionAudit.required_absence_checks.map((check) => check?.id))
      !== JSON.stringify(expectedAbsenceChecks)
    || projectionAudit.required_absence_checks.some((check) =>
      check?.expected_match_count !== 0
      || check?.match_count !== 0
      || !Array.isArray(check?.matches)
      || check.matches.length !== 0)
  ) {
    throw new Error(`${label} AionCore Codex-only projection evidence is incomplete.`);
  }
  const forbiddenPaths = boundary.forbidden_framework_codex_paths;
  if (
    !Array.isArray(forbiddenPaths)
    || JSON.stringify(forbiddenPaths.map((entry) => entry?.path))
      !== JSON.stringify(FULL_RUNTIME_FORBIDDEN_FRAMEWORK_CODEX_PATHS)
    || forbiddenPaths.some((entry) => entry?.exists !== false)
  ) {
    throw new Error(`${label} Framework Codex absence evidence is incomplete.`);
  }
}
