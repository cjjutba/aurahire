import * as React from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";

interface BaseLayoutProps {
  preview: string;
  children: React.ReactNode;
  unsubscribePath: string;
  appOrigin: string;
}

const BRAND_LOGO_URL =
  "https://fzjvalmouygmmnrgpgtg.supabase.co/storage/v1/object/public/brand/aurahire-logo.png";

export function BaseLayout({
  preview,
  children,
  unsubscribePath,
  appOrigin,
}: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: "#f7f7f7",
          fontFamily:
            "Inter, -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif",
          color: "#0a0b0d",
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            margin: "0 auto",
            padding: 32,
            backgroundColor: "#ffffff",
            borderRadius: 16,
          }}
        >
          <Section style={{ paddingBottom: 24, textAlign: "center" }}>
            <Img
              src={BRAND_LOGO_URL}
              alt="AuraHire"
              width={64}
              height={64}
              style={{
                display: "block",
                margin: "0 auto",
                border: 0,
                outline: "none",
              }}
            />
          </Section>
          {children}
          <Hr
            style={{
              border: 0,
              borderTop: "1px solid #dee1e6",
              margin: "32px 0 16px",
            }}
          />
          <Text style={{ fontSize: 12, color: "#7c828a", lineHeight: 1.5 }}>
            You&apos;re receiving this because of your AuraHire notification
            preferences.{" "}
            <Link
              href={`${appOrigin}${unsubscribePath}`}
              style={{ color: "#2563eb" }}
            >
              Manage notification settings
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const brandStyles = {
  ctaPrimary: {
    backgroundColor: "#2563eb",
    color: "#ffffff",
    padding: "12px 24px",
    borderRadius: 100,
    fontSize: 14,
    fontWeight: 600,
    textDecoration: "none",
    display: "inline-block",
  },
  body: {
    fontSize: 16,
    color: "#0a0b0d",
    lineHeight: 1.5,
    margin: "0 0 16px",
  },
  bodyMuted: {
    fontSize: 14,
    color: "#5b616e",
    lineHeight: 1.5,
    margin: "0 0 16px",
  },
} as const;
