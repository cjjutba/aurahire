import {
  Body,
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

interface TestEmailProps {
  recipientName: string;
}

export function TestEmail({
  recipientName,
}: TestEmailProps): React.ReactElement {
  return (
    <Html>
      <Head />
      <Preview>AuraHire email module test</Preview>
      <Body
        style={{ fontFamily: "Inter, sans-serif", backgroundColor: "#f7f7f7" }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "32px",
            borderRadius: "16px",
            maxWidth: "600px",
            margin: "0 auto",
          }}
        >
          <EmailBrandHeader />
          <Heading style={{ color: "#0a0b0d", fontWeight: 400 }}>
            Hello, {recipientName}
          </Heading>
          <Section>
            <Text style={{ color: "#5b616e", lineHeight: 1.5 }}>
              This is a test email from the AuraHire backend. If you're seeing
              this in Mailpit (localhost:8025), the email module is wired
              correctly.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default TestEmail;
