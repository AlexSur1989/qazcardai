import {
  getMaxWebhookBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { KASPI_PAYMENT_PROVIDER } from "@/lib/kaspi-config";
import { prisma } from "@/lib/prisma";
import { logKaspiWebhookApi } from "@/server/services/payments/kaspi-api-log";
import {
  confirmKaspiPaymentAfterWebhook,
  parseKaspiWebhook,
  verifyKaspiWebhook,
} from "@/server/services/payments/providers/kaspi";
import {
  setKaspiPaymentTerminalStatus,
} from "@/server/services/payments/paymentConfirmation";
import { sanitizeValueForPaymentMetadata } from "@/server/services/payments/kaspi-sanitize";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const over = rejectOversizedBody(request, getMaxWebhookBodyBytes());
  if (over) return over;

  const verified = await verifyKaspiWebhook(request);
  if (!verified.ok) {
    void logKaspiWebhookApi({
      endpoint: "/api/webhooks/kaspi",
      statusCode: 401,
      sanitizedPayload: { error: verified.error },
      errorMessage: "verify failed",
    });
    return new Response(null, { status: 401 });
  }

  const rawBody = await request.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    void logKaspiWebhookApi({
      endpoint: "/api/webhooks/kaspi",
      statusCode: 200,
      sanitizedPayload: { parseError: true },
      errorMessage: "invalid json",
    });
    return new Response(null, { status: 200 });
  }

  const parsed = parseKaspiWebhook(payload);
  if (!parsed) {
    void logKaspiWebhookApi({
      endpoint: "/api/webhooks/kaspi",
      statusCode: 200,
      sanitizedPayload: sanitizeValueForPaymentMetadata(payload),
      errorMessage: "parseKaspiWebhook returned null",
    });
    return new Response(null, { status: 200 });
  }

  void logKaspiWebhookApi({
    endpoint: "/api/webhooks/kaspi",
    statusCode: 200,
    sanitizedPayload: {
      provider: KASPI_PAYMENT_PROVIDER,
      eventType: parsed.eventType,
      paymentId: parsed.paymentId,
      providerPaymentId: parsed.providerPaymentId,
      normalizedStatus: parsed.normalizedStatus,
      amountKzt: parsed.amountKzt,
      currency: parsed.currency,
      payload: parsed.rawSafe,
    },
  });

  let payment =
    parsed.paymentId != null
      ? await prisma.payment.findUnique({ where: { id: parsed.paymentId } })
      : null;

  if (!payment && parsed.providerPaymentId) {
    payment = await prisma.payment.findFirst({
      where: {
        providerPaymentId: parsed.providerPaymentId,
        provider: KASPI_PAYMENT_PROVIDER,
      },
    });
  }

  if (!payment) {
    return new Response(null, { status: 200 });
  }

  if (payment.provider.trim().toUpperCase() !== KASPI_PAYMENT_PROVIDER) {
    return new Response(null, { status: 200 });
  }

  if (parsed.normalizedStatus === "failed") {
    await setKaspiPaymentTerminalStatus(payment.id, "FAILED", parsed.rawSafe);
    return new Response(null, { status: 200 });
  }

  if (parsed.normalizedStatus === "cancelled") {
    await setKaspiPaymentTerminalStatus(payment.id, "CANCELLED", parsed.rawSafe);
    return new Response(null, { status: 200 });
  }

  if (parsed.normalizedStatus !== "paid") {
    return new Response(null, { status: 200 });
  }

  const res = await confirmKaspiPaymentAfterWebhook(payment.id, parsed);
  if (!res.ok && "error" in res) {
    void logKaspiWebhookApi({
      endpoint: "/api/webhooks/kaspi",
      statusCode: 200,
      sanitizedPayload: {
        paymentId: payment.id,
        confirmError: res.error,
      },
    });
  }

  return new Response(null, { status: 200 });
}
