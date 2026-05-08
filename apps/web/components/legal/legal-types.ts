import type { ComponentType } from "react";

export type LegalBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered?: boolean; items: string[] }
  | { kind: "definitions"; entries: { term: string; definition: string }[] }
  | { kind: "fields"; entries: { label: string; description: string }[] }
  | {
      kind: "callout";
      tone: "info" | "warning" | "success" | "ai";
      title: string;
      body: string;
    };

export interface LegalSection {
  id: string;
  number: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  lede?: string;
  blocks: LegalBlock[];
}

export interface LegalCrossLink {
  label: string;
  description: string;
  href: string;
}

export interface LegalContact {
  title: string;
  body: string;
  email: string;
  addressLines?: string[];
}

export interface LegalDocument {
  hero: {
    eyebrow: string;
    title: string;
    lede: string;
    effectiveDate: string;
    lastUpdated: string;
    version: string;
  };
  summary: { label: string; body: string }[];
  sections: LegalSection[];
  crossLink: LegalCrossLink;
  contact: LegalContact;
}
