/**
 * Режим хранения загрузок: локальные файлы (dev) vs S3.
 * Без "server-only" — используется в env.ts при старте.
 */

const S3_ALIASES = new Set(["s3", "minio", "r2", "object", "remote"]);
const LOCAL_ALIASES = new Set(["local", "filesystem", "public"]);

/**
 * `true` — файлы в `public/uploads/...`, URL `/uploads/...` (только вне production).
 * В development по умолчанию (если `UPLOAD_STORAGE` не задан или = local), без S3 и без TLS к MinIO.
 * Чтобы в dev тестировать реальный S3/MinIO: `UPLOAD_STORAGE=s3` (+ S3_* и при self-signed `S3_TLS_INSECURE=1`).
 */
export function isLocalUploadStorageEffective(): boolean {
  const raw = (process.env.UPLOAD_STORAGE ?? "").trim().toLowerCase();
  if (S3_ALIASES.has(raw)) {
    return false;
  }
  if (LOCAL_ALIASES.has(raw)) {
    return true;
  }
  if (raw === "") {
    return process.env.NODE_ENV !== "production";
  }
  // неизвестное значение: в dev — как local, в prod — как S3
  return process.env.NODE_ENV !== "production";
}

/** Явно запрошен local в production — для проверки env (запрещено). */
export function isUploadStorageLocalExplicitInProduction(): boolean {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }
  return (process.env.UPLOAD_STORAGE ?? "").trim().toLowerCase() === "local";
}
