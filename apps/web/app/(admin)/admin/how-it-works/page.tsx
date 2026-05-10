import { HowItWorksView } from "@/components/how-it-works/how-it-works-view";

export const metadata = {
  title: "How AuraHire Works",
  description:
    "An end-to-end walkthrough of the admin operating loop — scoring configuration, prompt versioning, bias monitoring, calibration, audit, and iteration.",
};

export default function AdminHowItWorksPage() {
  return <HowItWorksView variant="admin" />;
}
