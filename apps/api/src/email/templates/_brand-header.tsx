import { Img, Section, Text } from "@react-email/components";
import * as React from "react";

/**
 * Logo + "AuraHire" wordmark used as a header across email templates.
 * Logo is served from the web app's /brand directory; APP_URL provides the host.
 */
export function EmailBrandHeader(): React.ReactElement {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return (
    <Section style={{ margin: "0 0 24px 0" }}>
      <table
        role="presentation"
        cellPadding={0}
        cellSpacing={0}
        border={0}
        style={{ borderCollapse: "collapse" }}
      >
        <tbody>
          <tr>
            <td style={{ verticalAlign: "middle", paddingRight: "8px" }}>
              <Img
                src={`${appUrl}/brand/aurahire-logo.png`}
                alt=""
                width={24}
                height={24}
                style={{ display: "block", border: 0, outline: "none" }}
              />
            </td>
            <td style={{ verticalAlign: "middle" }}>
              <Text
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  letterSpacing: "-0.2px",
                  color: "#0a0b0d",
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                AuraHire
              </Text>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}
