import { Prisma } from "@/generated/prisma/client";
import type { Payment, PaymentStatus, TokenPackage } from "@/generated/prisma/client";
import {
  KASPI_MANUAL_PAYMENT_PROVIDER,
  type ManualPaymentContactChannel,
} from "@/lib/kaspi-manual-config";
import { buildManualPaymentInstructionCode } from "@/lib/manual-payment-codes";
import { manualPaymentUserStatusLabel } from "@/lib/manual-payment-labels";
import { prisma } from "@/lib/prisma";
import {
  buildWhatsAppTopUpUrl,
  interpolateWhatsAppTemplate,
} from "@/lib/whatsapp-manual-payment";
import {
  getKaspiManualSettings,
  maskKaspiRecipientPhone,
  type KaspiManualSettings,
} from "@/server/services/kaspiManualSettings";
import { getTokenPackageByIdForCheckout } from "@/server/services/token-packages-catalog";

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

export { buildManualPaymentInstructionCode } from "@/lib/manual-payment-codes";

export function readPaymentMetadata(
  metadata: Prisma.JsonValue | null,
): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

export function mergePaymentMetadata(
  current: Prisma.JsonValue | null,
  extra: Record<string, unknown>,
): Prisma.InputJsonObject {
  return { ...readPaymentMetadata(current), ...extra } as Prisma.InputJsonObject;
}

export function isManualPaymentExpired(meta: Record<string, unknown>): boolean {
  const expiresAt =
    typeof meta.expiresAt === "string" ? meta.expiresAt : null;
  return Boolean(
    expiresAt &&
      !Number.isNaN(Date.parse(expiresAt)) &&
      Date.now() > Date.parse(expiresAt),
  );
}

export function buildWhatsAppUrlForManualPayment(args: {
  settings: KaspiManualSettings;
  paymentCode: string;
  packageLabel: string;
  amountKzt: number;
  creditsAmount: number;
  userEmail: string;
  userTelegram?: string | null;
}): string | null {
  if (!args.settings.whatsappEnabled || !args.settings.whatsappPhone) {
    return null;
  }
  const message = interpolateWhatsAppTemplate(args.settings.whatsappMessageTemplate, {
    paymentCode: args.paymentCode,
    packageLabel: args.packageLabel,
    amountKzt: args.amountKzt,
    creditsAmount: args.creditsAmount,
    userEmail: args.userEmail,
    userTelegram: args.userTelegram,
  });
  return buildWhatsAppTopUpUrl(args.settings.whatsappPhone, message);
}

export async function getUserTelegramUsername(userId: string): Promise<string | null> {
  const row = await prisma.userIdentity.findFirst({
    where: { userId, provider: "telegram" },
    select: { username: true },
  });
  const username = row?.username?.trim().replace(/^@/, "");
  return username || null;
}

export type ManualPaymentClientRow = {
  requestId: string;
  paymentCode: string;
  status: PaymentStatus;
  statusLabel: string;
  amountKzt: number;
  creditsAmount: number;
  packageId: string | null;
  packageLabel: string;
  contactChannel: ManualPaymentContactChannel;
  kaspiRecipientPhoneMasked: string;
  recipientName: string;
  instructionText: string;
  whatsappUrl: string | null;
  whatsappEnabled: boolean;
  createdAt: string;
  expiresAt: string | null;
  expired: boolean;
  canCancel: boolean;
  canOpenWhatsApp: boolean;
};

export function serializeManualPaymentForClient(args: {
  payment: Payment & { tokenPackage?: Pick<TokenPackage, "name"> | null };
  settings: KaspiManualSettings;
  userEmail: string;
  userTelegram?: string | null;
}): ManualPaymentClientRow {
  const meta = readPaymentMetadata(args.payment.metadata);
  const expired = isManualPaymentExpired(meta);
  const paymentCode =
    (typeof meta.instructionCode === "string" && meta.instructionCode) ||
    args.payment.providerPaymentId ||
    "";
  const contactChannel =
    (typeof meta.contactChannel === "string" &&
    meta.contactChannel === "whatsapp"
      ? "whatsapp"
      : "kaspi") satisfies ManualPaymentContactChannel;
  const packageLabel =
    args.payment.tokenPackage?.name ??
    (typeof meta.tokenPackageName === "string" ? meta.tokenPackageName : "Пакет");
  const amountKzt = Number(args.payment.amount.toString());
  const whatsappUrl =
    contactChannel === "whatsapp"
      ? buildWhatsAppUrlForManualPayment({
          settings: args.settings,
          paymentCode,
          packageLabel,
          amountKzt,
          creditsAmount: args.payment.credits,
          userEmail: args.userEmail,
          userTelegram: args.userTelegram,
        })
      : null;
  const canCancel =
    args.payment.status === "PENDING" || args.payment.status === "PROCESSING";
  return {
    requestId: args.payment.id,
    paymentCode,
    status: args.payment.status,
    statusLabel: manualPaymentUserStatusLabel(args.payment.status, expired),
    amountKzt,
    creditsAmount: args.payment.credits,
    packageId: args.payment.tokenPackageId,
    packageLabel,
    contactChannel,
    kaspiRecipientPhoneMasked:
      typeof meta.kaspiRecipientPhoneMasked === "string"
        ? meta.kaspiRecipientPhoneMasked
        : maskKaspiRecipientPhone(args.settings.recipientPhone),
    recipientName:
      typeof meta.kaspiRecipientName === "string"
        ? meta.kaspiRecipientName
        : args.settings.recipientName,
    instructionText: args.settings.instructionText,
    whatsappUrl,
    whatsappEnabled: args.settings.whatsappEnabled && Boolean(args.settings.whatsappPhone),
    createdAt: args.payment.createdAt.toISOString(),
    expiresAt: typeof meta.expiresAt === "string" ? meta.expiresAt : null,
    expired,
    canCancel,
    canOpenWhatsApp: canCancel && contactChannel === "whatsapp" && Boolean(whatsappUrl),
  };
}

