import { Sandbox } from "@vercel/sandbox";

import { parseError } from "@/lib/error";

const getSandbox = async (sandboxId: string): Promise<Sandbox> => {
  try {
    return await Sandbox.get({ sandboxId });
  } catch (error) {
    throw new Error(`[cloneRepo] Failed to get sandbox: ${parseError(error)}`, {
      cause: error,
    });
  }
};

const runClone = async (
  sandbox: Sandbox,
  repoFullName: string,
  token: string
): Promise<void> => {
  const result = await sandbox.runCommand("git", [
    "clone",
    "--depth",
    "1",
    `https://x-access-token:${token}@github.com/${repoFullName}`,
    ".",
  ]);

  if (result.exitCode !== 0) {
    const output = await result.output("both");
    const sanitized = output.replaceAll(token, "***");
    throw new Error(
      `git clone failed with exit code ${result.exitCode}: ${sanitized.trim()}`
    );
  }
};

export const cloneRepo = async (
  sandboxId: string,
  repoFullName: string,
  token: string
): Promise<void> => {
  "use step";

  const sandbox = await getSandbox(sandboxId);
  await runClone(sandbox, repoFullName, token);
};
