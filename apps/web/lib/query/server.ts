import "server-only";

// Server-only barrel. Importing from "@/lib/query/server" in a Client
// Component will fail at build time, by design — these helpers depend on
// next/headers (cookies) which is forbidden outside Server Components.
export { serverApiFetch, ServerApiError } from "./server-fetch";
export { serverQueries } from "./queries";
