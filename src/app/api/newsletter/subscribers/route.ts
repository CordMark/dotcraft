import { NextResponse } from "next/server";
import { getNewsletterSubscribers } from "@/lib/newsletter-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdminToken() {
  return process.env.NEWSLETTER_ADMIN_TOKEN?.trim() || "";
}

function isAuthorized(request: Request) {
  const token = getAdminToken();

  if (!token) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${token}`;
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function subscribersCsv(
  subscribers: Awaited<ReturnType<typeof getNewsletterSubscribers>>,
) {
  const rows = [
    ["email", "subscribedAt", "source"],
    ...subscribers.map((subscriber) => [
      subscriber.email,
      subscriber.subscribedAt,
      subscriber.source,
    ]),
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export async function GET(request: Request) {
  const token = getAdminToken();

  if (!token) {
    return NextResponse.json(
      { message: "Newsletter subscriber export is not configured." },
      { status: 404 },
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json(
      { message: "Unauthorized." },
      {
        headers: {
          "WWW-Authenticate": 'Bearer realm="newsletter-subscribers"',
        },
        status: 401,
      },
    );
  }

  const subscribers = await getNewsletterSubscribers();
  const { searchParams } = new URL(request.url);

  if (searchParams.get("format") === "csv") {
    return new Response(`${subscribersCsv(subscribers)}\n`, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="newsletter-subscribers.csv"',
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  }

  return NextResponse.json(
    {
      count: subscribers.length,
      subscribers,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
