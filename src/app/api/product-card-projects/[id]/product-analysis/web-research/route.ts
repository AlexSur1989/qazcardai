import {
  guardProductCardAnalysisUser,
  handleProductCardWebResearch,
} from "@/server/services/productCardAnalysisHandlers";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const gate = await guardProductCardAnalysisUser(req);
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  return handleProductCardWebResearch(id, gate.userId);
}
