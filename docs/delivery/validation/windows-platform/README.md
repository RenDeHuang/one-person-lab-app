# Windows Hyper-V Factory Contract

State: `validation_only_non_binding`

The only active factory root for this cohort is `C:\OPL-VMs`. The recovered
`E:\_Original-E-20260726\OPL-VMs` tree remains a read-only recovery source until
terminal closeout. No request, lease, VM configuration, VHDX, checkpoint,
runtime namespace, or receipt namespace may resolve below that recovery tree.

The factory creates two isolated Simplified Chinese Windows 11 VMs:

- `OPL-V6-WSL2-01`, whose only guest writer is task
  `019f97e4-288a-7140-8850-925c657d8c71` after an exact V6 writer lease;
- `OPL-WEBUI-CLEAN-01`, which remains powered off with WebUI runtime authority
  `0` until a separate operation is authorized.

Both guests require `zh-CN` installation media, UI, system and user locale and
TIP `0804:00000804`. Their VHDX, checkpoint, VM ID, switch, NAT, IP, port,
runtime and receipt namespaces must be disjoint.

## Copy, Verify, Cut Over

Copy only the official ISO, base cache, platform scripts, immutable packets and
necessary sanitized evidence from the exact recovery source into a random absent
`C:\OPL-VMs.staging-<GUID>` directory. Generate a sorted relative-path, size and
SHA256 manifest, verify every destination file against the source, then rename
the staging directory once to `C:\OPL-VMs`. Keep the recovery source unchanged.
Existing recovery-source request and lease JSON files are evidence only and
must not be copied into the active `C:\OPL-VMs\Leases` namespace.

Every task-owned host script placed under `C:\OPL-VMs\Scripts` is sealed in the
post-resize gate receipt by exact path and SHA256. The canonical source owns the
schemas, factory plan, request generator and verifier; a host script does not
become canonical merely because it exists on C:.

## Ordered Gates

1. Validate C: capacity, NTFS, Disk 0 GPT/WinRE, released F:, zero new Weston
   crash dumps during a bounded observation, official zh-CN ISO identity, and
   copy/hash parity with `windows-platform-post-resize-gate.schema.json`. The
   same receipt binds canonical main/source/delivery commit and tree identities,
   packet manifest SHA256, authenticated and anonymous raw parity, and the
   absorption-audit receipt.
2. Run the storage probe exactly once. An unknown result permits only read-only
   reconciliation, never a second mutation.
3. Use `fixtures/New-OPLWindowsVMRequest.ps1` to create fresh C-root requests
   bound to the current App acceptance, delivery, manifest, post-resize gate and
   storage-probe receipts. E-root requests and old request SHA256 values fail
   closed.
4. Create each VM exactly once. A media-attached checkpoint is only a factory
   checkpoint and cannot satisfy clean baseline admission.
5. After interactive OOBE and guest readback, seal a powered-off
   `OPL-Clean-Windows-zh-CN-*` checkpoint. The attestation binds the same VM UUID,
   configuration path, full VHDX chain, checkpoint, zh-CN/TIP receipt and
   isolated switch/NAT identity.
6. Grant the generic platform lease, then the exact V6 writer lease. The V6
   lease binds the fresh request, delivery, frozen acceptance, manifest, C-root
   paths, powered-off VM identity and clean attestation. It authorizes exactly
   build seal, fixture phase transition, visible smoke and soft shutdown.

## Terminal Contract

The V6 executor performs stopped, running and restart-persistence phases under
one active lease. The final host closeout requires the same VM to be powered
off and records operation-owned process, listener and writer counts as zero.
The independent verdict owner consumes those receipts but does not operate the
VM.

After verdict, terminal platform evidence must bind the canonical remote main
commit/tree, authenticated and anonymous raw parity, absorption audit, task-ref
cleanup, released lease, zero ownerless/duplicate writers and both VMs powered
off. At `stage=terminal_closeout`, task worktree, local task branch and remote
task branch removal must all be true and `remaining_source_cleanup_count` must
be zero. VM retention follows the product contract; it is not treated as a Git
development artifact. E: cleanup remains a proposal until C: parity and all
recovery obligations are closed.
