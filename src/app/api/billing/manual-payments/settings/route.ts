import { NextResponse } from "next/server";

import { getManualPaymentSettingsPublic } from "@/server/services/kaspiManualSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getManualPaymentSettingsPublic();
  if (!settings.enabled) {
    return NextResponse.json({ enabled: false });
  }
  return NextResponse.json({
    enabled: true,
    kaspiPhone: settings.kaspiRecipientPhoneMasked,
    recipientName: settings.recipientName,
    whatsappEnabled: settings.whatsappEnabled,
    whatsappPhoneDisplay: settings.whatsappPhoneDisplay,
    instructions: settings.instructionText,
    packages: settings.packages,
    requireReceiptUpload: settings.requireReceiptUpload,
    expiresMinutes: settings.expiresMinutes,
  });
}
