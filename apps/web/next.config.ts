import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // For monorepo: tell Next where to root file-tracing for serverless bundling.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Allow imports from workspace packages.
  transpilePackages: ["@aurahire/shared", "@aurahire/db"],
};

export default nextConfig;
