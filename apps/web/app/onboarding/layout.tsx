import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { BrandWordmark } from "@/components/brand/brand-wordmark";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = (await getCurrentProfile()) as
    | { id: string; role: string; profileCompleted: boolean }
    | null;

  if (!profile) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-surface-soft)]">
      <header className="flex items-center justify-center px-6 py-6">
        <Link href="/" aria-label="AuraHire home">
          <BrandWordmark size="md" />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12">
        {children}
      </main>
    </div>
  );
}
