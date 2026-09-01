# Getting Started

This guide explains how to run the local Azure DevOps MCP Server with supported MCP clients.

> [!NOTE]
> This is [sonyjv/azure-devops-mcp](https://github.com/sonyjv/azure-devops-mcp), a fork of the official [microsoft/azure-devops-mcp](https://github.com/microsoft/azure-devops-mcp) that adds support for connecting to an on-premises Azure DevOps Server / TFS collection (see [Azure DevOps Server (On-Premises)](#azure-devops-server-on-premises)). It is **not** published to npm, so every client below is configured to run the server you [build from source](#build-the-server) rather than via `npx`. If you're only targeting Azure DevOps Services (cloud) and don't need on-premises support, the hosted [Remote MCP Server](https://learn.microsoft.com/en-us/azure/devops/mcp-server/remote-mcp-server) or the [upstream project](https://github.com/microsoft/azure-devops-mcp) may be a simpler fit.

- [Prerequisites](#prerequisites)
- [Build the Server](#build-the-server)
- [Authentication](#authentication)
- [Visual Studio Code](#visual-studio-code)
- [Visual Studio](#visual-studio)
- [GitHub Copilot CLI](#github-copilot-cli)
- [Codex](#codex)
- [Claude Code](#claude-code)
- [Claude Desktop](#claude-desktop)
- [Cursor](#cursor)
- [OpenCode](#opencode)
- [Kilo Code](#kilo-code)

## Prerequisites

All local setups require:

1. [Node.js 20 or later](https://nodejs.org/en/download).
2. [Git](https://git-scm.com/downloads).
3. Access to an Azure DevOps organization (cloud) or an Azure DevOps Server / TFS collection (on-premises).
4. An MCP client listed below.

Visual Studio Code users need [VS Code](https://code.visualstudio.com/download) or [VS Code Insiders](https://code.visualstudio.com/insiders). Visual Studio users need [Visual Studio 2022 version 17.14 or later](https://learn.microsoft.com/en-us/visualstudio/releases/2022/release-history).

## Build the Server

Every client configuration below runs the server with `node`, pointing at the `dist/index.js` this step produces. Do this once, then reuse the same path in every client section:

```bash
git clone https://github.com/sonyjv/azure-devops-mcp.git
cd azure-devops-mcp
npm install
npm run build
```

(`npm install` also builds the server via its `prepare` script, so the separate `npm run build` isn't strictly required — run it again any time you pull new changes.)

Note the absolute path to the cloned folder (e.g. `/Users/you/azure-devops-mcp` or `C:\Users\you\azure-devops-mcp`) — the examples below use `/absolute/path/to/azure-devops-mcp` as a placeholder for it. To pick up new changes later, run `git pull && npm install` in the cloned repo and restart the server from your MCP client.

## Authentication

Interactive authentication is the default. To use another method, add `--authentication <value>` or `-a <value>` to the server arguments.

| Method                   | Value         | Required setup             |
| ------------------------ | ------------- | -------------------------- |
| Interactive (default)    | `interactive` | Microsoft account sign-in  |
| Azure CLI                | `azcli`       | Active `az login` session  |
| Azure credential chain   | `env`         | Azure Identity environment |
| Bearer token environment | `envvar`      | `ADO_MCP_AUTH_TOKEN`       |
| Personal Access Token    | `pat`         | `PERSONAL_ACCESS_TOKEN`    |

### Interactive

This method opens a browser for Microsoft account sign-in. Omit the authentication argument to use it:

```json
{
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/azure-devops-mcp/dist/index.js", "<your-org>"]
    }
  }
}
```

### Azure CLI

Uses the token from an active `az login` session. Requires the [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) to be installed and signed in.

```json
{
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/azure-devops-mcp/dist/index.js", "<your-org>", "--authentication", "azcli"]
    }
  }
}
```

### Azure Credential Chain

Use `env` to authenticate through `DefaultAzureCredential`. Configure a supported Azure Identity credential, then use this argument list:

```json
["/absolute/path/to/azure-devops-mcp/dist/index.js", "<your-org>", "--authentication", "env"]
```

### Bearer Token Environment Variable

Use `envvar` to read a bearer token from `ADO_MCP_AUTH_TOKEN`. Set the variable in the environment that starts your MCP client, then add `"--authentication", "envvar"` to the server arguments.

```bash
export ADO_MCP_AUTH_TOKEN="<bearer-token>"
```

### Personal Access Token

Use `pat` to authenticate with an Azure DevOps [Personal Access Token](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate). `PERSONAL_ACCESS_TOKEN` must contain the base64 encoding of `<email>:<pat>`. The email can be any non-empty value.

For example:

```bash
export PERSONAL_ACCESS_TOKEN="$(printf '%s' '<email>:<pat>' | base64)"
```

Then add `"--authentication", "pat"` to the server arguments.

> [!IMPORTANT]
> Do not commit tokens to an MCP configuration file. Set them outside the file or use a secrets manager.

### Azure DevOps Server (On-Premises)

To connect to an on-premises Azure DevOps Server / TFS collection instead of Azure DevOps Services, pass its full collection URL as the `organization` argument instead of an organization name. Azure DevOps Server generally only supports `pat` (or `envvar`) authentication — there's no Azure AD tenant to authenticate `interactive`/`azcli`/`env` against.

```json
{
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/azure-devops-mcp/dist/index.js", "http://tfsserver:8080/tfs/DefaultCollection", "--authentication", "pat"],
      "env": {
        "PERSONAL_ACCESS_TOKEN": "<base64 email:pat, see Personal Access Token above>"
      }
    }
  }
}
```

> [!NOTE]
> A few tools call fixed Azure DevOps Services endpoints rather than the connected server (the `search` domain's code/wiki/work-item search tools, and repository commit search) and don't work against Azure DevOps Server. Exclude `search` with `-d` (see [Using Domains](../README.md#using-domains-local-server)) if it isn't installed as an extension on your server.

## Visual Studio Code

1. Create `.vscode/mcp.json` in your project.
2. Add this configuration:

```json
{
  "inputs": [
    {
      "id": "ado_org",
      "type": "promptString",
      "description": "Azure DevOps organization name (e.g. 'contoso'), or an on-premises collection URL"
    }
  ],
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/azure-devops-mcp/dist/index.js", "${input:ado_org}"]
    }
  }
}
```

3. Save the file and start `ado` from the MCP view.
4. Open GitHub Copilot Chat and switch to [Agent mode](https://code.visualstudio.com/blogs/2025/02/24/introducing-copilot-agent-mode).
5. Select the Azure DevOps tools and try `List ADO projects`.
6. Sign in with an account that can access the selected organization.

> [!NOTE]
> VS Code's Agent Host does not support MCP configurations that require `${input:...}` prompts. If you use Agent Host, replace `${input:ado_org}` with your organization name or move the configuration to a workspace `.mcp.json` file.

## Visual Studio

Use Visual Studio 2022 version 17.14 or later, or Visual Studio 2026.

1. Create `.mcp.json` in the solution folder.
2. Add this configuration:

```json
{
  "inputs": [
    {
      "id": "ado_org",
      "type": "promptString",
      "description": "Azure DevOps organization name (e.g. 'contoso'), or an on-premises collection URL"
    }
  ],
  "servers": {
    "ado": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/azure-devops-mcp/dist/index.js", "${input:ado_org}"]
    }
  }
}
```

3. Save the file and enter your organization name when prompted.
4. Open Copilot Chat and select **Agent** from the mode selector.
5. Open the tool picker, select the `ado` tools, and try `List ADO projects`.

See the [Visual Studio MCP server documentation](https://learn.microsoft.com/en-us/visualstudio/ide/mcp-servers?view=vs-2022) for more details.

## GitHub Copilot CLI

Create or edit the configuration file `~/.copilot/mcp-config.json` and add:

```json
{
  "mcpServers": {
    "ado": {
      "command": "node",
      "args": ["/absolute/path/to/azure-devops-mcp/dist/index.js", "{Contoso}"],
      "tools": ["*"]
    }
  }
}
```

Replace `{Contoso}` with your Azure DevOps organization name.

For more information, see the [Copilot CLI documentation](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli).

## Codex

Codex can run the Azure DevOps MCP Server as a local stdio MCP server from either the Codex CLI or IDE extension. The configuration is shared through `~/.codex/config.toml`.

### Interactive Authentication

For local development, start with the default interactive authentication flow:

```bash
codex mcp add azure-devops -- node /absolute/path/to/azure-devops-mcp/dist/index.js Contoso
```

Replace `Contoso` with your Azure DevOps organization name.

Verify that Codex can see the server:

```bash
codex mcp list
```

On first use of an Azure DevOps tool, the MCP server opens a browser window for Microsoft account sign-in. Use an account that has access to the selected Azure DevOps organization.

### Azure CLI Authentication

If your workstation already uses Azure CLI sign-in, authenticate first and configure the MCP server with `azcli`:

```bash
az login
codex mcp add azure-devops -- node /absolute/path/to/azure-devops-mcp/dist/index.js Contoso --authentication azcli
```

### Manual Configuration

You can also edit `~/.codex/config.toml` directly:

```toml
[mcp_servers.azure-devops]
command = "node"
args = ["/absolute/path/to/azure-devops-mcp/dist/index.js", "Contoso"]
```

Restart Codex after editing the config manually, then ask for a simple read-only operation such as `List ADO projects`.

## Claude Code

See the [Claude Code MCP documentation](https://docs.anthropic.com/en/docs/claude-code/mcp) for general guidance.

For the Azure DevOps MCP Server, use the following command:

```bash
claude mcp add --transport stdio azure-devops -- node /absolute/path/to/azure-devops-mcp/dist/index.js Contoso
```

Replace `Contoso` with your organization name, then verify the connection:

```bash
claude mcp list
```

## Claude Desktop

1. Open **File > Settings > Developer** in Claude Desktop.
2. Select **Edit Config** and add this configuration:

```json
{
  "mcpServers": {
    "ado": {
      "command": "node",
      "args": ["/absolute/path/to/azure-devops-mcp/dist/index.js", "{Contoso}"]
    }
  }
}
```

3. Replace `{Contoso}` with your organization name, save the file, completely quit Claude Desktop, and restart it.
4. Start a chat, select **Add files, connectors, and more > Connectors**, confirm that `ado` is available, and try `List ADO projects`.

For additional guidance on Claude Desktop, see the [Quickstart](https://modelcontextprotocol.io/quickstart/user#installing-the-filesystem-server).

## Cursor

Create `.cursor/mcp.json` in your project and add:

```json
{
  "mcpServers": {
    "ado": {
      "command": "node",
      "args": ["/absolute/path/to/azure-devops-mcp/dist/index.js", "{Contoso}"]
    }
  }
}
```

Replace `{Contoso}` with your organization name and save the file. Open **Cursor Settings > Tools & Integrations**, confirm that the `ado` MCP server is enabled, and use its tools in Agent chat.

See the [Cursor MCP documentation](https://cursor.com/docs/context/mcp) for global configuration and server management options.

## OpenCode

Add the Azure DevOps MCP server to your OpenCode configuration file.

On macOS or Linux, edit `~/.config/opencode/opencode.json` and add the `azure-devops` entry under `mcp`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "azure-devops": {
      "type": "local",
      "command": ["node", "/absolute/path/to/azure-devops-mcp/dist/index.js", "<your-org>"],
      "enabled": true
    }
  }
}
```

Replace `<your-org>` with your Azure DevOps organization name.

> [!NOTE]
> OpenCode starts the interactive Microsoft account sign-in on first use.

> **Tip:** Limit loaded tools using domain filtering by appending `-d` flags to the command:
>
> ```json
> ["node", "/absolute/path/to/azure-devops-mcp/dist/index.js", "<your-org>", "-d", "core", "work", "work-items"]
> ```
>
> Available domains: `core`, `work`, `work-items`, `repositories`, `wiki`, `pipelines`, `search`, `test-plans`, `advanced-security`

For more on OpenCode MCP configuration, see the [OpenCode MCP documentation](https://opencode.ai/docs/mcp-servers/).

## Kilo Code

Kilo Code supports global configuration for all workspaces and project configuration for one repository.

### Global Configuration

1. Open **Agent Behaviour > MCP Servers** in the Kilo Code pane.
2. Select **Edit Global MCP** to open `mcp_settings.json`.
3. Add the `azure-devops` entry:

```json
{
  "mcpServers": {
    "azure-devops": {
      "command": "node",
      "args": ["/absolute/path/to/azure-devops-mcp/dist/index.js", "<your-org>"]
    }
  }
}
```

### Project Configuration

Create `.kilocode/mcp.json` in your project root with the same content as above. This file can be committed to version control to share the setup with your team.

For Windows Command Prompt, wrap the command:

> ```json
> {
>   "mcpServers": {
>     "azure-devops": {
>       "command": "cmd",
>       "args": ["/c", "node", "C:\\absolute\\path\\to\\azure-devops-mcp\\dist\\index.js", "<your-org>"]
>     }
>   }
> }
> ```

Replace `<your-org>` with your Azure DevOps organization name. On first use, a browser window will open for Microsoft account login.

For more on Kilo Code MCP configuration, see the [Kilo Code MCP documentation](https://kilo.ai/docs/automate/mcp/using-in-kilo-code).
