import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@docnotes/api", "@docnotes/shared"],
};

export default config;
