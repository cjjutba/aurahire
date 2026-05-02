import { defineConfig } from "orval";

export default defineConfig({
  aurahire: {
    input: {
      target: "./openapi.json",
    },
    output: {
      target: "./src/api-client/generated.ts",
      client: "react-query",
      mode: "single",
      override: {
        mutator: {
          path: "./src/api-client/fetcher.ts",
          name: "fetcher",
        },
        query: {
          useQuery: true,
          useMutation: true,
          options: {
            staleTime: 5 * 60 * 1000,
          },
        },
      },
    },
    hooks: {
      afterAllFilesWrite: "prettier --write",
    },
  },
});
