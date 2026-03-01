import { parseError } from "@/lib/error";
import { getInstallationOctokit } from "@/lib/github";

export const addPRComment = async (
  repoFullName: string,
  prNumber: number,
  body: string
): Promise<void> => {
  "use step";

  const octokit = await getInstallationOctokit().catch((error: unknown) => {
    throw new Error(
      `[addPRComment] Failed to get GitHub client: ${parseError(error)}`
    );
  });

  const [owner, repo] = repoFullName.split("/");

  const response = await octokit
    .request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
      body,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
      issue_number: prNumber,
      owner,
      repo,
    })
    .catch((error: unknown) => {
      throw new Error(`Failed to add PR comment: ${parseError(error)}`);
    });

  if (response.status !== 201) {
    throw new Error(`Failed to add PR comment with status ${response.status}`);
  }
};
