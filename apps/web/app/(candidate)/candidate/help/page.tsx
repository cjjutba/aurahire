import { HelpView } from "@/components/help/help-view";

export const metadata = {
  title: "Help & Documentation",
  description:
    "Candidate help center, applying, your match score, privacy, interviews, and offers.",
};

export default function CandidateHelpPage() {
  return <HelpView variant="candidate" />;
}
