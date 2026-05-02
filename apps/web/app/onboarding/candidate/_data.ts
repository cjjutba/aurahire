import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";

export const ONBOARDING_STEPS = [
  { label: "Resume" },
  { label: "Personal" },
  { label: "Education" },
  { label: "Experience" },
  { label: "Skills" },
  { label: "Preferences" },
] as const;

export interface CandidateProfileMe {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  headline: string | null;
  summary: string | null;
  locationCity: string | null;
  locationRegion: string | null;
  locationCountry: string | null;
  desiredRoles: string[];
  desiredSeniority: string | null;
  openTo: string[];
  desiredSalaryMin: number | null;
  desiredSalaryMax: number | null;
  desiredCurrency: string;
  availableStartDate: string | null;
  profileCompleted: boolean;
}

export async function fetchCandidateProfileMe(): Promise<CandidateProfileMe> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/candidate-profiles/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (res.status === 403) redirect("/login");
  if (!res.ok) throw new Error(`Failed to load candidate profile: ${res.status}`);

  const body = (await res.json()) as { data: CandidateProfileMe };
  return body.data;
}

export interface LatestParsedResume {
  id: string;
  parseStatus: string;
  parsed: {
    contact?: {
      full_name?: string | null;
      phone?: string | null;
      location_city?: string | null;
      location_country?: string | null;
    } | null;
    summary?: string | null;
  } | null;
}

export async function fetchLatestParsedResume(): Promise<LatestParsedResume | null> {
  const session = await getCurrentSession();
  if (!session) return null;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/api/v1/resumes/mine`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) return null;

  const body = (await res.json()) as {
    data: Array<{
      id: string;
      parseStatus: string;
      parsedData: unknown;
      isDefault: boolean;
      createdAt: string;
    }>;
  };

  if (body.data.length === 0) return null;

  const sorted = [...body.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const defaultR = sorted.find((r) => r.isDefault);
  const candidate = defaultR ?? sorted[0]!;

  return {
    id: candidate.id,
    parseStatus: candidate.parseStatus,
    parsed: candidate.parsedData as LatestParsedResume["parsed"],
  };
}
