import {
  getMaxWebhookBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { processStripeWebhookRequest } from "@/server/services/payments/process-stripe-webhook";

export const dynamic = "force-dynamic";

/**
 * Важно: сырые bytes для constructEvent. Не parse JSON вручную.
 */
export async function POST(request: Request) {
  const over = rejectOversizedBody(request, getMaxWebhookBodyBytes());
  if (over) return over;
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const out = await processStripeWebhookRequest({ rawBody, signature });
  return new Response(null, { status: out.status });
}
