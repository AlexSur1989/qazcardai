
import type Stripe from "stripe";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { applyPurchaseInTransaction } from "@/server/services/credits";
import {
  purchaseTokenPackageInTransaction,
} from "@/server/services/tokenPackages";
import { trySendPaymentSuccessEmail } from "@/server/services/notificationsIntegration";

import { getStripeClient } from "./stripe";

type ProcessResult =
  | { status: 200; duplicate?: boolean }
  | { status: 400 }
  | { status: 500 };

/**
 * rawBody — тело запроса как строка, то же, что ушло в constructEvent.
 */
export async function processStripeWebhookRequest(args: {
  rawBody: string;
  signature: string | null;
}): Promise<ProcessResult> {
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!whSecret) {
    return { status: 500 };
  }
  if (!args.signature) {
    return { status: 400 };
  }
  const stripe = getStripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(args.rawBody, args.signature, whSecret);
  } catch {
    return { status: 400 };
  }

  const payload = JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue;

  const row = await prisma.webhookEvent.findFirst({
    where: { provider: "stripe", providerEventId: event.id },
  });
  if (row?.status === "PROCESSED") {
    return { status: 200, duplicate: true };
  }

  if (!row) {
    try {
      await prisma.webhookEvent.create({
        data: {
          provider: "stripe",
          eventType: event.type,
          providerEventId: event.id,
          payload,
          status: "RECEIVED",
        },
      });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "P2002") {
        throw e;
      }
    }
  }

  if (event.type !== "checkout.session.completed") {
    await prisma.webhookEvent.updateMany({
      where: { provider: "stripe", providerEventId: event.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
    return { status: 200 };
  }

  const session = event.data.object as Stripe.Checkout.Session;
  try {
    await handleCheckoutSessionCompleted(session);
  } catch (err) {
    const message = err instanceof Error ? err.message : "webhook process error";
    await prisma.webhookEvent.updateMany({
      where: { provider: "stripe", providerEventId: event.id },
      data: {
        status: "FAILED",
        errorMessage: message.slice(0, 2000),
        processedAt: new Date(),
      },
    });
    if (message.startsWith("validation:") || message.startsWith("mismatch:")) {
      return { status: 200 };
    }
    return { status: 500 };
  }

  await prisma.webhookEvent.updateMany({
    where: { provider: "stripe", providerEventId: event.id },
    data: { status: "PROCESSED", processedAt: new Date() },
  });
  return { status: 200 };
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const paymentId = session.metadata?.paymentId;
  const userId = session.metadata?.userId;
  const creditsRaw = session.metadata?.credits;
  if (!paymentId || !userId || creditsRaw == null) {
    throw new Error("validation: missing session metadata (paymentId, userId, credits)");
  }
  const credits = parseInt(String(creditsRaw), 10);
  if (!Number.isInteger(credits) || credits <= 0) {
    throw new Error("validation: invalid credits in metadata");
  }
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    throw new Error("validation: session not paid");
  }

  let shouldSendSuccessEmail = false;

  await prisma.$transaction(async (tx) => {
    const pay = await tx.payment.findFirst({
      where: { id: paymentId, userId, provider: "stripe" },
      include: { tokenPackage: true },
    });
    if (!pay) {
      throw new Error("validation: payment not found");
    }
    if (pay.credits !== credits) {
      throw new Error("mismatch: credits do not match payment record");
    }
    if (pay.status === "COMPLETED") {
      return;
    }
    if (pay.status !== "PENDING") {
      throw new Error("validation: payment in unexpected status");
    }

    const meta = mergeJsonMeta(pay.metadata, {
      checkoutSessionId: session.id,
      paymentIntent:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
    });

    const updated = await tx.payment.updateMany({
      where: { id: paymentId, userId, status: "PENDING" },
      data: {
        status: "COMPLETED",
        providerPaymentId: session.id,
        metadata: meta,
      },
    });
    if (updated.count === 0) {
      const again = await tx.payment.findUnique({ where: { id: paymentId } });
      if (again?.status === "COMPLETED") {
        return;
      }
      throw new Error("concurrent update on payment");
    }

    const reason = pay.tokenPackage?.name
      ? `Token package purchase: ${pay.tokenPackage.name}`
      : "Token package purchase (Stripe)";

    if (pay.tokenPackageId && pay.tokenPackage) {
      await purchaseTokenPackageInTransaction(tx, {
        userId,
        paymentId,
        credits,
        reason,
        pkg: pay.tokenPackage,
      });
    } else {
      await applyPurchaseInTransaction(tx, {
        userId,
        credits,
        paymentId,
        reason,
      });
    }
    shouldSendSuccessEmail = true;
  });

  if (shouldSendSuccessEmail) {
    const pay = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { tokenPackage: true },
    });
    if (pay) {
      const pkgName = pay.tokenPackage?.name ?? "Токены";
      void trySendPaymentSuccessEmail({
        userId: pay.userId,
        packageName: pkgName,
        credits: pay.credits,
        amount: pay.amount.toString(),
        currency: pay.currency,
      });
    }
  }
}

function mergeJsonMeta(
  current: Prisma.JsonValue | null,
  extra: Record<string, unknown>,
): Prisma.InputJsonValue {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...base, ...extra } as Prisma.InputJsonValue;
}
