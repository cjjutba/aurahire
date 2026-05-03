import { DashboardClient } from "./_dashboard-client";

export const metadata = { title: "Command Center" };

export default function AdminDashboard() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <header>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Command Center
        </h1>
        <p className="mt-2 text-sm text-[var(--color-body)]">
          System health at a glance.
        </p>
      </header>
      <DashboardClient />
    </div>
  );
}
