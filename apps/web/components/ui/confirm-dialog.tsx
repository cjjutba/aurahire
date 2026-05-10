"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";

export type ConfirmVariant = "destructive" | "warning" | "info";

const variantConfirmClass: Record<ConfirmVariant, string> = {
  destructive:
    "bg-[var(--color-status-danger)] text-[var(--color-on-primary)] hover:opacity-90 active:opacity-95",
  warning:
    "bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]",
  info: "bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]",
};

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "info",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      disablePointerDismissal={loading}
      onOpenChange={(next) => {
        if (loading && !next) return;
        if (!next) onCancel?.();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md gap-0 p-6">
        <DialogHeader className="gap-2">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-sm leading-relaxed">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogFooter className="mt-6 pt-0">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => {
              onCancel?.();
              onOpenChange(false);
            }}
            className="rounded-[var(--radius-pill)] px-5"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={cn(
              "rounded-[var(--radius-pill)] px-5",
              variantConfirmClass[variant],
            )}
          >
            {loading && <ButtonSpinner />}
            {loading ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
