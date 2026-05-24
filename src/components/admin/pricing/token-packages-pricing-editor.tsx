"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatKzt } from "@/lib/format-kzt";

export type TokenPackageAdminRow = {
  id: string;
  name: string;
  slug: string;
  priceKzt: number;
  baseTokens: number;
  bonusTokens: number;
  totalTokens: number;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

type PackageDraft = {
  name: string;
  slug: string;
  priceKzt: number;
  baseTokens: number;
  bonusTokens: number;
  description: string;
  sortOrder: number;
  isActive: boolean;
};

const INPUT_CLS = "text-sm";

function emptyDraft(sortOrder: number): PackageDraft {
  return {
    name: "",
    slug: "",
    priceKzt: 1000,
    baseTokens: 100,
    bonusTokens: 0,
    description: "",
    sortOrder,
    isActive: true,
  };
}

function rowToDraft(p: TokenPackageAdminRow): PackageDraft {
  return {
    name: p.name,
    slug: p.slug,
    priceKzt: p.priceKzt,
    baseTokens: p.baseTokens,
    bonusTokens: p.bonusTokens,
    description: p.description ?? "",
    sortOrder: p.sortOrder,
    isActive: p.isActive,
  };
}

function pricePerToken(priceKzt: number, total: number): string {
  if (total <= 0) return "—";
  return (priceKzt / total).toFixed(2);
}

type Props = {
  initialPackages: TokenPackageAdminRow[];
  canEdit: boolean;
  priceWarnings?: string[];
};

export function TokenPackagesPricingEditor({
  initialPackages,
  canEdit,
  priceWarnings = [],
}: Props) {
  const router = useRouter();
  const [packages, setPackages] = useState(initialPackages);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<PackageDraft>(() =>
    emptyDraft(initialPackages.length),
  );
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const draftTotal = draft.baseTokens + draft.bonusTokens;

  const startEdit = useCallback((p: TokenPackageAdminRow) => {
    setEditingId(p.id);
    setDraft(rowToDraft(p));
    setErr(null);
    setOkMsg(null);
  }, []);

  const startCreate = useCallback(() => {
    setEditingId("new");
    setDraft(emptyDraft(packages.length));
    setErr(null);
    setOkMsg(null);
  }, [packages.length]);

  const cancel = useCallback(() => {
    setEditingId(null);
    setErr(null);
  }, []);

  const save = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setOkMsg(null);
    const body = {
      ...draft,
      description: draft.description.trim() || undefined,
    };
    try {
      const isNew = editingId === "new";
      const res = await fetch(
        isNew
          ? "/api/admin/pricing/token-packages"
          : `/api/admin/pricing/token-packages/${editingId}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json()) as { error?: string; id?: string };
      if (!res.ok) {
        setErr(data.error ?? `Ошибка ${res.status}`);
        return;
      }
      const listRes = await fetch("/api/admin/pricing/token-packages");
      const listData = (await listRes.json()) as { packages?: TokenPackageAdminRow[] };
      if (listData.packages) setPackages(listData.packages);
      setOkMsg(isNew ? "Пакет создан" : "Пакет сохранён");
      setEditingId(null);
      router.refresh();
    } catch {
      setErr("Сеть: не удалось сохранить");
    } finally {
      setLoading(false);
    }
  }, [draft, editingId, router]);

  const deactivate = useCallback(
    async (p: TokenPackageAdminRow) => {
      if (!confirm(`Отключить пакет «${p.name}»?`)) return;
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/admin/pricing/token-packages/${p.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...rowToDraft(p), isActive: false }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setErr(data.error ?? `Ошибка ${res.status}`);
          return;
        }
        const listRes = await fetch("/api/admin/pricing/token-packages");
        const listData = (await listRes.json()) as { packages?: TokenPackageAdminRow[] };
        if (listData.packages) setPackages(listData.packages);
        setOkMsg("Пакет отключён");
        router.refresh();
      } catch {
        setErr("Сеть: не удалось отключить");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  const sorted = useMemo(
    () => [...packages].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [packages],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">Пакеты токенов</CardTitle>
          <CardDescription>
            Изменения пакетов применяются только к новым заявкам. Существующие Payment сохраняют
            сумму и токены на момент создания.
          </CardDescription>
        </div>
        {canEdit ? (
          <Button type="button" size="sm" variant="outline" onClick={startCreate}>
            Добавить пакет
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {err ? (
          <Alert variant="destructive">
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        ) : null}
        {okMsg ? (
          <Alert>
            <AlertDescription>{okMsg}</AlertDescription>
          </Alert>
        ) : null}
        {priceWarnings.map((w) => (
          <Alert key={w}>
            <AlertDescription>{w}</AlertDescription>
          </Alert>
        ))}

        {editingId !== null ? (
          <div className="bg-muted/40 space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">
              {editingId === "new" ? "Новый пакет" : "Редактирование пакета"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label>Название</Label>
                <Input
                  className={INPUT_CLS}
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>slug (code)</Label>
                <Input
                  className={`font-mono ${INPUT_CLS}`}
                  value={draft.slug}
                  onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
                />
              </div>
              <div>
                <Label>Цена, ₸</Label>
                <Input
                  className={INPUT_CLS}
                  type="number"
                  min={1}
                  value={draft.priceKzt}
                  onChange={(e) => setDraft((d) => ({ ...d, priceKzt: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>База токенов</Label>
                <Input
                  className={INPUT_CLS}
                  type="number"
                  min={1}
                  value={draft.baseTokens}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, baseTokens: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <Label>Бонус</Label>
                <Input
                  className={INPUT_CLS}
                  type="number"
                  min={0}
                  value={draft.bonusTokens}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, bonusTokens: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <Label>sortOrder</Label>
                <Input
                  className={INPUT_CLS}
                  type="number"
                  value={draft.sortOrder}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, sortOrder: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Описание</Label>
                <Input
                  className={INPUT_CLS}
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
                    className="rounded border"
                  />
                  Активен
                </label>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Итого: <strong>{draftTotal}</strong> ток. · {pricePerToken(draft.priceKzt, draftTotal)}{" "}
              ₸/токен
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={loading} onClick={() => void save()}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Сохранить пакет"}
              </Button>
              <Button type="button" variant="outline" disabled={loading} onClick={cancel}>
                Отменить
              </Button>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>slug</TableHead>
                <TableHead className="text-right">Токены</TableHead>
                <TableHead className="text-right">Цена</TableHead>
                <TableHead className="text-right">₸/токен</TableHead>
                <TableHead>Статус</TableHead>
                {canEdit ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((p) => (
                <TableRow key={p.id} className={!p.isActive ? "opacity-60" : undefined}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="font-mono text-xs">{p.slug}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.totalTokens}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatKzt(p.priceKzt)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {pricePerToken(p.priceKzt, p.totalTokens)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.isActive ? "default" : "secondary"}>
                      {p.isActive ? "active" : "off"}
                    </Badge>
                  </TableCell>
                  {canEdit ? (
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={loading}
                          onClick={() => startEdit(p)}
                        >
                          Изменить
                        </Button>
                        {p.isActive ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={loading}
                            onClick={() => void deactivate(p)}
                          >
                            Отключить
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
