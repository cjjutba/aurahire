"use client";

import { CompanyCreateForm } from "@/components/onboarding/recruiter/company-create-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CompanyCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * In-portal dialog for creating an additional company from the sidebar
 * switcher. Keeps the user anchored on /recruiter instead of bouncing them
 * to an /onboarding/* URL, see the discussion that replaced the old
 * `?from=switcher` redirect with this modal.
 */
export function CompanyCreateDialog({
  open,
  onOpenChange,
}: CompanyCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[560px] overflow-y-auto p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl font-normal tracking-tight">
            Create a new company
          </DialogTitle>
          <DialogDescription className="mt-1">
            You'll be the owner. You can switch between companies from the
            sidebar at any time.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-6">
          <CompanyCreateForm
            mode="dialog"
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
