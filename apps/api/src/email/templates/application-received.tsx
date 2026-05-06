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
  matchBand: string | null;
  matchScore: number | null;
  applicationUrl: string;
  company?: { name: string; logoUrl: string | null } | null;
}

export function ApplicationReceivedEmail({
  recruiterName,
  candidateName,
  jobTitle,
  matchBand,
  matchScore,
  applicationUrl,
  company,
}: Props): React.ReactElement {
  return (
    <Html>
      <Head />
      <Preview>{`New application from ${candidateName}`}</Preview>
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
            New application
          </Heading>
          <Section>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>Hi {recruiterName},</Text>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              <strong style={{ color: "#0a0b0d" }}>{candidateName}</strong> applied to your job posting{" "}
              <strong style={{ color: "#0a0b0d" }}>&ldquo;{jobTitle}&rdquo;</strong>.
            </Text>
            {matchBand && matchScore !== null && (
              <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
                AI match: <strong style={{ color: "#2563eb" }}>{matchScore}/100</strong> ({matchBand})
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
              Review application
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
