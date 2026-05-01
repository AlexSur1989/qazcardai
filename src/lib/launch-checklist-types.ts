export type LaunchCheckSeverity = "ok" | "warning" | "required";

export type LaunchChecklistItem = {
  id: string;
  labelEn: string;
  labelRu: string;
  severity: LaunchCheckSeverity;
  detail: string | null;
  fixHref: string | null;
};
