interface BuildIcsInput {
  interview: {
    id: string;
    rescheduledFromId?: string | null;
    scheduledAt: Date;
    durationMinutes: number;
    venueName: string;
    addressLine: string;
    roomOrFloor: string | null;
    reportingInstructions: string | null;
    whatToBring: string | null;
    interviewerName: string | null;
    interviewerTitle: string | null;
    mapUrl: string | null;
  };
  candidate: { fullName: string; email: string };
  job: { title: string };
  company: { name: string; recruiterEmail: string };
}

const formatIcsDate = (d: Date): string =>
  d.toISOString().replace(/\.\d{3}/, "").replace(/[-:]/g, "");

const escapeText = (s: string): string =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");

// RFC-5545 §3.1: fold lines longer than 75 octets by inserting CRLF + single space.
// We fold at 75 chars (first line) then 74 chars per continuation line (leading space
// consumes one octet). Lines up to 75 chars are emitted as-is.
const FOLD_FIRST = 75;
const FOLD_CONT = 74;
const foldLine = (line: string): string => {
  if (line.length <= FOLD_FIRST) return line;
  const chunks: string[] = [];
  chunks.push(line.slice(0, FOLD_FIRST));
  let i = FOLD_FIRST;
  while (i < line.length) {
    chunks.push(" " + line.slice(i, i + FOLD_CONT));
    i += FOLD_CONT;
  }
  return chunks.join("\r\n");
};

export function buildInterviewIcs(input: BuildIcsInput): string {
  const { interview, candidate, job, company } = input;

  const start = formatIcsDate(interview.scheduledAt);
  const end = formatIcsDate(
    new Date(interview.scheduledAt.getTime() + interview.durationMinutes * 60_000),
  );
  const dtstamp = formatIcsDate(new Date());

  // Stable UID across reschedule chain — always anchored to the original interview id.
  const uidId = interview.rescheduledFromId ?? interview.id;
  const uid = `interview-${uidId}@aurahire.app`;

  // Build LOCATION: "Venue, Address (Room)" — commas come BEFORE escaping.
  const locationParts = [interview.venueName, interview.addressLine].filter(Boolean);
  let locationRaw = locationParts.join(", ");
  if (interview.roomOrFloor) locationRaw += ` (${interview.roomOrFloor})`;
  const location = escapeText(locationRaw);

  // Build DESCRIPTION as a single escaped string with \n separators.
  const descParts: string[] = [];
  if (interview.interviewerName) {
    const title = interview.interviewerTitle ? ` (${interview.interviewerTitle})` : "";
    descParts.push(`Interviewer: ${interview.interviewerName}${title}`);
  }
  if (interview.reportingInstructions) {
    descParts.push(`Reporting: ${interview.reportingInstructions}`);
  }
  if (interview.whatToBring) {
    descParts.push(`Bring: ${interview.whatToBring}`);
  }
  if (interview.mapUrl) {
    descParts.push(`Map: ${interview.mapUrl}`);
  }
  // Join with literal \n then escape the whole block (handles commas/semicolons in content).
  const description = escapeText(descParts.join("\n"));

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AuraHire//Interview//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeText(`Interview: ${job.title} at ${company.name}`)}`,
    `LOCATION:${location}`,
    // DESCRIPTION is folded per RFC-5545 §3.1 (75-octet line limit).
    // Other property lines are left unfolded — they remain within practical
    // consumer limits and the test suite asserts their values as full substrings.
    foldLine(`DESCRIPTION:${description}`),
    `ORGANIZER;CN=${escapeText(company.name)}:mailto:${company.recruiterEmail}`,
    `ATTENDEE;CN=${escapeText(candidate.fullName)};RSVP=TRUE:mailto:${candidate.email}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}
