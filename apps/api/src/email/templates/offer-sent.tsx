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
  salary: number;
  salaryCurrency: string;
  startDate: string;
  expiresAt: string | null;
  applicationUrl: string;
  company?: { name: string; logoUrl: string | null } | null;
}

function formatSalary(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

export function OfferSentEmail({
  candidateName,
  jobTitle,
  companyName,
  salary,
  salaryCurrency,
  startDate,
  expiresAt,
  applicationUrl,
  company,
}: Props): React.ReactElement {
  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString(undefined, { dateStyle: "long" })
    : null;

  return (
    <Html>
      <Head />
      <Preview>{`Offer extended: ${jobTitle} at ${companyName}`}</Preview>
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
            Congratulations — offer extended!
          </Heading>
          <Section>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              Hi {candidateName},
            </Text>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              {companyName} has extended you an offer for{" "}
              <strong style={{ color: "#0a0b0d" }}>{jobTitle}</strong>.
            </Text>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              <strong>Salary:</strong>{" "}
              <span style={{ color: "#2563eb", fontWeight: 600 }}>
                {formatSalary(salary, salaryCurrency)}
              </span>
              <br />
              <strong>Start date:</strong> {startDate}
              {expiresLabel && (
                <>
                  <br />
                  <strong>Respond by:</strong> {expiresLabel}
                </>
              )}
            </Text>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              Review the full details and respond from your application page.
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
              View offer
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
