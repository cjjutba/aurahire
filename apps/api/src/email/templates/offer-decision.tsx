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
  recruiterName: string;
  candidateName: string;
  jobTitle: string;
  decision: "accepted" | "declined";
  applicationUrl: string;
  company?: { name: string; logoUrl: string | null } | null;
}

export function OfferDecisionEmail({
  recruiterName,
  candidateName,
  jobTitle,
  decision,
  applicationUrl,
  company,
}: Props): React.ReactElement {
  const accepted = decision === "accepted";
  const headline = accepted ? "Offer accepted" : "Offer declined";
  const accentColor = accepted ? "#10b981" : "#cf202f";
  const previewVerb = accepted ? "accepted" : "declined";

  return (
    <Html>
      <Head />
      <Preview>{`${candidateName} ${previewVerb} the offer for ${jobTitle}`}</Preview>
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
          <Heading
            style={{ color: "#0a0b0d", fontWeight: 400, fontSize: "24px" }}
          >
            {headline}
          </Heading>
          <Section>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              Hi {recruiterName},
            </Text>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              <strong style={{ color: "#0a0b0d" }}>{candidateName}</strong> has{" "}
              <strong style={{ color: accentColor }}>{previewVerb}</strong> the
              offer for <strong style={{ color: "#0a0b0d" }}>{jobTitle}</strong>
              .
            </Text>
            {accepted ? (
              <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
                The application status has been updated to{" "}
                <strong>Hired</strong>. Time to kick off onboarding.
              </Text>
            ) : (
              <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
                The application remains active. You can review the
                candidate&apos;s notes and continue with other candidates for
                this role.
              </Text>
            )}
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
