import { NextResponse } from "next/server";

import {
  guardProductCardAnalysisUser,
  handleProductCardVisionAnalysis,
} from "@/server/services/productCardAnalysisHandlers";

type Ctx = { params: Promise<{ id: string }> };

type VisionBody = {
  productPhotoId?: string;
  saveToSimpleCard?: boolean;
};

/** @deprecated Используйте POST .../product-analysis/vision */
export async function POST(req: Request, ctx: Ctx) {
  const gate = await guardProductCardAnalysisUser(req);
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  let body: VisionBody = {};
  try {
    body = (await req.json()) as VisionBody;
  } catch {
    // пустое тело
  }

  const productPhotoId =
    typeof body.productPhotoId === "string" ? body.productPhotoId.trim() : undefined;
  const saveToSimpleCard =
    body.saveToSimpleCard === true || Boolean(productPhotoId);

  return handleProductCardVisionAnalysis(id, gate.userId, {
    productPhotoId,
    saveToSimpleCard,
  });
}
