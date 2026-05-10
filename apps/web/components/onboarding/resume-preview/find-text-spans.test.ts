import { describe, it, expect } from "vitest";
import { findTextSpans, type TextLayerItem } from "./find-text-spans";

const items: TextLayerItem[] = [
  { str: "Christian", x: 10, y: 100, width: 50, height: 12 },
  { str: " ", x: 60, y: 100, width: 4, height: 12 },
  { str: "Jutba", x: 64, y: 100, width: 30, height: 12 },
  { str: "0976-455-6948", x: 10, y: 80, width: 80, height: 12 },
  { str: "Senior Software Engineer", x: 10, y: 60, width: 140, height: 12 },
];

describe("findTextSpans", () => {
  it("finds a verbatim match", () => {
    const r = findTextSpans(items, "Christian Jutba");
    expect(r).not.toBeNull();
    expect(r!.length).toBeGreaterThanOrEqual(1);
  });
  it("is case-insensitive", () => {
    expect(findTextSpans(items, "christian jutba")).not.toBeNull();
  });
  it("is whitespace-tolerant", () => {
    expect(findTextSpans(items, "Christian   Jutba")).not.toBeNull();
  });
  it("returns null when not found", () => {
    expect(findTextSpans(items, "Nonexistent string")).toBeNull();
  });
  it("matches normalized phone formats (punctuation strip)", () => {
    expect(findTextSpans(items, "09764556948")).not.toBeNull();
  });
  it("returns multiple rects for multi-line matches", () => {
    const multi: TextLayerItem[] = [
      { str: "Senior", x: 10, y: 100, width: 30, height: 12 },
      { str: "Software", x: 10, y: 86, width: 50, height: 12 },
      { str: "Engineer", x: 10, y: 72, width: 50, height: 12 },
    ];
    const rects = findTextSpans(multi, "Senior Software Engineer");
    expect(rects).not.toBeNull();
    expect(rects!.length).toBeGreaterThanOrEqual(1);
  });
});
