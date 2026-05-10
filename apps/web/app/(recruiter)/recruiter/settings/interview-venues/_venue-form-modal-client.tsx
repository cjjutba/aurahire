"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface VenueFormValues {
  label: string;
  venueName: string;
  addressLine: string;
  roomOrFloor: string | null;
  mapUrl: string | null;
  reportingInstructions: string | null;
  whatToBring: string | null;
  interviewerName: string | null;
  interviewerTitle: string | null;
  isDefault: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Partial<VenueFormValues> | null;
  onSave: (values: VenueFormValues) => Promise<void>;
}

export function VenueFormModalClient({
  open,
  onOpenChange,
  initial,
  onSave,
}: Props) {
  const [label, setLabel] = useState("");
  const [venueName, setVenueName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [roomOrFloor, setRoomOrFloor] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [reportingInstructions, setReportingInstructions] = useState("");
  const [whatToBring, setWhatToBring] = useState("");
  const [interviewerName, setInterviewerName] = useState("");
  const [interviewerTitle, setInterviewerTitle] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mapUrlError, setMapUrlError] = useState<string | null>(null);

  // Reset form fields whenever the dialog opens or the initial data changes
  useEffect(() => {
    if (!open) return;
    setLabel(initial?.label ?? "");
    setVenueName(initial?.venueName ?? "");
    setAddressLine(initial?.addressLine ?? "");
    setRoomOrFloor(initial?.roomOrFloor ?? "");
    setMapUrl(initial?.mapUrl ?? "");
    setReportingInstructions(initial?.reportingInstructions ?? "");
    setWhatToBring(initial?.whatToBring ?? "");
    setInterviewerName(initial?.interviewerName ?? "");
    setInterviewerTitle(initial?.interviewerTitle ?? "");
    setIsDefault(initial?.isDefault ?? false);
    setMapUrlError(null);
  }, [open, initial]);

  function validateMapUrl(value: string): boolean {
    if (!value.trim()) {
      setMapUrlError(null);
      return true;
    }
    if (!/^https?:\/\//i.test(value.trim())) {
      setMapUrlError("Must start with http:// or https://");
      return false;
    }
    setMapUrlError(null);
    return true;
  }

  async function submit() {
    if (!validateMapUrl(mapUrl)) return;
    setSubmitting(true);
    try {
      await onSave({
        label: label.trim(),
        venueName: venueName.trim(),
        addressLine: addressLine.trim(),
        roomOrFloor: roomOrFloor.trim() || null,
        mapUrl: mapUrl.trim() || null,
        reportingInstructions: reportingInstructions.trim() || null,
        whatToBring: whatToBring.trim() || null,
        interviewerName: interviewerName.trim() || null,
        interviewerTitle: interviewerTitle.trim() || null,
        isDefault,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    label.trim() && venueName.trim() && addressLine.trim() && !mapUrlError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {initial?.label ? "Edit venue" : "Add venue"}
          </DialogTitle>
          <DialogDescription>
            Fields you save here can be auto-filled when scheduling an
            interview.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Label *">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. HQ Floor 3"
            />
          </Field>

          <Field label="Venue name *">
            <Input
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="e.g. AuraHire Head Office"
            />
          </Field>

          <Field label="Address *" className="sm:col-span-2">
            <Input
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              placeholder="123 Main St, City, Country"
            />
          </Field>

          <Field label="Room / floor">
            <Input
              value={roomOrFloor}
              onChange={(e) => setRoomOrFloor(e.target.value)}
              placeholder="e.g. Room 301"
            />
          </Field>

          <Field label="Map URL">
            <Input
              value={mapUrl}
              onChange={(e) => {
                setMapUrl(e.target.value);
                validateMapUrl(e.target.value);
              }}
              placeholder="https://maps.google.com/..."
            />
            {mapUrlError && (
              <span className="text-xs text-[var(--color-status-danger)]">
                {mapUrlError}
              </span>
            )}
          </Field>

          <Field label="Interviewer name">
            <Input
              value={interviewerName}
              onChange={(e) => setInterviewerName(e.target.value)}
              placeholder="e.g. Jane Smith"
            />
          </Field>

          <Field label="Interviewer title">
            <Input
              value={interviewerTitle}
              onChange={(e) => setInterviewerTitle(e.target.value)}
              placeholder="e.g. Engineering Manager"
            />
          </Field>

          <Field label="Reporting instructions" className="sm:col-span-2">
            <textarea
              rows={3}
              value={reportingInstructions}
              onChange={(e) => setReportingInstructions(e.target.value)}
              placeholder="e.g. Ask for the receptionist at the front desk"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-2 text-sm placeholder:text-[var(--color-muted-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </Field>

          <Field label="What to bring" className="sm:col-span-2">
            <textarea
              rows={3}
              value={whatToBring}
              onChange={(e) => setWhatToBring(e.target.value)}
              placeholder="e.g. Government-issued ID, printed portfolio"
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-2 text-sm placeholder:text-[var(--color-muted-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-[var(--color-body)] sm:col-span-2">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            Set as default venue for this company
          </label>
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
            disabled={submitting || !canSubmit}
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
          >
            {submitting ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </label>
      {children}
    </div>
  );
}
