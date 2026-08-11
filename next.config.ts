import type { NextConfig } from "next";

// GitHub Pages serve sites de projeto em https://usuario.github.io/repo/ — o build da CI
// passa NEXT_BASE_PATH="/repo" (ver .github/workflows/pages.yml). Em dev local fica vazio.
const basePath = process.env.NEXT_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
