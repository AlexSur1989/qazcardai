"use client";

import { useMemo, useState } from "react";

import {
  FileUploadCard,
  type FileUploadCardValue,
} from "@/components/dashboard/file-upload-card";

type Props = {
  inputUrls: string[];
  videoUrls: string[];
  setInputUrls: (urls: string[]) => void;
  setVideoUrls: (urls: string[]) => void;
  imageError?: string | null;
  videoError?: string | null;
  onImageUploadSuccess?: () => void;
  onVideoUploadSuccess?: (payload: {
    url: string;
    fileId?: string;
    durationSeconds?: number | null;
  }) => void;
  onVideoCleared?: () => void;
  disabled?: boolean;
};

function firstUrl(urls: string[] | undefined): string | null {
  if (!urls || urls.length === 0) return null;
  const u = urls[0];
  return typeof u === "string" && u.trim() ? u.trim() : null;
}

/**
 * Две большие зоны drag-and-drop для Kling 3.0 Motion Control: фото + видео в S3 → URL в настройках.
 */
export function KlingMotionControlUploads({
  inputUrls,
  videoUrls,
  setInputUrls,
  setVideoUrls,
  imageError,
  videoError,
  onImageUploadSuccess,
  onVideoUploadSuccess,
  onVideoCleared,
  disabled = false,
}: Props) {
  const [imageMeta, setImageMeta] = useState<{
    fileName: string;
    size: number;
  } | null>(null);
  const [videoMeta, setVideoMeta] = useState<{
    fileName: string;
    size: number;
  } | null>(null);

  const inputUrl = firstUrl(inputUrls) ?? null;
  const videoUrl = firstUrl(videoUrls) ?? null;

  const imageValue: FileUploadCardValue = useMemo(() => {
    if (!inputUrl) return null;
    return {
      url: inputUrl,
      fileName: imageMeta?.fileName ?? "Загружено",
      size: imageMeta?.size ?? 0,
    };
  }, [inputUrl, imageMeta]);

  const videoValue: FileUploadCardValue = useMemo(() => {
    if (!videoUrl) return null;
    return {
      url: videoUrl,
      fileName: videoMeta?.fileName ?? "Загружено",
      size: videoMeta?.size ?? 0,
    };
  }, [videoUrl, videoMeta]);

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          Файлы для Motion Control
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Загрузите фото персонажа и видео с движением. Мы отправим в Kie.ai только ссылки на
          загруженные файлы.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FileUploadCard
          title="Загрузите фото персонажа или объекта"
          description="Это изображение будет использоваться как основа для анимации."
          buttonLabel="Выбрать фото"
          hint="PNG, JPG или JPEG до 10MB"
          accept="image/jpeg,image/png,image/jpg"
          maxSizeMb={10}
          purpose="kling_motion_reference_image"
          fileType="image"
          value={imageValue}
          error={imageError}
          disabled={disabled}
          onUploaded={({ url, fileName, size }) => {
            setImageMeta({ fileName, size });
            setInputUrls([url]);
            onImageUploadSuccess?.();
          }}
          onRemove={() => {
            setImageMeta(null);
            setInputUrls([]);
          }}
        />

        <FileUploadCard
          title="Загрузите видео с движением"
          description="Движение из этого видео будет перенесено на загруженное изображение."
          buttonLabel="Выбрать видео"
          hint="MP4 или MOV до 100MB, длительность 3–30 секунд"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          maxSizeMb={100}
          purpose="kling_motion_video"
          fileType="video"
          value={videoValue}
          error={videoError}
          disabled={disabled}
          onUploaded={({ url, fileName, size, fileId, durationSeconds }) => {
            setVideoMeta({ fileName, size });
            setVideoUrls([url]);
            onVideoUploadSuccess?.({
              url,
              fileId,
              durationSeconds:
                typeof durationSeconds === "number" && Number.isFinite(durationSeconds)
                  ? durationSeconds
                  : null,
            });
          }}
          onRemove={() => {
            setVideoMeta(null);
            setVideoUrls([]);
            onVideoCleared?.();
          }}
        />
      </div>
    </section>
  );
}
