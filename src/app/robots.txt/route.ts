import { NextResponse } from "next/server";

import { generateRobotsTxt } from "@/server/services/seoSettings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const body = await generateRobotsTxt();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
