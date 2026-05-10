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
  applicationUrl: string;
  company?: { name: string; logoUrl: string | null } | null;
}

export function PositionFilledEmail({
  candidateName,
  jobTitle,
  applicationUrl,
  company,
}: Props): React.ReactElement {
  return (
    <Html>
      <Head />
      <Preview>{`Update on your application for ${jobTitle}`}</Preview>
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
            Update on your application
          </Heading>
          <Section>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              Hi {candidateName},
            </Text>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              We wanted to let you know that the{" "}
              <strong style={{ color: "#0a0b0d" }}>{jobTitle}</strong> position
              has been filled. We appreciate the time you took to apply and the
              chance to learn more about your background.
            </Text>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              We'll keep your profile on file for future roles. In the meantime,
              there are other openings on AuraHire that may be a good fit.
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
