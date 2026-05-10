import { Hr, Img, Section, Text } from "@react-email/components";
import * as React from "react";

/**
 * Header used across email templates. Two modes:
 *
 * 1. Account-level emails (password reset, email verification, team
 *    invitation, dev test) — no `company` prop is passed; the header
 *    renders only the AuraHire wordmark.
 *
 * 2. Company-on-AuraHire emails (interview scheduled/cancelled, offer
 *    sent/decision/expired, application received/status changed) — the
 *    sending company's name + logo render at the top, with a thin "on
 *    AuraHire" attribution line beneath. The visual hierarchy positions
 *    the company as the sender; AuraHire is the platform underneath.
 */

interface EmailBrandHeaderProps {
  company?: { name: string; logoUrl: string | null } | null;
}

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

function AuraHireWordmark({
  size = "primary",
}: {
  size?: "primary" | "secondary";
}): React.ReactElement {
  const isSecondary = size === "secondary";
  const fontSize = isSecondary ? "12px" : "16px";
  const color = isSecondary ? "#7c828a" : "#0a0b0d";
  const fontWeight = isSecondary ? 400 : 600;
  const iconSize = isSecondary ? 14 : 24;

  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      style={{ borderCollapse: "collapse" }}
    >
      <tbody>
        <tr>
          <td
            style={{
              verticalAlign: "middle",
              paddingRight: isSecondary ? "6px" : "8px",
            }}
          >
            <Img
              src={`${APP_URL}/brand/aurahire-logo.png`}
              alt=""
              width={iconSize}
              height={iconSize}
              style={{ display: "block", border: 0, outline: "none" }}
            />
          </td>
          <td style={{ verticalAlign: "middle" }}>
            <Text
              style={{
                fontSize,
                fontWeight,
                letterSpacing: "-0.2px",
                color,
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {isSecondary ? "Sent via AuraHire" : "AuraHire"}
            </Text>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function EmailBrandHeader({
  company,
}: EmailBrandHeaderProps = {}): React.ReactElement {
  // Account-level — AuraHire-only header.
  if (!company) {
    return (
      <Section style={{ margin: "0 0 24px 0" }}>
        <AuraHireWordmark />
      </Section>
    );
  }

  // Company-on-AuraHire header. Company name + logo dominate; AuraHire
  // sits below as platform attribution.
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
      <AuraHireWordmark size="secondary" />
    </Section>
  );
}
