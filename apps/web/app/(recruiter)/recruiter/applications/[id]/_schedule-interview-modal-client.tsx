"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

type InterviewFormat = "phone" | "video" | "in-person";

interface Props {
  applicationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleInterviewModalClient({ applicationId, open, onOpenChange }: Props) {
  const router = useRouter();
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [format, setFormat] = useState<InterviewFormat>("video");
  const [locationOrLink, setLocationOrLink] = useState("");
  const [working, setWorking] = useState(false);

  function reset() {
    setScheduledAt("");
    setDurationMinutes(60);
    setFormat("video");
    setLocationOrLink("");
  }

  async function submit() {
    if (!scheduledAt) {
      toast.error("Pick a date and time");
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
      const res = await fetch(
        `${apiUrl}/api/v1/applications/${applicationId}/interviews`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            scheduledAt: new Date(scheduledAt).toISOString(),
            durationMinutes,
            format,
            locationOrLink: locationOrLink.trim() || null,
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error("Schedule failed", { description: body.message });
        return;
      }
      toast.success("Interview scheduled — candidate notified");
      reset();
      onOpenChange(false);
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Interview</DialogTitle>
          <DialogDescription>
            Candidate will receive an email with the details.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Date &amp; Time
            </label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Duration (minutes)
            </label>
            <Input
              type="number"
              min={15}
              max={240}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value) || 60)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Format
            </label>
            <Select value={format} onValueChange={(v) => setFormat(v as InterviewFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="in-person">In Person</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Location / Link
            </label>
            <Input
              value={locationOrLink}
              onChange={(e) => setLocationOrLink(e.target.value)}
              placeholder="https://meet.example.com/abc OR address"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-[var(--radius-pill)]"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={working || !scheduledAt}
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
          >
            {working ? "Scheduling..." : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
