"use client";

import type { ReactNode } from "react";
import { Paperclip } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

interface Props {
  triggerLabel: string;
  children: ReactNode;
}

export function ResumeSheet({ triggerLabel, children }: Props) {
  return (
    <Sheet>
      <SheetTrigger className="flex items-center gap-1 rounded-full border border-[var(--color-hairline)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]">
        <Paperclip className="h-3.5 w-3.5" />
        {triggerLabel}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[85vw] max-w-[480px] overflow-auto p-4"
      >
        <SheetTitle className="mb-3 text-sm font-semibold">
          {triggerLabel.replace(/^View /, "")}
        </SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}
