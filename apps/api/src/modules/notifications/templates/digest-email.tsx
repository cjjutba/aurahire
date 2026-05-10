import * as React from "react";
import { BaseLayout, brandStyles } from "./base-layout";
import type { NotificationEventType } from "@aurahire/db";
import { EVENT_CATEGORIES } from "../event-defaults";

type Metadata = Record<string, unknown>;

interface DigestRow {
  id: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
  link: string | null;
  metadata: Metadata;
  createdAt: string;
}

interface DigestEmailProps {
  rows: DigestRow[];
  appOrigin: string;
  role: "candidate" | "recruiter" | "admin";
}

const CATEGORY_LABELS: Record<string, string> = {
  applications: "Applications",
  interviews: "Interviews",
  offers: "Offers",
  bias: "Bias & fairness",
  team: "Team",
  system: "System",
  account: "Account & security",
};

export function DigestEmail({ rows, appOrigin, role }: DigestEmailProps) {
  const grouped = new Map<string, DigestRow[]>();
  for (const row of rows) {
    const cat = EVENT_CATEGORIES[row.eventType];
    const arr = grouped.get(cat) ?? [];
    arr.push(row);
    grouped.set(cat, arr);
  }

  const total = rows.length;
  const preview = `${total} update${total === 1 ? "" : "s"} from AuraHire`;

  return (
    <BaseLayout
      preview={preview}
      appOrigin={appOrigin}
      unsubscribePath={`/${role}/settings/notifications`}
    >
      <h2 style={{ fontSize: 28, fontWeight: 400, margin: "0 0 8px" }}>
        Your AuraHire daily summary
      </h2>
      <p style={brandStyles.bodyMuted}>
        {total} update{total === 1 ? "" : "s"} since yesterday.
      </p>
      {Array.from(grouped.entries()).map(([category, categoryRows]) => (
        <div key={category} style={{ marginTop: 24 }}>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#5b616e",
              margin: "0 0 12px",
            }}
          >
            {CATEGORY_LABELS[category] ?? category}
          </h3>
          {categoryRows.map((row) => (
            <div
              key={row.id}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid #eef0f3",
              }}
            >
              <p
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  margin: "0 0 4px",
                  color: "#0a0b0d",
                }}
              >
                {row.title}
              </p>
              <p style={{ fontSize: 14, color: "#5b616e", margin: 0 }}>
                {row.body}
              </p>
              {row.link && (
                <p style={{ marginTop: 8 }}>
                  <a
                    href={`${appOrigin}${row.link}`}
                    style={{
                      color: "#2563eb",
                      textDecoration: "none",
                      fontSize: 14,
                    }}
                  >
                    View →
                  </a>
                </p>
              )}
            </div>
          ))}
        </div>
      ))}
    </BaseLayout>
  );
}
