import type { ComponentType } from "react";

export type HelpBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered?: boolean; items: string[] }
  | { kind: "steps"; items: { title: string; description: string }[] }
  | { kind: "fields"; entries: { label: string; description: string }[] }
  | { kind: "definitions"; entries: { term: string; definition: string }[] }
  | {
      kind: "callout";
      tone: "info" | "warning" | "danger" | "success" | "ai";
      title: string;
      body: string;
    }
  | { kind: "quote"; text: string; cite?: string }
  | { kind: "kbd"; entries: { keys: string[]; description: string }[] }
  | {
      kind: "matrix";
      head: string[];
      rows: string[][];
    };

export interface HelpSection {
  id: string;
  icon: ComponentType<{ className?: string }>;
  kicker?: string;
  title: string;
  lede?: string;
  blocks: HelpBlock[];
}

export interface HelpSectionGroup {
  label: string;
  sections: HelpSection[];
}

export interface HelpFaqItem {
  q: string;
  a: string;
}

export interface HelpContact {
  title: string;
  body: string;
  email: string;
  secondaryLink?: { label: string; href: string };
}

export interface HelpPageContent {
  hero: {
    eyebrow: string;
    title: string;
    lede: string;
  };
  groups: HelpSectionGroup[];
  faq: HelpFaqItem[];
  contact: HelpContact;
}
