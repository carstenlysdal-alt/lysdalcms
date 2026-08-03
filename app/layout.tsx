import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

// Modernist uses Archivo for both headings and body (weights 400/600/800).
// We bind the next/font variable to the design-system's --font-body / --font-heading.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lysdals CMS",
  description: "Generisk, AI-understøttet redaktionelt CMS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da" className={`${archivo.variable} h-full antialiased`}>
      <body
        className="min-h-full flex flex-col"
        style={{
          // Bind next/font into the Modernist token names.
          ["--font-body" as string]: "var(--font-archivo), system-ui, sans-serif",
          ["--font-heading" as string]: "var(--font-archivo), system-ui, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
