
import { getAppName } from "@/lib/app-name";
import { getAppBaseUrl } from "@/lib/app-base-url";
import { getAppSetting } from "@/server/services/appSettings";
import {
  canSendAdminAlert,
  canSendUserLowBalanceAgain,
  getEmailFlowUrls,
  markAdminAlertSent,
  markUserLowBalanceEmailSent,
  sendTemplateEmail,
} from "@/server/services/emailService";
import { prisma } from "@/lib/prisma";

/**
 * Best-effort; не бросать наружу.
 */
export async function trySendWelcomeEmailForNewUser(input: { userId: string }) {
  try {
    const [flag, u] = await Promise.all([
      getAppSetting("SEND_WELCOME_EMAIL"),
      prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true, name: true, createdAt: true },
      }),
    ]);
    if (flag !== true || !u) return;
    const { appName, dashboardUrl } = getEmailFlowUrls();
    await sendTemplateEmail({
      to: u.email,
      templateKey: "WELCOME_USER",
      variables: {
        appName,
        userName: u.name ?? u.email,
        userEmail: u.email,
        dashboardUrl,
        createdAt: u.createdAt,
      },
    });
  } catch (e) {
    console.error("[notifications] welcome", e);
  }
}

export async function trySendPaymentSuccessEmail(input: {
  userId: string;
  packageName: string;
  credits: number;
  amount: string;
  currency: string;
}) {
  try {
    const flag = await getAppSetting("SEND_PAYMENT_SUCCESS_EMAIL");
    if (flag !== true) return;
    const u = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, name: true, balanceCredits: true, createdAt: true },
    });
    if (!u) return;
    const { appName, billingUrl } = getEmailFlowUrls();
    await sendTemplateEmail({
      to: u.email,
      templateKey: "PAYMENT_SUCCESS",
      variables: {
        appName,
        userName: u.name ?? u.email,
        userEmail: u.email,
        packageName: input.packageName,
        credits: input.credits,
        amount: input.amount,
        currency: input.currency,
        balanceCredits: u.balanceCredits,
        billingUrl,
        createdAt: u.createdAt,
      },
    });
  } catch (e) {
    console.error("[notifications] payment", e);
  }
}

export async function trySendGenerationCompletedEmail(generationId: string) {
  try {
    const flag = await getAppSetting("SEND_GENERATION_COMPLETED_EMAIL");
    if (flag !== true) return;
    const gen = await prisma.generation.findUnique({
      where: { id: generationId },
      include: { user: { select: { email: true, name: true, balanceCredits: true } }, model: true },
    });
    if (!gen) return;
    const u = gen.user;
    const { appName, dashboardUrl } = getEmailFlowUrls();
    await sendTemplateEmail({
      to: u.email,
      templateKey: "GENERATION_COMPLETED",
      variables: {
        appName,
        userName: u.name ?? u.email,
        userEmail: u.email,
        generationId: gen.id,
        generationType: gen.type,
        modelName: gen.model.name,
        balanceCredits: u.balanceCredits,
        dashboardUrl,
        createdAt: gen.completedAt ?? gen.updatedAt,
      },
    });
  } catch (e) {
    console.error("[notifications] gen completed", e);
  }
}

export async function trySendGenerationFailedEmail(generationId: string) {
  try {
    const flag = await getAppSetting("SEND_GENERATION_FAILED_EMAIL");
    if (flag !== true) return;
    const gen = await prisma.generation.findUnique({
      where: { id: generationId },
      include: { user: { select: { email: true, name: true } }, model: true },
    });
    if (!gen) return;
    const u = gen.user;
    const { appName, dashboardUrl } = getEmailFlowUrls();
    await sendTemplateEmail({
      to: u.email,
      templateKey: "GENERATION_FAILED",
      variables: {
        appName,
        userName: u.name ?? u.email,
        userEmail: u.email,
        generationId: gen.id,
        generationType: gen.type,
        modelName: gen.model.name,
        errorMessage: (gen.errorMessage ?? "").slice(0, 2000),
        dashboardUrl,
        createdAt: gen.completedAt ?? gen.updatedAt,
      },
    });
  } catch (e) {
    console.error("[notifications] gen failed", e);
  }
}

