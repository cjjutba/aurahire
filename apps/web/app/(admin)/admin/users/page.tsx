import { redirect } from "next/navigation";
import { getCurrentSession, getCurrentProfile } from "@/lib/auth/session";
import { UsersTableClient } from "./_users-table-client";
import { FiltersClient } from "./_filters-client";

export const metadata = { title: "Users" };

interface PageProps {
  searchParams: Promise<{
    role?: string;
    status?: string;
    q?: string;
    page?: string;
  }>;
}

interface UserRow {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

interface ListBody {
  data: UserRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface ProfileMe {
  id: string;
}

export default async function UsersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const me = (await getCurrentProfile()) as ProfileMe | null;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const params = new URLSearchParams();
  if (sp.role) params.set("role", sp.role);
  if (sp.status) params.set("status", sp.status);
  if (sp.q) params.set("q", sp.q);
  if (sp.page) params.set("page", sp.page);
  params.set("limit", "20");

  const res = await fetch(`${apiUrl}/api/v1/admin/users?${params.toString()}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="text-[var(--color-status-danger)]">
        Failed to load users.
      </div>
    );
  }
  const body = (await res.json()) as ListBody;

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <header>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Users
        </h1>
        <p className="mt-1 text-sm text-[var(--color-body)]">
          {body.meta.total} user{body.meta.total === 1 ? "" : "s"}
        </p>
      </header>
      <FiltersClient
        initialFilters={{ role: sp.role, status: sp.status, q: sp.q }}
      />
      {body.data.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] py-16 text-center">
          <h3 className="text-lg font-semibold text-[var(--color-ink)]">
            No users match these filters
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-body)]">
            Try widening the filters or clearing the search.
          </p>
        </div>
      ) : (
        <UsersTableClient
          rows={body.data}
          currentUserId={me?.id ?? null}
          meta={body.meta}
        />
      )}
    </div>
  );
}
