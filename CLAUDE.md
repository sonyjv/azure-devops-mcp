# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

An MCP (Model Context Protocol) server that gives AI agents access to Azure DevOps. It's a thin `stdio` wrapper over the Azure DevOps REST APIs (via `azure-devops-node-api`) — each tool does one focused ADO task; the AI agent handles higher-level reasoning. The project intentionally avoids complex, multi-step tools (see CONTRIBUTING.md).

This repo builds the **local** MCP server (`@azure-devops/mcp` on npm upstream, binary `mcp-server-azuredevops`). Microsoft's recommended path for new users is a separate hosted **remote** MCP server; this repo remains supported but new tool development still happens here.

**This is a fork** ([sonyjv/azure-devops-mcp](https://github.com/sonyjv/azure-devops-mcp)) of [microsoft/azure-devops-mcp](https://github.com/microsoft/azure-devops-mcp), diverging to add support for connecting to an on-premises Azure DevOps Server / TFS collection (not just Azure DevOps Services/cloud) — see the `resolveOrgUrl` flow in `src/utils.ts`/`src/index.ts`, the host-allow-list changes in `src/auth.ts`, and [docs/GETTINGSTARTED.md](./docs/GETTINGSTARTED.md#azure-devops-server-on-premises). It is not published to npm and isn't intended to be merged upstream, so setup docs across this repo point at running from source rather than `npx @azure-devops/mcp`.

## Commands

```bash
npm run build           # tsc compile + chmod dist/*.js (runs prebuild: regenerates src/version.ts from package.json)
npm run watch            # tsc --watch
npm test                 # jest (all tests, with coverage)
npm test test/src/tools/core.test.ts       # single test file
npm test -- -t "test name substring"       # single test by name
npm run validate-tools   # tsc --noEmit + scripts/build-validate-tools.js (tool/param name lint, see below)
npm run eslint           # lint
npm run eslint-fix       # lint --fix
npm run format           # prettier --write .
npm run format-check     # prettier --check .
npm run inspect           # runs dist/index.js through the MCP inspector UI
```

`npm run build` must succeed before `npm start` / `npm run inspect`, since those run compiled `dist/`, not `src/`. There is no separate lint-only test target — `validate-tools` and `eslint` are both run in CI/pre-commit (husky + lint-staged run `npm run format` on staged files).

Running the server directly requires an organization argument: `node dist/index.js <organization> [--domains ...] [--authentication ...]` (see `src/index.ts` for full CLI flags).

## Architecture

### Entry point and wiring

`src/index.ts` parses CLI args (yargs), resolves the Azure AD tenant for the org (`src/org-tenants.ts`), builds an `authenticator` (`src/auth.ts`) and a `connectionProvider` (a `() => Promise<WebApi>` factory using `azure-devops-node-api`), then calls `configureAllTools(...)` from `src/tools.ts` to register tools on an `@modelcontextprotocol/sdk` `McpServer`, and connects it over `StdioServerTransport`.

Every tool-registration function shares the same signature shape: `(server: McpServer, tokenProvider, connectionProvider, userAgentProvider?) => void`. `tokenProvider`/`connectionProvider` are lazy factories (not eagerly-resolved values) so auth happens per-call, lazily, and can be re-resolved (e.g. token refresh).

### Domains (`src/shared/domains.ts`)

Tools are grouped into domains (`core`, `work`, `work-items`, `search`, `test-plans`, `repositories`, `wiki`, `pipelines`, `advanced-security`, plus an internal `mcp-apps` domain that is excluded from "all" and must be opted into explicitly). `DomainsManager` parses the `--domains`/`-d` CLI flag (comma-separated string or array; `"all"` or omitted enables every domain except `mcp-apps`) and `src/tools.ts` uses `configureIfDomainEnabled` to conditionally call each domain's `configure*Tools` function. When adding a new tool, put it in the domain file that matches its ADO API surface — don't create new domains without discussion (see CONTRIBUTING.md).

### Tool modules (`src/tools/*.ts`)

One file per domain (`core.ts`, `work.ts`, `work-items.ts`, `repositories.ts`, `pipelines.ts`, `wiki.ts`, `test-plans.ts`, `search.ts`, `advanced-security.ts`, `mcp-apps.ts`), plus `auth.ts` (identity lookups) and `pipelines.dto.ts` (pipeline-specific request/response types). Every module follows the same pattern:

1. A `const X_TOOLS = { action_name: "domain_action_name" }` map — the object keys are internal names, the string values are the actual MCP tool names exposed to the client (snake_case, `{domain}_{action}` convention).
2. A `configureXTools(server, ...)` function that calls `server.tool(TOOL_NAME, description, zodSchema, handler)` once per tool.
3. Handlers wrap the ADO API call in try/catch, returning `{ content: [{ type: "text", text: ... }], isError: true }` on failure and `{ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }` on success — no thrown errors escape to the MCP layer.
4. Both the `X_TOOLS` map and `configureXTools` are exported for use in `src/tools.ts` and in tests.

**Tool/parameter naming is enforced, not just conventional.** Tool names and Zod schema parameter names must match `^[a-zA-Z0-9_.-]{1,64}$` (Claude API's hard requirement) — enforced by an ESLint rule (`eslint-rules/tool-name-lint-rule.js`, applies to `src/tools/*.ts`) and by `npm run validate-tools` (`scripts/build-validate-tools.js`), both built on the shared logic in `src/shared/tool-validation.ts`. See `docs/TOOL-NAME-VALIDATION.md` for the full rationale/rules. Keep new tool names ≤64 chars and new parameter names ≤32 chars (recommended).

### Cross-cutting helpers (`src/shared/`)

- `elicitations.ts` — `elicitProject`/`elicitTeam` prompt the user (via MCP `elicitInput`) to pick a project/team when a tool's `project`/`team` arg is omitted, unless `ado_mcp_project`/`ado_mcp_team` env vars supply a default. Tools that take an optional `project`/`team` should reuse these rather than reimplementing selection UI.
- `content-safety.ts` — `createExternalContentResponse`/`spotlightContent` wrap any content fetched from Azure DevOps (wiki pages, work item text, PR descriptions, etc.) in randomized delimiters before returning it to the model, so untrusted external content can't be mistaken for instructions (prompt-injection mitigation — see the referenced paper). Use this for any tool surfacing free-text ADO content back to the model.
- `tool-validation.ts` — see naming enforcement above.

### Auth (`src/auth.ts`, `src/org-tenants.ts`)

`createAuthenticator(type, tenantId)` returns a `() => Promise<string>` token factory for one of: `interactive` (default off-Codespaces; MSAL OAuth via `OAuthAuthenticator`, with native broker + fallback), `azcli`/`env` (`DefaultAzureCredential`/`AzureCliCredential` chain), `envvar` (`ADO_MCP_AUTH_TOKEN`), `pat` (`PERSONAL_ACCESS_TOKEN`, base64 `email:token`). For `pat` mode, `installPatFetchInterceptor` monkey-patches `globalThis.fetch` to rewrite the outgoing `Bearer` header to `Basic`, but only for requests targeting an allow-listed ADO host (`patAllowedHosts` / `*.visualstudio.com`) — this is a deliberate exfiltration guard; don't widen the host allow-list without good reason. `getOrgTenant` resolves the AAD tenant for an org name (used unless `--tenant` is passed explicitly).

### Tests (`test/`)

Mirrors `src/` (`test/src/...`, `test/src/tools/...`). Tests mock `McpServer` as `{ tool: jest.fn(), server: { elicitInput: jest.fn() } }`, capture the registered handler via `(server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "...")`, and invoke it directly with a mocked `connectionProvider` returning a fake `WebApi` (whose sub-APIs, e.g. `getCoreApi()`, are jest mocks). `test/mocks/` holds larger reusable fixture objects (pipelines, work items). Jest uses `ts-jest` with `tsconfig.jest.json` (CommonJS + `isolatedModules`) — `moduleNameMapper` in `jest.config.cjs` rewrites certain `.js` imports back to `.ts` since source uses ESM-style `.js` extensions (Node16 module resolution) that ts-jest under CommonJS can't resolve directly. Coverage threshold is 40% (global) — not a target, just a floor.

## Conventions

- Source uses ESM (`"type": "module"`, `NodeNext`/`Node16` resolution) — internal imports must use explicit `.js` extensions even though the files are `.ts`.
- Every `src/**/*.ts` file except `src/index.ts` requires the two-line MIT copyright header (enforced by `eslint-plugin-header`); `src/version.ts` is generated (`prebuild` script) and ESLint-ignored — don't hand-edit it.
- All logging goes through `src/logger.ts` (winston, `LOG_LEVEL` env var). MCP servers communicate over stdout via `stdio`, so logs must never touch `stdout` — winston here is already configured for `stderr`. Don't add `console.log`.
- `getCliArgs()` in `src/utils.ts` deliberately doesn't use yargs' `hideBin` — see the docstring for why it breaks under Electron.
