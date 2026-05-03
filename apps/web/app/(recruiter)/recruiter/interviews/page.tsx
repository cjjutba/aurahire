import { CalendarClock } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Interviews" };

export default function RecruiterInterviewsPage() {
  return (
    <div className="mx-auto max-w-[1024px] space-y-6">
      <header>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Interviews
        </h1>
        <p className="mt-1 text-sm text-[var(--color-body)]">
          Schedule and track interviews with shortlisted candidates.
        </p>
      </header>
      <EmptyState
        icon={<CalendarClock className="h-6 w-6" />}
        headline="No interviews scheduled"
        description="Move applications to the Interview stage from your job's applications list to schedule them here."
        cta={{ href: "/recruiter/jobs", label: "View jobs" }}
      />
    </div>
  );
}
