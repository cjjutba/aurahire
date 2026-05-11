"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { RawOutputJsonViewer } from "@/components/admin/raw-output-json-viewer";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { humanizeAuditAction } from "@/lib/audit/humanize-action";

interface Detail {
  id: string;
  action: string;
  actorType: string;
  actor: {
    id: string;
    fullName: string;
    email: string;
    role: string | null;
  } | null;
  company: { id: string; name: string; logoUrl: string | null } | null;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface Props {
  entryId: string;
  open: boolean;
  onClose: () => void;
}

export function AuditDetailSheetClient({ entryId, open, onClose }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setDetail(null);
      setError(null);
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Not signed in");
        return;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const res = await fetch(`${apiUrl}/api/v1/admin/audit/${entryId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      if (cancelled) return;
      if (!res.ok) {
        setError(`Failed (${res.status})`);
        return;
      }
      const body = (await res.json()) as { data: Detail };
      if (cancelled) return;
      setDetail(body.data);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [entryId]);

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full overflow-y-auto bg-[var(--color-canvas)] sm:max-w-2xl"
      >
        <SheetHeader>
          <SheetTitle>
            {detail ? humanizeAuditAction(detail.action) : "Loading…"}
          </SheetTitle>
          {detail && (
            <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">
              {detail.action}
            </p>
          )}
        </SheetHeader>
        {error && (
          <p className="mt-6 text-sm text-[var(--color-status-danger)]">
            {error}
          </p>
        )}
        {!detail && !error && (
          <Skeleton className="mt-6 h-32 rounded-[var(--radius-lg)]" />
        )}
        {detail && (
          <div className="mt-6 space-y-6 px-4 pb-8">
            <section className="space-y-1 text-xs">
              <p className="text-[var(--color-muted)]">
                {new Date(detail.createdAt).toLocaleString()}
              </p>
              <p className="text-[var(--color-body)]">
                Actor:{" "}
                <strong className="text-[var(--color-ink)]">
                  {detail.actor?.fullName ?? "(system)"}
                </strong>{" "}
                <span className="text-[var(--color-muted)]">
                  ({detail.actorType})
                </span>
              </p>
              {detail.actor && (
                <p className="text-[var(--color-muted)]">
                  {detail.actor.email} · role: {detail.actor.role ?? "-"}
                </p>
              )}
              <p className="text-[var(--color-body)]">
                Entity: <span className="font-mono">{detail.entityType}</span> /{" "}
                <span className="font-mono text-[var(--color-muted)]">
                  {detail.entityId}
                </span>
              </p>
              {detail.company && (
                <p className="text-[var(--color-body)]">
                  Company:{" "}
                  <strong className="text-[var(--color-ink)]">
                    {detail.company.name}
                  </strong>
                </p>
              )}
              {detail.ipAddress && (
                <p className="text-[var(--color-muted)]">
                  IP: {detail.ipAddress}
                </p>
              )}
              {detail.userAgent && (
                <p className="break-all text-[var(--color-muted)]">
                  UA: {detail.userAgent}
                </p>
              )}
            </section>
            <RawOutputJsonViewer
              value={detail.details}
              title="Audit Details"
              defaultOpen
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
