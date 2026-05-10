import { JobForm } from "@/components/jobs/job-form";

export const metadata = { title: "New Job" };

export default function NewJobPage() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <header>
        <h1 className="text-2xl font-normal tracking-tight text-[var(--color-ink)]">
          Post a new job
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          Fill in the details. You can publish it after saving.
        </p>
      </header>
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-8">
        <JobForm />
      </div>
    </div>
  );
}
