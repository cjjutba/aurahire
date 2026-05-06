"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { clientApiFetch } from "@/hooks/_client-fetch";
import { setActiveCompanyId } from "@/lib/active-company";
import { toastApiError, toastSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";

interface AcceptResponse {
  data: {
    companyId: string;
    companyName: string;
    role: "owner" | "admin" | "recruiter";
  };
}

const ROLE_LABEL: Record<AcceptResponse["data"]["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  recruiter: "Recruiter",
};

/**
 * Accept / Decline handlers for the signed-in path of /invite/[token].
 * On Accept:
 *   1. POST /invitations/accept (auth required; backend sets the accepted
 *      company as last_active_company_id)
 *   2. Mirror the choice into the client singleton so subsequent fetches
 *      carry X-Active-Company-Id immediately
 *   3. Clear TanStack Query — previous-tenant data is now stale
 *   4. Toast confirmation
 *   5. Navigate to /recruiter (the new active tenant)
 *
 * On Decline:
 *   - POST /invitations/decline (hard-deletes the row)
 *   - Navigate home (no further action required)
 */
export function PublicInviteActions({ token }: { token: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);

  async function handleAccept() {
    if (pending) return;
    setPending("accept");
    try {
      const res = await clientApiFetch<AcceptResponse>(
        "/api/v1/invitations/accept",
        { method: "POST", body: { token } },
      );
      setActiveCompanyId(res.data.companyId);
      queryClient.clear();
      toastSuccess(
        `You joined ${res.data.companyName}`,
        `Role: ${ROLE_LABEL[res.data.role]}`,
      );
      router.push("/recruiter");
      router.refresh();
    } catch (err) {
      toastApiError(err, "Couldn't accept invitation");
      setPending(null);
    }
  }

  async function handleDecline() {
    if (pending) return;
    setPending("decline");
    try {
      await clientApiFetch("/api/v1/invitations/decline", {
        method: "POST",
        body: { token },
      });
      router.push("/");
    } catch (err) {
      toastApiError(err, "Couldn't decline invitation");
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        onClick={handleAccept}
        disabled={pending !== null}
        className="h-12 w-full rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-base font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
      >
        {pending === "accept" && <ButtonSpinner />}
        {pending === "accept" ? "Accepting..." : "Accept invitation"}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={handleDecline}
        disabled={pending !== null}
        className="h-12 w-full rounded-[var(--radius-pill)] border-[var(--color-hairline)] bg-[var(--color-canvas)] text-sm font-medium text-[var(--color-body)] hover:bg-[var(--color-surface-strong)]"
      >
        {pending === "decline" ? "Declining..." : "Decline"}
      </Button>
    </div>
  );
}
