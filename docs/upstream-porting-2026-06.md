# Upstream Porting Status - 2026-06-21

This document continues `docs/upstream-porting-2026-05.md` and records the
second selective upstream review from `mcu-debug/mcu-debug` into this fork.

## Baseline

- Review date: 2026-06-21
- Next scheduled upstream review: 2026-07-21
- Local fork head before this pass: `e12b64a`
- Upstream remote: `upstream`
- Previously reviewed upstream head: `77947f4`
- Current upstream head reviewed: `3fa6956`
- Merge base with upstream: `2e6992a`
- New commits reviewed in this pass: 50
- Total divergence at review time: 14 local-only commits and 124 upstream-only commits

The review covered every commit in `77947f4..3fa6956`. A direct merge remains
unsafe: the range changes 231 files, adds a large documentation application,
renames the Rust helper, and continues the CLI, cockpit, remote, and serial
architecture that this fork deliberately excluded in the previous pass.

The pre-existing uncommitted changes in `live-watch.ts` and generated
`packages/shared/lib/*` files were preserved and were not treated as part of
this upstream port.

## Fork Features To Preserve

The preservation list from the May review still applies, including:

- MCP server and bridge behavior
- Live Watch snapshot, recording, graphing, and local struct selection
- MCU-AI-Debug branding, command IDs, publisher metadata, and settings
- Fork documentation in `README.md` and `docs/mcu-debug-mcp.md`

In particular, this pass does not import upstream changes that would replace
or indirectly delete the fork-owned MCP and Live Watch integrations.

## Ported In This Pass

The following upstream concepts were manually adapted to the current fork
instead of cherry-picking their commits:

- `99361f2` partial: GDB startup now has a 60-second overall timeout, emits
  progress every five seconds, and lets the first version probe exceed the
  normal command timeout. The serial subcommand from the same commit was not
  imported.
- `befc37b` partial: missing `debugFlags` no longer replaces the GDB instance's
  valid default flags with `undefined`.
- `9278515` and `49af36a`: Debug Adapter Protocol termination capabilities and
  cleanup now distinguish terminate, suspend, and normal disconnect. Normal
  disconnect resumes and detaches; terminate or suspend stays halted and
  disconnects.
- `49af36a`: Live Watch GDB cleanup uses `-target-disconnect`, avoiding the
  unintended target resume caused by `-target-detach`, and its asynchronous
  shutdown is awaited before the main GDB instance is stopped.
- `bc30598`: `preLaunchCommands` and `preAttachCommands` now run before GDB's
  server connection commands, matching their names and allowing setup that
  must precede target connection.
- `465aa01` partial: the delay required after custom post-start or post-reset
  commands now occurs before an automatic continue. The Windows USB hot-plug
  and Rust helper changes from the same commit were not imported.

## Reviewed And Deferred

All remaining commits were reviewed and grouped below. Hashes listed in a
group are fully deferred unless a partial import is called out above.

### CLI, TUI, Cockpit, and RTT Lifecycle

- `74e9847`, `37f14c5`, `562710c`, `baa091f`, `187c20e`, `cf115c8`
- `0fcc544`, `00619f8`, `5af8d04`, `6371687`, `549ff29`

These changes assume the common/frontend refactor, the Rust cockpit transport,
or the upstream CLI session driver. Importing isolated portions would create a
second lifecycle beside the fork's VS Code and MCP integrations. The RTT
startup rewrite in `00619f8` is useful, but it should be revisited as one unit
rather than reduced to its 20 ms timer change.

### Helper Rename, Packaging, and Dependencies

- `a2de497`, `2b46e8a`, `0f3c34b`, `85d8576`, `d8df18d`
- `b7a9bec`, `0462dfc`, `482eeb4`, `055e9ad`, `f0e1eac`

Upstream now renames the helper and product to `mdbg`, adds an npm launcher,
and rewrites build/package scripts around that layout. This conflicts with the
fork's package identity and is still a dedicated migration decision. The large
lockfile update in `b7a9bec` is therefore also deferred.

### Server, Serial, and Configuration Changes

- Deferred portions of `465aa01` and `99361f2`
- `b2f92d0`, `ad59b04`, `1495820`, `0153d15`

These changes depend on upstream CLI configuration loading, serial enumeration,
or later server-process ownership. The fork already has local server startup
fallbacks and split-chunk buffering in `server-session.ts`; replacing them with
`1495820` would discard fork-specific Windows startup handling. The stricter
`envFile` parser in `0153d15` remains a good standalone candidate once tests
for quoting, Windows paths, precedence, and substitution are added locally.

### Documentation Site and Repository Automation

- `c428213`, `3b0069c`, `798df55`, `50a36f8`, `813a2d9`, `ac5d35c`
- `67c5412`, `04171a0`, `85e3e14`, `ffc3351`, `7b1c3fe`
- `2f45100`, `19df610`, `fd18f85`, `c27a7e8`, `4dc431a`, `3fa6956`

This group adds the Docusaurus application, generated launch-property docs,
GitHub Pages deployment, Node 22 requirements for the docs app, and workflow
updates. It is product documentation for the upstream CLI/remote/cockpit stack
and does not describe this fork accurately.

### Local Repository Policy

- `cb315e7`, `8abb0e1`

Claude settings and upstream local-ignore policy are not portable product
changes and were left out.

## Superseded May Decision

The May pass adopted `564f452`'s use of `-target-detach` for Live Watch cleanup.
Upstream `49af36a` later identified that detach can resume a halted MCU. This
pass intentionally supersedes that one May detail: the auxiliary Live Watch
GDB now disconnects before exiting, while the main session only detaches when
the user's disconnect request explicitly permits the target to continue.

## Validation

- `npm run compile --workspace=packages/mcu-debug`: passed, including the Rust
  helper build/tests, manifest generation, strict TypeScript check, and esbuild.
- `npx tsc --noEmit -p packages/mcu-debug/tsconfig.json`: passed.
- Direct invocation of `src/test/sync-files-utils.test.ts`: passed (1 test).
- `npm run test:unit --workspace=packages/mcu-debug`: the script itself remains
  broken because its shell does not expand the literal `src/test/**/*.test.ts`
  glob; this is an existing test-runner issue, not a test failure.

No hardware debug session was available, so terminate/suspend/disconnect target
state still requires the smoke test listed below.

## Next Pass

1. Start the next review from `3fa6956`, not from the old merge base.
2. Decide whether the fork wants the upstream GDB/RTT initialization lifecycle
   as a whole before porting `00619f8`.
3. Add focused `envFile` parser tests, then consider a local adaptation of
   `0153d15` without importing the CLI config loader.
4. Keep the helper rename, Docusaurus site, CLI/cockpit stack, and serial proxy
   out until their product-level adoption is explicitly approved.
5. Hardware-smoke-test all three disconnect modes: normal disconnect should
   leave the MCU running, suspend should leave it halted, and terminate should
   stop the debuggee without the Live Watch connection resuming it first.
