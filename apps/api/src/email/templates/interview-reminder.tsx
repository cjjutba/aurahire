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

export interface InterviewReminderEmailProps {
  candidateName: string;
  jobTitle: string;
  companyName: string;
  scheduledAt: string; // ISO
  durationMinutes: number;
  format: string;
  venueName?: string | null;
  addressLine?: string | null;
  roomOrFloor?: string | null;
  reportingInstructions?: string | null;
  whatToBring?: string | null;
  interviewerName?: string | null;
  interviewerTitle?: string | null;
  mapUrl?: string | null;
  applicationUrl: string;
  company?: { name: string; logoUrl?: string | null } | null;
}

const FORMAT_LABELS: Record<string, string> = {
  phone: "Phone",
  video: "Video",
  "in-person": "In-Person",
};

export function InterviewReminderEmail({
  candidateName,
  jobTitle,
  companyName,
  scheduledAt,
  durationMinutes,
  format,
  venueName,
  addressLine,
  roomOrFloor,
  reportingInstructions,
  whatToBring,
  interviewerName,
  interviewerTitle,
  mapUrl,
  applicationUrl,
  company,
}: InterviewReminderEmailProps): React.ReactElement {
  const when = new Date(scheduledAt).toLocaleString();
  const formatLabel = FORMAT_LABELS[format] ?? format;

  const hasVenueCard = Boolean(venueName && addressLine);

  return (
    <Html>
      <Head />
      <Preview>{`Reminder: your interview for ${jobTitle} is tomorrow`}</Preview>
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
            Quick reminder: your interview is tomorrow
          </Heading>
          <Section>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              Hi {candidateName},
            </Text>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              Just a reminder that your interview for{" "}
              <strong style={{ color: "#0a0b0d" }}>{jobTitle}</strong> at{" "}
              {companyName} is scheduled for{" "}
              <strong style={{ color: "#2563eb" }}>{when}</strong> (
              {durationMinutes} minutes, {formatLabel}).
            </Text>

            {/* Venue card */}
            {hasVenueCard && (
              <Section
                style={{
                  backgroundColor: "#f7f7f7",
                  borderRadius: "12px",
                  padding: "16px 20px",
                  marginTop: "16px",
                  marginBottom: "8px",
                }}
              >
                <Text
                  style={{
                    color: "#0a0b0d",
                    fontWeight: 600,
                    fontSize: "14px",
                    margin: "0 0 8px 0",
                  }}
                >
                  Interview location
                </Text>
                <Text
                  style={{
                    color: "#0a0b0d",
                    margin: "0 0 2px 0",
                    fontSize: "15px",
                  }}
                >
                  {venueName}
                </Text>
                <Text
                  style={{
                    color: "#5b616e",
                    margin: "0 0 2px 0",
                    fontSize: "14px",
                  }}
                >
                  {addressLine}
                </Text>
                {roomOrFloor && (
                  <Text
                    style={{
                      color: "#5b616e",
                      margin: "0 0 2px 0",
                      fontSize: "14px",
                    }}
                  >
                    {roomOrFloor}
                  </Text>
                )}
                {mapUrl && (
                  <Text style={{ margin: "8px 0 0 0", fontSize: "14px" }}>
                    <a
                      href={mapUrl}
                      style={{ color: "#2563eb", textDecoration: "none" }}
                    >
                      View on map
                    </a>
                  </Text>
                )}
              </Section>
            )}

            {/* Interviewer info */}
            {interviewerName && (
              <Text
                style={{ color: "#5b616e", lineHeight: 1.5, marginTop: "12px" }}
              >
                <strong style={{ color: "#0a0b0d" }}>Your interviewer:</strong>{" "}
                {interviewerName}
                {interviewerTitle ? `, ${interviewerTitle}` : ""}
              </Text>
            )}

            {/* Reporting instructions: prominent for reminders */}
            {reportingInstructions && (
              <Section
                style={{
                  borderLeft: "4px solid #2563eb",
                  paddingLeft: "12px",
                  marginTop: "12px",
                  marginBottom: "4px",
                }}
              >
                <Text
                  style={{
                    color: "#0a0b0d",
                    fontWeight: 600,
                    fontSize: "14px",
                    margin: "0 0 4px 0",
                  }}
                >
                  Reporting instructions
                </Text>
                <Text style={{ color: "#5b616e", lineHeight: 1.5, margin: 0 }}>
                  {reportingInstructions}
                </Text>
              </Section>
            )}

            {/* What to bring: prominent for reminders */}
            {whatToBring && (
              <Section
                style={{
                  borderLeft: "4px solid #10b981",
                  paddingLeft: "12px",
                  marginTop: "12px",
                  marginBottom: "4px",
                }}
              >
                <Text
                  style={{
                    color: "#0a0b0d",
                    fontWeight: 600,
                    fontSize: "14px",
                    margin: "0 0 4px 0",
                  }}
                >
                  What to bring
                </Text>
                <Text style={{ color: "#5b616e", lineHeight: 1.5, margin: 0 }}>
                  {whatToBring}
                </Text>
              </Section>
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
