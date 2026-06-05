"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminTerm } from "@/lib/admin-terms";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProviderPayload = {
  smtpConfigured: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUser: string | null;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
  smtpPasswordConfigured: boolean;
  supportEmail: string | null;
  resendApiConfigured: boolean;
  sendgridApiConfigured: boolean;
  apiKeyConfigured: boolean;
  emailEnabled: boolean;
  emailProvider: string;
};

type TemplateRow = {
  id: string;
  key: string;
  name: string;
  subject: string;
  isActive: boolean;
  version: number;
  updatedAt: string | Date;
  bodyText: string | null;
  bodyHtml: string | null;
  variables: unknown;
};

type Props = {
  canEdit: boolean;
  initial: {
    settings: Record<string, unknown>;
    provider: ProviderPayload;
    templates: TemplateRow[];
  };
};

const NOTIF_BOOL_KEYS = [
  "EMAIL_ENABLED",
  "SEND_WELCOME_EMAIL",
  "SEND_PAYMENT_SUCCESS_EMAIL",
  "SEND_GENERATION_COMPLETED_EMAIL",
  "SEND_GENERATION_FAILED_EMAIL",
  "SEND_LOW_BALANCE_EMAIL",
  "SEND_ADMIN_PROVIDER_ERRORS",
  "SEND_ADMIN_WORKER_ERRORS",
] as const;

