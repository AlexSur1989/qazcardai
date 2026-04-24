import { processKieIncomingWebhook } from "@/server/services/kie-webhook";

export const dynamic = "force-dynamic";

/**
 * Callback от Kie.ai. Кредиты подтверждаются/возвращаются только в completeWithOutput / markFailed.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const out = await processKieIncomingWebhook(request, rawBody);
  return new Response(null, { status: out.status });
}
