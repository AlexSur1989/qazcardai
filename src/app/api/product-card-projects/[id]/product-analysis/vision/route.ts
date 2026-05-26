import {
  guardProductCardAnalysisUser,
  handleProductCardVisionAnalysis,
} from "@/server/services/productCardAnalysisHandlers";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const gate = await guardProductCardAnalysisUser(req);
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  return handleProductCardVisionAnalysis(id, gate.userId);
}
