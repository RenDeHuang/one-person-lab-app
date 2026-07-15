import {
  assert,
  crypto,
  fs,
  os,
  path,
  spawnSync,
  test,
  appRoot,
  require,
  activeShellRoot,
  runNode,
  writeFile,
  writeExecutable,
  writeReleaseMetadata,
} from "./helpers.ts";

function writeJson(filePath, value) {
  writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function fileSha256Ref(filePath) {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")}`;
}

function runGit(repoRoot, args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function initializeGitRepo(repoRoot) {
  fs.mkdirSync(repoRoot, { recursive: true });
  runGit(repoRoot, ["init", "-q"]);
  runGit(repoRoot, ["config", "user.name", "Full Runtime Test"]);
  runGit(repoRoot, ["config", "user.email", "full-runtime-test@example.invalid"]);
}

function commitFixtureRepo(repoRoot, message) {
  runGit(repoRoot, ["add", "."]);
  runGit(repoRoot, ["commit", "-q", "-m", message]);
  return runGit(repoRoot, ["rev-parse", "HEAD"]);
}

function writeVersionExecutable(filePath, output) {
  writeExecutable(filePath, `#!/bin/sh\nprintf '%s\\n' ${JSON.stringify(output)}\n`);
}

function writeDomainPlugin(root, pluginId) {
  writeJson(path.join(root, "plugins", pluginId, ".codex-plugin", "plugin.json"), {
    name: pluginId,
    skills: "./skills/",
  });
  writeFile(
    path.join(root, "plugins", pluginId, "skills", pluginId, "SKILL.md"),
    `# ${pluginId}\n`,
  );
}

function writeFrameworkRuntimeSource(frameworkRoot, catalogEntry) {
  const temporalPackages = [
    "@temporalio/activity",
    "@temporalio/client",
    "@temporalio/common",
    "@temporalio/worker",
    "@temporalio/workflow",
  ];
  const dependencies = Object.fromEntries(temporalPackages.map((packageName) => [packageName, "1.0.0"]));
  const lockPackages = {
    "": { dependencies },
    ...Object.fromEntries(temporalPackages.map((packageName) => [`node_modules/${packageName}`, {}])),
    "node_modules/@temporalio/core-bridge": {},
  };
  writeJson(path.join(frameworkRoot, "package.json"), {
    name: "fixture-opl-framework",
    version: "0.0.0",
    dependencies,
  });
  writeJson(path.join(frameworkRoot, "package-lock.json"), {
    name: "fixture-opl-framework",
    lockfileVersion: 3,
    packages: lockPackages,
  });
  writeJson(path.join(frameworkRoot, "tsconfig.json"), {});
  for (const packageName of temporalPackages) {
    writeJson(path.join(frameworkRoot, "node_modules", ...packageName.split("/"), "package.json"), {
      name: packageName,
      version: "1.0.0",
    });
  }
  writeFile(
    path.join(
      frameworkRoot,
      "node_modules",
      "@temporalio",
      "core-bridge",
      "releases",
      "aarch64-apple-darwin",
      "index.node",
    ),
    "fixture native module",
  );

  const managedUpdate = {
    managed_update: {
      surface_id: "opl_managed_updater_kernel",
      components: [
        { component_id: "opl_base", provider_id: "runtime_substrate" },
        {
          component_id: "opl_app",
          provider_id: "installation_carrier",
          current: { host_update_route: "fixture_host_update" },
          owner_route: { route_kind: "fixture_owner_route" },
        },
        {
          component_id: "opl_packages",
          provider_id: "capability_packages",
          projection_status: { status: "current" },
          profile_migration_status: {
            semantic_merge_required: true,
            silent_overwrite_allowed: false,
          },
        },
      ],
    },
  };
  const appState = {
    app_state: {
      schema_version: "opl_app_state.v1",
      runtime_source_carriers: {
        items: [{ carrier_id: "medautoscience", source_health_status: "ready" }],
      },
    },
  };
  writeExecutable(path.join(frameworkRoot, "bin", "opl"), `#!/bin/sh
expected_scholar_root="$OPL_FULL_RUNTIME_HOME/modules/mas-scholar-skills"
if [ "\${OPL_MODULE_PATH_MAS_SCHOLAR_SKILLS:-}" != "$expected_scholar_root" ]; then
  printf 'MAS Scholar Skills wrapper env mismatch: %s != %s\\n' "\${OPL_MODULE_PATH_MAS_SCHOLAR_SKILLS:-unset}" "$expected_scholar_root" >&2
  exit 3
fi
if [ ! -f "$OPL_MODULE_PATH_MAS_SCHOLAR_SKILLS/.codex-plugin/plugin.json" ]; then
  printf 'MAS Scholar Skills packaged root is incomplete: %s\\n' "$OPL_MODULE_PATH_MAS_SCHOLAR_SKILLS" >&2
  exit 4
fi
case "$*" in
  "update status --json") printf '%s\\n' '${JSON.stringify(managedUpdate)}' ;;
  "app state --profile fast --json") printf '%s\\n' '${JSON.stringify(appState)}' ;;
  *) printf 'unexpected fixture opl args: %s\\n' "$*" >&2; exit 2 ;;
esac
`);

  const catalogRoot = path.join(frameworkRoot, "contracts", "opl-framework");
  const masPackageManifestPath = path.join(catalogRoot, "packages", "mas.json");
  const packageManifestPath = path.join(catalogRoot, "packages", "mas-scholar-skills.json");
  const payloadManifestPath = path.join(
    catalogRoot,
    "packages",
    "payloads",
    "mas-scholar-skills-0.2.3.json",
  );
  writeJson(masPackageManifestPath, {
    surface_kind: "opl_agent_package_manifest.v1",
    package_id: "mas",
    version: "0.2.6",
    capability_dependencies: [
      {
        package_id: "mas-scholar-skills",
        kind: "framework_capability_package",
        required: true,
        version_requirement: ">=0.2.0 <0.3.0",
        capability_abi: "mas-scholar-skills.v1",
      },
    ],
  });
  const scholarConsumer = {
    agent_id: "mas",
    package_id: "mas",
    dependency_kind: "hard_runtime_dependency",
    required: true,
    version_requirement: ">=0.2.0 <0.3.0",
    capability_abi: "mas-scholar-skills.v1",
  };
  const scholarConsumerPolicy = {
    supported_required_by: ["mas"],
    non_primary_runtime_dependency_supported: false,
  };
  writeJson(packageManifestPath, {
    surface_kind: "opl_capability_package_manifest.v2",
    package_id: "mas-scholar-skills",
    package_role: "required_agent_capability_package",
    version: "0.2.3",
    primary_consumer: scholarConsumer,
    consumer_policy: scholarConsumerPolicy,
  });
  writeJson(payloadManifestPath, catalogEntry.payloadManifest);
  writeJson(path.join(catalogRoot, "bundled-full-runtime-package-catalog.json"), {
    surface_kind: "opl_bundled_full_runtime_package_catalog.v1",
    packages: {
      mas: {
        package_id: "mas",
        package_role: "standard_agent",
        package_version: "0.2.6",
        manifest_ref: "packages/mas.json",
        manifest_sha256: fileSha256Ref(masPackageManifestPath),
        runtime_module_relative_path: "modules/mas",
      },
      "mas-scholar-skills": {
        package_id: "mas-scholar-skills",
        package_role: "framework_capability_package",
        package_version: "0.2.3",
        owner_source_commit: catalogEntry.sourceCommit,
        manifest_ref: "packages/mas-scholar-skills.json",
        manifest_sha256: fileSha256Ref(packageManifestPath),
        payload_manifest_ref: "packages/payloads/mas-scholar-skills-0.2.3.json",
        payload_manifest_sha256: fileSha256Ref(payloadManifestPath),
        runtime_module_relative_path: "modules/mas-scholar-skills",
      },
    },
  });
}

function createFullRuntimeFixture() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opl-full-scholar-runtime-"));
  const scholarRoot = path.join(tempRoot, "mas-scholar-skills");
  initializeGitRepo(scholarRoot);
  const contentLockPaths = [
    ".codex-plugin/plugin.json",
    "contracts/scholar-skills-capability-modules.json",
    "runtime/reference-provider-adapters/index.ts",
    "skills/mas-scholar-skills/SKILL.md",
  ];
  writeJson(path.join(scholarRoot, ".codex-plugin", "plugin.json"), {
    name: "mas-scholar-skills",
    version: "0.2.3",
    skills: "./skills/",
  });
  writeJson(
    path.join(scholarRoot, "contracts", "scholar-skills-capability-modules.json"),
    { package_id: "mas-scholar-skills" },
  );
  writeFile(path.join(scholarRoot, "skills", "mas-scholar-skills", "SKILL.md"), "# Scholar Skills\n");
  writeFile(
    path.join(scholarRoot, "runtime", "reference-provider-adapters", "index.ts"),
    "export const fixtureAdapter = true;\n",
  );
  const contentLock = {
    algorithm: "sha256",
    canonicalization: "ordered_path_length_file_length_bytes",
    paths: contentLockPaths,
    digest: `sha256:${"a".repeat(64)}`,
  };
  writeJson(path.join(scholarRoot, "contracts", "opl_capability_package_manifest.json"), {
    surface_kind: "opl_capability_package_manifest.v2",
    package_id: "mas-scholar-skills",
    package_role: "required_agent_capability_package",
    version: "0.2.3",
    primary_consumer: {
      agent_id: "mas",
      package_id: "mas",
      dependency_kind: "hard_runtime_dependency",
      required: true,
      version_requirement: ">=0.2.0 <0.3.0",
      capability_abi: "mas-scholar-skills.v1",
    },
    consumer_policy: {
      supported_required_by: ["mas"],
      non_primary_runtime_dependency_supported: false,
    },
    content_lock: contentLock,
  });
  const sourceCommit = commitFixtureRepo(scholarRoot, "fixture scholar source");
  runGit(scholarRoot, ["branch", "scholar-fixture-ref", sourceCommit]);
  const payloadManifest = {
    surface_kind: "opl_package_payload_manifest.v2",
    package_id: "mas-scholar-skills",
    package_version: "0.2.3",
    source_repo: "https://github.com/gaofeng21cn/mas-scholar-skills.git",
    source_commit: sourceCommit,
    content_lock: {
      algorithm: contentLock.algorithm,
      canonicalization: contentLock.canonicalization,
      digest: contentLock.digest,
    },
    files: contentLockPaths.map((relativePath) => ({
      path: relativePath,
      mode: "100644",
      source_url: `https://example.invalid/${sourceCommit}/${relativePath}`,
      sha256: fileSha256Ref(path.join(scholarRoot, ...relativePath.split("/"))),
    })),
  };

  const frameworkRoot = path.join(tempRoot, "one-person-lab");
  initializeGitRepo(frameworkRoot);
  writeFrameworkRuntimeSource(frameworkRoot, { payloadManifest, sourceCommit });
  const frameworkCommit = commitFixtureRepo(frameworkRoot, "fixture framework source");

  const masRoot = path.join(tempRoot, "med-autoscience");
  const magRoot = path.join(tempRoot, "med-autogrant");
  const rcaRoot = path.join(tempRoot, "redcube-ai");
  const metaAgentRoot = path.join(tempRoot, "opl-meta-agent");
  const bookforgeRoot = path.join(tempRoot, "opl-bookforge");
  const oplFlowRoot = path.join(tempRoot, "opl-flow");
  writeDomainPlugin(masRoot, "med-autoscience");
  writeDomainPlugin(magRoot, "med-autogrant");
  writeDomainPlugin(rcaRoot, "redcube-ai");
  writeDomainPlugin(metaAgentRoot, "opl-meta-agent");
  writeDomainPlugin(bookforgeRoot, "opl-bookforge");
  writeJson(path.join(oplFlowRoot, ".codex-plugin", "plugin.json"), {
    name: "opl-flow",
    skills: "./skills/",
  });
  writeJson(path.join(oplFlowRoot, "contracts", "workflow-policy.json"), {
    schema: "opl_flow_workflow_policy.v1",
    package: { id: "opl-flow" },
    requires: [],
    recommends: [],
  });
  writeFile(path.join(oplFlowRoot, "templates", "AGENTS.md"), "# OPL Flow fixture\n");
  writeFile(path.join(oplFlowRoot, "skills", "opl-flow", "SKILL.md"), "# OPL Flow\n");

  const officeCliRoot = path.join(tempRoot, "OfficeCLI");
  const mineruRoot = path.join(tempRoot, "MinerU-Ecosystem");
  const mineruDocumentExtractorRoot = path.join(tempRoot, "mineru-document-extractor");
  const uiUxProMaxRoot = path.join(tempRoot, "ui-ux-pro-max-skill");
  for (const root of [officeCliRoot, mineruRoot, mineruDocumentExtractorRoot, uiUxProMaxRoot]) {
    fs.mkdirSync(root, { recursive: true });
  }

  const toolsRoot = path.join(tempRoot, "tools");
  const codexRoot = path.join(toolsRoot, "codex-package");
  const codexVendorRoot = path.join(toolsRoot, "codex-vendor", "aarch64-apple-darwin");
  const codexBin = path.join(codexVendorRoot, "bin", "codex");
  const rgBin = path.join(codexVendorRoot, "codex-path", "rg");
  writeJson(path.join(codexRoot, "package.json"), { name: "@openai/codex", version: "1.0.0" });
  writeVersionExecutable(codexBin, "codex-cli 1.0.0");
  writeVersionExecutable(rgBin, "ripgrep 1.0.0");

  const nodeRoot = path.join(toolsRoot, "node");
  const nodeBin = path.join(nodeRoot, "bin", "node");
  const npmBin = path.join(nodeRoot, "bin", "npm");
  const npxBin = path.join(nodeRoot, "bin", "npx");
  const npmRoot = path.join(nodeRoot, "lib", "node_modules", "npm");
  writeVersionExecutable(nodeBin, "v22.0.0");
  writeVersionExecutable(npmBin, "10.0.0");
  writeVersionExecutable(npxBin, "10.0.0");
  writeJson(path.join(npmRoot, "package.json"), { name: "npm", version: "10.0.0" });
  writeFile(path.join(npmRoot, "lib", "cli.js"), "// npm fixture\n");

  const pythonRoot = path.join(toolsRoot, "cpython-3.12-fixture-macos-aarch64-none");
  const uvBin = path.join(toolsRoot, "uv");
  const temporalCliBin = path.join(toolsRoot, "temporal");
  const temporalCliArchive = path.join(toolsRoot, "temporal.tar.gz");
  const officeCliBin = path.join(toolsRoot, "officecli");
  const mineruOpenApiBin = path.join(toolsRoot, "mineru-open-api");
  writeVersionExecutable(path.join(pythonRoot, "bin", "python3"), "Python 3.12.0");
  writeVersionExecutable(uvBin, "uv 0.1.0");
  writeVersionExecutable(temporalCliBin, "temporal 1.0.0");
  writeFile(temporalCliArchive, "fixture temporal archive");
  writeVersionExecutable(officeCliBin, "officecli 0.0.1");
  writeVersionExecutable(mineruOpenApiBin, "mineru-open-api 0.0.1");

  const options = {
    version: "26.7.15-scholar-fixture",
    outDir: path.join(tempRoot, "out"),
    frameworkRoot,
    frameworkRef: "framework-fixture-ref",
    guiRoot: path.join(tempRoot, "gui"),
    masRoot,
    masRef: "mas-fixture-ref",
    masScholarSkillsRoot: scholarRoot,
    masScholarSkillsRef: "scholar-fixture-ref",
    magRoot,
    magRef: "mag-fixture-ref",
    rcaRoot,
    rcaRef: "rca-fixture-ref",
    metaAgentRoot,
    metaAgentRef: "oma-fixture-ref",
    bookforgeRoot,
    bookforgeRef: "obf-fixture-ref",
    oplFlowRoot,
    oplFlowRef: "flow-fixture-ref",
    officeCliRoot,
    officeCliRef: "v0.0.1",
    officeCliRelease: {
      requested_ref: "v0.0.1",
      resolved_ref: "v0.0.1",
      resolved_commit: null,
      latest_stable_verified: true,
      policy: "fixture",
      version: "0.0.1",
    },
    mineruRoot,
    mineruRef: "mineru-fixture-ref",
    mineruDocumentExtractorRoot,
    uiUxProMaxRoot,
    uiUxProMaxRef: "ui-fixture-ref",
    includeBunRuntime: false,
    runtimeCacheDir: path.join(tempRoot, "cache"),
    runtimeCacheMode: "off",
  };
  const sources = {
    codexRoot,
    codexBinaries: { vendorRoot: codexVendorRoot, codex: codexBin, rg: rgBin },
    nodeToolchain: { nodeBin, npmBin, npxBin, npmRoot },
    bunBin: null,
    pythonRoot,
    uvBin,
    temporalCliBin,
    temporalCliArchive,
    officeCliBin,
    mineruOpenApiBin,
    mineruRepoRoot: null,
  };
  return { tempRoot, options, sources, sourceCommit, frameworkCommit };
}

test("publish rejects standard App artifacts that contain the Full runtime payload", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opl-app-release-full-leak-"));
  const shellRoot = path.join(tempRoot, "shells", "aionui");
  const outDir = path.join(shellRoot, "out");
  const version = "26.5.15-test";
  const dmgName = `One-Person-Lab-${version}-mac-arm64.dmg`;

  writeFile(path.join(outDir, dmgName));
  writeFile(path.join(outDir, `One-Person-Lab-${version}-mac-arm64.zip`));
  writeReleaseMetadata(outDir, version, dmgName);
  writeFile(
    path.join(
      shellRoot,
      "out",
      "mac-arm64",
      "One Person Lab.app",
      "Contents",
      "Resources",
      "opl-full-runtime",
      "runtime",
      "current",
      "manifest",
      "full-package-manifest.json",
    ),
    "{}\n",
  );

  const result = runNode([
    "scripts/publish-release.ts",
    "--no-build",
    "--dry-run",
    "--shell-root",
    shellRoot,
    "--version",
    version,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /contains Full runtime payload/);
});

test("packaged runtime validator only requires Full runtime when explicitly requested", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opl-app-packaged-runtime-"));
  const resourcesRoot = path.join(tempRoot, "One Person Lab.app", "Contents", "Resources");
  const asarPath = path.join(resourcesRoot, "app.asar");

  fs.mkdirSync(resourcesRoot, { recursive: true });
  fs.writeFileSync(asarPath, "", "utf8");

  const validator = require(path.join(activeShellRoot, "scripts", "validate-packaged-runtime.js"));
  const optional = validator.validateFullRuntimeResources(resourcesRoot, { require: false });
  const required = validator.validateFullRuntimeResources(resourcesRoot, { require: true });

  assert.equal(optional.checked, false);
  assert.deepEqual(optional.issues, []);
  assert.equal(required.checked, false);
  assert.match(required.issues.join("\n"), /missing opl-full-runtime extraResource/);
});