export function AdminNotificationsPage({ canEdit, initial }: Props) {
  const [data, setData] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>(() => ({
    ...initial.settings,
  }));
  const [editorKey, setEditorKey] = useState<string | null>(null);
  const [editor, setEditor] = useState({
    subject: "",
    bodyText: "",
    bodyHtml: "",
    isActive: true,
  });
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [smtpTestTo, setSmtpTestTo] = useState("");
  const [smtpTesting, setSmtpTesting] = useState(false);

  const selected = useMemo(
    () => data.templates.find((t) => t.key === editorKey) ?? null,
    [data.templates, editorKey],
  );

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/notifications", { method: "GET" });
    const j = (await res.json()) as {
      settings: Record<string, unknown>;
      provider: ProviderPayload;
      templates: TemplateRow[];
    };
    if (res.ok) {
      setData({ settings: j.settings, provider: j.provider, templates: j.templates });
      setForm((p) => ({ ...p, ...j.settings }));
    }
  }, []);

  const openEditor = (t: TemplateRow) => {
    setEditorKey(t.key);
    setEditor({
      subject: t.subject,
      bodyText: t.bodyText ?? "",
      bodyHtml: t.bodyHtml ?? "",
      isActive: t.isActive,
    });
  };

  const saveSettings = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/notifications/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "error");
      toast.success("Сохранено / Saved");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const seedDefaults = async () => {
    if (!canEdit) return;
    setSeeding(true);
    try {
      const res = await fetch(
        "/api/admin/notifications/templates/seed-defaults",
        { method: "POST" },
      );
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "error");
      toast.success("Шаблоны созданы / Templates seeded");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSeeding(false);
    }
  };

  const saveTemplate = async () => {
    if (!canEdit || !editorKey) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/notifications/templates/${encodeURIComponent(editorKey)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: editor.subject,
            bodyText: editor.bodyText,
            bodyHtml: editor.bodyHtml || null,
            isActive: editor.isActive,
          }),
        },
      );
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "error");
      toast.success("Шаблон сохранён / Template saved");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  const sendSmtpTest = async () => {
    if (!canEdit) return;
    if (!smtpTestTo.trim()) {
      toast.error("Email");
      return;
    }
    setSmtpTesting(true);
    try {
      const res = await fetch("/api/admin/notifications/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: smtpTestTo.trim() }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        result?: string;
        reason?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(j.message ?? j.error ?? "error");
      }
      if (j.result === "skipped") {
        toast.message(`Пропущено: ${j.reason ?? ""}`);
      } else {
        toast.success("SMTP-тест отправлен / SMTP test sent");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSmtpTesting(false);
    }
  };

  const sendTest = async () => {
    if (!canEdit || !editorKey) return;
    if (!testTo.trim()) {
      toast.error("Email");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/admin/notifications/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo.trim(), templateKey: editorKey }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        result?: string;
        reason?: string;
      };
      if (!res.ok) throw new Error(
        (j as { error?: string; message?: string }).error ??
        (j as { message?: string }).message ??
        "error"
      );
      if (j.result === "skipped") {
        toast.message(`Пропущено: ${j.reason ?? ""}`);
      } else {
        toast.success("Письмо отправлено / Sent");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setTesting(false);
    }
  };

  const preview = useMemo(() => {
    const sample: Record<string, string> = {
      appName: "QazCard AI",
      userName: "Demo",
      userEmail: "user@example.com",
      balanceCredits: "10",
      packageName: "100 токенов",
      credits: "100",
      amount: "1000",
      currency: "KZT",
      generationId: "cuid…",
      generationType: "VIDEO",
      modelName: "Demo model",
      errorMessage: "—",
      dashboardUrl: "https://app.example/dashboard",
      billingUrl: "https://app.example/dashboard/billing",
      supportEmail: "support@qazcardai.kz",
      createdAt: new Date().toISOString(),
    };
    const subj = simpleReplace(editor.subject, sample);
    const text = simpleReplace(editor.bodyText, sample);
    return { subj, text };
  }, [editor.subject, editor.bodyText]);

  return (
    <div className="space-y-8">
      {canEdit ? null : (
        <p className="text-muted-foreground text-sm">{adminTerm("notifReadOnly")}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{adminTerm("notifProviderSection")}</CardTitle>
          <CardDescription>
            Email provider / Email-провайдер · {adminTerm("notifSmtpOk").split(" / ")[0]}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>EMAIL_PROVIDER (none, smtp, resend, sendgrid)</Label>
              <Input
                value={String(form.EMAIL_PROVIDER ?? "none")}
                onChange={(e) =>
                  setForm((f) => ({ ...f, EMAIL_PROVIDER: e.target.value }))
                }
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>{adminTerm("notifLabelEmailFrom")}</Label>
              <Input
                value={String(form.EMAIL_FROM ?? "")}
                onChange={(e) => setForm((f) => ({ ...f, EMAIL_FROM: e.target.value }))}
                disabled={!canEdit}
                placeholder="QazCard AI &lt;noreply@qazcardai.kz&gt;"
              />
              <p className="text-muted-foreground text-xs">
                From в env (SMTP_FROM_EMAIL / SMTP_FROM_NAME) имеет приоритет над этим полем.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>ADMIN_ALERT_EMAIL (admin alerts)</Label>
              <Input
                value={String(form.ADMIN_ALERT_EMAIL ?? "")}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ADMIN_ALERT_EMAIL: e.target.value }))
                }
                disabled={!canEdit}
              />
            </div>
          </div>
          <ul className="text-muted-foreground space-y-1 text-sm">
            <li>
              {data.provider.smtpConfigured
                ? "✓ " + adminTerm("notifSmtpOk")
                : "— " + adminTerm("notifSmtpNo")}
            </li>
            {data.provider.smtpHost ? (
              <li>
                SMTP: {data.provider.smtpHost}:{data.provider.smtpPort}
                {data.provider.smtpSecure ? " (SSL)" : ""} · From:{" "}
                {data.provider.smtpFromName} &lt;{data.provider.smtpFromEmail}&gt;
              </li>
            ) : null}
            <li>
              {data.provider.smtpPasswordConfigured
                ? "✓ SMTP password задан в env"
                : "— SMTP_PASSWORD не задан в env"}
            </li>
            {data.provider.supportEmail ? (
              <li>Поддержка в письмах: {data.provider.supportEmail}</li>
            ) : null}
            <li>
              {data.provider.apiKeyConfigured
                ? "✓ " + adminTerm("notifApiOk")
                : "— " + adminTerm("notifApiNo")}
            </li>
          </ul>
          {canEdit ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label>Тест SMTP (без шаблона)</Label>
                <Input
                  type="email"
                  placeholder="admin@example.com"
                  value={smtpTestTo}
                  onChange={(e) => setSmtpTestTo(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={sendSmtpTest}
                disabled={smtpTesting}
              >
                {smtpTesting ? "…" : "Отправить тест SMTP"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{adminTerm("notifEventsSection")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {NOTIF_BOOL_KEYS.map((k) => (
              <label key={k} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 rounded border"
                  checked={form[k] === true}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [k]: e.target.checked }))
                  }
                  disabled={!canEdit}
                />
                <span className="text-sm">{k}</span>
              </label>
          ))}
          {canEdit ? (
            <Button onClick={saveSettings} disabled={saving}>
              {adminTerm("notifSaveSettings")}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{adminTerm("notifTemplatesSection")}</CardTitle>
              <CardDescription>
                Template / Шаблон · {adminTerm("lpColVersion")}
              </CardDescription>
            </div>
            {canEdit ? (
              <Button variant="secondary" onClick={seedDefaults} disabled={seeding}>
                {adminTerm("notifSeed")}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key / Ключ</TableHead>
                  <TableHead>Name / Название</TableHead>
                  <TableHead>Subject / Тема</TableHead>
                  <TableHead>Active / Активен</TableHead>
                  <TableHead>Version / Версия</TableHead>
                  <TableHead>Updated at / Обновлено</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.templates.map((t) => (
                  <TableRow key={t.key}>
                    <TableCell className="font-mono text-xs">{t.key}</TableCell>
                    <TableCell>{t.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={t.subject}>
                      {t.subject}
                    </TableCell>
                    <TableCell>{t.isActive ? "✓" : "—"}</TableCell>
                    <TableCell>{t.version}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {t.updatedAt
                        ? new Date(t.updatedAt).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEditor(t)}
                      >
                        {adminTerm("lpEdit")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {editorKey ? (
        <Card>
          <CardHeader>
            <CardTitle>{adminTerm("notifTemplateEditor")}</CardTitle>
            <CardDescription className="font-mono text-xs">
              {editorKey}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Subject / Тема</Label>
              <Input
                value={editor.subject}
                onChange={(e) => setEditor((x) => ({ ...x, subject: e.target.value }))}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Body text / Текст письма</Label>
              <Textarea
                className="min-h-[120px] font-mono text-sm"
                value={editor.bodyText}
                onChange={(e) => setEditor((x) => ({ ...x, bodyText: e.target.value }))}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Body HTML / HTML письма (optional)</Label>
              <Textarea
                className="min-h-[80px] font-mono text-sm"
                value={editor.bodyHtml}
                onChange={(e) => setEditor((x) => ({ ...x, bodyHtml: e.target.value }))}
                disabled={!canEdit}
              />
            </div>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 rounded border"
                  checked={editor.isActive}
                  onChange={(e) => setEditor((x) => ({ ...x, isActive: e.target.checked }))}
                  disabled={!canEdit}
                />
                <span className="text-sm">Active / Активен</span>
              </label>
            {selected && Array.isArray(selected.variables) ? (
              <div>
                <p className="mb-1 text-sm font-medium">Variables / Переменные</p>
                <p className="text-muted-foreground text-xs">
                  {selected.variables
                    .filter((x: unknown) => typeof x === "string")
                    .map((x: string) => `{{${x}}}`)
                    .join(" ")}
                </p>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 rounded border p-3 text-sm">
                <p className="text-muted-foreground text-xs">Preview / Предпросмотр</p>
                <p className="font-medium">{preview.subj}</p>
                <pre className="text-muted-foreground mt-2 whitespace-pre-wrap font-sans text-xs">
                  {preview.text}
                </pre>
              </div>
              <div className="space-y-2">
                <Label>{adminTerm("notifTestEmail")}</Label>
                <Input
                  type="email"
                  placeholder="admin@example.com"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  disabled={!canEdit}
                />
                {canEdit ? (
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={saveTemplate} disabled={saving}>
                      {adminTerm("lpSaveDraft")}
                    </Button>
                    <Button variant="secondary" onClick={sendTest} disabled={testing}>
                      {adminTerm("notifTestEmail")}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function simpleReplace(s: string, m: Record<string, string>) {
  return s.replace(/\{\{(\w+)\}\}/g, (_a, b: string) => m[b] ?? "");
}
