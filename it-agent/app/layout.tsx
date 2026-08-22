import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/ui/themes";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorBackground: "var(--bg-base)",
    colorInput: "var(--bg-surface)",
    colorInputForeground: "var(--text-primary)",
    colorForeground: "var(--text-primary)",
    colorMutedForeground: "var(--text-muted)",
    colorPrimary: "var(--accent-primary)",
    colorPrimaryForeground: "var(--primary-foreground)",
    colorNeutral: "var(--text-muted)",
    colorBorder: "var(--border-default)",
    colorDanger: "var(--state-error)",
    colorSuccess: "var(--state-success)",
    colorWarning: "var(--state-pending)",
    fontFamily: "var(--font-sans)",
    borderRadius: "var(--radius)",
  },
};

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Amex Service",
  description: "AI-powered customer service automation for card, dispute, and account servicing",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider appearance={clerkAppearance}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}