import "server-only";
import { start } from "workflow/api";

import { parseError } from "@/lib/error";
import { getGitHubApp, getInstallationOctokit } from "@/lib/github";
import { reviewWorkflow } from "@/lib/review";

const BOT_NAME = "openreview";

const shouldHandleComment = (payload: {
  action: string;
  comment: { body: string; user: { type: string } };
  issue: { pull_request?: { url: string } };
}): boolean => {
  if (payload.action !== "created") {
    return false;
  }
  if (payload.comment.user.type === "Bot") {
    return false;
  }
  if (!payload.comment.body.toLowerCase().includes(`@${BOT_NAME}`)) {
    return false;
  }
  if (!payload.issue.pull_request) {
    return false;
  }
  return true;
};

const startReview = async (
  repoFullName: string,
  prNumber: number
): Promise<void> => {
  const octokit = await getInstallationOctokit();
  const [owner, repo] = repoFullName.split("/");

  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    pull_number: prNumber,
    repo,
  });

  await octokit.request(
    "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
    {
      body: "Starting code review...",
      headers: { "X-GitHub-Api-Version": "2022-11-28" },
      issue_number: prNumber,
      owner,
      repo,
    }
  );

  await start(reviewWorkflow, [
    {
      baseBranch: pr.base.ref,
      prBranch: pr.head.ref,
      prNumber,
      repoFullName,
    },
  ]);
};

export const handleIssueComment = async (payload: {
  action: string;
  comment: { body: string; user: { type: string } };
  issue: { number: number; pull_request?: { url: string } };
  repository: { full_name: string };
}): Promise<void> => {
  if (!shouldHandleComment(payload)) {
    return;
  }

  await startReview(payload.repository.full_name, payload.issue.number);
};

export const handlePullRequest = async (payload: {
  action: string;
  pull_request: {
    base: { ref: string };
    head: { ref: string };
    number: number;
  };
  repository: { full_name: string };
}): Promise<void> => {
  if (payload.action !== "opened" && payload.action !== "synchronize") {
    return;
  }

  await start(reviewWorkflow, [
    {
      baseBranch: payload.pull_request.base.ref,
      prBranch: payload.pull_request.head.ref,
      prNumber: payload.pull_request.number,
      repoFullName: payload.repository.full_name,
    },
  ]);
};

export const verifyWebhookSignature = async (
  rawBody: string,
  signature: string
): Promise<boolean> => {
  try {
    const app = getGitHubApp();
    await app.webhooks.verify(rawBody, signature);
    return true;
  } catch (error) {
    throw new Error(
      `Webhook signature verification failed: ${parseError(error)}`,
      { cause: error }
    );
  }
};
