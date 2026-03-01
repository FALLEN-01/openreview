import { Sandbox } from "@vercel/sandbox";

import { parseError } from "@/lib/error";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export const createSandbox = async (): Promise<string> => {
  "use step";

  let sandbox: Sandbox | null = null;

  try {
    sandbox = await Sandbox.create({
      timeout: FIVE_MINUTES_MS,
    });
  } catch (error) {
    throw new Error(`Failed to create sandbox: ${parseError(error)}`, {
      cause: error,
    });
  }

  return sandbox.sandboxId;
};
