"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WORK_MODES = ["remote", "hybrid", "on-site"] as const;
const EXPERIENCE_LEVELS = [
  "entry",
  "junior",
  "mid",
  "senior",
  "lead",
  "principal",
  "manager",
] as const;

export function JobFilters() {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`?${next.toString()}`);
  }

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Input
        placeholder="Search title or description..."
        defaultValue={params.get("q") ?? ""}
        onBlur={(e) => setParam("q", e.target.value || null)}
        className="md:col-span-2"
      />
      <Select
        value={params.get("mode") ?? "all"}
        onValueChange={(v) => setParam("mode", v === "all" ? null : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Mode" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Modes</SelectItem>
          {WORK_MODES.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={params.get("experienceLevel") ?? "all"}
        onValueChange={(v) =>
          setParam("experienceLevel", v === "all" ? null : v)
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Experience" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Levels</SelectItem>
          {EXPERIENCE_LEVELS.map((l) => (
            <SelectItem key={l} value={l}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
