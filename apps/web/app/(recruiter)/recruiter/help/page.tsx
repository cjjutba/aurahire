import { HelpView } from "@/components/help/help-view";

export const metadata = {
  title: "Help & Documentation",
  description:
    "Recruiter help center, publishing jobs, scoring transparency, bias mitigation, and pipeline workflows.",
};

export default function RecruiterHelpPage() {
  return <HelpView variant="recruiter" />;
}
