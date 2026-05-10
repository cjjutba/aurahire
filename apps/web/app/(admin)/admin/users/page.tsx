import { redirect } from "next/navigation";
import { getCurrentSession, getCurrentProfile } from "@/lib/auth/session";
import { UsersTableClient } from "./_users-table-client";
import { UsersToolbarClient } from "./_users-toolbar-client";

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
      <div className="mx-auto max-w-[1280px]">
        <p className="text-sm text-[var(--color-status-danger)]">
          Failed to load users. Please refresh the page.
        </p>
      </div>
    );
  }
  const body = (await res.json()) as ListBody;

  const filtersActive = !!(sp.role || sp.status || sp.q);

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <header>
        <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          Users
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          {body.meta.total === 0
            ? "No users yet"
            : `${body.meta.total} user${body.meta.total === 1 ? "" : "s"}`}
        </p>
      </header>

      <UsersToolbarClient
        initialQuery={sp.q ?? ""}
        role={sp.role ?? "all"}
        status={sp.status ?? "all"}
      />

      {body.data.length === 0 ? (
        filtersActive ? (
          <EmptyFiltered />
        ) : (
          <EmptyUsers />
        )
      ) : (
        <UsersTableClient
          rows={body.data}
          currentUserId={me?.id ?? null}
          meta={body.meta}
          searchParams={{ role: sp.role, status: sp.status, q: sp.q }}
        />
      )}
    </div>
  );
}

function EmptyUsers() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No users yet
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        Once people register, they will appear here.
      </div>
    </div>
  );
}

function EmptyFiltered() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-12 text-center">
      <div className="mt-3 text-sm font-medium text-[var(--color-ink)]">
        No users match your filters
      </div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">
        Try different search terms or clear the filters.
      </div>
      <a
        href="/admin/users"
        className="mt-4 inline-flex h-9 items-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-soft)]"
      >
        Clear filters
      </a>
    </div>
  );
}
