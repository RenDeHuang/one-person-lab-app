import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { parse as parseYaml } from "yaml";

const workflowPath = path.join(process.cwd(), ".github", "workflows", "opl-first-run-vm.yml");
const workflowSource = fs.readFileSync(workflowPath, "utf8");
const workflow = parseYaml(workflowSource) as Record<string, any>;

test("Nightly Homebrew uses the Standard runtime smoke with the exact Nightly cask", () => {
  const normalizeInputs = String(
    workflow.jobs["validate-vm-inputs"].steps.find(
      (step: Record<string, unknown>) => step.name === "Normalize diagnostic inputs",
    ).run,
  );
  assert.match(
    normalizeInputs,
    /full \| standard \| homebrew-standard \| homebrew-nightly \| homebrew-full/,
  );
  assert.match(
    normalizeInputs,
    /package_profile=homebrew-nightly requires an exact pre-publication Cask artifact/,
  );
  assert.match(
    normalizeInputs,
    /accepted only for package_profile=homebrew-nightly or homebrew-full/,
  );

  const resolveProfile = workflow.jobs["clean-vm-first-run"].steps.find(
    (step: Record<string, unknown>) => step.name === "Resolve package profile",
  );
  const source = String(resolveProfile.run);
  assert.match(source, /homebrew-nightly\)/);
  assert.match(source, /homebrew_cask=gaofeng21cn\/one-person-lab\/one-person-lab-nightly/);
  assert.match(source, /homebrew-nightly\)[\s\S]*runtime_profile=standard/);
  assert.match(source, /homebrew-nightly\)[\s\S]*install_mode=homebrew-cask/);

  const runSmoke = workflow.jobs["clean-vm-first-run"].steps.find(
    (step: Record<string, unknown>) => step.name === "Run clean VM first launch smoke",
  );
  assert.match(
    String(runSmoke.run),
    /profile \}\}" = "homebrew-nightly"[\s\S]*--smoke-profile homebrew-nightly-cask[\s\S]*--homebrew-cask-file "\$\{\{ steps\.homebrew_candidate\.outputs\.cask_path \}\}"/,
  );
  assert.match(String(runSmoke.run), /--smoke-profile homebrew-standard-cask/);
  assert.match(
    String(runSmoke.run),
    /--homebrew-cask "\$\{\{ steps\.package_profile\.outputs\.homebrew_cask \}\}"/,
  );
});

test("Nightly candidate binding cannot fall through to Full or the public Tap", () => {
  const bindCandidate = workflow.jobs["clean-vm-first-run"].steps.find(
    (step: Record<string, unknown>) => step.name === "Bind exact pre-publication Homebrew Cask",
  );
  const source = String(bindCandidate.run);
  assert.match(source, /homebrew-nightly\)[\s\S]*expected_name=one-person-lab-nightly\.rb/);
  assert.match(source, /homebrew-full\)[\s\S]*expected_name=one-person-lab-full\.rb/);
  assert.match(source, /find artifacts\/homebrew-candidate -type f -name "\$expected_name"/);
  assert.match(source, /Nightly Cask candidate must depend on Formula opl/);
  assert.match(source, /Full Cask candidate must not depend on Formula opl/);
  assert.doesNotMatch(source, /gaofeng21cn\/one-person-lab/);
});

test("Nightly Homebrew remains a Standard qualification artifact", () => {
  const attempt = workflow.jobs["qualification-attempt-finalizer"];
  const receiptStep = attempt.steps.find(
    (step: Record<string, unknown>) => step.name === "Write durable typed attempt receipt",
  );
  const source = String(receiptStep.run);
  assert.match(source, /artifact_kind=standard/);
  assert.match(source, /case "\$profile" in full\|homebrew-full\) artifact_kind=full/);
  assert.doesNotMatch(source, /homebrew-nightly\) artifact_kind=full/);
});
