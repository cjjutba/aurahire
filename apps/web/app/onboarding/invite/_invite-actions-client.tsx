"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { clientApiFetch } from "@/hooks/_client-fetch";
import { setActiveCompanyId } from "@/lib/active-company";
import { toastApiError, toastSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";

import { clearPendingInviteCookie } from "./_actions";

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

interface InviteActionsClientProps {
  token: string;
}

/**
 * Onboarding-flow accept/decline buttons. Differs from the public
 * /invite/[token] flow only in destination:
 *
 *   - Accept → /onboarding/recruiter (continue with About + Focus steps)
 *   - Decline → /onboarding/start (let user re-fork)
 *
 * Both paths clear the pendingInviteToken cookie so it doesn't survive into
 * future sessions.
 */
export function InviteActionsClient({ token }: InviteActionsClientProps) {
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
      await clearPendingInviteCookie();
      queryClient.clear();
      toastSuccess(
        `Joined ${res.data.companyName}`,
        `Role: ${ROLE_LABEL[res.data.role]}`,
      );
      router.push("/onboarding/recruiter");
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
      await clearPendingInviteCookie();
      router.push("/onboarding/start");
      router.refresh();
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
        {pending === "decline" && <ButtonSpinner />}
        {pending === "decline" ? "Declining..." : "Decline"}
      </Button>
      <Link
        href="/onboarding/recruiter/company-create"
        className="mt-1 text-center text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:underline"
      >
        I changed my mind, create a company instead
      </Link>
    </div>
  );
}
