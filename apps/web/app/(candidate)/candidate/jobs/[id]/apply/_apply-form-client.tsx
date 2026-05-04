"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess, toastApiError } from "@/lib/toast";

import { AiShimmer } from "@/components/ai/ai-shimmer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

interface ResumeOption {
  id: string;
  filename: string;
  isDefault: boolean;
}

interface Props {
  jobId: string;
  resumes: ResumeOption[];
}

export function ApplyFormClient({ jobId, resumes }: Props) {
  const router = useRouter();
  const defaultResumeId =
    resumes.find((r) => r.isDefault)?.id ?? resumes[0]?.id ?? "";
  const [resumeId, setResumeId] = useState<string>(defaultResumeId);
  const [coverLetter, setCoverLetter] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!resumeId) {
      toastApiError(null, "Check your input", "Please pick a resume to apply with.");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toastApiError(null, "Couldn't apply", "Please sign in again.");
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const res = await fetch(`${apiUrl}/api/v1/applications`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId,
          resumeId,
          coverLetter: coverLetter || null,
        }),
      });

      if (res.status === 409) {
        toastApiError(null, "Couldn't apply", "You've already applied to this job.");
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        toastApiError(null, "Couldn't apply", body.message ?? "Please try again.");
        return;
      }

      const body = (await res.json()) as { data: { id: string } };
      toastSuccess("Application sent", "We'll notify you when there's an update.");
      router.push(`/candidate/applications/${body.data.id}`);
    } catch (err) {
      toastApiError(err, "Couldn't apply");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitting) {
    return (
      <AiShimmer
        caption="Computing your match against this job — analyzing skills, experience, education, and cultural fit..."
        height={240}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-ink)]">
          Resume
        </label>
        <Select value={resumeId} onValueChange={(v) => setResumeId(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="Select resume" />
          </SelectTrigger>
          <SelectContent>
            {resumes.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.filename}
                {r.isDefault ? " (default)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-ink)]">
          Cover Letter (optional)
        </label>
        <Textarea
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          placeholder="Why are you a great fit for this role?"
          rows={6}
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="rounded-[var(--radius-pill)]"
        >
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={!resumeId}
          className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          Submit application
        </Button>
      </div>
    </div>
  );
}
