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

import { EmailBrandHeader } from "./_brand-header";

interface TeamInvitationProps {
  inviterName: string;
  companyName: string;
  role: string;
  inviteUrl: string;
  expiresAt: string;
}

export function TeamInvitationEmail({
  inviterName,
  companyName,
  role,
  inviteUrl,
  expiresAt,
}: TeamInvitationProps): React.ReactElement {
  const friendlyRole = role.charAt(0).toUpperCase() + role.slice(1);
  return (
    <Html>
      <Head />
      <Preview>
        {inviterName} invited you to join {companyName} on AuraHire.
      </Preview>
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
          <EmailBrandHeader />

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
            You're invited to {companyName}
          </Heading>

          <Text
            style={{
              color: "#5b616e",
              fontSize: "16px",
              lineHeight: 1.5,
              margin: "0 0 16px 0",
            }}
          >
            <strong style={{ color: "#0a0b0d" }}>{inviterName}</strong> invited
            you to join{" "}
            <strong style={{ color: "#0a0b0d" }}>{companyName}</strong> on
            AuraHire as a{" "}
            <strong style={{ color: "#0a0b0d" }}>{friendlyRole}</strong>.
          </Text>

          <Text
            style={{
              color: "#5b616e",
              fontSize: "16px",
              lineHeight: 1.5,
              margin: "0 0 24px 0",
            }}
          >
            AuraHire is a recruitment platform with explainable AI scoring and
            active bias mitigation — every decision shows its work.
          </Text>

          <Section style={{ textAlign: "center", margin: "32px 0" }}>
            <Button
              href={inviteUrl}
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
              Accept invitation
            </Button>
          </Section>

          <Text
            style={{
              color: "#5b616e",
              fontSize: "14px",
              lineHeight: 1.5,
              margin: "0 0 8px 0",
            }}
          >
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
            <Link href={inviteUrl} style={{ color: "#2563eb" }}>
              {inviteUrl}
            </Link>
          </Text>

          <Hr style={{ borderColor: "#dee1e6", margin: "32px 0" }} />

          <Text
            style={{
              color: "#7c828a",
              fontSize: "13px",
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            This invitation expires on {expiresAt}. If you didn't expect this
            invitation, you can safely ignore this email — no account will be
            created.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default TeamInvitationEmail;
