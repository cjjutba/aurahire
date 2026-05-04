"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { createSupabaseBrowserClient } from "@/lib/auth/client";
import { SumIndicator } from "./_sum-indicator-client";
import { PreviewImpactModalClient } from "./_preview-impact-modal-client";

interface InitialConfig {
  id: string;
  matchWeights: {
    skills: number;
    experience: number;
    education: number;
    cultural_fit: number;
  };
  profileWeights: {
    resume_quality: number;
    skills_breadth: number;
    experience_depth: number;
    preferences_clarity: number;
  };
  bandThresholds: { strong: number; partial: number };
  biasCategoriesEnabled: string[];
  customFlaggedTerms: string[];
  piiRedactionEnabled: boolean;
  piiFieldsRedacted: string[];
}

interface Props {
  initial: InitialConfig;
}

const BIAS_CATEGORIES = [
  { value: "gendered", label: "Gendered" },
  { value: "age-coded", label: "Age-coded" },
  { value: "ableist", label: "Ableist" },
  { value: "exclusionary", label: "Exclusionary" },
] as const;

const REQUIRED_PII_FIELDS = ["name", "email", "phone", "address"];

export function ConfigEditorClient({ initial }: Props) {
  const router = useRouter();
  const [matchWeights, setMatchWeights] = useState(initial.matchWeights);
  const [profileWeights, setProfileWeights] = useState(initial.profileWeights);
  const [bandThresholds, setBandThresholds] = useState(initial.bandThresholds);
  const [biasCats, setBiasCats] = useState<string[]>(initial.biasCategoriesEnabled);
  const [customTermsText, setCustomTermsText] = useState(
    initial.customFlaggedTerms.join("\n"),
  );
  const [piiFields, setPiiFields] = useState<string[]>(initial.piiFieldsRedacted);
  const [piiAddInput, setPiiAddInput] = useState("");
  const [working, setWorking] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const matchSum = useMemo(
    () =>
      matchWeights.skills +
      matchWeights.experience +
      matchWeights.education +
      matchWeights.cultural_fit,
    [matchWeights],
  );
  const profileSum = useMemo(
    () =>
      profileWeights.resume_quality +
      profileWeights.skills_breadth +
      profileWeights.experience_depth +
      profileWeights.preferences_clarity,
    [profileWeights],
  );
  const bandValid =
    bandThresholds.strong > bandThresholds.partial &&
    bandThresholds.partial >= 0 &&
    bandThresholds.strong <= 100;
  const customTermsList = useMemo(
    () =>
      customTermsText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    [customTermsText],
  );
  const customTermsValid = customTermsList.length <= 50;

  const allValid =
    matchSum === 100 && profileSum === 100 && bandValid && customTermsValid;

  const dirty = useMemo(
    () =>
      JSON.stringify(matchWeights) !== JSON.stringify(initial.matchWeights) ||
      JSON.stringify(profileWeights) !== JSON.stringify(initial.profileWeights) ||
      JSON.stringify(bandThresholds) !== JSON.stringify(initial.bandThresholds) ||
      JSON.stringify([...biasCats].sort()) !==
        JSON.stringify([...initial.biasCategoriesEnabled].sort()) ||
      JSON.stringify(customTermsList) !==
        JSON.stringify(initial.customFlaggedTerms) ||
      JSON.stringify([...piiFields].sort()) !==
        JSON.stringify([...initial.piiFieldsRedacted].sort()),
    [
      matchWeights,
      profileWeights,
      bandThresholds,
      biasCats,
      customTermsList,
      piiFields,
      initial,
    ],
  );

  function setMatch<K extends keyof typeof matchWeights>(key: K, raw: string) {
    const n = Math.max(0, Math.min(100, Number(raw) || 0));
    setMatchWeights({ ...matchWeights, [key]: n });
  }
  function setProfile<K extends keyof typeof profileWeights>(key: K, raw: string) {
    const n = Math.max(0, Math.min(100, Number(raw) || 0));
    setProfileWeights({ ...profileWeights, [key]: n });
  }
  function setBand<K extends keyof typeof bandThresholds>(key: K, raw: string) {
    const n = Math.max(0, Math.min(100, Number(raw) || 0));
    setBandThresholds({ ...bandThresholds, [key]: n });
  }
  function toggleCategory(value: string) {
    setBiasCats((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }
  function addPiiField() {
    const trimmed = piiAddInput.trim();
    if (!trimmed) return;
    if (piiFields.includes(trimmed)) {
      setPiiAddInput("");
      return;
    }
    setPiiFields([...piiFields, trimmed]);
    setPiiAddInput("");
  }
  function removePiiField(field: string) {
    if (REQUIRED_PII_FIELDS.includes(field)) {
      toast.error(`'${field}' is required and cannot be removed`);
      return;
    }
    setPiiFields(piiFields.filter((f) => f !== field));
  }

  async function authedFetch(path: string, init?: RequestInit) {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not signed in");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
    return fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${session.access_token}`,
      },
    });
  }

  async function save() {
    if (!allValid) {
      toast.error("Fix validation errors before saving");
      return;
    }
    if (!dirty) {
      toast.error("No changes to save");
      return;
    }
    setWorking(true);
    try {
      const res = await authedFetch("/api/v1/admin/scoring-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchWeights,
          profileWeights,
          bandThresholds,
          biasCategoriesEnabled: biasCats,
          customFlaggedTerms: customTermsList,
          piiFieldsRedacted: piiFields,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        toast.error("Save failed", {
          description: body.message ?? `HTTP ${res.status}`,
        });
        return;
      }
      toast.success("Configuration saved");
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Match Weights */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">
            Match Score Weights
          </h2>
          <SumIndicator current={matchSum} target={100} />
        </header>
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          Determines how heavily each component counts toward the candidate-job
          match score. Must sum to 100.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["skills", "Skills Match"],
              ["experience", "Experience Match"],
              ["education", "Education Match"],
              ["cultural_fit", "Cultural Fit"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-semibold tracking-wider text-[var(--color-muted)] uppercase">
                {label}
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                value={matchWeights[key]}
                onChange={(e) => setMatch(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Profile Weights */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">
            Profile Score Weights
          </h2>
          <SumIndicator current={profileSum} target={100} />
        </header>
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          Determines how the candidate&rsquo;s standalone profile is scored at
          onboarding. Must sum to 100.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["resume_quality", "Resume Quality"],
              ["skills_breadth", "Skills Breadth"],
              ["experience_depth", "Experience Depth"],
              ["preferences_clarity", "Preferences Clarity"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-semibold tracking-wider text-[var(--color-muted)] uppercase">
                {label}
              </label>
              <Input
                type="number"
                min={0}
                max={100}
                value={profileWeights[key]}
                onChange={(e) => setProfile(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Band Thresholds */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <header className="mb-4">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">
            Score Band Thresholds
          </h2>
        </header>
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          Score → band classification. Strong must be greater than Partial.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold tracking-wider text-[var(--color-muted)] uppercase">
              Strong ≥
            </label>
            <Input
              type="number"
              min={1}
              max={100}
              value={bandThresholds.strong}
              onChange={(e) => setBand("strong", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold tracking-wider text-[var(--color-muted)] uppercase">
              Partial ≥
            </label>
            <Input
              type="number"
              min={0}
              max={99}
              value={bandThresholds.partial}
              onChange={(e) => setBand("partial", e.target.value)}
            />
          </div>
        </div>
        {bandValid ? (
          <p className="mt-3 font-mono text-xs text-[var(--color-body)]">
            Strong: {bandThresholds.strong}-100 · Partial: {bandThresholds.partial}-
            {bandThresholds.strong - 1} · Limited: 0-{bandThresholds.partial - 1}
          </p>
        ) : (
          <p className="mt-3 text-xs text-[var(--color-status-danger)]">
            Strong must be greater than Partial.
          </p>
        )}
      </section>

      {/* Bias Detection */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <header className="mb-4">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">
            Bias Detection
          </h2>
        </header>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wider text-[var(--color-muted)] uppercase">
              Active Categories
            </p>
            <div className="flex flex-wrap gap-3">
              {BIAS_CATEGORIES.map((c) => (
                <label key={c.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={biasCats.includes(c.value)}
                    onCheckedChange={() => toggleCategory(c.value)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold tracking-wider text-[var(--color-muted)] uppercase">
              Custom Flagged Terms ({customTermsList.length}/50, one per line)
            </label>
            <Textarea
              rows={5}
              value={customTermsText}
              onChange={(e) => setCustomTermsText(e.target.value)}
              placeholder={"guru\nninja\n..."}
            />
            {!customTermsValid && (
              <p className="mt-1 text-xs text-[var(--color-status-danger)]">
                Maximum 50 terms.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* PII Redaction */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-6">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">
            PII Redaction
          </h2>
          <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-score-high-soft)] px-3 py-1 text-xs font-semibold tracking-wider text-[var(--color-score-high)] uppercase">
            Locked ON
          </span>
        </header>
        <p className="mb-3 flex items-start gap-2 text-xs text-[var(--color-muted)]">
          <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <span>
            PII redaction is mandatory in this system and cannot be disabled —
            it&rsquo;s part of the thesis-defining fairness contract. You can ADD
            additional fields to redact but cannot remove the core required
            fields ({REQUIRED_PII_FIELDS.join(", ")}).
          </span>
        </p>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {piiFields.map((f) => {
              const required = REQUIRED_PII_FIELDS.includes(f);
              return (
                <span
                  key={f}
                  className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-3 py-1 text-xs font-medium ${
                    required
                      ? "bg-[var(--color-surface-strong)] text-[var(--color-muted)]"
                      : "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                  }`}
                >
                  {f}
                  {!required && (
                    <button
                      type="button"
                      onClick={() => removePiiField(f)}
                      className="rounded-full px-1 text-xs hover:bg-[var(--color-canvas)]"
                      aria-label={`Remove ${f}`}
                    >
                      ×
                    </button>
                  )}
                </span>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Input
              value={piiAddInput}
              onChange={(e) => setPiiAddInput(e.target.value)}
              placeholder="Add a field to redact (e.g. zip_code)"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPiiField();
                }
              }}
            />
            <Button
              onClick={addPiiField}
              variant="outline"
              className="rounded-[var(--radius-pill)]"
            >
              Add
            </Button>
          </div>
        </div>
      </section>

      {/* Action Bar */}
      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 py-4 sm:mx-0 sm:rounded-b-[var(--radius-lg)] sm:border-x">
        <Button
          onClick={() => setPreviewOpen(true)}
          disabled={!allValid || working}
          variant="outline"
          className="rounded-[var(--radius-pill)]"
        >
          Preview Impact
        </Button>
        <Button
          onClick={save}
          disabled={!allValid || !dirty || working}
          className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-active)]"
        >
          {working && <ButtonSpinner />}
          {working ? "Saving..." : "Save Configuration"}
        </Button>
      </div>

      <PreviewImpactModalClient
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        proposedConfig={{ matchWeights, bandThresholds }}
        onConfirmSave={async () => {
          setPreviewOpen(false);
          await save();
        }}
      />
    </div>
  );
}
