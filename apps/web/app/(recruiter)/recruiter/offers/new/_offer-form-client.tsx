"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

interface Props {
  applicationId: string;
  defaultTitle: string;
}

const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "PHP"] as const;

function isoDatePlusDays(days: number): string {
  return new Date(Date.now() + days * 86400 * 1000).toISOString().slice(0, 10);
}

export function OfferFormClient({ applicationId, defaultTitle }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(defaultTitle);
  const [salary, setSalary] = useState<string>("");
  const [salaryCurrency, setSalaryCurrency] = useState<(typeof CURRENCY_OPTIONS)[number]>("USD");
  const [startDate, setStartDate] = useState(isoDatePlusDays(30));
  const [managerName, setManagerName] = useState("");
  const [benefitsSummary, setBenefitsSummary] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [expiresAtDate, setExpiresAtDate] = useState(isoDatePlusDays(14));
  const [working, setWorking] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const salaryNum = Number(salary);
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!Number.isFinite(salaryNum) || salaryNum <= 0) {
      toast.error("Salary must be a positive number");
      return;
    }
    if (!startDate) {
      toast.error("Start date is required");
      return;
    }

    setWorking(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not signed in");
        return;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
      const expiresAt = expiresAtDate
        ? new Date(`${expiresAtDate}T23:59:59`).toISOString()
        : null;
      const res = await fetch(
        `${apiUrl}/api/v1/applications/${applicationId}/offers`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: title.trim(),
            salary: salaryNum,
            salaryCurrency,
            startDate,
            managerName: managerName.trim() || null,
            benefitsSummary: benefitsSummary.trim() || null,
            customMessage: customMessage.trim() || null,
            expiresAt,
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
          code?: string;
        };
        if (body.code === "OFFER_ALREADY_PENDING") {
          toast.error("There's already a pending offer", {
            description: "Withdraw the existing offer before sending another.",
          });
        } else {
          toast.error("Send offer failed", { description: body.message });
        }
        return;
      }
      toast.success("Offer sent — candidate notified");
      router.push(`/recruiter/applications/${applicationId}`);
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-6 rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6"
    >
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Job title
        </label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Salary
          </label>
          <Input
            type="number"
            min={1}
            step="any"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            placeholder="95000"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Currency
          </label>
          <Select
            value={salaryCurrency}
            onValueChange={(v) => setSalaryCurrency(v as (typeof CURRENCY_OPTIONS)[number])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Start date
          </label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Offer expires
          </label>
          <Input
            type="date"
            value={expiresAtDate}
            onChange={(e) => setExpiresAtDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Hiring manager
        </label>
        <Input
          value={managerName}
          onChange={(e) => setManagerName(e.target.value)}
          placeholder="Jane Doe"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Benefits summary
        </label>
        <Textarea
          value={benefitsSummary}
          onChange={(e) => setBenefitsSummary(e.target.value)}
          rows={3}
          placeholder="Health, dental, 401k matching, 20 PTO days..."
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Personal note (optional)
        </label>
        <Textarea
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          rows={4}
          placeholder="We're excited to have you join the team!"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={working}
          className="rounded-[var(--radius-pill)]"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={working}
          className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          {working ? "Sending..." : "Send offer"}
        </Button>
      </div>
    </form>
  );
}
