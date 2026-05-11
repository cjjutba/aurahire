import { HowItWorksView } from "@/components/how-it-works/how-it-works-view";

export const metadata = {
  title: "How AuraHire Works",
  description:
    "An end-to-end walkthrough of the candidate experience, from sign-up to offer, including how match scores are computed, how PII is redacted, and what humans decide.",
};

export default function CandidateHowItWorksPage() {
  return <HowItWorksView variant="candidate" />;
}
