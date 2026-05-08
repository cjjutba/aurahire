"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { getActiveCompanyId } from "@/lib/active-company";
import { toastSuccess, toastApiError } from "@/lib/toast";

interface Props {
  applicationId: string;
  initialNotes: string;
}

export function NotesSectionClient({ applicationId, initialNotes }: Props) {
  const [notes, setNotes] = useState(initialNotes);
  const [working, setWorking] = useState(false);

  async function saveNotes() {
    setWorking(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const activeCompanyId = getActiveCompanyId();

      const res = await fetch(
        `${apiUrl}/api/v1/applications/${applicationId}/notes`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            ...(activeCompanyId
              ? { "X-Active-Company-Id": activeCompanyId }
              : {}),
          },
          body: JSON.stringify({ notes: notes || null }),
        },
      );
      if (!res.ok) {
        toastApiError(null, "Couldn't save notes", "Please try again.");
        return;
      }
      toastSuccess("Notes saved");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
      <header>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Recruiter Notes
        </h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Notes for your team — visible only to recruiters at your company.
        </p>
      </header>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="Notes for your team — visible only to recruiters"
      />
      <div className="flex justify-end">
        <Button
          onClick={saveNotes}
          disabled={working}
          className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          {working && <ButtonSpinner />}
          {working ? "Saving..." : "Save notes"}
        </Button>
      </div>
    </section>
  );
}
