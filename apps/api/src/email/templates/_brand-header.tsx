import { Hr, Img, Section, Text } from "@react-email/components";
import * as React from "react";

/**
 * Header used across email templates. Two modes:
 *
 * 1. Account-level emails (password reset, email verification, team
 *    invitation, dev test): a centered AuraHire logo, no wordmark text.
 *
 * 2. Company-on-AuraHire emails (interview scheduled/cancelled, offer
 *    sent/decision/expired, application received/status changed): the
 *    sending company name + logo sit at the top, with a small centered
 *    AuraHire logo beneath as platform attribution.
 */

interface EmailBrandHeaderProps {
  company?: { name: string; logoUrl: string | null } | null;
}

const BRAND_LOGO_URL =
  "https://fzjvalmouygmmnrgpgtg.supabase.co/storage/v1/object/public/brand/aurahire-logo.png";

function AuraHireLogo({
  size = "primary",
}: {
  size?: "primary" | "secondary";
}): React.ReactElement {
  const iconSize = size === "primary" ? 72 : 32;
  return (
    <Section style={{ textAlign: "center" }}>
      <Img
        src={BRAND_LOGO_URL}
        alt="AuraHire"
        width={iconSize}
        height={iconSize}
        style={{
          display: "block",
          margin: "0 auto",
          border: 0,
          outline: "none",
        }}
      />
    </Section>
  );
}

export function EmailBrandHeader({
  company,
}: EmailBrandHeaderProps = {}): React.ReactElement {
  if (!company) {
    return (
      <Section style={{ margin: "0 0 24px 0" }}>
        <AuraHireLogo />
      </Section>
    );
  }

  return (
    <Section style={{ margin: "0 0 24px 0" }}>
      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        border={0}
        style={{ borderCollapse: "collapse", width: "100%" }}
      >
        <tbody>
          <tr>
            <td style={{ verticalAlign: "middle" }}>
              <table
                role="presentation"
                cellPadding={0}
                cellSpacing={0}
                border={0}
                style={{ borderCollapse: "collapse" }}
              >
                <tbody>
                  <tr>
                    {company.logoUrl && (
                      <td
                        style={{
                          verticalAlign: "middle",
                          paddingRight: "10px",
                        }}
                      >
                        <Img
                          src={company.logoUrl}
                          alt=""
                          width={28}
                          height={28}
                          style={{
                            display: "block",
                            border: 0,
                            outline: "none",
                            borderRadius: "6px",
                          }}
                        />
                      </td>
                    )}
                    <td style={{ verticalAlign: "middle" }}>
                      <Text
                        style={{
                          fontSize: "18px",
                          fontWeight: 600,
                          letterSpacing: "-0.2px",
                          color: "#0a0b0d",
                          margin: 0,
                          lineHeight: 1.2,
                        }}
                      >
                        {company.name}
                      </Text>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
      <Hr
        style={{
          borderTop: "1px solid #eef0f3",
          borderBottom: 0,
          margin: "16px 0 12px 0",
        }}
      />
      <AuraHireLogo size="secondary" />
    </Section>
  );
}
