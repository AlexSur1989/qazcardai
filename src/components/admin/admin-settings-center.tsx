"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { AdminSettingsAdvancedPanel } from "@/components/admin/admin-settings-advanced-panel";
import { AdminSettingsBasicView } from "@/components/admin/admin-settings-basic-view";
import { BASIC_EDITABLE_SETTING_KEYS } from "@/lib/admin-settings-basic-config";
import type { GoogleOAuthEnvStatus } from "@/lib/google-auth-config";
import type { Permission } from "@/lib/permissions";

type SettingRow = {
  key: string;
  group: string;
  label: string;
  description: string;
  type: string;
  value: unknown;
  defaultValue: unknown;
  inDatabase: boolean;
  editable: boolean;
  sensitive: boolean;
};

type Group = {
  group: string;
  label: string;
  settings: SettingRow[];
};

function jsonStringify(v: unknown): string {
  try {
    return JSON.stringify(v ?? null, null, 2);
  } catch {
    return "";
  }
}

function canChangeRow(
  row: SettingRow,
  hasManage: boolean,
  hasCritical: boolean,
): boolean {
  if (!hasManage || !row.editable) return false;
  const needsCritical = row.sensitive || row.group === "maintenance";
  if (needsCritical && !hasCritical) return false;
  return true;
}

export function AdminSettingsCenter({
  initialGroups,
  canEdit,
  canEditCritical,
  linkPermissions,
  googleOAuthEnvStatus,
}: {
  initialGroups: Group[];
  canEdit: boolean;
  canEditCritical: boolean;
  linkPermissions: Partial<Record<Permission, boolean>>;
  googleOAuthEnvStatus: GoogleOAuthEnvStatus;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showAdvanced = searchParams.get("advanced") === "1";

  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [seeding, setSeeding] = useState(false);

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const o: Record<string, unknown> = {};
    for (const g of initialGroups) {
      for (const s of g.settings) {
        o[s.key] = s.value;
      }
    }
    return o;
  });

  const [jsonText, setJsonText] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const g of initialGroups) {
      for (const s of g.settings) {
        if (s.type === "json") {
          o[s.key] = jsonStringify(s.value);
        }
      }
    }
    return o;
  });

  const basicSettings = useMemo(() => {
    const rows: SettingRow[] = [];
    for (const g of initialGroups) {
      for (const s of g.settings) {
        if (BASIC_EDITABLE_SETTING_KEYS.has(s.key)) {
          rows.push(s);
        }
      }
    }
    return rows;
  }, [initialGroups]);

  const advancedOnlyCount = useMemo(() => {
    let n = 0;
    for (const g of initialGroups) {
      for (const s of g.settings) {
        if (BASIC_EDITABLE_SETTING_KEYS.has(s.key)) continue;
        n += 1;
      }
    }
    return n;
  }, [initialGroups]);

  const byKey = useMemo(() => {
    const m = new Map<string, SettingRow>();
    for (const g of initialGroups) {
      for (const s of g.settings) m.set(s.key, s);
    }
    return m;
  }, [initialGroups]);

  function setAdvancedMode(next: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set("advanced", "1");
    } else {
      params.delete("advanced");
    }
    const qs = params.toString();
    router.push(qs ? `/admin/settings?${qs}` : "/admin/settings");
  }

  async function patchKey(key: string, value: unknown) {
    setMessage(null);
    const res = await fetch(
      `/api/admin/settings/${encodeURIComponent(key)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      },
    );
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setMessage({ type: "err", text: j.error ?? `HTTP ${res.status}` });
      return false;
    }
    setMessage({ type: "ok", text: "Сохранено" });
    startTransition(() => {
      router.refresh();
    });
    return true;
  }

  async function saveKey(key: string) {
    const row = byKey.get(key);
    if (!row || !canChangeRow(row, canEdit, canEditCritical)) return;
    if (row.type === "json") {
      const raw = jsonText[key] ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        setMessage({ type: "err", text: "Некорректный JSON" });
        return;
      }
      const ok = await patchKey(key, parsed);
      if (ok) {
        setValues((m) => ({ ...m, [key]: parsed }));
        setJsonText((m) => ({ ...m, [key]: jsonStringify(parsed) }));
      }
      return;
    }
    await patchKey(key, values[key]);
  }

  async function seedDefaults() {
    if (!canEditCritical) return;
    setSeeding(true);
    setMessage(null);
    const res = await fetch("/api/admin/settings/seed-defaults", {
      method: "POST",
    });
    const j = (await res.json().catch(() => ({}))) as {
      error?: string;
      created?: number;
    };
    setSeeding(false);
    if (!res.ok) {
      setMessage({ type: "err", text: j.error ?? "Ошибка seed" });
      return;
    }
    setMessage({
      type: "ok",
      text: `Создано отсутствующих: ${j.created ?? 0}`,
    });
    startTransition(() => {
      router.refresh();
    });
  }

  if (showAdvanced) {
    return (
      <AdminSettingsAdvancedPanel
        initialGroups={initialGroups}
        canEdit={canEdit}
        canEditCritical={canEditCritical}
        values={values}
        setValues={setValues}
        jsonText={jsonText}
        setJsonText={setJsonText}
        onSaveKey={(key) => void saveKey(key)}
        pending={pending}
        message={message}
        onHideAdvanced={() => setAdvancedMode(false)}
        onSeedDefaults={() => void seedDefaults()}
        seeding={seeding}
        googleOAuthEnvStatus={googleOAuthEnvStatus}
      />
    );
  }

  return (
    <AdminSettingsBasicView
      basicSettings={basicSettings}
      canEdit={canEdit}
      canEditCritical={canEditCritical}
      linkPermissions={linkPermissions}
      values={values}
      setValues={setValues}
      onSaveKey={(key) => void saveKey(key)}
      pending={pending}
      message={message}
      onShowAdvanced={() => setAdvancedMode(true)}
      advancedCount={advancedOnlyCount}
    />
  );
}