/**
 * Вызвать после списания резерва, если баланс под порогом.
 */
export async function trySendLowBalanceEmail(userId: string) {
  try {
    const [flag, rawThreshold] = await Promise.all([
      getAppSetting("SEND_LOW_BALANCE_EMAIL"),
      getAppSetting("LOW_BALANCE_THRESHOLD"),
    ]);
    if (flag !== true) return;
    const th =
      typeof rawThreshold === "number" && Number.isFinite(rawThreshold)
        ? Math.max(0, Math.floor(rawThreshold))
        : 50;
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        balanceCredits: true,
        createdAt: true,
      },
    });
    if (!u || u.balanceCredits >= th) return;
    if (!(await canSendUserLowBalanceAgain(userId))) return;
    const { appName, dashboardUrl, billingUrl } = getEmailFlowUrls();
    const r = await sendTemplateEmail({
      to: u.email,
      templateKey: "LOW_BALANCE",
      variables: {
        appName,
        userName: u.name ?? u.email,
        userEmail: u.email,
        balanceCredits: u.balanceCredits,
        dashboardUrl,
        billingUrl,
        createdAt: new Date(),
      },
    });
    if (r.status === "sent") {
      await markUserLowBalanceEmailSent(userId);
    }
  } catch (e) {
    console.error("[notifications] low balance", e);
  }
}

export async function trySendAdminProviderErrorEmail(args: { errorMessage: string }) {
  try {
    const [flag, rawTo] = await Promise.all([
      getAppSetting("SEND_ADMIN_PROVIDER_ERRORS"),
      getAppSetting("ADMIN_ALERT_EMAIL"),
    ]);
    if (flag !== true) return;
    const to = typeof rawTo === "string" ? rawTo.trim() : "";
    if (!to) return;
    if (!(await canSendAdminAlert("provider"))) return;
    const appName = (() => {
      try {
        return getAppName();
      } catch {
        return "QazCard AI";
      }
    })();
    const r = await sendTemplateEmail({
      to,
      templateKey: "ADMIN_PROVIDER_ERROR",
      variables: {
        appName,
        errorMessage: args.errorMessage.slice(0, 4000),
        createdAt: new Date(),
      },
    });
    if (r.status === "sent") {
      await markAdminAlertSent("provider");
    }
  } catch (e) {
    console.error("[notifications] admin provider", e);
  }
}

export async function trySendAdminWorkerErrorEmail(input: {
  generationId: string;
  errorMessage: string;
}) {
  try {
    const [flag, rawTo] = await Promise.all([
      getAppSetting("SEND_ADMIN_WORKER_ERRORS"),
      getAppSetting("ADMIN_ALERT_EMAIL"),
    ]);
    if (flag !== true) return;
    const to = typeof rawTo === "string" ? rawTo.trim() : "";
    if (!to) return;
    if (!(await canSendAdminAlert("worker"))) return;
    const appName = (() => {
      try {
        return getAppName();
      } catch {
        return "QazCard AI";
      }
    })();
    const r = await sendTemplateEmail({
      to,
      templateKey: "ADMIN_WORKER_ERROR",
      variables: {
        appName,
        generationId: input.generationId,
        errorMessage: input.errorMessage.slice(0, 4000),
        createdAt: new Date(),
      },
    });
    if (r.status === "sent") {
      await markAdminAlertSent("worker");
    }
  } catch (e) {
    console.error("[notifications] admin worker", e);
  }
}

export function getPublicUrlsForTestEmail() {
  return { ...getEmailFlowUrls(), baseUrl: getAppBaseUrl() };
}
