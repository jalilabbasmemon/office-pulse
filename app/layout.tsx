import type { Metadata, Viewport } from "next";
import { DM_Sans, Source_Serif_4 } from "next/font/google";
import { PublicEnvScript } from "@/components/providers/public-env-script";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OfficePulse · Attendance",
  description:
    "Mobile-first office attendance with GPS and network validation.",
  applicationName: "OfficePulse",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PublicEnvScript />
        {children}
      </body>
    </html>
  );
}
