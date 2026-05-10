import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { NotificationsForm } from "@/components/settings/notifications-form";

export const metadata = { title: "Notifications · Settings" };

export default function RecruiterSettingsNotificationsPage() {
  return (
    <>
      <SettingsSectionHeader
        title="Notifications"
        subtitle="Choose which events trigger an email to you."
      />

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)]/30 p-4 text-sm text-[var(--color-ink)]">
        Notification preferences will sync to the email service in a future
        release. Toggling a preference saves it locally for now.
      </div>

      <SettingsCard
        title="Event notifications"
        description="All events default to enabled."
      >
        <NotificationsForm audience="recruiter" />
      </SettingsCard>
    </>
  );
}
