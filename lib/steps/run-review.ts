import { anthropic } from "@ai-sdk/anthropic";
import { Sandbox } from "@vercel/sandbox";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import { parseError } from "@/lib/error";

export interface ReviewResult {
  errorMessage?: string;
  review: string;
  success: boolean;
}

const systemPrompt = `You are an expert code reviewer. You have access to a sandbox with a git repository checked out on a PR branch.

Your job is to review the code changes in this pull request and provide actionable feedback.

Focus on:
- Bugs and logic errors
- Security vulnerabilities
- Performance issues
- Code quality and maintainability
- Missing error handling
- Race conditions or concurrency issues

Be specific and reference file paths and line numbers. For each issue, explain:
1. What the problem is
2. Why it matters
3. How to fix it

If the code looks good, say so briefly. Don't nitpick style or formatting.

Format your review as markdown.`;

const readFileParams = z.object({
  path: z.string().describe("Path to the file relative to repo root"),
});

const runCommandParams = z.object({
  args: z.array(z.string()).default([]).describe("Command arguments"),
  command: z.string().describe("The command to run"),
});

const createReadFileTool = (sandbox: Sandbox) =>
  tool({
    description: "Read a file from the repository",
    execute: async ({ path }) => {
      const result = await sandbox.runCommand("cat", [path]);
      const output = await result.stdout();
      return { content: output.slice(0, 20_000) };
    },
    inputSchema: readFileParams,
  });

const createRunCommandTool = (sandbox: Sandbox) =>
  tool({
    description:
      "Execute a shell command in the sandbox to explore the codebase",
    execute: async ({ args, command }) => {
      const result = await sandbox.runCommand(command, args);
      const output = await result.output("both");
      return {
        exitCode: result.exitCode,
        output: output.slice(0, 10_000),
      };
    },
    inputSchema: runCommandParams,
  });

const callReviewer = async (
  sandbox: Sandbox,
  diff: string
): Promise<string> => {
  const { text } = await generateText({
    model: anthropic("claude-haiku-4-5"),
    prompt: `Here is the PR diff to review:\n\n\`\`\`diff\n${diff}\n\`\`\`\n\nReview the changes. Use the tools to explore files for additional context if needed.`,
    stopWhen: stepCountIs(10),
    system: systemPrompt,
    tools: {
      readFile: createReadFileTool(sandbox),
      runCommand: createRunCommandTool(sandbox),
    },
  });

  return text;
};

export const runReview = async (
  sandboxId: string,
  diff: string
): Promise<ReviewResult> => {
  "use step";

  const sandbox = await Sandbox.get({ sandboxId }).catch((error: unknown) => {
    throw new Error(`[runReview] Failed to get sandbox: ${parseError(error)}`, {
      cause: error,
    });
  });

  try {
    const text = await callReviewer(sandbox, diff);
    return { review: text, success: true };
  } catch (error) {
    return {
      errorMessage: parseError(error),
      review: "",
      success: false,
    };
  }
};
