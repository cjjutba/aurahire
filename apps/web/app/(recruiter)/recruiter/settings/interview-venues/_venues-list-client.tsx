"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { getActiveCompanyId } from "@/lib/active-company";
import { toastSuccess, toastApiError } from "@/lib/toast";
import { queryKeys } from "@/lib/query/keys";
import {
  VenueFormModalClient,
  type VenueFormValues,
} from "./_venue-form-modal-client";

export interface VenueRow {
  id: string;
  companyId: string;
  label: string;
  venueName: string;
  addressLine: string;
  roomOrFloor: string | null;
  mapUrl: string | null;
  reportingInstructions: string | null;
  whatToBring: string | null;
  interviewerName: string | null;
  interviewerTitle: string | null;
  isDefault: boolean;
}

async function authedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const activeCompanyId = getActiveCompanyId();
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${session.access_token}`,
      ...(activeCompanyId ? { "X-Active-Company-Id": activeCompanyId } : {}),
    },
  });
}

export function VenuesListClient() {
  const qc = useQueryClient();
  const companyId = getActiveCompanyId();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VenueRow | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: venues = [], isLoading } = useQuery({
    queryKey: queryKeys.interviewVenues.byCompany(companyId ?? ""),
    queryFn: async () => {
      if (!companyId) return [];
      const res = await authedFetch(
        `/api/v1/companies/${companyId}/interview-venues`,
      );
      if (!res.ok) throw new Error("Failed to load venues");
      const body = (await res.json()) as { data: VenueRow[] };
      return body.data;
    },
    enabled: Boolean(companyId),
  });

  async function handleSave(values: VenueFormValues) {
    if (!companyId) return;
    const res = editing
      ? await authedFetch(`/api/v1/interview-venues/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        })
      : await authedFetch(`/api/v1/companies/${companyId}/interview-venues`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      toastApiError(null, "Couldn't save venue", body.message);
      return;
    }
    toastSuccess(editing ? "Venue updated" : "Venue created");
    setFormOpen(false);
    setEditing(null);
    qc.invalidateQueries({
      queryKey: queryKeys.interviewVenues.byCompany(companyId),
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this venue template?")) return;
    setPendingId(id);
    try {
      const res = await authedFetch(`/api/v1/interview-venues/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toastApiError(null, "Couldn't delete");
        return;
      }
      toastSuccess("Venue deleted");
      qc.invalidateQueries({
        queryKey: queryKeys.interviewVenues.byCompany(companyId ?? ""),
      });
    } finally {
      setPendingId(null);
    }
  }

  async function handleSetDefault(id: string) {
    setPendingId(id);
    try {
      const res = await authedFetch(
        `/api/v1/interview-venues/${id}/set-default`,
        { method: "POST" },
      );
      if (!res.ok) {
        toastApiError(null, "Couldn't set default");
        return;
      }
      toastSuccess("Default venue updated");
      qc.invalidateQueries({
        queryKey: queryKeys.interviewVenues.byCompany(companyId ?? ""),
      });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-ink)]">
            Interview Venues
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Reusable templates for in-person interview venues. Selecting a
            default auto-fills the schedule modal.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add venue
        </Button>
      </header>

      {isLoading ? (
        <p className="text-sm text-[var(--color-muted)]">Loading...</p>
      ) : venues.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-12 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            No venue templates yet. Create your first one.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {venues.map((v) => (
            <li
              key={v.id}
              className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-[var(--color-ink)]">
                      {v.label}
                    </strong>
                    {v.isDefault && (
                      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                        <Star className="h-3 w-3" aria-hidden /> Default
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-body)]">
                    {v.venueName}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {v.addressLine}
                    {v.roomOrFloor ? ` · ${v.roomOrFloor}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!v.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(v.id)}
                      disabled={pendingId === v.id}
                      className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-xs font-medium text-[var(--color-body)] transition hover:bg-[var(--color-surface-strong)] disabled:opacity-60"
                    >
                      {pendingId === v.id ? (
                        <ButtonSpinner />
                      ) : (
                        <Star className="h-3.5 w-3.5" aria-hidden />
                      )}
                      Set default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(v);
                      setFormOpen(true);
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-xs font-medium text-[var(--color-body)] transition hover:bg-[var(--color-surface-strong)]"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(v.id)}
                    disabled={pendingId === v.id}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-status-danger)] bg-[var(--color-canvas)] px-3 text-xs font-medium text-[var(--color-status-danger)] transition hover:bg-[var(--color-status-danger)] hover:text-[var(--color-on-primary)] disabled:opacity-60"
                  >
                    {pendingId === v.id ? (
                      <ButtonSpinner />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    )}
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <VenueFormModalClient
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSave={handleSave}
      />
    </div>
  );
}