export async function findUserOpenManualPayment(userId: string) {
  return prisma.payment.findFirst({
    where: {
      userId,
      provider: KASPI_MANUAL_PAYMENT_PROVIDER,
      status: { in: ["PENDING", "PROCESSING"] },
    },
    orderBy: { createdAt: "desc" },
    include: { tokenPackage: { select: { name: true, slug: true } } },
  });
}

export async function listUserManualPayments(userId: string, take = 20) {
  return prisma.payment.findMany({
    where: {
      userId,
      provider: KASPI_MANUAL_PAYMENT_PROVIDER,
    },
    orderBy: { createdAt: "desc" },
    take,
    include: { tokenPackage: { select: { name: true, slug: true } } },
  });
}

export type CreateManualPaymentResult =
  | { ok: true; row: ManualPaymentClientRow }
  | { ok: false; error: string; status: number; existingPaymentId?: string };

export async function createManualPaymentRequest(args: {
  userId: string;
  userEmail: string;
  userTelegram?: string | null;
  packageId: string;
  contactChannel?: ManualPaymentContactChannel;
}): Promise<CreateManualPaymentResult> {
  const settings = await getKaspiManualSettings();
  if (!settings.kaspiManualEnabled) {
    return { ok: false, error: "Ручное пополнение отключено", status: 503 };
  }

  const contactChannel: ManualPaymentContactChannel =
    args.contactChannel === "whatsapp" && settings.whatsappEnabled
      ? "whatsapp"
      : "kaspi";

  if (contactChannel === "whatsapp" && !settings.whatsappPhone) {
    return { ok: false, error: "WhatsApp временно недоступен", status: 503 };
  }

  const pkg = await getTokenPackageByIdForCheckout(args.packageId, {
    requireActive: true,
  });
  if (!pkg) {
    return { ok: false, error: "Пакет не найден или недоступен", status: 400 };
  }

  const openManual = await findUserOpenManualPayment(args.userId);
  if (openManual) {
    return {
      ok: false,
      error:
        "У вас уже есть активная заявка на пополнение. Отмените её или дождитесь проверки.",
      status: 409,
      existingPaymentId: openManual.id,
    };
  }

  const totalTokens = pkg.baseTokens + pkg.bonusTokens;
  if (totalTokens <= 0) {
    return { ok: false, error: "Пакет не содержит токенов", status: 400 };
  }

  const masked = maskKaspiRecipientPhone(settings.recipientPhone);
  const expiresAt = new Date(
    Date.now() + settings.expiresMinutes * 60 * 1000,
  ).toISOString();

  for (let attempt = 0; attempt < 20; attempt++) {
    const instructionCode = buildManualPaymentInstructionCode(settings.paymentCodePrefix);
    try {
      const payment = await prisma.payment.create({
        data: {
          userId: args.userId,
          tokenPackageId: pkg.id,
          provider: KASPI_MANUAL_PAYMENT_PROVIDER,
          providerPaymentId: instructionCode,
          amount: new Prisma.Decimal(pkg.priceKzt),
          currency: "KZT",
          credits: totalTokens,
          status: "PENDING",
          metadata: {
            manualKaspi: true,
            paymentMethod: "kaspi_transfer",
            contactChannel,
            instructionCode,
            kaspiRecipientName: settings.recipientName,
            kaspiRecipientPhoneMasked: masked,
            expiresAt,
            tokenPackageId: pkg.id,
            tokenPackageSlug: pkg.slug,
            tokenPackageName: pkg.name,
            priceKzt: pkg.priceKzt,
            baseTokens: pkg.baseTokens,
            bonusTokens: pkg.bonusTokens,
            totalTokens,
          } satisfies Prisma.InputJsonObject,
        },
        include: { tokenPackage: { select: { name: true } } },
      });

      return {
        ok: true,
        row: serializeManualPaymentForClient({
          payment,
          settings,
          userEmail: args.userEmail,
          userTelegram: args.userTelegram,
        }),
      };
    } catch (e) {
      if (isUniqueViolation(e)) continue;
      console.error("[manual-payment/create]", e);
      return { ok: false, error: "Не удалось создать заявку", status: 500 };
    }
  }

  return {
    ok: false,
    error: "Не удалось сгенерировать уникальный код — повторите",
    status: 503,
  };
}

export async function cancelUserManualPayment(args: {
  userId: string;
  paymentId: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const pay = await prisma.payment.findUnique({ where: { id: args.paymentId } });
  if (!pay || pay.userId !== args.userId) {
    return { ok: false, error: "Не найдено", status: 404 };
  }
  if (pay.provider !== KASPI_MANUAL_PAYMENT_PROVIDER) {
    return { ok: false, error: "Неверный тип заявки", status: 400 };
  }
  if (pay.status !== "PENDING" && pay.status !== "PROCESSING") {
    return { ok: false, error: "Отмена недоступна для этого статуса", status: 400 };
  }

  await prisma.payment.update({
    where: { id: pay.id },
    data: {
      status: "CANCELLED",
      metadata: mergePaymentMetadata(pay.metadata, {
        cancelledByUserAt: new Date().toISOString(),
      }),
    },
  });

  return { ok: true };
}
