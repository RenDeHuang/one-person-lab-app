import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateAppGuiProductContract } from '../../scripts/validate-active-shell/gui-product-contract-validator.ts';
import { validatePageStateMatrix } from '../../scripts/validate-active-shell/page-state-matrix-validator.ts';

const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(relativePath, 'utf8'));

const validateGuiContract = (guiContract: any) => validateAppGuiProductContract(
  guiContract,
  readJson('contracts/app-release-channel.json'),
  readJson('contracts/app-install-exposure-policy.json'),
);

const validatePageState = (matrix: any, guiContract = readJson('contracts/app-gui-product-contract.json')) =>
  validatePageStateMatrix(
    matrix,
    readJson('contracts/app-shell-adapter.json'),
    guiContract,
  );

test('Runtime cockpit product contract and page-state acceptance are active', () => {
  assert.doesNotThrow(() => validateGuiContract(readJson('contracts/app-gui-product-contract.json')));
  assert.doesNotThrow(() => validatePageState(readJson('contracts/app-page-state-matrix.json')));
});

test('Runtime cockpit rejects dashboard drift and incomplete user-action semantics', () => {
  for (const mutate of [
    (contract: any) => {
      contract.pages.runtime_status.runtime_cockpit_product_contract.role = 'observability_dashboard';
    },
    (contract: any) => {
      contract.pages.runtime_status.runtime_cockpit_product_contract.state_separation.combined_status_allowed = true;
    },
    (contract: any) => {
      contract.pages.runtime_status.runtime_cockpit_product_contract.system_attention.required_fields = ['issue'];
    },
    (contract: any) => {
      contract.pages.runtime_status.runtime_cockpit_product_contract.system_attention.empty_or_generic_state_allowed = true;
    },
  ]) {
    const contract = structuredClone(readJson('contracts/app-gui-product-contract.json'));
    mutate(contract);
    assert.throws(() => validateGuiContract(contract));
  }
});

test('Runtime cockpit rejects attempt-owned identity, history-dependent inventory, and fabricated Token zeroes', () => {
  for (const mutate of [
    (contract: any) => {
      contract.pages.runtime_status.runtime_cockpit_product_contract.project_identity.temporal_attempt_may_define_identity = true;
    },
    (contract: any) => {
      contract.pages.runtime_status.runtime_cockpit_product_contract.work_item_inventory.temporal_history_required = true;
    },
    (contract: any) => {
      contract.pages.runtime_status.runtime_cockpit_product_contract.work_item_inventory.fast_profile_must_preserve_every_task_row = false;
    },
    (contract: any) => {
      contract.pages.runtime_status.runtime_cockpit_product_contract.token_usage.missing_value_may_render_as_zero = true;
    },
    (contract: any) => {
      contract.pages.runtime_status.runtime_cockpit_product_contract.token_usage.observed_values_only = false;
    },
  ]) {
    const contract = structuredClone(readJson('contracts/app-gui-product-contract.json'));
    mutate(contract);
    assert.throws(() => validateGuiContract(contract));
  }
});

test('Runtime cockpit rejects bare sidebar counts, raw default fields, and upstream weakening', () => {
  for (const mutate of [
    (contract: any) => {
      contract.pages.runtime_status.runtime_cockpit_product_contract.agent_package_sidebar.name_policy = 'short_id';
    },
    (contract: any) => {
      contract.pages.runtime_status.runtime_cockpit_product_contract.agent_package_sidebar.bare_count_or_fraction_allowed = true;
    },
    (contract: any) => {
      contract.pages.runtime_status.runtime_cockpit_product_contract.progressive_disclosure.raw_technical_fields_default_visible = true;
    },
    (contract: any) => {
      contract.interaction_baseline.feature_preservation_policy.runtime_preservation_gate.upstream_alignment_may_remove_or_weaken = true;
    },
  ]) {
    const contract = structuredClone(readJson('contracts/app-gui-product-contract.json'));
    mutate(contract);
    assert.throws(() => validateGuiContract(contract));
  }
});

test('Runtime page-state rejects removal or weakening of App-owned cockpit invariants', () => {
  for (const mutate of [
    (matrix: any) => {
      matrix.acceptance_boundary.runtime_upstream_alignment_may_remove_or_weaken = true;
    },
    (matrix: any) => {
      const runtime = matrix.pages.find((page: any) => page.id === 'runtime');
      runtime.runtime_view_model.runtime_cockpit_acceptance.required_invariants = [];
    },
    (matrix: any) => {
      const runtime = matrix.pages.find((page: any) => page.id === 'runtime');
      runtime.runtime_view_model.runtime_cockpit_acceptance.feature_removal_or_weakening_allowed = true;
    },
    (matrix: any) => {
      const runtime = matrix.pages.find((page: any) => page.id === 'runtime');
      runtime.runtime_view_model.runtime_cockpit_acceptance.page_role = 'observability_dashboard';
    },
  ]) {
    const matrix = structuredClone(readJson('contracts/app-page-state-matrix.json'));
    mutate(matrix);
    assert.throws(() => validatePageState(matrix));
  }
});
