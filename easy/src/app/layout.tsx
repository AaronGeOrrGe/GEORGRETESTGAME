import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/service-worker";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
export const metadata: Metadata = {
  title: { default: "Easy", template: "%s · Easy" },
  description: "Academic resources made easy.",
  manifest: "/manifest.json",
  icons: { icon: "/icon-192.svg", apple: "/icon-192.svg" },
};
export const viewport: Viewport = { themeColor: "#2457e6" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={geist.variable}>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
