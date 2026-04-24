import { notFound } from "next/navigation";

import { AiModelForm } from "@/components/admin/ai-model-form";
import { fromDbModelToFormFields } from "@/lib/ai-model-form-mappers";
import { getAdminAiModelById } from "@/lib/ai-model-admin-queries";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const m = await getAdminAiModelById(id);
  if (!m) {
    return { title: "Модель не найдена" };
  }
  return { title: `${m.name} — редактирование` };
}

export default async function AdminEditModelPage({ params }: Props) {
  const { id } = await params;
  const m = await getAdminAiModelById(id);
  if (!m) {
    notFound();
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Редактирование</h1>
        <p className="text-foreground text-sm font-medium">{m.name}</p>
        <p className="text-muted-foreground mt-1 font-mono text-xs">id: {m.id}</p>
      </div>
      <AiModelForm
        mode="edit"
        modelId={m.id}
        initialData={fromDbModelToFormFields(m)}
      />
    </div>
  );
}
