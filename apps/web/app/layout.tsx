import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AuthTokenProvider } from "@/components/providers/auth-token-provider";
import { ConfirmProvider } from "@/components/providers/confirm-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AuraHire",
    template: "%s · AuraHire",
  },
  description: "Explainable + Fair AI-Powered Recruitment",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <AuthTokenProvider>
          <QueryProvider>
            <ConfirmProvider>
              {children}
              <Toaster position="top-right" richColors closeButton />
            </ConfirmProvider>
          </QueryProvider>
        </AuthTokenProvider>
      </body>
    </html>
  );
}
