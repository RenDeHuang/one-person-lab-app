import {
  assert,
  fs,
  path,
  test,
  appRoot,
} from './helpers.ts';
import { validateFirstRunMatrix } from '../../../scripts/validate-active-shell/first-run-matrix-validator.ts';
import { releaseBoundaryChecks } from '../../../scripts/validate-release-boundary/release-checks.ts';

const readJson = (relativePath: string) => JSON.parse(
  fs.readFileSync(path.join(appRoot, relativePath), 'utf8'),
);
const scenarioIds = [
  'beginner_simplified_first_run_clean_machine',
  'full_first_install_clean_machine',
  'standard_dmg_clean_vm_smoke',
  'full_dmg_clean_vm_smoke',
  'homebrew_standard_cask_clean_vm_smoke',
  'standard_app_managed_bootstrap',
  'macos_clt_system_installer',
  'updater_standard_channel',
  'ecosystem_modules_app_cli_managed',
];
const releaseGateScenarioIds = [
  'standard_dmg_clean_vm_smoke',
  'full_dmg_clean_vm_smoke',
  'homebrew_standard_cask_clean_vm_smoke',
];
const requireReleaseBoundaryCheck = (id: string) => {
  const check = releaseBoundaryChecks.find((entry) => entry.id === id);
  assert.ok(check, id);
  return check;
};

test('first-run matrix delegates policy shape to the active-shell validator', () => {
  const matrix = readJson('contracts/app-first-run-test-matrix.json');
  const adapter = readJson('contracts/app-shell-adapter.json');
  const scenarioById = new Map(matrix.scenarios.map((scenario) => [scenario.id, scenario]));

  assert.doesNotThrow(() => validateFirstRunMatrix(matrix, adapter));
  assert.ok(matrix.scenarios.every((scenario) => !('aliases' in scenario)));
  for (const id of scenarioIds) {
    assert.ok(scenarioById.has(id), id);
  }
  for (const id of releaseGateScenarioIds) {
    assert.equal(scenarioById.get(id).release_gate, true, id);
  }
});

test('one-shot App installer boundary is enforced by release-boundary checks', () => {
  const oneShot = requireReleaseBoundaryCheck('one_shot_unsigned_local_authorization');
  const stable = requireReleaseBoundaryCheck('short_stable_macos_installer');

  assert.equal(oneShot.file, 'install.sh');
  assert.ok(oneShot.required.includes('--stable-macos-install'));
  assert.ok(oneShot.required.includes('--authorize-local-app-only'));
  assert.equal(stable.file, 'install-stable.sh');
  assert.ok(stable.required.some((entry) => entry.includes('install.sh')));
  assert.ok(stable.required.some((entry) => entry.includes('--stable-macos-install')));
  assert.equal(fs.existsSync(path.join(appRoot, 'install-free.sh')), false);
});
