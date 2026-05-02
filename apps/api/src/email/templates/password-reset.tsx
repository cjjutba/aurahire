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

interface PasswordResetProps {
  resetUrl: string;
}

export function PasswordResetTemplate({
  resetUrl,
}: PasswordResetProps): React.ReactElement {
  return (
    <Html>
      <Head />
      <Preview>Reset your AuraHire password.</Preview>
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
            Reset your password
          </Heading>

          <Text style={{ color: "#5b616e", fontSize: "16px", lineHeight: 1.5, margin: "0 0 24px 0" }}>
            We got a request to reset your password. Click the button below to set a new one.
          </Text>

          <Section style={{ textAlign: "center", margin: "32px 0" }}>
            <Button
              href={resetUrl}
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
              Set new password
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
            <Link href={resetUrl} style={{ color: "#2563eb" }}>
              {resetUrl}
            </Link>
          </Text>

          <Hr style={{ borderColor: "#dee1e6", margin: "32px 0" }} />

          <Text style={{ color: "#7c828a", fontSize: "13px", lineHeight: 1.5, margin: 0 }}>
            This link expires in 1 hour. If you didn't request a reset, you can safely ignore
            this email — your password won't change.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default PasswordResetTemplate;
