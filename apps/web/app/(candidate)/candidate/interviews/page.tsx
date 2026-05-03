import { CalendarClock } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Interviews" };

export default function CandidateInterviewsPage() {
  return (
    <div className="mx-auto max-w-[1024px] space-y-6">
      <header>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Interviews
        </h1>
        <p className="mt-1 text-sm text-[var(--color-body)]">
          Your scheduled interviews will appear here.
        </p>
      </header>
      <EmptyState
        icon={<CalendarClock className="h-6 w-6" />}
        headline="No interviews scheduled"
        description="When a recruiter schedules an interview, it'll show up here. In the meantime, check your applications or browse new jobs."
        cta={{ href: "/candidate/applications", label: "View applications" }}
        secondaryCta={{ href: "/candidate/jobs", label: "Browse jobs" }}
      />
    </div>
  );
}
