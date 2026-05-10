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

export interface InterviewFeedbackSharedEmailProps {
  candidateName: string;
  jobTitle: string;
  companyName: string;
  candidateSummary: string;
  applicationUrl: string;
  company?: { name: string; logoUrl?: string | null } | null;
}

export function InterviewFeedbackSharedEmail({
  candidateName,
  jobTitle,
  companyName,
  candidateSummary,
  applicationUrl,
  company,
}: InterviewFeedbackSharedEmailProps): React.ReactElement {
  return (
    <Html>
      <Head />
      <Preview>{`Feedback from your interview at ${companyName}`}</Preview>
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
          <EmailBrandHeader
            company={
              company
                ? { name: company.name, logoUrl: company.logoUrl ?? null }
                : null
            }
          />
          <Heading
            style={{ color: "#0a0b0d", fontWeight: 400, fontSize: "24px" }}
          >
            Feedback from your interview at {companyName}
          </Heading>
          <Section>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              Hi {candidateName},
            </Text>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              The recruiter at{" "}
              <strong style={{ color: "#0a0b0d" }}>{companyName}</strong> has
              shared feedback from your interview for{" "}
              <strong style={{ color: "#0a0b0d" }}>{jobTitle}</strong>.
            </Text>

            {/* Candidate summary block */}
            <Section
              style={{
                backgroundColor: "#f7f7f7",
                borderRadius: "12px",
                borderLeft: "4px solid #2563eb",
                padding: "16px 20px",
                marginTop: "16px",
                marginBottom: "16px",
              }}
            >
              <Text
                style={{
                  color: "#7c828a",
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  margin: "0 0 10px 0",
                }}
              >
                Feedback summary
              </Text>
              <Text
                style={{
                  color: "#0a0b0d",
                  lineHeight: 1.6,
                  fontStyle: "italic",
                  margin: 0,
                }}
              >
                {candidateSummary}
              </Text>
            </Section>

            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              If you have any questions about this feedback, you can reply
              directly to this email or reach out through your candidate portal.
            </Text>
          </Section>

          <Section style={{ marginTop: "16px" }}>
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
