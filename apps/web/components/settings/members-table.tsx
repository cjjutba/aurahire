"use client";

import { useActiveCompany } from "@/contexts/active-company-context";

import { useMembersQuery, type CompanyMember } from "@/hooks/use-members";

import { MembersInviteButton } from "./members-invite-dialog";
import { MembersRowActions } from "./members-row-actions";

/**
 * Active members + pending invites in a single envelope. We render them
 * in one table with a status pill so the UX is honest about who has
 * actually joined vs who's been emailed an invite.
 */
export function MembersTable() {
  const ctx = useActiveCompany();
  const callerRole = ctx?.activeMembership?.role ?? null;
  const isOwnerOrAdmin = callerRole === "owner" || callerRole === "admin";

  const { data, isLoading, isError } = useMembersQuery();
  const rows = data?.data ?? [];

  if (isLoading) {
    return (
      <p className="text-sm text-[var(--color-muted)]">Loading members…</p>
    );
  }
  if (isError) {
    return (
      <p className="text-sm text-[var(--color-status-danger)]">
        Failed to load members. Refresh to try again.
      </p>
    );
  }

  // Sort: active first, owner pinned to top of active; pending invites last.
  const sorted = [...rows].sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === "active") return -1;
      if (b.status === "active") return 1;
    }
    if (a.role !== b.role) {
      if (a.role === "owner") return -1;
      if (b.role === "owner") return 1;
      if (a.role === "admin") return -1;
      if (b.role === "admin") return 1;
    }
    return a.email.localeCompare(b.email);
  });

  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] py-12 px-6 text-center">
        <h3 className="text-base font-semibold text-[var(--color-ink)]">
          No team members yet
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-body)]">
          Invite someone to collaborate. They'll get an email with a one-time
          link to accept.
        </p>
        {isOwnerOrAdmin ? (
          <div className="mt-6">
            <MembersInviteButton />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)]">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Member
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Role
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Joined
            </th>
            {isOwnerOrAdmin ? <th className="w-10 px-2 py-3" /> : null}
          </tr>
        </thead>
        <tbody>
          {sorted.map((m, idx) => (
            <MemberRow
              key={m.id}
              member={m}
              isLast={idx === sorted.length - 1}
              callerRole={
                isOwnerOrAdmin ? (callerRole as "owner" | "admin") : null
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface MemberRowProps {
  member: CompanyMember;
  isLast: boolean;
  callerRole: "owner" | "admin" | null;
}

function MemberRow({ member, isLast, callerRole }: MemberRowProps) {
  const displayName =
    member.user?.fullName?.trim() ||
    (member.status === "invited" ? `Pending: ${member.email}` : member.email);
  const initials = getInitials(displayName);

  return (
    <tr
      className={`border-b border-[var(--color-hairline-soft)] hover:bg-[var(--color-surface-soft)] ${
        isLast ? "border-b-0" : ""
      }`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-strong)] text-xs font-semibold text-[var(--color-ink)]"
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-[var(--color-ink)]">
              {displayName}
            </p>
            {member.user?.email || member.status === "invited" ? (
              <p className="truncate text-xs text-[var(--color-muted)]">
                {member.user?.email ?? member.email}
              </p>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-hairline-soft)] bg-[var(--color-surface-soft)] px-2.5 py-1 text-xs font-medium capitalize text-[var(--color-body)]">
          {member.role}
        </span>
      </td>
      <td className="px-4 py-3">
        <StatusPill status={member.status} />
      </td>
      <td className="px-4 py-3 text-[var(--color-body)]">
        {member.joinedAt
          ? new Date(member.joinedAt).toLocaleDateString()
          : member.status === "invited"
            ? "-"
            : "-"}
      </td>
      {callerRole ? (
        <td className="px-2 py-3 text-right">
          <MembersRowActions member={member} callerRole={callerRole} />
        </td>
      ) : null}
    </tr>
  );
}

function StatusPill({ status }: { status: CompanyMember["status"] }) {
  const map: Record<
    CompanyMember["status"],
    { label: string; dot: string; text: string }
  > = {
    active: {
      label: "Active",
      dot: "bg-[var(--color-status-success)]",
      text: "text-[var(--color-status-success)]",
    },
    invited: {
      label: "Pending invite",
      dot: "bg-[var(--color-status-warning)]",
      text: "text-[var(--color-status-warning)]",
    },
    suspended: {
      label: "Suspended",
      dot: "bg-[var(--color-status-danger)]",
      text: "text-[var(--color-status-danger)]",
    },
    left: {
      label: "Left",
      dot: "bg-[var(--color-muted)]",
      text: "text-[var(--color-muted)]",
    },
  };
  const v = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-hairline-soft)] bg-[var(--color-surface-soft)] px-2.5 py-1 text-xs font-medium ${v.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${v.dot}`} />
      {v.label}
    </span>
  );
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
