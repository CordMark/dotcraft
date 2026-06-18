import { NextResponse } from "next/server";
import { runVideoNewsletterJob } from "@/lib/video-newsletter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();

  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { message: "Unauthorized." },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get("dryRun") === "1";
  const force = searchParams.get("force") === "1";
  const resendKey = searchParams.get("resendKey")?.trim() || undefined;

  try {
    const result = await runVideoNewsletterJob({ dryRun, force, resendKey });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
