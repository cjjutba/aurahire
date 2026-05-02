import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface VerifyEmailProps {
  recipientName: string;
  verifyUrl: string;
}

export function VerifyEmailTemplate({
  recipientName,
  verifyUrl,
}: VerifyEmailProps): React.ReactElement {
  return (
    <Html>
      <Head />
      <Preview>Verify your AuraHire account to start hiring fairly.</Preview>
      <Body
        style={{
          fontFamily:
            "Inter, -apple-system, system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          backgroundColor: "#f7f7f7",
          margin: 0,
          padding: "32px 16px",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "40px 32px",
            borderRadius: "16px",
            maxWidth: "560px",
            margin: "0 auto",
          }}
        >
          <Text
            style={{
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#7c828a",
              margin: "0 0 8px 0",
            }}
          >
            AuraHire
          </Text>

          <Heading
            style={{
              fontSize: "32px",
              fontWeight: 400,
              lineHeight: 1.13,
              letterSpacing: "-0.4px",
              color: "#0a0b0d",
              margin: "0 0 16px 0",
            }}
          >
            Verify your email
          </Heading>

          <Text style={{ color: "#5b616e", fontSize: "16px", lineHeight: 1.5, margin: "0 0 24px 0" }}>
            Hi {recipientName}, thanks for signing up. Confirm your email so we can finish
            setting up your account.
          </Text>

          <Section style={{ textAlign: "center", margin: "32px 0" }}>
            <Button
              href={verifyUrl}
              style={{
                backgroundColor: "#2563eb",
                color: "#ffffff",
                fontSize: "16px",
                fontWeight: 600,
                padding: "12px 24px",
                borderRadius: "100px",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Verify email
            </Button>
          </Section>

          <Text style={{ color: "#5b616e", fontSize: "14px", lineHeight: 1.5, margin: "0 0 8px 0" }}>
            Or copy and paste this link into your browser:
          </Text>
          <Text
            style={{
              fontSize: "13px",
              color: "#2563eb",
              wordBreak: "break-all",
              margin: "0 0 24px 0",
            }}
          >
            <Link href={verifyUrl} style={{ color: "#2563eb" }}>
              {verifyUrl}
            </Link>
          </Text>

          <Hr style={{ borderColor: "#dee1e6", margin: "32px 0" }} />

          <Text style={{ color: "#7c828a", fontSize: "13px", lineHeight: 1.5, margin: 0 }}>
            This link expires in 24 hours. If you didn't create an AuraHire account, you can
            safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default VerifyEmailTemplate;