test("Full first-install manifest consumes the OPL runtime bundle boundary instead of owning dependency truth", async () => {
  const mod = await import("../../../scripts/full-first-install-package.ts");
  const manifest = mod.buildFullPackageManifest({ version: "26.6.21-bundle-consumer" });

  assert.equal(manifest.opl_runtime_bundle_consumer.app_repo_role, "consumer_only");
  assert.equal(manifest.opl_runtime_bundle_consumer.dependency_truth_owner, false);
  assert.equal(
    manifest.opl_runtime_bundle_consumer.consumption_boundary
      .keeps_full_offline_first_install_payloads,
    true,
  );
  assert.equal(
    manifest.opl_runtime_bundle_consumer.consumption_boundary
      .can_delete_required_offline_payloads_for_size,
    false,
  );
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, "contracts", "app-release-channel.json"), "utf8"),
  );
  assert.ok(
    releaseContract.full_first_install.payload_boundary.allowed_actions.includes(
      "copy_framework_catalog_declared_capability_package_payloads",
    ),
  );
});

test("real Full domain and prepareRuntime builders package the current MAS Scholar Skills closure", async () => {
  const fixture = createFullRuntimeFixture();
  const previousStrictSigning = process.env.OPL_MAC_STRICT_SIGNING_CHECKS;
  process.env.OPL_MAC_STRICT_SIGNING_CHECKS = "false";
  let prepared;
  try {
    const { buildDomainLayer, writeDomainMarkers } =
      await import("../../../scripts/build-full-first-install-package/runtime-layers.ts");
    const directLayerRoot = path.join(fixture.tempRoot, "direct-domain-layer");
    buildDomainLayer(directLayerRoot, fixture.options);
    const directScholarRoot = path.join(
      directLayerRoot,
      "modules",
      "mas-scholar-skills",
    );
    assert.equal(
      fs.readFileSync(path.join(directScholarRoot, "skills", "mas-scholar-skills", "SKILL.md"), "utf8"),
      "# Scholar Skills\n",
    );
    assert.equal(
      fs.existsSync(path.join(directScholarRoot, "runtime", "reference-provider-adapters", "index.ts")),
      true,
    );
    writeDomainMarkers(directLayerRoot, fixture.options, "2026-07-15T00:00:00.000Z");
    assert.equal(fs.existsSync(path.join(directScholarRoot, "opl-runtime-module.json")), false);

    const { prepareRuntime } =
      await import("../../../scripts/build-full-first-install-package/staging.ts");
    prepared = prepareRuntime(fixture.options, fixture.sources);
    const packagedScholarRoot = path.join(
      prepared.runtimeRoot,
      "modules",
      "mas-scholar-skills",
    );
    assert.equal(
      fs.readFileSync(path.join(packagedScholarRoot, "skills", "mas-scholar-skills", "SKILL.md"), "utf8"),
      "# Scholar Skills\n",
    );
    assert.equal(
      fs.existsSync(path.join(packagedScholarRoot, "runtime", "reference-provider-adapters", "index.ts")),
      true,
    );
    assert.equal(fs.existsSync(path.join(packagedScholarRoot, "opl-runtime-module.json")), false);

    const wrapper = fs.readFileSync(path.join(prepared.runtimeRoot, "bin", "opl"), "utf8");
    assert.match(
      wrapper,
      /export OPL_MODULE_PATH_MAS_SCHOLAR_SKILLS="\$RUNTIME_HOME\/modules\/mas-scholar-skills"/,
    );

    const component = prepared.manifest.components.mas_scholar_skills;
    assert.equal(component.source_path, fixture.options.masScholarSkillsRoot);
    assert.equal(component.git_commit, fixture.sourceCommit);
    assert.equal(component.required, true);
    assert.deepEqual(component.required_by, ["mas"]);
    assert.equal(component.visible_in_first_run_ui, false);
    assert.equal(component.standard_domain_agent, false);

    const resolved = prepared.resolved_refs.mas_scholar_skills;
    assert.equal(resolved.requested_ref, "scholar-fixture-ref");
    assert.equal(resolved.requested_ref_commit, fixture.sourceCommit);
    assert.equal(resolved.resolved_commit, fixture.sourceCommit);
    assert.equal(resolved.owner_source_commit, fixture.sourceCommit);
    assert.equal(resolved.package_role, "framework_capability_package");
    assert.equal(resolved.runtime_module_relative_path, "modules/mas-scholar-skills");
    assert.equal(resolved.mas_manifest_ref, "packages/mas.json");
    assert.match(resolved.mas_manifest_sha256, /^sha256:[a-f0-9]{64}$/);
    assert.match(resolved.manifest_sha256, /^sha256:[a-f0-9]{64}$/);
    assert.match(resolved.payload_manifest_sha256, /^sha256:[a-f0-9]{64}$/);
    assert.match(resolved.source_manifest_sha256, /^sha256:[a-f0-9]{64}$/);
    assert.equal(resolved.payload_file_count, 4);
    assert.equal(resolved.checksum_status, "verified");
    assert.equal(resolved.currentness_status, "current");
    assert.equal(resolved.currentness.mas_dependency_edge_matches_framework_catalog, true);
    assert.equal(resolved.currentness.primary_consumer_matches_mas, true);
    assert.equal(resolved.currentness.source_payload_checksums_verified, true);

    const requiredPayloads = prepared.manifest.runtime_assertions.offline_required_payloads;
    assert.equal(
      new Set(requiredPayloads.map((entry) => entry.path)).size,
      requiredPayloads.length,
      "offline required payload assertions must have unique paths",
    );
    for (const entryPath of [
      "modules/mas-scholar-skills/.codex-plugin/plugin.json",
      "modules/mas-scholar-skills/contracts/opl_capability_package_manifest.json",
      "modules/mas-scholar-skills/runtime/reference-provider-adapters/index.ts",
      "modules/mas-scholar-skills/skills/mas-scholar-skills/SKILL.md",
    ]) {
      assert.equal(
        requiredPayloads.find((entry) => entry.path === entryPath)?.exists,
        true,
        entryPath,
      );
    }

    const domainCacheInputs = prepared.runtime_cache.key_inputs["domain-runtime"];
    assert.equal(domainCacheInputs.mas_scholar_skills_ref, "scholar-fixture-ref");
    assert.equal(domainCacheInputs.mas_scholar_skills_commit, fixture.sourceCommit);
    assert.match(domainCacheInputs.mas_scholar_skills_source_manifest_sha256, /^[a-f0-9]{64}$/);
    assert.match(domainCacheInputs.mas_scholar_skills_fingerprint, /^[a-f0-9]{64}$/);
    assert.equal(prepared.runtime_cache.currentness.framework_commit, fixture.frameworkCommit);
    assert.equal(
      prepared.runtime_cache.currentness.mas_scholar_skills_commit,
      fixture.sourceCommit,
    );
    assert.equal(
      prepared.runtime_cache.currentness.mas_scholar_skills_checksum_status,
      "verified",
    );
    assert.equal(
      prepared.runtime_cache.currentness.mas_scholar_skills_currentness_status,
      "current",
    );
    assert.equal(
      prepared.runtime_cache.currentness.mas_scholar_skills_payload_file_count,
      4,
    );

    const { assertFullRuntimeCurrentness } =
      await import("../../../scripts/build-full-first-install-package/runtime-currentness.ts");
    writeFile(
      path.join(packagedScholarRoot, "skills", "mas-scholar-skills", "SKILL.md"),
      "# drifted packaged Scholar Skills\n",
    );
    assert.throws(
      () => assertFullRuntimeCurrentness(prepared.runtimeRoot, {
        frameworkRoot: fixture.options.frameworkRoot,
        masScholarSkillsRoot: fixture.options.masScholarSkillsRoot,
        masScholarSkillsRef: fixture.options.masScholarSkillsRef,
      }),
      /packaged MAS Scholar Skills payload skills\/mas-scholar-skills\/SKILL\.md checksum drifted/,
    );
    writeFile(
      path.join(packagedScholarRoot, "skills", "mas-scholar-skills", "SKILL.md"),
      "# Scholar Skills\n",
    );
    const packagedOwnerManifestPath = path.join(
      packagedScholarRoot,
      "contracts",
      "opl_capability_package_manifest.json",
    );
    const packagedOwnerManifest = JSON.parse(
      fs.readFileSync(packagedOwnerManifestPath, "utf8"),
    );
    packagedOwnerManifest.package_id = "mas-scholar-skills-drifted";
    writeJson(packagedOwnerManifestPath, packagedOwnerManifest);
    assert.throws(
      () => assertFullRuntimeCurrentness(prepared.runtimeRoot, {
        frameworkRoot: fixture.options.frameworkRoot,
        masScholarSkillsRoot: fixture.options.masScholarSkillsRoot,
        masScholarSkillsRef: fixture.options.masScholarSkillsRef,
      }),
      /packaged MAS Scholar Skills owner capability manifest checksum drifted/,
    );
    fs.copyFileSync(
      path.join(
        fixture.options.masScholarSkillsRoot,
        "contracts",
        "opl_capability_package_manifest.json",
      ),
      packagedOwnerManifestPath,
    );
    const packagedManifestPath = path.join(
      prepared.runtimeRoot,
      "manifest",
      "full-package-manifest.json",
    );
    const packagedManifest = JSON.parse(fs.readFileSync(packagedManifestPath, "utf8"));
    packagedManifest.resolved_refs.mas_scholar_skills.framework_catalog_ref =
      "contracts/opl-framework/drifted-catalog.json";
    writeJson(packagedManifestPath, packagedManifest);
    assert.throws(
      () => assertFullRuntimeCurrentness(prepared.runtimeRoot, {
        frameworkRoot: fixture.options.frameworkRoot,
        masScholarSkillsRoot: fixture.options.masScholarSkillsRoot,
        masScholarSkillsRef: fixture.options.masScholarSkillsRef,
      }),
      /resolved MAS Scholar Skills framework_catalog_ref drifted/,
    );
  } finally {
    if (previousStrictSigning === undefined) delete process.env.OPL_MAC_STRICT_SIGNING_CHECKS;
    else process.env.OPL_MAC_STRICT_SIGNING_CHECKS = previousStrictSigning;
    if (prepared?.stagingRoot) {
      fs.rmSync(prepared.stagingRoot, { recursive: true, force: true });
    }
    fs.rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
});

test("MAS Scholar Skills source resolution fails closed for a missing root and payload drift", async () => {
  const fixture = createFullRuntimeFixture();
  try {
    const { resolveMasScholarSkillsFullRuntimeSource } =
      await import("../../../scripts/build-full-first-install-package/manifest-checksum.ts");
    assert.throws(
      () => resolveMasScholarSkillsFullRuntimeSource({
        ...fixture.options,
        masScholarSkillsRoot: path.join(fixture.tempRoot, "missing-mas-scholar-skills"),
      }),
      /MAS Scholar Skills root is missing/,
    );
    assert.throws(
      () => resolveMasScholarSkillsFullRuntimeSource({
        ...fixture.options,
        masScholarSkillsRef: "missing-scholar-ref",
      }),
      /git rev-parse --verify missing-scholar-ref\^\{commit\}/,
    );

    const current = resolveMasScholarSkillsFullRuntimeSource(fixture.options);
    assert.equal(current.source_commit, fixture.sourceCommit);
    assert.equal(current.checksum_status, "verified");
    writeFile(
      path.join(
        fixture.options.masScholarSkillsRoot,
        "skills",
        "mas-scholar-skills",
        "SKILL.md",
      ),
      "# drifted Scholar Skills\n",
    );
    assert.throws(
      () => resolveMasScholarSkillsFullRuntimeSource(fixture.options),
      /source payload skills\/mas-scholar-skills\/SKILL\.md checksum drifted/,
    );
  } finally {
    fs.rmSync(fixture.tempRoot, { recursive: true, force: true });
  }
});

test("MAS Scholar Skills source resolution rejects commit, catalog, dependency, and content-lock drift", async () => {
  const { resolveMasScholarSkillsFullRuntimeSource } =
    await import("../../../scripts/build-full-first-install-package/manifest-checksum.ts");
  const commitFixture = createFullRuntimeFixture();
  const catalogFixture = createFullRuntimeFixture();
  const dependencyFixture = createFullRuntimeFixture();
  const contentLockFixture = createFullRuntimeFixture();
  try {
    writeFile(
      path.join(commitFixture.options.masScholarSkillsRoot, "README.md"),
      "commit drift\n",
    );
    const driftCommit = commitFixtureRepo(
      commitFixture.options.masScholarSkillsRoot,
      "fixture source commit drift",
    );
    runGit(
      commitFixture.options.masScholarSkillsRoot,
      ["branch", "-f", "scholar-fixture-ref", driftCommit],
    );
    assert.throws(
      () => resolveMasScholarSkillsFullRuntimeSource(commitFixture.options),
      /source is stale: checkout has .* Framework catalog requires/,
    );

    const catalogPackageManifestPath = path.join(
      catalogFixture.options.frameworkRoot,
      "contracts",
      "opl-framework",
      "packages",
      "mas-scholar-skills.json",
    );
    writeFile(catalogPackageManifestPath, "{}\n");
    assert.throws(
      () => resolveMasScholarSkillsFullRuntimeSource(catalogFixture.options),
      /MAS Scholar Skills package manifest checksum drifted/,
    );

    const dependencyCatalogRoot = path.join(
      dependencyFixture.options.frameworkRoot,
      "contracts",
      "opl-framework",
    );
    const dependencyCatalogPath = path.join(
      dependencyCatalogRoot,
      "bundled-full-runtime-package-catalog.json",
    );
    const masManifestPath = path.join(dependencyCatalogRoot, "packages", "mas.json");
    const masManifest = JSON.parse(fs.readFileSync(masManifestPath, "utf8"));
    const dependencyCatalog = JSON.parse(fs.readFileSync(dependencyCatalogPath, "utf8"));
    const scholarDependency = { ...masManifest.capability_dependencies[0] };
    const assertInvalidMasDependency = () => {
      writeJson(masManifestPath, masManifest);
      dependencyCatalog.packages.mas.manifest_sha256 = fileSha256Ref(masManifestPath);
      writeJson(dependencyCatalogPath, dependencyCatalog);
      assert.throws(
        () => resolveMasScholarSkillsFullRuntimeSource(dependencyFixture.options),
        /must require MAS Scholar Skills exactly once/,
      );
    };

    masManifest.capability_dependencies = [];
    assertInvalidMasDependency();
    masManifest.capability_dependencies = [
      { ...scholarDependency, package_id: "mas-scholar-skills-drifted" },
    ];
    assertInvalidMasDependency();
    masManifest.capability_dependencies = [{ ...scholarDependency, required: false }];
    assertInvalidMasDependency();
    masManifest.capability_dependencies = [scholarDependency, { ...scholarDependency }];
    assertInvalidMasDependency();

    masManifest.capability_dependencies = [scholarDependency];
    writeJson(masManifestPath, masManifest);
    dependencyCatalog.packages.mas.manifest_sha256 = fileSha256Ref(masManifestPath);
    const scholarManifestPath = path.join(
      dependencyCatalogRoot,
      "packages",
      "mas-scholar-skills.json",
    );
    const scholarManifest = JSON.parse(fs.readFileSync(scholarManifestPath, "utf8"));
    scholarManifest.primary_consumer.required = false;
    writeJson(scholarManifestPath, scholarManifest);
    dependencyCatalog.packages["mas-scholar-skills"].manifest_sha256 =
      fileSha256Ref(scholarManifestPath);
    writeJson(dependencyCatalogPath, dependencyCatalog);
    assert.throws(
      () => resolveMasScholarSkillsFullRuntimeSource(dependencyFixture.options),
      /primary_consumer.required drifted/,
    );

    scholarManifest.primary_consumer.required = true;
    writeJson(scholarManifestPath, scholarManifest);
    dependencyCatalog.packages["mas-scholar-skills"].manifest_sha256 =
      fileSha256Ref(scholarManifestPath);
    writeJson(dependencyCatalogPath, dependencyCatalog);
    const sourceManifestPath = path.join(
      dependencyFixture.options.masScholarSkillsRoot,
      "contracts",
      "opl_capability_package_manifest.json",
    );
    const sourceManifest = JSON.parse(fs.readFileSync(sourceManifestPath, "utf8"));
    sourceManifest.consumer_policy.supported_required_by = ["not-mas"];
    writeJson(sourceManifestPath, sourceManifest);
    assert.throws(
      () => resolveMasScholarSkillsFullRuntimeSource(dependencyFixture.options),
      /owner manifest consumer policy must keep MAS as the sole supported runtime dependency owner/,
    );

    const catalogRoot = path.join(
      contentLockFixture.options.frameworkRoot,
      "contracts",
      "opl-framework",
    );
    const payloadManifestPath = path.join(
      catalogRoot,
      "packages",
      "payloads",
      "mas-scholar-skills-0.2.3.json",
    );
    const catalogPath = path.join(catalogRoot, "bundled-full-runtime-package-catalog.json");
    const payloadManifest = JSON.parse(fs.readFileSync(payloadManifestPath, "utf8"));
    payloadManifest.content_lock.digest = `sha256:${"b".repeat(64)}`;
    writeJson(payloadManifestPath, payloadManifest);
    const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
    catalog.packages["mas-scholar-skills"].payload_manifest_sha256 =
      fileSha256Ref(payloadManifestPath);
    writeJson(catalogPath, catalog);
    assert.throws(
      () => resolveMasScholarSkillsFullRuntimeSource(contentLockFixture.options),
      /content_lock\.digest drifted/,
    );
  } finally {
    for (const fixture of [commitFixture, catalogFixture, dependencyFixture, contentLockFixture]) {
      fs.rmSync(fixture.tempRoot, { recursive: true, force: true });
    }
  }
});

test("Full runtime currentness consumes the Framework managed update component array", async () => {
  const { assertManagedUpdateProbe } =
    await import("../../../scripts/build-full-first-install-package/runtime-currentness.ts");
  const components = Object.entries({
    opl_app: "installation_carrier",
    opl_base: "runtime_substrate",
    opl_packages: "capability_packages",
  }).map(([component_id, provider_id]) => ({ component_id, provider_id }));
  Object.assign(components[0], {
    current: { host_update_route: "carrier_specific_host_update_route_required" },
    owner_route: { route_kind: "manual_owner_route" },
  });
  Object.assign(components[2], {
    projection_status: { status: "current" },
    profile_migration_status: { semantic_merge_required: true, silent_overwrite_allowed: false },
  });

  const current = assertManagedUpdateProbe({
    managed_update: {
      surface_id: "opl_managed_updater_kernel",
      components,
    },
  });
  assert.equal(current.components, components);
  assert.throws(
    () =>
      assertManagedUpdateProbe({
        managed_update: {
          surface_id: "opl_managed_updater_kernel",
          components: components.map((component) =>
            component.component_id === "opl_base"
              ? { ...component, provider_id: "wrong-provider" }
              : component,
          ),
        },
      }),
    /component opl_base uses provider wrong-provider/,
  );
  assert.throws(
    () =>
      assertManagedUpdateProbe({
        managed_update: {
          surface_id: "opl_managed_updater_kernel",
          components: Object.fromEntries(
            components.map((component) => [component.component_id, component]),
          ),
        },
      }),
    /expected array at managed_update.components/,
  );
});

test("Full runtime currentness consumes the canonical runtime source carrier projection", async () => {
  const { assertAppStateProbe } =
    await import("../../../scripts/build-full-first-install-package/runtime-currentness.ts");
  const appState = assertAppStateProbe({
    app_state: {
      schema_version: "opl_app_state.v1",
      runtime_source_carriers: {
        items: [{ carrier_id: "medautoscience", source_health_status: "ready" }],
      },
    },
  });

  assert.equal(appState.schema_version, "opl_app_state.v1");
  assert.throws(
    () =>
      assertAppStateProbe({
        app_state: {
          schema_version: "opl_app_state.v1",
          modules: { items: [{ module_id: "medautoscience", health_status: "ready" }] },
        },
      }),
    /expected object at app_state\.runtime_source_carriers/,
  );
});

test("Full runtime pruning keeps macOS arm64 launch payloads without development environments", async () => {
  const mod = await import("../../../scripts/full-first-install-package.ts");
  const policy = JSON.parse(
    fs.readFileSync(path.join(appRoot, "contracts", "full-runtime-prune-policy.json"), "utf8"),
  );

  for (const relativePath of policy.validation_examples.runtime_tree.excluded) {
    assert.equal(mod.shouldExcludeRuntimePath(relativePath), true, relativePath);
  }
  for (const relativePath of policy.validation_examples.runtime_tree.retained) {
    assert.equal(mod.shouldExcludeRuntimePath(relativePath), false, relativePath);
  }
  for (const relativePath of policy.validation_examples.production_node_modules.excluded) {
    assert.equal(mod.shouldExcludeProductionNodeModulePath(relativePath), true, relativePath);
  }
  for (const relativePath of policy.validation_examples.production_node_modules.retained) {
    assert.equal(mod.shouldExcludeProductionNodeModulePath(relativePath), false, relativePath);
  }
  for (const relativePath of policy.validation_examples.node_toolchain_global_packages.excluded) {
    assert.equal(mod.shouldExcludeNodeToolchainPackagePath(relativePath), true, relativePath);
  }
  for (const relativePath of policy.validation_examples.node_toolchain_global_packages.retained) {
    assert.equal(mod.shouldExcludeNodeToolchainPackagePath(relativePath), false, relativePath);
  }

  assert.equal(mod.FULL_RUNTIME_PRUNE_POLICY.schema, "opl_full_runtime_prune_policy.v1");
  assert.equal(mod.FULL_RUNTIME_PRUNE_POLICY.id, "full_runtime_offline_first_install_slim_v1");
  assert.equal(mod.FULL_RUNTIME_PRUNE_POLICY.mode, "explicit_non_runtime_prune_only");
  assert.equal(
    mod.FULL_RUNTIME_PRUNE_POLICY_PATH,
    path.join(appRoot, "contracts", "full-runtime-prune-policy.json"),
  );
  assert.deepEqual(mod.FULL_RUNTIME_PRUNE_POLICY.runtime_tree, policy.runtime_tree);
  assert.match(mod.buildFullRuntimePrunePolicyHash(), /^[a-f0-9]{64}$/);
  assert.equal(
    mod.buildFullPackageManifest({ version: "26.5.15" }).runtime_prune_policy.id,
    mod.FULL_RUNTIME_PRUNE_POLICY.id,
  );

  const auditResult = runNode(["scripts/audit-full-runtime-prune-policy.ts", "--json"]);
  assert.equal(auditResult.status, 0, auditResult.stderr);
  const audit = JSON.parse(auditResult.stdout);
  assert.equal(audit.schema, "opl_full_runtime_prune_policy_audit.v1");
  assert.equal(audit.source_of_truth, "contracts/full-runtime-prune-policy.json");
  assert.equal(audit.policy_id, policy.id);
  assert.equal(audit.policy_hash, mod.buildFullRuntimePrunePolicyHash());
  assert.equal(audit.examples.status, "passed");
  assert.equal(audit.examples.failures.length, 0);

  const auditRuntimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opl-full-prune-audit-runtime-"));
  writeFile(path.join(auditRuntimeRoot, "modules", "mas", "logs", "latest.log"), "log");
  writeFile(path.join(auditRuntimeRoot, "modules", "mas", "src", "index.py"), 'print("ok")');
  writeFile(
    path.join(auditRuntimeRoot, "node", "lib", "node_modules", "npm", "docs", "readme.md"),
    "docs",
  );
  writeFile(
    path.join(auditRuntimeRoot, "node", "lib", "node_modules", "npm", "lib", "cli.js"),
    "cli",
  );
  writeFile(path.join(auditRuntimeRoot, "node", "bin", "node"), "node");
  writeFile(
    path.join(auditRuntimeRoot, "opl", "node_modules", "@temporalio", "client", "docs", "api.md"),
    "docs",
  );
  writeFile(
    path.join(auditRuntimeRoot, "opl", "node_modules", "@temporalio", "client", "lib", "index.js"),
    "client",
  );
  const baselinePath = path.join(auditRuntimeRoot, "baseline-audit.json");
  writeFile(
    baselinePath,
    JSON.stringify({
      runtime_scan: {
        excluded_paths: ["modules/mas/tmp/old.tmp", "node/lib/node_modules/npm/docs"],
      },
    }),
  );
  const scanResult = runNode([
    "scripts/audit-full-runtime-prune-policy.ts",
    "--json",
    "--runtime-root",
    auditRuntimeRoot,
    "--baseline",
    baselinePath,
    "--top",
    "5",
  ]);
  assert.equal(scanResult.status, 0, scanResult.stderr);
  const scanAudit = JSON.parse(scanResult.stdout);
  assert.equal(scanAudit.runtime_scan.runtime_root, auditRuntimeRoot);
  assert.ok(scanAudit.runtime_scan.excluded_paths.includes("modules/mas/logs"));
  assert.ok(scanAudit.runtime_scan.excluded_paths.includes("modules/mas/logs/latest.log"));
  assert.ok(scanAudit.runtime_scan.excluded_paths.includes("node/lib/node_modules/npm/docs"));
  assert.ok(
    scanAudit.runtime_scan.excluded_paths.includes("node/lib/node_modules/npm/docs/readme.md"),
  );
  assert.ok(
    scanAudit.runtime_scan.excluded_paths.includes("opl/node_modules/@temporalio/client/docs"),
  );
  assert.ok(
    scanAudit.runtime_scan.excluded_paths.includes(
      "opl/node_modules/@temporalio/client/docs/api.md",
    ),
  );
  assert.ok(
    !scanAudit.runtime_scan.excluded_paths.includes("node/lib/node_modules/npm/lib/cli.js"),
  );
  assert.ok(!scanAudit.runtime_scan.excluded_paths.includes("opl/node_modules"));
  assert.ok(!scanAudit.runtime_scan.excluded_paths.includes("opl/node_modules/@temporalio/client"));
  assert.ok(
    !scanAudit.runtime_scan.excluded_paths.includes(
      "opl/node_modules/@temporalio/client/lib/index.js",
    ),
  );
  assert.ok(scanAudit.runtime_scan.excluded_bytes > 0);
  assert.ok(scanAudit.runtime_scan.excluded_by_surface.runtime_tree >= 2);
  assert.ok(scanAudit.runtime_scan.excluded_by_surface.node_toolchain_global_packages >= 2);
  assert.ok(scanAudit.runtime_scan.excluded_by_surface.production_node_modules >= 2);
  assert.ok(scanAudit.runtime_scan.top_excluded_paths.length <= 5);
  assert.equal(scanAudit.runtime_scan.runtime_assertions.prune_policy_id, policy.id);
  assert.equal(
    scanAudit.runtime_scan.runtime_assertions.prune_policy_hash,
    mod.buildFullRuntimePrunePolicyHash(),
  );
  assert.ok(
    scanAudit.runtime_scan.runtime_assertions.declared_pruned_paths.some(
      (entry) => entry.path === "node/lib/node_modules/npm/docs" && entry.expected === "absent",
    ),
  );
  assert.ok(scanAudit.runtime_scan_diff.added_excluded_paths.includes("modules/mas/logs"));
  assert.ok(scanAudit.runtime_scan_diff.removed_excluded_paths.includes("modules/mas/tmp/old.tmp"));
});

test("Full App bundle staging trim removes non-runtime artifacts while preserving offline runtime payloads", async () => {
  const { trimFullAppBundleForDmg, auditFullPackageBundleBoundaries, withFullPackageOptimization } =
    await import("../../../scripts/build-full-first-install-package/package-optimization.ts");
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opl-full-app-bundle-trim-"));
  const appPath = path.join(tempRoot, "One Person Lab.app");
  writeFile(path.join(appPath, "Contents", "Resources", "app.asar"), "app");
  writeFile(path.join(appPath, "Contents", "Resources", "app.asar.map"), "map");
  writeFile(
    path.join(appPath, "Contents", "Resources", "bundled-aioncore", "runtime.js.map"),
    "shell map",
  );
  writeFile(
    path.join(appPath, "Contents", "Resources", "app.asar.unpacked", "native.node.map"),
    "native map",
  );
  writeFile(
    path.join(
      appPath,
      "Contents",
      "Frameworks",
      "Electron Framework.framework",
      "Resources",
      "electron.js.map",
    ),
    "electron map",
  );
  writeFile(path.join(appPath, "Contents", "Resources", "test-results", "result.json"), "{}");
  writeFile(
    path.join(
      appPath,
      "Contents",
      "Resources",
      "opl-full-runtime",
      "runtime",
      "current",
      "bin",
      "opl",
    ),
    "runtime",
  );
  writeFile(
    path.join(appPath, "Contents", "Resources", "bundled-aioncore", "node"),
    "shell-runtime",
  );
  writeFile(
    path.join(
      appPath,
      "Contents",
      "Frameworks",
      "Electron Framework.framework",
      "Electron Framework",
    ),
    "electron",
  );

  const trimReport = trimFullAppBundleForDmg(appPath);
  assert.equal(trimReport.schema, "opl_full_app_bundle_trim_report.v1");
  assert.equal(trimReport.required_payload_boundary.preserved, true);
  assert.equal(fs.existsSync(path.join(appPath, "Contents", "Resources", "app.asar.map")), false);
  assert.equal(fs.existsSync(path.join(appPath, "Contents", "Resources", "test-results")), false);
  assert.equal(
    fs.existsSync(
      path.join(
        appPath,
        "Contents",
        "Resources",
        "opl-full-runtime",
        "runtime",
        "current",
        "bin",
        "opl",
      ),
    ),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(appPath, "Contents", "Resources", "bundled-aioncore", "node")),
    true,
  );
  assert.equal(
    fs.existsSync(
      path.join(appPath, "Contents", "Resources", "bundled-aioncore", "runtime.js.map"),
    ),
    true,
  );
  assert.equal(
    fs.existsSync(
      path.join(appPath, "Contents", "Resources", "app.asar.unpacked", "native.node.map"),
    ),
    true,
  );
  assert.equal(
    fs.existsSync(
      path.join(
        appPath,
        "Contents",
        "Frameworks",
        "Electron Framework.framework",
        "Resources",
        "electron.js.map",
      ),
    ),
    true,
  );

  const boundaryAudit = auditFullPackageBundleBoundaries(appPath, {
    package_kind: "opl_full_first_install_macos_arm64",
    version: "26.6.21-size-opt",
  });
  assert.equal(
    boundaryAudit.standard_app_boundary.standard_package_allowed_to_contain_full_runtime,
    false,
  );
  assert.equal(boundaryAudit.full_package_boundary.contains_opl_full_runtime, true);
  assert.equal(boundaryAudit.full_package_boundary.contains_shell_runtime, true);
  const manifest = withFullPackageOptimization(
    { manifest_version: 2, package_kind: "opl_full_first_install_macos_arm64" },
    { trimReport, boundaryAudit },
  );
  assert.equal(manifest.package_optimization.offline_first_install_completeness_preserved, true);
  assert.equal(manifest.package_optimization.size_review_release_blocking_by_size_alone, false);
  assert.equal(
    manifest.package_optimization.app_bundle_trim.bytes_removed,
    trimReport.bytes_removed,
  );

  const incompleteAudit = auditFullPackageBundleBoundaries(path.join(tempRoot, "Incomplete.app"), {
    package_kind: "opl_full_first_install_macos_arm64",
    version: "26.6.21-size-opt",
  });
  assert.throws(
    () =>
      withFullPackageOptimization(
        { manifest_version: 2, package_kind: "opl_full_first_install_macos_arm64" },
        { trimReport, boundaryAudit: incompleteAudit },
      ),
    /did not preserve the declared offline first-install App bundle boundary/,
  );
});

