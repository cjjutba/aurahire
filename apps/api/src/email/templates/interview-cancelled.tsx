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
  applicationUrl: string;
  company?: { name: string; logoUrl: string | null } | null;
}

export function InterviewCancelledEmail({
  candidateName,
  jobTitle,
  companyName,
  scheduledAt,
  applicationUrl,
  company,
}: Props): React.ReactElement {
  const when = new Date(scheduledAt).toLocaleString();

  return (
    <Html>
      <Head />
      <Preview>{`Interview cancelled: ${jobTitle} at ${companyName}`}</Preview>
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
            Interview cancelled
          </Heading>
          <Section>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              Hi {candidateName},
            </Text>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              The interview previously scheduled for{" "}
              <strong style={{ color: "#0a0b0d" }}>{jobTitle}</strong> at{" "}
              {companyName} on <strong>{when}</strong> has been cancelled.
            </Text>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              Your application is still active — the recruiter may reschedule or
              move you forward another way. Check your application detail for
              updates.
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
