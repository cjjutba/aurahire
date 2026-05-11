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

function statusHeadline(status: string, jobTitle: string): string {
  switch (status.toLowerCase()) {
    case "hired":
      return `Congratulations, you're hired!`;
    case "offer":
      return `Great news, you have an offer`;
    case "interview":
      return `You're moving to interviews`;
    case "screening":
      return `Your application is under review`;
    case "rejected":
      return `Update on your application`;
    case "withdrawn":
      return `Your application has been withdrawn`;
    case "applied":
      return `We received your application`;
    default:
      return `Update on your ${jobTitle} application`;
  }
}

function statusBody(
  status: string,
  candidateName: string,
  jobTitle: string,
  companyName: string,
): string {
  switch (status.toLowerCase()) {
    case "hired":
      return `Welcome to ${companyName}, ${candidateName}. You have officially been hired for ${jobTitle}. Your recruiter will be in touch with onboarding details. The team is thrilled to have you join.`;
    case "offer":
      return `${companyName} has extended you an offer for ${jobTitle}. Take a moment to review the full offer and respond when you are ready.`;
    case "interview":
      return `Exciting update, ${candidateName}. Your application for ${jobTitle} at ${companyName} has advanced to the interview stage. Watch for scheduling details to arrive shortly.`;
    case "screening":
      return `Your application for ${jobTitle} at ${companyName} is now under review. The hiring team will follow up with next steps.`;
    case "rejected":
      return `Thank you for your interest in ${jobTitle} at ${companyName}. After careful consideration, the team has decided to move forward with other candidates this time. We genuinely appreciate the time and effort you invested, and we wish you the very best in your search.`;
    case "withdrawn":
      return `Your application for ${jobTitle} at ${companyName} has been withdrawn. If this was not intentional, you are welcome to apply again.`;
    case "applied":
      return `Your application for ${jobTitle} at ${companyName} has been received. Sit tight while the hiring team reviews it.`;
    default:
      return `Your application for ${jobTitle} at ${companyName} has been updated.`;
  }
}

function statusCta(status: string): string {
  switch (status.toLowerCase()) {
    case "hired":
      return "View your offer details";
    case "offer":
      return "Review your offer";
    default:
      return "View application";
  }
}

function statusPreview(status: string, jobTitle: string): string {
  switch (status.toLowerCase()) {
    case "hired":
      return `Congratulations, you're hired for ${jobTitle}`;
    case "offer":
      return `You received an offer for ${jobTitle}`;
    case "interview":
      return `You're moving to interviews for ${jobTitle}`;
    default:
      return `Update on your application for ${jobTitle}`;
  }
}

export function ApplicationStatusChangedEmail({
  candidateName,
  jobTitle,
  companyName,
  newStatus,
  applicationUrl,
  company,
}: Props): React.ReactElement {
  return (
    <Html>
      <Head />
      <Preview>{statusPreview(newStatus, jobTitle)}</Preview>
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
            {statusHeadline(newStatus, jobTitle)}
          </Heading>
          <Section>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              Hi {candidateName},
            </Text>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              {statusBody(newStatus, candidateName, jobTitle, companyName)}
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
              {statusCta(newStatus)}
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
