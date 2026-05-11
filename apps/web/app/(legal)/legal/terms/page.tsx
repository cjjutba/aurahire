import { LegalView } from "@/components/legal/legal-view";

export const metadata = {
  title: "Terms of Service · AuraHire",
  description:
    "The agreement that governs your use of AuraHire, covering accounts, AI scoring, bias mitigation, intellectual property, and liability.",
};

export default function TermsPage() {
  return <LegalView variant="terms" />;
}
