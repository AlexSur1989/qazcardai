/**
 * Ручной перевод на Kaspi (временный способ до полной интеграции Kaspi Pay).
 * Отдельно от автоматического KASPI (Kaspi Pay).
 */
export const KASPI_MANUAL_PAYMENT_PROVIDER = "kaspi_manual" as const;

export type ManualPaymentContactChannel = "whatsapp" | "kaspi";

export type KaspiManualBillingPublic = {
  enabled: boolean;
  recipientName: string;
  kaspiRecipientPhoneMasked: string;
  instructionText: string;
  requireReceiptUpload: boolean;
  expiresMinutes: number;
  whatsappEnabled: boolean;
  whatsappPhoneDisplay: string;
};

export type ManualPaymentSettingsPublic = KaspiManualBillingPublic & {
  packages: Array<{
    id: string;
    label: string;
    amountKzt: number;
    credits: number;
  }>;
};
