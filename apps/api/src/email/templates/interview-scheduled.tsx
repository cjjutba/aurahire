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
  scheduledAt: string;
  durationMinutes: number;
  format: string;
  locationOrLink: string | null;
  applicationUrl: string;
}

const FORMAT_LABELS: Record<string, string> = {
  phone: "Phone",
  video: "Video",
  "in-person": "In-Person",
};

export function InterviewScheduledEmail({
  candidateName,
  jobTitle,
  companyName,
  scheduledAt,
  durationMinutes,
  format,
  locationOrLink,
  applicationUrl,
}: Props): React.ReactElement {
  const when = new Date(scheduledAt).toLocaleString();
  const formatLabel = FORMAT_LABELS[format] ?? format;

  return (
    <Html>
      <Head />
      <Preview>{`Interview scheduled: ${jobTitle} at ${companyName}`}</Preview>
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
          <EmailBrandHeader />
          <Heading style={{ color: "#0a0b0d", fontWeight: 400, fontSize: "24px" }}>
            Interview scheduled
          </Heading>
          <Section>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>Hi {candidateName},</Text>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              Your interview for{" "}
              <strong style={{ color: "#0a0b0d" }}>{jobTitle}</strong> at {companyName} is set for{" "}
              <strong style={{ color: "#2563eb" }}>{when}</strong>
              {" "}({durationMinutes} minutes, {formatLabel}).
            </Text>
            {locationOrLink && (
              <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
                <strong>Location / Link:</strong> {locationOrLink}
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
