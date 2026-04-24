import {
  getMaxWebhookBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { processKieIncomingWebhook } from "@/server/services/kie-webhook";

export const dynamic = "force-dynamic";

/**
 * Callback от Kie.ai. Кредиты подтверждаются/возвращаются только в completeWithOutput / markFailed.
 */
export async function POST(request: Request) {
  const over = rejectOversizedBody(request, getMaxWebhookBodyBytes());
  if (over) return over;
  const rawBody = await request.text();
  const out = await processKieIncomingWebhook(request, rawBody);
  return new Response(null, { status: out.status });
}
