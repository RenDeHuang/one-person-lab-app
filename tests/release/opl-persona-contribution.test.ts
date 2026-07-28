import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validatePackageAppContributionsProductContract } from '../../scripts/validate-active-shell/gui-framework-surfaces-validator.ts';

const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(relativePath, 'utf8'));

test('OPL Persona is consumable as a role-neutral App Package contribution', () => {
  const fixture = readJson('contracts/fixtures/opl-persona-app-contributions.fixture.json');
  const contract = readJson('contracts/app-gui-product-contract.json').framework_surfaces.package_app_contributions;

  assert.equal(fixture.package_id, 'opl-persona');
  assert.equal(contract.package_role_policy, 'role_agnostic_no_package_role_filter');
  assert.doesNotThrow(() => validatePackageAppContributionsProductContract(contract));

  const contributions = fixture.app_contributions;
  assert.equal(contributions.schema_version, 'opl-app-contributions.v1');
  const viewIds = new Set(contributions.views.map((view: any) => view.view_id));
  for (const item of contributions.navigation) {
    assert.ok(viewIds.has(item.view_id), `navigation ${item.navigation_id} must resolve a view`);
  }
  const commandIds = new Set(contributions.commands.map((command: any) => command.command_id));
  const proposalView = contributions.views.find((view: any) => view.view_id === 'persona.proposals');
  assert.deepEqual(proposalView.command_ids, ['persona.proposal.inspect', 'persona.proposal.approve']);
  assert.ok(proposalView.command_ids.every((id: string) => commandIds.has(id)));
});
