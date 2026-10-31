import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-serif", display: "swap" });
const body = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "سوا كوفي هاوس | المنيو",
  description: "منيو سوا كوفي هاوس: قهوة ساخنة ومثلجة، ماتشا، سموزي، مخبوزات وديزرت. اطلبوا سوا من الموبايل.",
  icons: { icon: "/icon.png", apple: "/icon.png" },
  openGraph: { title: "سوا كوفي هاوس", description: "قهوة تتشرب سوا", images: ["/img/og.jpg"] },
};

export const viewport: Viewport = { themeColor: "#100b08", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${serif.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
