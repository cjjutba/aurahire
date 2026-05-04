"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface AuthInputProps
  extends Omit<React.ComponentProps<"input">, "placeholder"> {
  id: string;
  label: string;
  error?: string;
}

export const AuthInput = React.forwardRef<HTMLInputElement, AuthInputProps>(
  function AuthInput({ id, label, error, className, type = "text", ...rest }, ref) {
    const errorId = error ? `${id}-error` : undefined;
    return (
      <div className="w-full">
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={type}
            placeholder=" "
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            className={cn(
              "peer h-[52px] w-full rounded-[var(--radius-pill)] border px-5 pt-1.5 text-[15px] text-[var(--color-ink)] outline-none transition-colors",
              "border-[var(--color-hairline)] bg-[var(--color-canvas)]",
              "placeholder:text-[var(--color-muted-soft)]",
              "focus:border-2 focus:border-[var(--color-primary)] focus:px-[19px] focus:pt-1.5",
              error &&
                "border-2 border-[var(--color-status-danger)] px-[19px] focus:border-[var(--color-status-danger)]",
              "disabled:cursor-not-allowed disabled:opacity-60",
              className,
            )}
            {...rest}
          />
          <label
            htmlFor={id}
            className={cn(
              "pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 bg-[var(--color-canvas)] px-1.5 text-[15px] text-[var(--color-muted-soft)] transition-all duration-150",
              "peer-focus:top-0 peer-focus:text-[11px] peer-focus:font-medium peer-focus:text-[var(--color-body)]",
              "peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-medium peer-[:not(:placeholder-shown)]:text-[var(--color-body)]",
              error &&
                "peer-focus:text-[var(--color-status-danger)] peer-[:not(:placeholder-shown)]:text-[var(--color-status-danger)]",
            )}
          >
            {label}
          </label>
        </div>
        {error && (
          <p
            id={errorId}
            className="mt-1.5 px-5 text-xs text-[var(--color-status-danger)]"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);
