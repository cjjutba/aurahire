"use client";

import { useEffect, useState } from "react";

import { toastSuccess } from "@/lib/toast";

interface NotificationEvent {
  key: string;
  label: string;
  description: string;
}

const RECRUITER_EVENTS: NotificationEvent[] = [
  {
    key: "new_application_received",
    label: "New application received",
    description: "Email me whenever a candidate applies to one of my jobs.",
  },
  {
    key: "interview_reminders",
    label: "Interview reminders",
    description: "1-hour and 24-hour before scheduled interviews.",
  },
  {
    key: "interview_rescheduled",
    label: "Interview rescheduled",
    description: "Notify me when an interview I own is moved to a new time.",
  },
  {
    key: "interview_record_feedback",
    label: "Interview feedback required",
    description: "Remind me to submit feedback after an interview completes.",
  },
  {
    key: "application_withdrawn",
    label: "Candidate withdrew application",
    description: "Notify me when a candidate withdraws from a job I own.",
  },
  {
    key: "offer_events",
    label: "Offer events",
    description: "Sent, accepted, declined, and expired notifications.",
  },
  {
    key: "weekly_digest",
    label: "Weekly digest",
    description: "Friday recap of pipeline activity from the week.",
  },
];

const CANDIDATE_EVENTS: NotificationEvent[] = [
  {
    key: "application_status_changed",
    label: "Application status changes",
    description: "When a recruiter moves your application forward or rejects it.",
  },
  {
    key: "interview_reminders",
    label: "Interview reminders",
    description: "1-hour and 24-hour before scheduled interviews.",
  },
  {
    key: "interview_rescheduled",
    label: "Interview rescheduled",
    description: "Notify me when a recruiter moves my interview to a new time.",
  },
  {
    key: "interview_completed",
    label: "Interview completed",
    description: "Notify me when an interview I participated in is marked completed.",
  },
  {
    key: "offer_received",
    label: "Offer received",
    description: "Notify me the moment an offer is sent.",
  },
  {
    key: "weekly_digest",
    label: "Weekly digest",
    description: "New jobs that match your preferences.",
  },
];

interface NotificationsFormProps {
  audience: "recruiter" | "candidate";
}

/**
 * Per-event toggle list. Persistence is local-only until the backend
 * notification_preferences table lands — the banner inside the page tells
 * the user that. We still persist to localStorage so a session feels
 * stable; the storage key includes the audience so candidate vs recruiter
 * preferences don't collide on a shared device.
 */
export function NotificationsForm({ audience }: NotificationsFormProps) {
  const events = audience === "recruiter" ? RECRUITER_EVENTS : CANDIDATE_EVENTS;
  const storageKey = `notif-prefs:${audience}`;

  const [prefs, setPrefs] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(events.map((e) => [e.key, true])),
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        setPrefs((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // localStorage may be disabled (Safari private mode) — ignore.
    }
    setHydrated(true);
  }, [storageKey]);

  function toggle(key: string) {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    toastSuccess("Preference saved", "Stored locally until backend lands.");
  }

  return (
    <ul className="divide-y divide-[var(--color-hairline-soft)]">
      {events.map((event) => {
        const enabled = prefs[event.key] ?? true;
        return (
          <li
            key={event.key}
            className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-ink)]">
                {event.label}
              </p>
              <p className="mt-1 text-sm text-[var(--color-body)]">
                {event.description}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => toggle(event.key)}
              disabled={!hydrated}
              className={[
                "relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60",
                enabled
                  ? "bg-[var(--color-primary)]"
                  : "bg-[var(--color-surface-strong)]",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block h-4 w-4 rounded-full bg-[var(--color-canvas)] shadow transition",
                  enabled ? "translate-x-6" : "translate-x-1",
                ].join(" ")}
              />
              <span className="sr-only">
                {enabled ? "On" : "Off"}: {event.label}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
