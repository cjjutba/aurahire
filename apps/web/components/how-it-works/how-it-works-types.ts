import type { ComponentType } from "react";
import type { HelpBlock } from "../help/help-types";

export interface HowItWorksJourneyStep {
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  /** Section id to scroll to when clicked. Omit to render as non-interactive. */
  targetId?: string;
}

export interface HowItWorksSection {
  id: string;
  icon: ComponentType<{ className?: string }>;
  kicker?: string;
  title: string;
  lede?: string;
  blocks: HelpBlock[];
}

export interface HowItWorksSectionGroup {
  label: string;
  sections: HowItWorksSection[];
}

export interface HowItWorksContact {
  title: string;
  body: string;
  email: string;
  secondaryLink?: { label: string; href: string };
}

export interface HowItWorksContent {
  hero: {
    eyebrow: string;
    title: string;
    lede: string;
  };
  journey: {
    title: string;
    steps: HowItWorksJourneyStep[];
  };
  groups: HowItWorksSectionGroup[];
  contact: HowItWorksContact;
}
