import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // For monorepo: tell Next where to root file-tracing for serverless bundling.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Allow imports from workspace packages.
  transpilePackages: ["@aurahire/shared", "@aurahire/db"],
  async redirects() {
    return [
      // Legacy candidate-onboarding routes consolidated into /review.
      {
        source: "/onboarding/candidate/education",
        destination: "/onboarding/candidate/review",
        permanent: false,
      },
      {
        source: "/onboarding/candidate/experience",
        destination: "/onboarding/candidate/review",
        permanent: false,
      },
      {
        source: "/onboarding/candidate/skills",
        destination: "/onboarding/candidate/review",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
