import { AiModelForm } from "@/components/admin/ai-model-form";

export const metadata = { title: "Новая AI-модель — админ" };

export default function AdminNewModelPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Новая AI-модель</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Данные уходят в БД, без вызовов Kie.ai. Цену в кредитах задаёте вручную.
        </p>
      </div>
      <AiModelForm mode="create" />
    </div>
  );
}
