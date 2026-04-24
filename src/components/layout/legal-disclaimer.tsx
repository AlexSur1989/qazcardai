import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

/**
 * Обязательная пометка на всех legal-страницах: не заменяет review юриста.
 */
export function LegalDisclaimerBanner() {
  return (
    <Alert className="border-amber-500/40 bg-amber-500/5">
      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-500" />
      <AlertTitle>Черновик для внутреннего использования</AlertTitle>
      <AlertDescription className="text-sm leading-relaxed">
        Текст ниже — <strong>заглушка-шаблон</strong>, а не юридическая консультация и не
        итоговая редакция. Перед публикацией в production его необходимо{" "}
        <strong>проверить квалифицированным юристом</strong> с учётом вашей юрисдикции,
        продукта и политики провайдера.
      </AlertDescription>
    </Alert>
  );
}
