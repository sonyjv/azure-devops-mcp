# Azure DevOps MCP Server

> [!NOTE]
> **This is a fork.** [sonyjv/azure-devops-mcp](https://github.com/sonyjv/azure-devops-mcp) is a personal fork of [microsoft/azure-devops-mcp](https://github.com/microsoft/azure-devops-mcp), the official Azure DevOps MCP Server. It adds support for connecting to an **on-premises Azure DevOps Server / TFS collection**, in addition to Azure DevOps Services (cloud) — see [Azure DevOps Server (On-Premises)](./docs/GETTINGSTARTED.md#azure-devops-server-on-premises).
>
> This fork is published to npm as [`@sonyjv/azure-devops-mcp`](https://www.npmjs.com/package/@sonyjv/azure-devops-mcp) (Microsoft's own `@azure-devops/mcp` name is upstream's) — run it with `npx -y @sonyjv/azure-devops-mcp`, no separate clone or build step needed. It is not intended to be merged upstream. See [Local MCP Server Installation](#local-mcp-server-installation-optional).
>
> New to this and not sure what it actually does? [How It Works](./docs/how-it-works.html) is a plain-language walkthrough — pulling a requirement out of Azure DevOps, drafting test cases with Copilot, and publishing them back — written for non-technical readers. Download it and open it in a browser to view it rendered (GitHub shows `.html` files as source code, not as a page).

> [!WARNING]
> We recently completed a full tool consolidation that includes renaming of existing tools. Please see the [Toolset documentation](docs/TOOLSET.md) for the complete list of new tool names.

This project gives AI agents access to Azure DevOps through the Model Context Protocol (MCP). Use the hosted remote server for the simplest setup, or run the local server when you need a `stdio` connection — or when you need on-premises Azure DevOps Server support, which the hosted remote server (below) does not provide.

## Table of Contents

> [!IMPORTANT]
> If you're on Azure DevOps Services (cloud) and don't need on-premises support, Microsoft's [Remote MCP Server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server) requires no installation and gets new features first — see [Learn more](#remote-mcp-server-recommended). It does **not** support on-premises Azure DevOps Server, which is this fork's reason for existing — on-prem users need the local server below.

1. [Overview](#overview)
2. [How It Works (Plain-Language Walkthrough)](./docs/how-it-works.html)
3. [Design](#design)
4. [Remote MCP Server (Recommended)](#remote-mcp-server-recommended)
5. [Supported Tools](#supported-tools)
6. [Local MCP Server Installation (Optional)](#local-mcp-server-installation-optional)
7. [Using Domains (Local Server)](#using-domains-local-server)
8. [Project and Team Defaults (Local Server)](#project-and-team-defaults-local-server)
9. [Troubleshooting](#troubleshooting)
10. [Examples and Best Practices](#examples-and-best-practices)
11. [Frequently Asked Questions](#frequently-asked-questions)
12. [Contributing](#contributing)

## Overview

The Azure DevOps MCP Server brings Azure DevOps context to your agents. Try prompts like:

- "List my ADO projects"
- "List ADO Builds for 'Contoso'"
- "List ADO Repos for 'Contoso'"
- "List test plans for 'Contoso'"
- "List teams for project 'Contoso'"
- "List iterations for project 'Contoso'"
- "List my work items for project 'Contoso'"
- "List work items in current iteration for 'Contoso' project and 'Contoso Team'"
- "List all wikis in the 'Contoso' project"
- "Create a wiki page '/Architecture/Overview' with content about system design"
- "Update the wiki page '/Getting Started' with new onboarding instructions"
- "Get the content of the wiki page '/API/Authentication' from the Documentation wiki"

## Design

Each tool handles a focused Azure DevOps task. The server provides a thin layer over the REST APIs, while the AI agent handles higher-level reasoning.

## Remote MCP Server (Recommended)

For complete instructions, see the [Remote MCP Server onboarding documentation](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops).

The remote server will eventually replace the local server. The local server remains supported, but new development will focus on the remote server. Existing local server users should begin planning their migration.

If you encounter issues with tools, need support, or have a feature request, you can report an issue using the [Remote MCP Server issue template](https://github.com/microsoft/azure-devops-mcp/issues/new?template=remote-mcp-server-issue.md). During the preview period, we will track Remote MCP Server issues through this repository.

### Quick Start

Create `.vscode/mcp.json` in your project and add this configuration. Replace `{organization}` with your Azure DevOps organization name.

```json
{
  "servers": {
    "ado-remote-mcp": {
      "url": "https://mcp.dev.azure.com/{organization}",
      "type": "http"
    }
  },
  "inputs": []
}
```

See the [remote server configuration documentation](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#mcpjson-configuration) for more options.

After saving `.vscode/mcp.json`, start the server from the MCP view in VS Code, then run a prompt like `List ADO projects`.

## Supported Tools

See the [Available Tools](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server?view=azure-devops#available-tools) documentation for the complete list of available remote tools.

For the complete list of local tools, see [TOOLSET.md](./docs/TOOLSET.md).

## Local MCP Server Installation (Optional)

> [!NOTE]
> This fork publishes under its own package name, `@sonyjv/azure-devops-mcp` — `npx -y @azure-devops/mcp` (as documented for the [upstream project](https://github.com/microsoft/azure-devops-mcp)) installs Microsoft's original package, **not** this fork's on-premises support. `npx -y @sonyjv/azure-devops-mcp` works exactly like installing any published npm package — no clone or build step, and no local `git` needed. If you'd rather always track the unreleased `main` branch instead of a published version, `npx -y github:sonyjv/azure-devops-mcp` also works, though it needs `git` and direct network access to GitHub, which some locked-down/corporate networks block even when npm registry access works fine. Clone-and-build (see [Run from Source](./docs/GETTINGSTARTED.md#run-from-source)) is only needed if you're modifying the code yourself.

These steps use Visual Studio Code and GitHub Copilot. For other supported clients, including Visual Studio 2022, Codex, Claude Code, Cursor, OpenCode, and Kilo Code, see the [getting started guide](./docs/GETTINGSTARTED.md). That guide also covers connecting to an on-premises Azure DevOps Server / TFS collection instead of Azure DevOps Services — see [Azure DevOps Server (On-Premises)](./docs/GETTINGSTARTED.md#azure-devops-server-on-premises).

### Prerequisites

1. Install [VS Code](https://code.visualstudio.com/download) or [VS Code Insiders](https://code.visualstudio.com/insiders).
2. Install [Node.js 20 or later](https://nodejs.org/en/download).
3. Open your project in VS Code.

### Installation

#### Install from npm

1. Create `.vscode/mcp.json` in your project.
2. Add this configuration:

```json
{
  "inputs": [
    {
      "id": "ado_org",
      "type": "promptString",
      "description": "Azure DevOps organization name (e.g. 'contoso'), or a full on-premises collection URL (e.g. 'http://tfsserver:8080/tfs/DefaultCollection')"
    }
  ],
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@sonyjv/azure-devops-mcp", "${input:ado_org}"]
    }
  }
}
```

3. Save the file, then start the `ado` server from the MCP view in VS Code.
4. Open GitHub Copilot Chat and switch to [Agent mode](https://code.visualstudio.com/blogs/2025/02/24/introducing-copilot-agent-mode).
5. Select the Azure DevOps tools, then try a prompt such as `List ADO projects`.
6. When prompted, sign in with a Microsoft account that has access to the selected Azure DevOps organization (or configure PAT authentication for an on-premises server — see [Authentication](./docs/GETTINGSTARTED.md#authentication)).

To pin to a specific released version instead of always resolving `latest`, replace `@sonyjv/azure-devops-mcp` with `@sonyjv/azure-devops-mcp@<version>` (see the [available versions](https://www.npmjs.com/package/@sonyjv/azure-devops-mcp?activeTab=versions)).

For better tool selection, add `.github/copilot-instructions.md` to your project with this instruction:

```text
This project uses Azure DevOps. Always check whether the Azure DevOps MCP server has a tool relevant to the user's request.
```

## Using Domains (Local Server)

The local server includes many tools. Domains let you load only the tool groups you need, which keeps the tool list manageable and helps clients with tool limits. Available domains are `core`, `work`, `work-items`, `search`, `test-plans`, `repositories`, `wiki`, `pipelines`, and `advanced-security`.

Add `-d` followed by the domains to the server arguments. For example, this configuration loads only work item-related tools:

```json
{
  "inputs": [
    {
      "id": "ado_org",
      "type": "promptString",
      "description": "Azure DevOps organization name  (e.g. 'contoso')"
    }
  ],
  "servers": {
    "ado_with_filtered_domains": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@sonyjv/azure-devops-mcp", "${input:ado_org}", "-d", "core", "work", "work-items"]
    }
  }
}
```

Always include `core` so the agent can retrieve project information.

> If you omit `-d`, the server loads all domains.

## Project and Team Defaults (Local Server)

Set default Azure DevOps project and team values in `.vscode/mcp.json` so tools can skip selection prompts.

### Example `.vscode/mcp.json`

```json
{
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@sonyjv/azure-devops-mcp", "myorg", "--authentication", "azcli"],
      "env": {
        "ado_mcp_project": "Contoso",
        "ado_mcp_team": "Fabrikam Team"
      }
    }
  }
}
```

## Troubleshooting

See the [Troubleshooting guide](./docs/TROUBLESHOOTING.md) for help with common issues and logging.

## Examples

See the [examples](./docs/EXAMPLES.md) for sample prompts.

## Frequently Asked Questions

For answers to common questions about the Azure DevOps MCP Server, see the [Frequently Asked Questions](./docs/FAQ.md).

## Contributing

We welcome contributions. During preview, file issues for bugs, enhancements, or documentation improvements.

See our [Contributions Guide](./CONTRIBUTING.md) for:

- Development setup
- Adding new tools
- Code style and testing
- Pull request process

Read the [Contributions Guide](./CONTRIBUTING.md) before creating a pull request.

## Code of Conduct

This project follows the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For questions, see the [FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [open@microsoft.com](mailto:open@microsoft.com).

## Hall of Fame

Thanks to all contributors who make this project awesome! ❤️

[![Contributors](https://contrib.rocks/image?repo=microsoft/azure-devops-mcp)](https://github.com/microsoft/azure-devops-mcp/graphs/contributors)

> Generated with [contrib.rocks](https://contrib.rocks)

## License

Licensed under the [MIT License](./LICENSE.md).

---

_Trademarks: This project may include trademarks or logos for Microsoft or third parties. Use of Microsoft trademarks or logos must follow [Microsoft’s Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general). Third-party trademarks are subject to their respective policies._

<!-- version: 2023-04-07 [Do not delete this line, it is used for analytics that drive template improvements] -->
