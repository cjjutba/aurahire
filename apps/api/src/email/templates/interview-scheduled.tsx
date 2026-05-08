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

export interface InterviewScheduledEmailProps {
  candidateName: string;
  jobTitle: string;
  companyName: string;
  scheduledAt: string; // ISO
  durationMinutes: number;
  format: string;
  locationOrLink?: string | null;
  // v2 venue fields
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

export function InterviewScheduledEmail({
  candidateName,
  jobTitle,
  companyName,
  scheduledAt,
  durationMinutes,
  format,
  locationOrLink,
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
}: InterviewScheduledEmailProps): React.ReactElement {
  const when = new Date(scheduledAt).toLocaleString();
  const formatLabel = FORMAT_LABELS[format] ?? format;

  const hasVenueCard = Boolean(venueName && addressLine);

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
          <EmailBrandHeader
            company={company ? { name: company.name, logoUrl: company.logoUrl ?? null } : null}
          />
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

            {/* Venue card — shown when structured venue data is available */}
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
                <Text style={{ color: "#0a0b0d", margin: "0 0 2px 0", fontSize: "15px" }}>
                  {venueName}
                </Text>
                <Text style={{ color: "#5b616e", margin: "0 0 2px 0", fontSize: "14px" }}>
                  {addressLine}
                </Text>
                {roomOrFloor && (
                  <Text style={{ color: "#5b616e", margin: "0 0 2px 0", fontSize: "14px" }}>
                    {roomOrFloor}
                  </Text>
                )}
                {mapUrl && (
                  <Text style={{ margin: "8px 0 0 0", fontSize: "14px" }}>
                    <a href={mapUrl} style={{ color: "#2563eb", textDecoration: "none" }}>
                      View on map
                    </a>
                  </Text>
                )}
              </Section>
            )}

            {/* Fallback to legacy locationOrLink when no structured venue */}
            {!hasVenueCard && locationOrLink && (
              <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
                <strong>Location / Link:</strong> {locationOrLink}
              </Text>
            )}

            {/* Interviewer info */}
            {interviewerName && (
              <Text style={{ color: "#5b616e", lineHeight: 1.5, marginTop: "12px" }}>
                <strong style={{ color: "#0a0b0d" }}>Your interviewer:</strong>{" "}
                {interviewerName}
                {interviewerTitle ? `, ${interviewerTitle}` : ""}
              </Text>
            )}

            {/* Reporting instructions */}
            {reportingInstructions && (
              <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
                <strong style={{ color: "#0a0b0d" }}>Reporting instructions:</strong>{" "}
                {reportingInstructions}
              </Text>
            )}

            {/* What to bring */}
            {whatToBring && (
              <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
                <strong style={{ color: "#0a0b0d" }}>What to bring:</strong>{" "}
                {whatToBring}
              </Text>
            )}
          </Section>

          <Section style={{ marginTop: "8px" }}>
            <Text style={{ color: "#7c828a", fontSize: "13px", lineHeight: 1.5 }}>
              A calendar invite (.ics) is attached to this email — add it to your calendar to keep
              the details handy.
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
