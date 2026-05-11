import { LegalView } from "@/components/legal/legal-view";

export const metadata = {
  title: "Privacy Policy · AuraHire",
  description:
    "How AuraHire collects, redacts, processes, and retains personal data, including how PII is removed from resumes before AI scoring.",
};

export default function PrivacyPage() {
  return <LegalView variant="privacy" />;
}
