/**
 * Безопасный разбор JSON из fetch (пустое тело / HTML-ошибка не бросают).
 */
export async function readJsonSafe<T>(
  res: Response,
): Promise<
  | { ok: true; data: T; status: number }
  | { ok: false; message: string; status: number }
> {
  const text = await res.text();
  const t = text.trim();
  if (!t) {
    return {
      ok: false,
      message:
        res.status >= 500
          ? "Сервер вернул пустой ответ. Проверьте миграции и логи."
          : "Пустой ответ сервера",
      status: res.status,
    };
  }
  try {
    return { ok: true, data: JSON.parse(t) as T, status: res.status };
  } catch {
    return {
      ok: false,
      message: "Сервер вернул не JSON (часто это страница ошибки 500).",
      status: res.status,
    };
  }
}
