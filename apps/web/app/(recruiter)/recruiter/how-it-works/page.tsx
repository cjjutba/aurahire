import { HowItWorksView } from "@/components/how-it-works/how-it-works-view";

export const metadata = {
  title: "How AuraHire Works",
  description:
    "An end-to-end walkthrough of the recruiter workflow — from drafting a role with bias checks to extending an offer — including scoring transparency, override semantics, and the audit trail.",
};

export default function RecruiterHowItWorksPage() {
  return <HowItWorksView variant="recruiter" />;
}
