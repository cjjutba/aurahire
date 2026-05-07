import { buildInterviewIcs } from "./build-interview-ics";

const fixture = {
  interview: {
    id: "11111111-1111-1111-1111-111111111111",
    scheduledAt: new Date("2026-06-01T10:00:00Z"),
    durationMinutes: 90,
    venueName: "JRMSU Main Campus",
    addressLine: "Dapitan City, Zamboanga del Norte, PH",
    roomOrFloor: "ICT Building, Room 305",
    reportingInstructions: "Arrive 15 min early.",
    whatToBring: "1 valid ID, printed resume.",
    interviewerName: "Maria Santos",
    interviewerTitle: "Engineering Manager",
    mapUrl: "https://maps.google.com/?q=JRMSU",
  },
  candidate: { fullName: "Juan Dela Cruz", email: "juan@example.com" },
  job: { title: "Software Engineer" },
  company: { name: "Acme Corp", recruiterEmail: "recruiter@acme.example" },
};

describe("buildInterviewIcs", () => {
  it("contains stable UID and required RFC-5545 fields", () => {
    const ics = buildInterviewIcs(fixture);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("UID:interview-11111111-1111-1111-1111-111111111111@aurahire.app");
    expect(ics).toContain("DTSTART:20260601T100000Z");
    expect(ics).toContain("DTEND:20260601T113000Z");
    expect(ics).toContain("SUMMARY:Interview: Software Engineer at Acme Corp");
    expect(ics).toContain("LOCATION:JRMSU Main Campus\\, Dapitan City\\, Zamboanga del Norte\\, PH (ICT Building\\, Room 305)");
    expect(ics).toContain("ORGANIZER;CN=Acme Corp:mailto:recruiter@acme.example");
    expect(ics).toContain("ATTENDEE;CN=Juan Dela Cruz;RSVP=TRUE:mailto:juan@example.com");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("escapes ICS special chars in text fields (commas, semicolons, backslashes)", () => {
    const ics = buildInterviewIcs(fixture);
    // commas in venue/address must be escaped as \,
    expect(ics).toContain("Dapitan City\\, Zamboanga");
  });

  it("folds long DESCRIPTION lines per RFC-5545 (continuation lines start with single space)", () => {
    const longInterview = {
      ...fixture.interview,
      reportingInstructions: "x".repeat(200),
    };
    const ics = buildInterviewIcs({ ...fixture, interview: longInterview });
    const lines = ics.split("\r\n");
    // At least one continuation line that starts with a single space
    const hasContinuation = lines.some((l) => l.startsWith(" "));
    expect(hasContinuation).toBe(true);
  });

  it("uses an alias UID when rescheduledFromId is provided (calendar update, not duplicate)", () => {
    const aliased = buildInterviewIcs({
      ...fixture,
      interview: {
        ...fixture.interview,
        id: "22222222-2222-2222-2222-222222222222",
        rescheduledFromId: "11111111-1111-1111-1111-111111111111",
      },
    });
    expect(aliased).toContain("UID:interview-11111111-1111-1111-1111-111111111111@aurahire.app");
    expect(aliased).not.toContain("UID:interview-22222222-2222-2222-2222-222222222222");
  });
});
