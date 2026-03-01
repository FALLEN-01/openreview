import "server-only";
import { createGitHubAdapter } from "@chat-adapter/github";
import { createMemoryState } from "@chat-adapter/state-memory";
import { createRedisState } from "@chat-adapter/state-redis";
import { Chat } from "chat";

import { env } from "@/lib/env";

let instance: Chat | null = null;

const createState = () => {
  if (env.REDIS_URL) {
    return createRedisState({ url: env.REDIS_URL });
  }

  return createMemoryState();
};

export const getBot = (): Chat => {
  if (!instance) {
    instance = new Chat({
      adapters: {
        github: createGitHubAdapter({
          appId: env.GITHUB_APP_ID,
          installationId: env.GITHUB_APP_INSTALLATION_ID,
          privateKey: env.GITHUB_APP_PRIVATE_KEY.replaceAll("\\n", "\n"),
          userName: "openreview[bot]",
          webhookSecret: env.GITHUB_APP_WEBHOOK_SECRET,
        }),
      },
      state: createState(),
      userName: "openreview",
    });
  }

  return instance;
};
