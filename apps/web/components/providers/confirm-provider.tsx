"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  ConfirmDialog,
  type ConfirmVariant,
} from "@/components/ui/confirm-dialog";

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  /**
   * Optional async work to run while the dialog stays open with a loading
   * state. If it throws, the returned promise rejects with the same error
   * after the dialog closes; callers can wrap their own try/catch + toasts
   * inside this handler if they prefer.
   */
  onConfirm?: () => void | Promise<void>;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

const EXIT_ANIMATION_MS = 200;

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<{
    resolve: (value: boolean) => void;
    reject: (reason: unknown) => void;
  } | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback(
    (resolveValue: boolean | { reject: unknown }) => {
      const resolver = resolverRef.current;
      resolverRef.current = null;
      setOpen(false);
      setLoading(false);
      // Defer clearing options so the exit animation has content to render.
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => {
        setOptions(null);
        clearTimerRef.current = null;
      }, EXIT_ANIMATION_MS);
      if (!resolver) return;
      if (typeof resolveValue === "boolean") resolver.resolve(resolveValue);
      else resolver.reject(resolveValue.reject);
    },
    [],
  );

  const confirm = useCallback<ConfirmFn>(
    (nextOptions) =>
      new Promise<boolean>((resolve, reject) => {
        // If a previous confirm is still pending, treat it as cancelled.
        if (resolverRef.current) resolverRef.current.resolve(false);
        if (clearTimerRef.current) {
          clearTimeout(clearTimerRef.current);
          clearTimerRef.current = null;
        }
        resolverRef.current = { resolve, reject };
        setOptions(nextOptions);
        setLoading(false);
        setOpen(true);
      }),
    [],
  );

  async function handleConfirm() {
    if (!options) return;
    if (!options.onConfirm) {
      finish(true);
      return;
    }
    try {
      setLoading(true);
      await options.onConfirm();
      finish(true);
    } catch (err) {
      finish({ reject: err });
    }
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      setOpen(true);
      return;
    }
    if (loading) return;
    finish(false);
  }

  function handleCancel() {
    if (loading) return;
    finish(false);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={options?.title ?? ""}
        description={options?.description}
        confirmLabel={options?.confirmLabel}
        cancelLabel={options?.cancelLabel}
        variant={options?.variant}
        loading={loading}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used inside <ConfirmProvider>.");
  }
  return ctx;
}
