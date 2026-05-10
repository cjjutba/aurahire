"use client";

import { useState } from "react";
import Link from "next/link";

import { useActiveCompany } from "@/contexts/active-company-context";
import { toastSuccess } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";

/**
 * Integrations are stubs in Phase 5 — the webhook delivery pipeline,
 * Slack incoming webhook, and CSV exporter aren't wired. Each card
 * shows the input it would persist + a save button that toasts.
 */
export function IntegrationsPageClient() {
  const ctx = useActiveCompany();
  const role = ctx?.activeMembership?.role ?? null;
  const isOwnerOrAdmin = role === "owner" || role === "admin";

  const [webhookUrl, setWebhookUrl] = useState("");
  const [slackUrl, setSlackUrl] = useState("");

  function fakeSave(label: string) {
    toastSuccess(`${label} saved locally`, "Backend persistence coming soon.");
  }

  function fakeExport(label: string) {
    toastSuccess(
      `${label} export queued`,
      "You'll get an email with a download link when it's ready.",
    );
  }

  if (!isOwnerOrAdmin) {
    return (
      <>
        <SettingsSectionHeader
          title="Integrations"
          subtitle="Wire AuraHire events to your existing tools."
        />
        <SettingsCard>
          <p className="text-sm text-[var(--color-body)]">
            Only owners and admins can configure integrations.
          </p>
          <div className="mt-4">
            <Link
              href="/recruiter/settings/profile"
              className="inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-6 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline)]"
            >
              Back to profile
            </Link>
          </div>
        </SettingsCard>
      </>
    );
  }

  return (
    <>
      <SettingsSectionHeader
        title="Integrations"
        subtitle="Wire AuraHire events to your existing tools."
      />

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)]/30 p-4 text-sm text-[var(--color-ink)]">
        Integrations are previews. Saving a value persists locally; the delivery
        and export pipelines will land in a future release.
      </div>

      <SettingsCard
        title="Webhook"
        description="Send a JSON event to your endpoint whenever an application is created, scored, or moved."
        trailing={<ComingSoonBadge />}
      >
        <div className="space-y-3">
          <Input
            type="url"
            placeholder="https://api.example.com/webhooks/aurahire"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => fakeSave("Webhook URL")}
              className="rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-6 text-[var(--color-ink)] hover:bg-[var(--color-hairline)]"
            >
              Save webhook
            </Button>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Slack"
        description="Post AuraHire events to a Slack channel via an incoming webhook."
        trailing={<ComingSoonBadge />}
      >
        <div className="space-y-3">
          <Input
            type="url"
            placeholder="https://hooks.slack.com/services/T000/B000/XXX"
            value={slackUrl}
            onChange={(e) => setSlackUrl(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => fakeSave("Slack webhook")}
              className="rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-6 text-[var(--color-ink)] hover:bg-[var(--color-hairline)]"
            >
              Save Slack URL
            </Button>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Export data"
        description="Download a CSV snapshot of jobs or applications."
        trailing={<ComingSoonBadge />}
      >
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => fakeExport("Jobs CSV")}
            className="rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-6 text-[var(--color-ink)] hover:bg-[var(--color-hairline)]"
          >
            Export jobs (CSV)
          </Button>
          <Button
            type="button"
            onClick={() => fakeExport("Applications CSV")}
            className="rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-6 text-[var(--color-ink)] hover:bg-[var(--color-hairline)]"
          >
            Export applications (CSV)
          </Button>
        </div>
      </SettingsCard>
    </>
  );
}

function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-surface-strong)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
      Coming soon
    </span>
  );
}
