import { redirect } from "next/navigation";

import { getLandingUrl } from "@/lib/app-name";

/** Production: app.qazcardai.kz/ → qazcardai.kz (дублирует middleware). */
export default function HomePage() {
  if (process.env.NODE_ENV === "production") {
    redirect(getLandingUrl());
  }
  redirect("/login");
}
