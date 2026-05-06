import { redirect } from "next/navigation";

/**
 * /recruiter/settings -> /recruiter/settings/profile.
 *
 * The new shell is sub-route driven; the bare /settings path is a
 * permanent redirect to the first item in the rail. We keep this rather
 * than rendering Profile inline at the index so deep-linking is honest:
 * the URL bar always reflects which section you're on.
 */
export default function RecruiterSettingsIndex() {
  redirect("/recruiter/settings/profile");
}
