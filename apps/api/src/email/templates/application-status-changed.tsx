import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

import { EmailBrandHeader } from "./_brand-header";

interface Props {
  candidateName: string;
  jobTitle: string;
  companyName: string;
  previousStatus: string;
  newStatus: string;
  applicationUrl: string;
  company?: { name: string; logoUrl: string | null } | null;
}

const STATUS_LABELS: Record<string, string> = {
  applied: "Applied",
  screening: "Under Review",
  interview: "Interview Scheduled",
  offer: "Offer Extended",
  hired: "Hired",
  rejected: "Not Selected",
  withdrawn: "Withdrawn",
};

export function ApplicationStatusChangedEmail({
  candidateName,
  jobTitle,
  companyName,
  previousStatus,
  newStatus,
  applicationUrl,
  company,
}: Props): React.ReactElement {
  const fromLabel = STATUS_LABELS[previousStatus] ?? previousStatus;
  const toLabel = STATUS_LABELS[newStatus] ?? newStatus;

  return (
    <Html>
      <Head />
      <Preview>{`Update on your application for ${jobTitle}`}</Preview>
      <Body
        style={{
          fontFamily: "Inter, sans-serif",
          backgroundColor: "#f7f7f7",
          padding: "32px 16px",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "32px",
            borderRadius: "16px",
            maxWidth: "560px",
            margin: "0 auto",
          }}
        >
          <EmailBrandHeader company={company} />
          <Heading style={{ color: "#0a0b0d", fontWeight: 400, fontSize: "24px" }}>
            Application Update
          </Heading>
          <Section>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>Hi {candidateName},</Text>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              Your application for <strong style={{ color: "#0a0b0d" }}>{jobTitle}</strong> at{" "}
              {companyName} has moved from <strong>{fromLabel}</strong> to{" "}
              <strong style={{ color: "#2563eb" }}>{toLabel}</strong>.
            </Text>
          </Section>
          <Section style={{ marginTop: "24px" }}>
            <Button
              href={applicationUrl}
              style={{
                backgroundColor: "#2563eb",
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: "9999px",
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              View application
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
