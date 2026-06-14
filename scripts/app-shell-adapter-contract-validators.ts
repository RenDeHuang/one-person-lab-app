export function validateGuiProductContractPolicyFields(contract, options = {}) {
  const subject = options.subject ?? 'active shell';
  if (contract.gui_product_contract !== 'contracts/app-gui-product-contract.json') {
    throw new Error(`Unexpected active shell gui_product_contract: ${contract.gui_product_contract}`);
  }
  if (contract.gui_product_contract_policy?.must_implement !== true) {
    throw new Error(`${subject} must implement the App GUI product contract`);
  }
  if (contract.gui_product_contract_policy.source_of_truth !== 'one-person-lab-app') {
    throw new Error(`${subject} GUI product contract source of truth must stay in one-person-lab-app`);
  }
  if (contract.gui_product_contract_policy.upstream_override_allowed !== false) {
    throw new Error('AionUI upstream must not override App GUI product truth');
  }
  if (contract.gui_product_contract_policy.upstream_family_role !== 'implementation_material_only') {
    throw new Error(`Unexpected upstream GUI role: ${contract.gui_product_contract_policy.upstream_family_role}`);
  }
  if (
    contract.gui_product_contract_policy.upstream_must_not_override_app_truth !== true &&
    contract.gui_product_contract_policy.aionui_upstream_must_not_override_app_truth !== true
  ) {
    throw new Error(`${subject} must declare that upstream GUI behavior cannot override App truth`);
  }
}

export function validateValidationCommandShape(contract) {
  if (!Array.isArray(contract.validation_commands) || contract.validation_commands.length === 0) {
    throw new Error('validation_commands must be a non-empty array');
  }
  for (const entry of contract.validation_commands) {
    if (!entry.id || !entry.cwd || !entry.command) {
      throw new Error(`Invalid validation command entry: ${JSON.stringify(entry)}`);
    }
  }
  return contract.validation_commands;
}
