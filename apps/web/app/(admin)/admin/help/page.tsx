import { HelpView } from "@/components/help/help-view";

export const metadata = {
  title: "Help & Documentation",
  description:
    "Admin help center, operations, AI configuration, fairness monitoring, audit, and system health.",
};

export default function AdminHelpPage() {
  return <HelpView variant="admin" />;
}
