# Upstream Porting Status - 2026-05-27

This document records the current state of the selective upstream port from
`mcu-debug/mcu-debug` into this fork.

## Baseline

- Porting pass date: 2026-05-27
- Next scheduled upstream review: 2026-06-27
- Local fork head before this pass: `28b1624`
- Upstream fetched remote: `upstream`
- Upstream target inspected: `upstream/main`
- Current upstream head inspected: `77947f4`
- Merge base with upstream: `2e6992a`

The upstream range from `2e6992a..upstream/main` contains 74 commits. A direct
merge is intentionally avoided because it would delete or overwrite several
fork-owned product features.

## Fork Features To Preserve

These files/features are fork-owned and must be kept unless a later migration
explicitly replaces them:

- `packages/mcu-debug/src/frontend/mcp-server.ts`
- `packages/mcu-debug/support/mcp-bridge.js`
- `packages/mcu-debug/src/frontend/views/live-watch-grapher.ts`
- `packages/mcu-debug/src/frontend/views/live-watch-logger.ts`
- `packages/mcu-debug/resources/live-watch-graph.html`
- `packages/mcu-debug/resources/live-watch-graph.js`
- `docs/mcu-debug-mcp.md`
- `README.md` sections describing MCU-AI-Debug, MCP, snapshots, recording, and graphing
- `packages/mcu-debug/package.json` branding, publisher, icon, MCP settings, and `mcu-ai-debug.*` commands

## Ported In This Pass

The following upstream changes were accepted because they are small, local, and
do not pull in the remote/WSL/serial/cockpit/CLI stack:

- `564f452` concept: Live Watch monitor now detaches with `-target-detach` instead of `-target-disconnect` during cleanup.
- `34d82a9` concept: stopped-thread parsing tolerates a missing MI record and still creates a fallback thread.
- `0a72577` core fix: `symbolFiles` address handling now accepts number/string/bigint values through `parseAddrVal()`, preventing runtime crashes when launch config values are not already bigint.
- `010b9c2` partial: `packages/shared` esbuild output is only minified in production and keeps source content for development debugging.
- `010b9c2`/`d95ab43` partial: extension startup logging now records workspace location and handles the no-workspace case.
- `.gitignore` now ignores generated `packages/shared/lib/`.

## Deliberately Not Ported Yet

These upstream areas were intentionally deferred for this pass:

- Remote / SSH / WSL support: begins around `1e1f07d`, `fee5750`, `146da03`, `198942d`, `8bd71e1`, `e71dd3d`, `1b16d33`, `eadafd2`.
- Serial proxy and UART management: begins around `8c5e42f`, `461b4f3`, `da7061b`, `7af6c9b`, `fe48a62`, `f286d3f`, `e83fa54`, `4350377`, `b1734a1`, `aa8f4d2`, `3bfb463`.
- Cockpit panel/webview: begins around `9e98358`, then continues through `ebbf571`, `8ce8d8b`, `9f24551`, `34428ca`, `811dc89`.
- CLI/TUI stack: begins around `7508403`, then continues through `93a6214`, `f6a70c2`, `c1157e1`, `2869443`, `4fd42d1`, `7d3b34a`, `46e5313`, `ffa0eac`, `77947f4`.
- Large common/frontend refactor: `5dfb531` and `fe5fbc2`. These are likely useful later, but they move many frontend APIs into `src/common` and must be reconciled with MCP and Live Watch graph/recording code.
- TypeScript 6 / VS Code engine bump: `930069f` and follow-up build commits. Defer until the dependency and package-lock strategy is decided.
- Helper binary rename from `mcu-debug-helper` to `mcu-debug`: `eb052c7`. This touches Rust package names, scripts, manifests, proxy code, docs, and packaged binaries, so it should be done as a dedicated migration.

## Known Conflict Hotspots

A dry merge check showed conflicts or fork-dangerous changes in:

- `package.json`
- `package-lock.json`
- `packages/mcu-debug/package.json`
- `packages/mcu-debug/src/frontend/extension.ts`
- `packages/mcu-debug/src/frontend/views/live-watch.ts`
- `packages/mcu-debug/src/adapter/server-session.ts`
- `scripts/build-binaries.sh`
- `docs/mcu-debug-mcp.md`
- `README.md`

Upstream also deletes the fork's MCP server, MCP bridge, graph resources, and
Live Watch logger/grapher files. Treat those deletions as rejected by default.

## Suggested Next Pass

1. Decide whether this fork wants the upstream `src/common` refactor without the cockpit/CLI layer. If yes, port `5dfb531` and `fe5fbc2` manually, then reattach the MCP and Live Watch integrations.
2. Decide whether the helper binary rename is desired. If yes, migrate Rust package names, packaging scripts, docs, and generated binary layout together.
3. Revisit TypeScript 6 and VS Code `^1.108.1` only after the common refactor decision, because the package-lock churn is large.
4. If remote/WSL/serial/cockpit/CLI are still out of scope, keep rejecting changes under `packages/mcu-debug-proxy`, `packages/mcu-debug/src/cli`, `packages/mcu-debug/src/webviews/cockpit`, and the upstream serial manager/proxy helper additions.
5. After each future porting batch, run `npm run compile` and manually smoke-test:
   - MCP config generation
   - `get_livewatch_variables`
   - snapshot export
   - CSV/JSONL recording
   - Live Watch graph opening and rendering
