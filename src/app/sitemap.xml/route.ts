import { NextResponse } from "next/server";

import { generateSitemapXml } from "@/server/services/seoSettings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const body = await generateSitemapXml();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
