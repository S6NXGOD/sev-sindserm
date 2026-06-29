import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SEV SINDSERM — Sistema Eletrônico de Votação do SINDSERM",
  description:
    "SEV SINDSERM — Sistema Eletrônico de Votação do SINDSERM. Eleições de representantes de base.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
