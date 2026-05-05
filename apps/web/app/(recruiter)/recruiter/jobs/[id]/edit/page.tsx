import { notFound, redirect } from "next/navigation";
import type { CreateJobInput } from "@aurahire/shared";
import { JobForm } from "@/components/jobs/job-form";
import { getCurrentSession } from "@/lib/auth/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Edit Job" };

interface EditableJob {
  title: string;
  department: string | null;
  employmentType: CreateJobInput["employmentType"];
  workMode: CreateJobInput["workMode"];
  locationCity: string | null;
  locationRegion: string | null;
  locationCountry: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  description: string;
  descriptionPlain: string;
  requiredSkills: string[];
  experienceLevel: CreateJobInput["experienceLevel"];
  educationRequirement: CreateJobInput["educationRequirement"];
  applicationDeadline: string | null;
}

export default async function EditJobPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/jobs/${id}/for-recruiter`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (res.status === 404) notFound();
  if (!res.ok) return <div>Failed to load job.</div>;

  const body = (await res.json()) as { data: EditableJob };
  const job = body.data;

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="max-w-[840px]">
        <h1 className="text-3xl font-normal tracking-tight text-[var(--color-ink)]">
          Edit job
        </h1>
        <div className="mt-8 rounded-[var(--radius-xl)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-8">
          <JobForm
            jobId={id}
            defaults={{
              title: job.title,
              department: job.department,
              employmentType: job.employmentType,
              workMode: job.workMode,
              locationCity: job.locationCity,
              locationRegion: job.locationRegion,
              locationCountry: job.locationCountry,
              salaryMin: job.salaryMin,
              salaryMax: job.salaryMax,
              salaryCurrency: job.salaryCurrency,
              description: job.description,
              descriptionPlain: job.descriptionPlain,
              requiredSkills: job.requiredSkills,
              experienceLevel: job.experienceLevel,
              educationRequirement: job.educationRequirement,
              applicationDeadline: job.applicationDeadline,
            }}
          />
        </div>
      </div>
    </div>
  );
}
