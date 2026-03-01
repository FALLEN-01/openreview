import { after, NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  handleIssueComment,
  handlePullRequest,
  verifyWebhookSignature,
} from "@/lib/bot";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? "";

  await verifyWebhookSignature(rawBody, signature);

  const event = request.headers.get("x-github-event");
  const payload = JSON.parse(rawBody) as Record<string, unknown>;

  after(async () => {
    if (event === "issue_comment") {
      await handleIssueComment(
        payload as Parameters<typeof handleIssueComment>[0]
      );
    } else if (event === "pull_request") {
      await handlePullRequest(
        payload as Parameters<typeof handlePullRequest>[0]
      );
    }
  });

  return NextResponse.json({ ok: true });
};
