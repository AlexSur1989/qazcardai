import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  // Убирает предупреждение о «лишнем» lockfile в родительской папке (Windows).
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
