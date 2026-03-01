import { FatalError } from "workflow";

import { parseError } from "@/lib/error";
import { addPRComment } from "@/lib/steps/add-pr-comment";
import { checkPushAccess } from "@/lib/steps/check-push-access";
import { checkoutBranch } from "@/lib/steps/checkout-branch";
import { cloneRepo } from "@/lib/steps/clone-repo";
import { configureGit } from "@/lib/steps/configure-git";
import { createSandbox } from "@/lib/steps/create-sandbox";
import { extendSandbox } from "@/lib/steps/extend-sandbox";
import { getDiff } from "@/lib/steps/get-diff";
import { getGitHubToken } from "@/lib/steps/get-github-token";
import { installDependencies } from "@/lib/steps/install-dependencies";
import { runReview } from "@/lib/steps/run-review";
import { stopSandbox } from "@/lib/steps/stop-sandbox";

export interface ReviewParams {
  baseBranch: string;
  prBranch: string;
  prNumber: number;
  repoFullName: string;
}

const postErrorComment = async (
  repoFullName: string,
  prNumber: number,
  error: unknown
): Promise<void> => {
  try {
    await addPRComment(
      repoFullName,
      prNumber,
      `## Review Failed

An error occurred while reviewing this PR:

\`\`\`
${parseError(error)}
\`\`\`

---
*Powered by [OpenReview](https://github.com/haydenbleasel/openreview)*`
    );
  } catch {
    // Ignore comment failure
  }
};

const denyPushAccess = async (
  repoFullName: string,
  prNumber: number,
  reason: string | undefined
): Promise<never> => {
  await addPRComment(
    repoFullName,
    prNumber,
    `## Review Skipped

Unable to access this branch: ${reason}

Please ensure the OpenReview app has access to this repository and branch.

---
*Powered by [OpenReview](https://github.com/haydenbleasel/openreview)*`
  );

  throw new FatalError(reason ?? "Push access denied");
};

const runSandboxReview = async (
  sandboxId: string,
  repoFullName: string,
  prNumber: number,
  prBranch: string,
  baseBranch: string,
  token: string
): Promise<void> => {
  await cloneRepo(sandboxId, repoFullName, token);
  await checkoutBranch(sandboxId, prBranch);
  await installDependencies(sandboxId);
  await configureGit(sandboxId, repoFullName, token);
  await extendSandbox(sandboxId);

  const diff = await getDiff(sandboxId, baseBranch);
  const reviewResult = await runReview(sandboxId, diff);

  if (!reviewResult.success) {
    throw new FatalError(
      reviewResult.errorMessage ?? "AI review failed to run"
    );
  }

  await addPRComment(
    repoFullName,
    prNumber,
    `## Code Review

${reviewResult.review}

---
*Powered by [OpenReview](https://github.com/haydenbleasel/openreview)*`
  );
};

const executeReview = async (params: ReviewParams): Promise<void> => {
  const { baseBranch, prBranch, prNumber, repoFullName } = params;

  const token = await getGitHubToken();
  const sandboxId = await createSandbox();

  try {
    await runSandboxReview(
      sandboxId,
      repoFullName,
      prNumber,
      prBranch,
      baseBranch,
      token
    );
  } catch (error) {
    await postErrorComment(repoFullName, prNumber, error);
    throw error;
  } finally {
    await stopSandbox(sandboxId);
  }
};

export const reviewWorkflow = async (params: ReviewParams): Promise<void> => {
  "use workflow";

  const pushAccess = await checkPushAccess(
    params.repoFullName,
    params.prBranch
  );

  if (!pushAccess.canPush) {
    await denyPushAccess(
      params.repoFullName,
      params.prNumber,
      pushAccess.reason
    );
  }

  await executeReview(params);
};
