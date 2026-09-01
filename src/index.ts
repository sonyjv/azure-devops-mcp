#!/usr/bin/env node

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getBearerHandler, getPersonalAccessTokenHandler, WebApi } from "azure-devops-node-api";
import yargs from "yargs";

import { createAuthenticator, installPatFetchInterceptor } from "./auth.js";
import { logger } from "./logger.js";
import { getOrgTenant } from "./org-tenants.js";
//import { configurePrompts } from "./prompts.js";
import { configureAllTools } from "./tools.js";
import { UserAgentComposer } from "./useragent.js";
import { getCliArgs, resolveOrgUrl } from "./utils.js";
import { packageVersion } from "./version.js";
import { DomainsManager } from "./shared/domains.js";

function isGitHubCodespaceEnv(): boolean {
  return process.env.CODESPACES === "true" && !!process.env.CODESPACE_NAME;
}

const defaultAuthenticationType = isGitHubCodespaceEnv() ? "azcli" : "interactive";

// Parse command line arguments using yargs
const argv = yargs(getCliArgs())
  .scriptName("mcp-server-azuredevops")
  .usage("Usage: $0 <organization> [options]")
  .version(packageVersion)
  .command("$0 <organization> [options]", "Azure DevOps MCP Server", (yargs) => {
    yargs.positional("organization", {
      describe: "Azure DevOps organization name (e.g. 'contoso'), or a full base URL for on-premises Azure DevOps Server / TFS (e.g. 'http://tfsserver:8080/tfs/DefaultCollection')",
      type: "string",
      demandOption: true,
    });
  })
  .option("domains", {
    alias: "d",
    describe: "Domain(s) to enable: 'all' for everything, or specific domains like 'repositories builds work'. Defaults to 'all'.",
    type: "string",
    array: true,
    default: "all",
  })
  .option("authentication", {
    alias: "a",
    describe: "Type of authentication to use",
    type: "string",
    choices: ["interactive", "azcli", "env", "envvar", "pat"],
    default: defaultAuthenticationType,
  })
  .option("tenant", {
    alias: "t",
    describe: "Azure tenant ID (optional, applied when using 'interactive' and 'azcli' type of authentication)",
    type: "string",
  })
  .help()
  .parseSync();

const { orgUrl, cloudOrgName } = resolveOrgUrl(argv.organization as string);
// Preserved for the handful of tools that still call fixed Azure DevOps Services
// endpoints (e.g. code/wiki/work-item search) rather than the connected server's URL.
// Those remain cloud-only; see docs/TOOLSET.md and README for the on-prem limitation.
export const orgName = cloudOrgName ?? (argv.organization as string);

const domainsManager = new DomainsManager(argv.domains);
export const enabledDomains = domainsManager.getEnabledDomains();

function getAzureDevOpsClient(getAzureDevOpsToken: () => Promise<string>, userAgentComposer: UserAgentComposer, authType: string): () => Promise<WebApi> {
  return async () => {
    const accessToken = await getAzureDevOpsToken();
    // For pat, accessToken is base64("{email}:{token}"). Decode to extract the token part,
    // since getPersonalAccessTokenHandler prepends ":" internally and just needs the raw token.
    const authHandler = authType === "pat" ? getPersonalAccessTokenHandler(Buffer.from(accessToken, "base64").toString("utf8").split(":").slice(1).join(":")) : getBearerHandler(accessToken);
    const connection = new WebApi(orgUrl, authHandler, undefined, {
      productName: "AzureDevOps.MCP",
      productVersion: packageVersion,
      userAgent: userAgentComposer.userAgent,
    });
    return connection;
  };
}

async function main() {
  logger.info("Starting Azure DevOps MCP Server", {
    organization: orgName,
    organizationUrl: orgUrl,
    authentication: argv.authentication,
    tenant: argv.tenant,
    domains: argv.domains,
    enabledDomains: Array.from(enabledDomains),
    version: packageVersion,
    isCodespace: isGitHubCodespaceEnv(),
  });

  const server = new McpServer({
    name: "Azure DevOps MCP Server",
    version: packageVersion,
    icons: [
      {
        src: "https://cdn.vsassets.io/content/icons/favicon.ico",
      },
    ],
  });

  const userAgentComposer = new UserAgentComposer(packageVersion);
  server.server.oninitialized = () => {
    userAgentComposer.appendMcpClientInfo(server.server.getClientVersion());
  };
  if (!cloudOrgName && !["pat", "envvar"].includes(argv.authentication)) {
    logger.warn(
      `Authentication type '${argv.authentication}' was requested against a non-Azure DevOps Services URL ('${orgUrl}'). Azure DevOps Server (on-premises) generally only supports 'pat' (or 'envvar') authentication.`
    );
  }

  const tenantId = argv.tenant ?? (cloudOrgName ? await getOrgTenant(cloudOrgName) : undefined);
  const authenticator = createAuthenticator(argv.authentication, tenantId);

  if (argv.authentication === "pat") {
    const basicValue = await authenticator();
    installPatFetchInterceptor(basicValue, new URL(orgUrl).hostname);
    logger.debug("PAT mode: global fetch interceptor installed to rewrite Bearer -> Basic auth headers");
  }

  // removing prompts until further notice
  // configurePrompts(server);

  configureAllTools(server, authenticator, getAzureDevOpsClient(authenticator, userAgentComposer, argv.authentication), () => userAgentComposer.userAgent, enabledDomains);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  logger.error("Fatal error in main():", error);
  process.exit(1);
});
