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

interface Props {
  candidateName: string;
  jobTitle: string;
  companyName: string;
  applicationUrl: string;
}

export function OfferExpiredEmail({
  candidateName,
  jobTitle,
  companyName,
  applicationUrl,
}: Props): React.ReactElement {
  return (
    <Html>
      <Head />
      <Preview>{`Your offer for ${jobTitle} has expired`}</Preview>
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
          <Heading style={{ color: "#0a0b0d", fontWeight: 400, fontSize: "24px" }}>
            Offer Expired
          </Heading>
          <Section>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>Hi {candidateName},</Text>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              Your offer for <strong style={{ color: "#0a0b0d" }}>{jobTitle}</strong>
              {" "}at {companyName} has expired without a response. If you'd still like
              to discuss the opportunity, please reach out to the recruiter directly.
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