test("Full runtime node payload prunes package-only docs while preserving offline launch executables", async () => {
  const { copyNodeRuntimePayload } =
    await import("../../../scripts/build-full-first-install-package/filesystem.ts");
  const { collectRuntimeAssertions } =
    await import("../../../scripts/build-full-first-install-package/runtime-layers.ts");
  const { writeFullRuntimeManifest } =
    await import("../../../scripts/build-full-first-install-package/manifest-checksum.ts");
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "opl-full-node-prune-"));
  const sourceRoot = path.join(tempRoot, "node-source");
  const targetRoot = path.join(tempRoot, "runtime", "node");

  writeExecutable(path.join(sourceRoot, "bin", "node"), "#!/bin/sh\nexit 0\n");
  writeExecutable(path.join(sourceRoot, "bin", "npm"), "#!/bin/sh\nexit 0\n");
  writeExecutable(path.join(sourceRoot, "bin", "npx"), "#!/bin/sh\nexit 0\n");
  writeFile(path.join(sourceRoot, "include", "node", "node.h"), "header");
  writeFile(path.join(sourceRoot, "share", "man", "man1", "node.1"), "manual");
  writeFile(
    path.join(sourceRoot, "lib", "node_modules", "npm", "package.json"),
    '{"name":"npm"}\n',
  );
  writeFile(path.join(sourceRoot, "lib", "node_modules", "npm", "lib", "cli.js"), "runtime");
  writeFile(
    path.join(
      sourceRoot,
      "lib",
      "node_modules",
      "npm",
      "node_modules",
      "@npmcli",
      "arborist",
      "lib",
      "index.js",
    ),
    "runtime",
  );
  writeFile(path.join(sourceRoot, "lib", "node_modules", "npm", "docs", "config.md"), "docs");
  writeFile(path.join(sourceRoot, "lib", "node_modules", "npm", "man", "man1", "npm.1"), "manual");
  writeFile(
    path.join(sourceRoot, "lib", "node_modules", "npm", "tap-snapshots", "install.snap"),
    "snapshot",
  );
  writeFile(
    path.join(sourceRoot, "lib", "node_modules", "corepack", "dist", "corepack.js"),
    "runtime",
  );
  writeFile(
    path.join(sourceRoot, "lib", "node_modules", "corepack", "tests", "corepack.test.js"),
    "test",
  );

  copyNodeRuntimePayload(sourceRoot, targetRoot);

  for (const relativePath of [
    "bin/node",
    "bin/npm",
    "bin/npx",
    "lib/node_modules/npm/lib/cli.js",
    "lib/node_modules/npm/node_modules/@npmcli/arborist/lib/index.js",
    "lib/node_modules/corepack/dist/corepack.js",
  ]) {
    assert.equal(fs.existsSync(path.join(targetRoot, relativePath)), true, relativePath);
  }
  for (const relativePath of [
    "include",
    "share",
    "lib/node_modules/npm/docs",
    "lib/node_modules/npm/man",
    "lib/node_modules/npm/tap-snapshots",
    "lib/node_modules/corepack/tests",
  ]) {
    assert.equal(fs.existsSync(path.join(targetRoot, relativePath)), false, relativePath);
  }

  const runtimeRoot = path.join(tempRoot, "runtime");
  writeExecutable(path.join(runtimeRoot, "bin", "codex"), "#!/bin/sh\nexit 0\n");
  writeFile(
    path.join(runtimeRoot, "vendor", "codex", "codex_cli_darwin_arm64.tar.gz"),
    "codex archive",
  );
  writeExecutable(path.join(runtimeRoot, "bin", "temporal"), "#!/bin/sh\nexit 0\n");
  writeFile(
    path.join(runtimeRoot, "vendor", "temporal", "temporal_cli_darwin_arm64.tar.gz"),
    "temporal archive",
  );
  writeExecutable(path.join(runtimeRoot, "uv", "bin", "uv"), "#!/bin/sh\nexit 0\n");
  writeExecutable(path.join(runtimeRoot, "bin", "officecli"), "#!/bin/sh\nexit 0\n");
  writeExecutable(path.join(runtimeRoot, "bin", "mineru-open-api"), "#!/bin/sh\nexit 0\n");
  for (const skillId of ["med-autoscience", "med-autogrant", "redcube-ai", "opl-bookforge"]) {
    writeFile(path.join(runtimeRoot, "skills", skillId, "SKILL.md"), "# skill\n");
  }
  for (const [modulePath, pluginId] of [
    ["modules/mas", "med-autoscience"],
    ["modules/mag", "med-autogrant"],
    ["modules/rca", "redcube-ai"],
  ]) {
    writeFile(
      path.join(runtimeRoot, modulePath, "plugins", pluginId, ".codex-plugin", "plugin.json"),
      "{}\n",
    );
    writeFile(
      path.join(runtimeRoot, modulePath, "plugins", pluginId, "skills", pluginId, "SKILL.md"),
      "# skill\n",
    );
  }
  for (const relativePath of [
    "modules/opl-flow/contracts/workflow-policy.json",
    "modules/opl-flow/templates/AGENTS.md",
    "modules/opl-flow/skills/opl-flow/SKILL.md",
    "modules/opl-flow/skills/future-flow-skill/SKILL.md",
  ]) {
    writeFile(
      path.join(runtimeRoot, relativePath),
      relativePath.endsWith(".json") ? "{}\n" : "# fixture\n",
    );
  }
  writeFile(
    path.join(runtimeRoot, "modules/opl-flow/.codex-plugin/plugin.json"),
    '{"skills":"./skills/"}\n',
  );
  writeFile(
    path.join(runtimeRoot, "modules/mas-scholar-skills/.codex-plugin/plugin.json"),
    '{"name":"mas-scholar-skills","skills":"./skills/"}\n',
  );
  writeFile(
    path.join(runtimeRoot, "modules/mas-scholar-skills/skills/mas-scholar-skills/SKILL.md"),
    "# Scholar Skills\n",
  );
  writeFile(
    path.join(
      runtimeRoot,
      "modules/mas-scholar-skills/contracts/opl_capability_package_manifest.json",
    ),
    JSON.stringify({
      package_id: "mas-scholar-skills",
      content_lock: {
        paths: [
          ".codex-plugin/plugin.json",
          "skills/mas-scholar-skills/SKILL.md",
        ],
      },
    }),
  );

  const assertions = collectRuntimeAssertions(runtimeRoot);
  assert.equal(assertions.prune_policy_id, "full_runtime_offline_first_install_slim_v1");
  assert.match(assertions.prune_policy_hash, /^[a-f0-9]{64}$/);
  assert.deepEqual(assertions.packaged_global_node_packages, ["corepack", "npm"]);
  for (const [entryPath, field] of [
    ["vendor/codex/codex_cli_darwin_arm64.tar.gz", "exists"],
    ["vendor/temporal/temporal_cli_darwin_arm64.tar.gz", "exists"],
    ["node/bin/npm", "executable"],
    ["modules/mag/plugins/med-autogrant/.codex-plugin/plugin.json", "exists"],
    ["modules/mag/plugins/med-autogrant/skills/med-autogrant/SKILL.md", "exists"],
    ["modules/mas-scholar-skills/.codex-plugin/plugin.json", "exists"],
    ["modules/mas-scholar-skills/skills/mas-scholar-skills/SKILL.md", "exists"],
  ]) {
    assert.equal(
      assertions.offline_required_payloads.find((entry) => entry.path === entryPath)?.[field],
      true,
      entryPath,
    );
  }
  assert.equal(
    assertions.offline_required_payloads.some((entry) => entry.path.includes("codex-ops-kit")),
    false,
  );
  assert.equal(
    assertions.offline_required_payloads.find(
      (entry) => entry.path === "modules/opl-flow/skills/future-flow-skill/SKILL.md",
    )?.exists,
    true,
  );
  assert.doesNotThrow(() =>
    writeFullRuntimeManifest(
      runtimeRoot,
      { version: "26.7.7-test" },
      "2026-07-07T00:00:00.000Z",
      {},
      {},
    ),
  );
  fs.rmSync(path.join(runtimeRoot, "modules", "opl-flow", "skills"), {
    recursive: true,
    force: true,
  });
  assert.throws(
    () => collectRuntimeAssertions(runtimeRoot),
    /declared skill root contains no SKILL\.md/,
  );
  writeFile(
    path.join(runtimeRoot, "modules/opl-flow/skills/opl-flow/SKILL.md"),
    "# skill\n",
  );
  fs.rmSync(path.join(runtimeRoot, "modules", "mag", "plugins", "med-autogrant", ".codex-plugin"), {
    recursive: true,
    force: true,
  });
  assert.throws(
    () =>
      writeFullRuntimeManifest(
        runtimeRoot,
        { version: "26.7.7-test" },
        "2026-07-07T00:00:00.000Z",
        {},
        {},
      ),
    /modules\/mag\/plugins\/med-autogrant\/\.codex-plugin\/plugin\.json/,
  );
  for (const entryPath of ["node/include", "node/lib/node_modules/npm/docs"]) {
    assert.equal(
      assertions.declared_pruned_paths.find((entry) => entry.path === entryPath)?.present,
      false,
      entryPath,
    );
  }
});
