import { Star } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Shortlist" };

export default function RecruiterShortlistPage() {
  return (
    <div className="mx-auto max-w-[1024px] space-y-6">
      <header>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Shortlist
        </h1>
        <p className="mt-1 text-sm text-[var(--color-body)]">
          Candidates you've shortlisted across jobs.
        </p>
      </header>
      <EmptyState
        icon={<Star className="h-6 w-6" />}
        headline="No candidates shortlisted yet"
        description="Open a job's applications list and shortlist your top matches — they'll show up here for fast comparison."
        cta={{ href: "/recruiter/jobs", label: "View jobs" }}
      />
    </div>
  );
}
