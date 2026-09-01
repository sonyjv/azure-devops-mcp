// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach, afterEach } from "@jest/globals";
import { jest } from "@jest/globals";
import { AzureCliCredential, ChainedTokenCredential, DefaultAzureCredential } from "@azure/identity";
import { PublicClientApplication } from "@azure/msal-node";
import open from "open";

jest.mock("../../src/logger.js", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("@azure/identity", () => ({
  AzureCliCredential: jest.fn(),
  ChainedTokenCredential: jest.fn(),
  DefaultAzureCredential: jest.fn(),
}));

jest.mock("@azure/msal-node", () => ({
  PublicClientApplication: jest.fn(),
}));

jest.mock("open", () => jest.fn());

import { createAuthenticator, installPatFetchInterceptor } from "../../src/auth";

describe("PAT authentication", () => {
  const originalEnv = process.env;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    (AzureCliCredential as unknown as jest.Mock).mockReset();
    (ChainedTokenCredential as unknown as jest.Mock).mockReset();
    (DefaultAzureCredential as unknown as jest.Mock).mockReset();
    (PublicClientApplication as unknown as jest.Mock).mockReset();
    (open as jest.Mock).mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  describe("installPatFetchInterceptor", () => {
    const rawPat = "myrawpat";
    const expectedBasicValue = Buffer.from(`PAT:${rawPat}`).toString("base64");

    it.each(["https://dev.azure.com/org", "https://vssps.dev.azure.com/org", "https://almsearch.dev.azure.com/org", "https://contoso.visualstudio.com/project"])(
      "rewrites this PAT for trusted Azure DevOps host %s",
      async (url) => {
        const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response());
        globalThis.fetch = fetchMock;
        installPatFetchInterceptor(rawPat);

        await fetch(url, { headers: { Authorization: `Bearer ${rawPat}` } });

        const rewrittenInit = fetchMock.mock.calls[0][1];
        expect(new Headers(rewrittenInit?.headers).get("Authorization")).toBe(`Basic ${expectedBasicValue}`);
      }
    );

    it.each([
      "https://attacker.example/path",
      "http://dev.azure.com/org",
      "https://dev.azure.com.attacker.example/org",
      "https://visualstudio.com",
      "https://contoso.visualstudio.com.attacker.example",
    ])("refuses to send this PAT to untrusted destination %s", async (url) => {
      const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response());
      globalThis.fetch = fetchMock;
      installPatFetchInterceptor(rawPat);

      await expect(fetch(url, { headers: { Authorization: `Bearer ${rawPat}` } })).rejects.toThrow("Refusing to send a Personal Access Token to untrusted destination");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does not replace an unrelated bearer token", async () => {
      const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response());
      globalThis.fetch = fetchMock;
      installPatFetchInterceptor(rawPat);

      await fetch("https://attacker.example/path", { headers: { Authorization: "Bearer unrelated-token" } });

      expect(fetchMock).toHaveBeenCalledWith("https://attacker.example/path", { headers: { Authorization: "Bearer unrelated-token" } });
    });

    it("passes through requests without headers", async () => {
      const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response());
      globalThis.fetch = fetchMock;
      installPatFetchInterceptor(rawPat);

      await fetch("https://example.com/path");

      expect(fetchMock).toHaveBeenCalledWith("https://example.com/path", undefined);
    });

    it("rewrites headers supplied by a Request object", async () => {
      const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response());
      globalThis.fetch = fetchMock;
      installPatFetchInterceptor(rawPat);

      await fetch(new Request("https://dev.azure.com/org", { headers: { Authorization: `Bearer ${rawPat}` } }));

      const rewrittenRequest = fetchMock.mock.calls[0][0] as Request;
      expect(rewrittenRequest.headers.get("Authorization")).toBe(`Basic ${expectedBasicValue}`);
    });

    describe("with a configured on-premises host", () => {
      it("rewrites the PAT for the configured host over plain http", async () => {
        const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response());
        globalThis.fetch = fetchMock;
        installPatFetchInterceptor(rawPat, "tfsserver");

        await fetch("http://tfsserver:8080/tfs/DefaultCollection/_apis/wit/workitems", { headers: { Authorization: `Bearer ${rawPat}` } });

        const rewrittenInit = fetchMock.mock.calls[0][1];
        expect(new Headers(rewrittenInit?.headers).get("Authorization")).toBe(`Basic ${expectedBasicValue}`);
      });

      it("is case-insensitive when matching the configured host", async () => {
        const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response());
        globalThis.fetch = fetchMock;
        installPatFetchInterceptor(rawPat, "TFSServer");

        await fetch("http://tfsserver:8080/tfs/DefaultCollection", { headers: { Authorization: `Bearer ${rawPat}` } });

        const rewrittenInit = fetchMock.mock.calls[0][1];
        expect(new Headers(rewrittenInit?.headers).get("Authorization")).toBe(`Basic ${expectedBasicValue}`);
      });

      it("still refuses an unrelated http host", async () => {
        const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response());
        globalThis.fetch = fetchMock;
        installPatFetchInterceptor(rawPat, "tfsserver");

        await expect(fetch("http://attacker.example/path", { headers: { Authorization: `Bearer ${rawPat}` } })).rejects.toThrow("Refusing to send a Personal Access Token to untrusted destination");
        expect(fetchMock).not.toHaveBeenCalled();
      });

      it("still requires https for the built-in cloud hosts even when a configured host is set", async () => {
        const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response());
        globalThis.fetch = fetchMock;
        installPatFetchInterceptor(rawPat, "tfsserver");

        await expect(fetch("http://dev.azure.com/org", { headers: { Authorization: `Bearer ${rawPat}` } })).rejects.toThrow("Refusing to send a Personal Access Token to untrusted destination");
        expect(fetchMock).not.toHaveBeenCalled();
      });
    });
  });

  describe("createAuthenticator('pat')", () => {
    it("should return the raw PAT as-is from PERSONAL_ACCESS_TOKEN", async () => {
      process.env["PERSONAL_ACCESS_TOKEN"] = "myrawpat";

      const authenticator = createAuthenticator("pat");
      const result = await authenticator();

      expect(result).toBe("myrawpat");
    });

    it("should throw if PERSONAL_ACCESS_TOKEN is not set", async () => {
      delete process.env["PERSONAL_ACCESS_TOKEN"];

      const authenticator = createAuthenticator("pat");

      await expect(authenticator()).rejects.toThrow("Environment variable 'PERSONAL_ACCESS_TOKEN' is not set or empty");
    });

    it("should throw if PERSONAL_ACCESS_TOKEN is an empty string", async () => {
      process.env["PERSONAL_ACCESS_TOKEN"] = "";

      const authenticator = createAuthenticator("pat");

      await expect(authenticator()).rejects.toThrow("Environment variable 'PERSONAL_ACCESS_TOKEN' is not set or empty");
    });

    it("should return a different value each call if env var changes between calls", async () => {
      process.env["PERSONAL_ACCESS_TOKEN"] = "token-a";
      const authenticator = createAuthenticator("pat");
      const resultA = await authenticator();

      process.env["PERSONAL_ACCESS_TOKEN"] = "token-b";
      const resultB = await authenticator();

      expect(resultA).toBe("token-a");
      expect(resultB).toBe("token-b");
    });
  });

  describe("createAuthenticator('envvar')", () => {
    it("should return ADO_MCP_AUTH_TOKEN", async () => {
      process.env["ADO_MCP_AUTH_TOKEN"] = "environment-token";

      await expect(createAuthenticator("envvar")()).resolves.toBe("environment-token");
    });

    it("should throw when ADO_MCP_AUTH_TOKEN is not set", async () => {
      delete process.env["ADO_MCP_AUTH_TOKEN"];

      await expect(createAuthenticator("envvar")()).rejects.toThrow("Environment variable 'ADO_MCP_AUTH_TOKEN' is not set or empty");
    });
  });

  describe("Azure credential authentication", () => {
    it("should use DefaultAzureCredential for env authentication", async () => {
      const getToken = jest.fn().mockResolvedValue({ token: "default-token" });
      (DefaultAzureCredential as unknown as jest.Mock).mockImplementation(() => ({ getToken }));
      delete process.env.AZURE_TOKEN_CREDENTIALS;

      await expect(createAuthenticator("env")()).resolves.toBe("default-token");

      expect(process.env.AZURE_TOKEN_CREDENTIALS).toBeUndefined();
      expect(getToken).toHaveBeenCalledWith(["499b84ac-1321-427f-aa17-267ca6975798/.default"]);
    });

    it("should use a tenant-specific Azure CLI credential chain for azcli authentication", async () => {
      const defaultCredential = { getToken: jest.fn() };
      const azureCliCredential = { getToken: jest.fn() };
      const getToken = jest.fn().mockResolvedValue({ token: "chained-token" });
      (DefaultAzureCredential as unknown as jest.Mock).mockImplementation(() => defaultCredential);
      (AzureCliCredential as unknown as jest.Mock).mockImplementation(() => azureCliCredential);
      (ChainedTokenCredential as unknown as jest.Mock).mockImplementation(() => ({ getToken }));

      await expect(createAuthenticator("azcli", "tenant-id")()).resolves.toBe("chained-token");

      expect(process.env.AZURE_TOKEN_CREDENTIALS).toBe("dev");
      expect(AzureCliCredential).toHaveBeenCalledWith({ tenantId: "tenant-id" });
      expect(ChainedTokenCredential).toHaveBeenCalledWith(azureCliCredential, defaultCredential);
    });

    it("should throw when the Azure credential returns no token", async () => {
      (DefaultAzureCredential as unknown as jest.Mock).mockImplementation(() => ({ getToken: jest.fn().mockResolvedValue(null) }));

      await expect(createAuthenticator("env")()).rejects.toThrow("Failed to obtain Azure DevOps token");
    });
  });

  describe("OAuth authentication", () => {
    it("forwards MSAL log messages to the application logger", async () => {
      (PublicClientApplication as unknown as jest.Mock).mockImplementation(() => ({ acquireTokenInteractive: jest.fn() }));

      const authenticator = createAuthenticator("oauth");
      // The broker client is built lazily on first use (see getBrokerClient in src/auth.ts),
      // so it's the second PublicClientApplication call — the first is the always-eager fallback.
      await authenticator().catch(() => undefined);

      const config = (PublicClientApplication as unknown as jest.Mock).mock.calls[1][0];
      expect(() => config.system.loggerOptions.loggerCallback(2, "MSAL message")).not.toThrow();
    });

    it.each([new Error("broker failure"), { platformBrokerError: { code: "broker_failure" } }])(
      "falls back to browser authentication when broker authentication rejects with %p",
      async (brokerError) => {
        const brokerAcquireTokenInteractive = jest.fn().mockRejectedValue(brokerError);
        const fallbackAcquireTokenInteractive = jest.fn().mockImplementation(async ({ openBrowser }) => {
          await openBrowser("https://login.example.com/fallback");
          return { accessToken: "fallback-token", account: null };
        });
        // The fallback client is constructed eagerly (first call); the broker client is only
        // built lazily on first use, inside getToken() (second call).
        (PublicClientApplication as unknown as jest.Mock)
          .mockImplementationOnce(() => ({ acquireTokenInteractive: fallbackAcquireTokenInteractive }))
          .mockImplementationOnce(() => ({ acquireTokenInteractive: brokerAcquireTokenInteractive }));

        await expect(createAuthenticator("oauth")()).resolves.toBe("fallback-token");

        expect(fallbackAcquireTokenInteractive).toHaveBeenCalledWith(expect.objectContaining({ scopes: ["499b84ac-1321-427f-aa17-267ca6975798/.default"] }));
        expect(open).toHaveBeenCalledWith("https://login.example.com/fallback");
      }
    );

    it("should use tenant-specific interactive authentication, open the browser, and cache the account", async () => {
      const account = { homeAccountId: "account-id" };
      const acquireTokenSilent = jest.fn().mockResolvedValue({ accessToken: "silent-token", account });
      const acquireTokenInteractive = jest.fn().mockImplementation(async ({ openBrowser }) => {
        await openBrowser("https://login.example.com");
        return { accessToken: "interactive-token", account };
      });
      (PublicClientApplication as unknown as jest.Mock).mockImplementation(() => ({ acquireTokenSilent, acquireTokenInteractive }));

      const authenticator = createAuthenticator("oauth", "tenant-id");

      await expect(authenticator()).resolves.toBe("interactive-token");
      await expect(authenticator()).resolves.toBe("silent-token");
      expect(PublicClientApplication).toHaveBeenCalledWith({
        auth: {
          clientId: "0d50963b-7bb9-4fe7-94c7-a99af00b5136",
          authority: "https://login.microsoftonline.com/tenant-id",
        },
      });
      expect(open).toHaveBeenCalledWith("https://login.example.com");
      expect(acquireTokenSilent).toHaveBeenCalledWith(expect.objectContaining({ account }));
      expect(acquireTokenInteractive).toHaveBeenCalledTimes(1);
    });

    it.each([new Error("silent failure"), "silent failure"])("should fall back to interactive authentication when silent acquisition rejects with %p", async (error) => {
      const account = { homeAccountId: "account-id" };
      const acquireTokenSilent = jest.fn().mockRejectedValue(error);
      const acquireTokenInteractive = jest.fn().mockResolvedValueOnce({ accessToken: "first-token", account }).mockResolvedValueOnce({ accessToken: "fallback-token", account });
      (PublicClientApplication as unknown as jest.Mock).mockImplementation(() => ({ acquireTokenSilent, acquireTokenInteractive }));

      const authenticator = createAuthenticator("oauth");

      await expect(authenticator()).resolves.toBe("first-token");
      await expect(authenticator()).resolves.toBe("fallback-token");
      expect(acquireTokenInteractive).toHaveBeenCalledTimes(2);
    });

    it("should use the common authority for the zero tenant ID", async () => {
      const acquireTokenInteractive = jest.fn().mockResolvedValue({ accessToken: "token", account: null });
      (PublicClientApplication as unknown as jest.Mock).mockImplementation(() => ({ acquireTokenInteractive }));

      await expect(createAuthenticator("oauth", "00000000-0000-0000-0000-000000000000")()).resolves.toBe("token");

      expect(PublicClientApplication).toHaveBeenCalledWith(expect.objectContaining({ auth: expect.objectContaining({ authority: "https://login.microsoftonline.com/common" }) }));
    });

    it("should throw when interactive authentication returns no access token", async () => {
      const acquireTokenInteractive = jest.fn().mockResolvedValue({ accessToken: "", account: null });
      (PublicClientApplication as unknown as jest.Mock).mockImplementation(() => ({ acquireTokenInteractive }));

      await expect(createAuthenticator("oauth")()).rejects.toThrow("Failed to obtain Azure DevOps OAuth token");
    });

    it("falls back to browser authentication (no broker attempt at all) when the native broker module fails to load", async () => {
      // Simulates a machine where @azure/msal-node-extensions' native keytar binding
      // isn't available (missing prebuilt binary, blocked install script, no build
      // toolchain, etc.) — the dynamic import in getBrokerClient() should reject, and
      // every auth type other than 'interactive' must be unaffected by this at all.
      await jest.isolateModulesAsync(async () => {
        jest.doMock("@azure/msal-node-extensions", () => {
          throw new Error("simulated native module load failure");
        });

        const { createAuthenticator: isolatedCreateAuthenticator } = await import("../../src/auth");
        const fallbackAcquireTokenInteractive = jest.fn().mockImplementation(async ({ openBrowser }: { openBrowser: (url: string) => Promise<void> }) => {
          await openBrowser("https://login.example.com/no-broker");
          return { accessToken: "no-broker-token", account: null };
        });
        // Only one PublicClientApplication is ever constructed in this scenario (the
        // fallback) — the broker one is never reached since the import itself throws.
        (PublicClientApplication as unknown as jest.Mock).mockImplementationOnce(() => ({ acquireTokenInteractive: fallbackAcquireTokenInteractive }));

        await expect(isolatedCreateAuthenticator("oauth")()).resolves.toBe("no-broker-token");

        expect(PublicClientApplication).toHaveBeenCalledTimes(1);
        expect(open).toHaveBeenCalledWith("https://login.example.com/no-broker");
      });
    });
  });
});
