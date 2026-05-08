"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal, Eye, Briefcase } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RecruiterInterviewRowActionsProps {
  applicationId: string;
  jobId: string | null;
}

export function RecruiterInterviewRowActionsClient({
  applicationId,
  jobId,
}: RecruiterInterviewRowActionsProps) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Interview actions"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-muted)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        }
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom">
        <DropdownMenuItem
          onClick={() => router.push(`/recruiter/applications/${applicationId}`)}
          className="flex cursor-pointer items-center gap-2"
        >
          <Eye className="h-4 w-4" />
          View Application
        </DropdownMenuItem>
        {jobId && (
          <DropdownMenuItem
            onClick={() => router.push(`/recruiter/jobs/${jobId}`)}
            className="flex cursor-pointer items-center gap-2"
          >
            <Briefcase className="h-4 w-4" />
            View Job
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
