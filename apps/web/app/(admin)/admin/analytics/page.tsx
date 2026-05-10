import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { DateRangeClient } from "./_date-range-client";
import { KpiTiles } from "./_kpi-tiles";
import { ChartsClient } from "./_charts-client";

export const metadata = { title: "Analytics" };

interface PageProps {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
}

interface BundleBody {
  data: {
    range: { from: string; to: string };
    kpis: {
      totalUsers: number;
      newUsersThisPeriod: number;
      growthPct: number;
      activeJobs: number;
      avgApplicationsPerDay: number;
      avgTimeToHireDays: number | null;
    };
    charts: {
      userGrowth: Array<{
        date: string;
        candidate: number;
        recruiter: number;
        admin: number;
      }>;
      jobsOverTime: Array<{
        date: string;
        draft: number;
        published: number;
        archived: number;
      }>;
      applicationsByStatus: Array<{
        date: string;
        applied: number;
        screening: number;
        interview: number;
        offer: number;
        hired: number;
        rejected: number;
        withdrawn: number;
      }>;
      scoreDistribution: Array<{ bucket: string; count: number }>;
      aiProcessingTime: Array<{
        date: string;
        avgParseMs: number;
        avgScoreMs: number;
      }>;
      topRecruiters: Array<{
        recruiterId: string;
        fullName: string;
        jobCount: number;
        applicationCount: number;
      }>;
    };
  };
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const params = new URLSearchParams();
  if (sp.dateFrom) params.set("dateFrom", sp.dateFrom);
  if (sp.dateTo) params.set("dateTo", sp.dateTo);

  const res = await fetch(
    `${apiUrl}/api/v1/admin/analytics?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <p className="text-sm text-[var(--color-status-danger)]">
          Failed to load analytics.
        </p>
      </div>
    );
  }
  const body = (await res.json()) as BundleBody;

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
            Analytics
          </h1>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Period: {new Date(body.data.range.from).toLocaleDateString()} →{" "}
            {new Date(body.data.range.to).toLocaleDateString()}
          </p>
        </div>
        <DateRangeClient initialFrom={sp.dateFrom} initialTo={sp.dateTo} />
      </header>

      <KpiTiles kpis={body.data.kpis} />

      <ChartsClient charts={body.data.charts} />
    </div>
  );
}
