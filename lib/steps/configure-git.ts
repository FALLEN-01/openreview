import { Sandbox } from "@vercel/sandbox";

import { parseError } from "@/lib/error";

export const configureGit = async (
  sandboxId: string,
  repoFullName: string,
  token: string
): Promise<void> => {
  "use step";

  let sandbox: Sandbox | null = null;

  try {
    sandbox = await Sandbox.get({ sandboxId });
  } catch (error) {
    throw new Error(
      `[configureGit] Failed to get sandbox: ${parseError(error)}`,
      { cause: error }
    );
  }

  const authenticatedUrl = `https://x-access-token:${token}@github.com/${repoFullName}.git`;

  try {
    await sandbox.runCommand("git", [
      "remote",
      "set-url",
      "origin",
      authenticatedUrl,
    ]);

    await sandbox.runCommand("git", [
      "config",
      "--local",
      "core.hooksPath",
      "/dev/null",
    ]);
  } catch (error) {
    throw new Error(`Failed to configure git: ${parseError(error)}`, {
      cause: error,
    });
  }
};
