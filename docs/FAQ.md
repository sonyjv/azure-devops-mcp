# Frequently Asked Questions

Before you get started, ensure you follow the steps in the `README.md` file. This will help you get up and running and connected to your Azure DevOps organization.

## Does the MCP Server support both Azure DevOps Services and on-premises deployments?

Yes, in this fork. In addition to Azure DevOps Services (cloud), this fork adds support for connecting to an on-premises Azure DevOps Server / TFS collection. See [Azure DevOps Server (On-Premises)](./GETTINGSTARTED.md#azure-devops-server-on-premises) for setup instructions. (Microsoft's upstream project and its hosted Remote MCP Server only support the cloud service — on-premises support is specific to this fork.)

## Can I connect to more than one organization at a time?

No, you can connect to only one organization at a time. However, you can switch organizations as needed.

## Can I set a default project instead of fetching the list every time?

Currently, you need to fetch the list of projects so the LLM has context about the project name or ID. We plan to improve this experience in the future by leveraging prompts. In the meantime, you can set a default project name in your `copilot-instructions.md` file.

## Are PAT's supported?

Yes. Personal Access Tokens (PATs) are supported through the `pat` authentication type. See [Authentication](./GETTINGSTARTED.md#authentication) for setup instructions.

## Is there a remote supported version of the MCP Server?

At this time, only the local version of the MCP Server is supported.

## Are personal accounts supported?

Unfortunately, personal accounts are not supported. To maintain a higher level of authentication and security, your account must be backed by Entra ID. If you receive an error message like this, it means you are using a personal account.

![image of login error for personal accounts](./media/personal-accounts-error.png)

## When will a remote Azure DevOps MCP Server be available?

We receive this question frequently. The good news is that work is currently underway. Development began in early January 2026. Once we can provide a reliable timeline, we will publish it on the public [Azure DevOps roadmap](https://learn.microsoft.com/en-us/azure/devops/release-notes/features-timeline).

## How does the server protect me from malicious content stored in Azure DevOps?

As of v2.10.0, every tool response is automatically wrapped in "Spotlighting" — content pulled from Azure DevOps (wiki pages, work item descriptions, PR text, comments, and so on) is delimited before it's handed back to the model, so text an attacker planted in, say, a wiki page can't be mistaken for an instruction from you. This applies automatically across every tool domain; you don't need to configure anything.

## Why does the pull request autocomplete tool now require `bypassPolicy`?

As of v2.10.0, setting autocomplete on a pull request (`repo_pull_request_write`, `update` action) requires explicitly passing `bypassPolicy: true` before a `bypassReason` takes effect. Previously, supplying a reason alone was enough to silently bypass branch policies — this closes that accidental-bypass gap. If you want autocomplete to bypass policy, pass both `bypassPolicy: true` and a `bypassReason`; otherwise autocomplete waits for policies to pass normally.

## Can I retrieve a work item without knowing its project?

Yes, for the `get` action of `wit_work_item`: as of v2.10.0, you can fetch a single work item by ID at organization scope without specifying a project — the project-selection prompt is skipped for `get` specifically. Other actions (`my`, `list_for_iteration`, and so on) still need a project, same as before.
