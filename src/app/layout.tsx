import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { InstallPwaPrompt } from "@/components/pwa/install-prompt";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  applicationName: "SEV SINDSERM",
  title: "SEV SINDSERM — Sistema Eletrônico de Votação do SINDSERM",
  description:
    "SEV SINDSERM — Sistema Eletrônico de Votação do SINDSERM. Eleições de representantes de base.",
  manifest: "/manifest.webmanifest",
  // Favicon + ícone de instalação (iOS/Android) = public/icones/LOGO_SEV.png.
  icons: {
    icon: [{ url: "/icones/LOGO_SEV.png", type: "image/png" }],
    shortcut: [{ url: "/icones/LOGO_SEV.png" }],
    apple: [{ url: "/icones/LOGO_SEV.png" }],
  },
  appleWebApp: {
    capable: true,
    title: "SEV SINDSERM",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  // Comportamento de app nativo: impede o "zoom automático" do iOS Safari ao
  // focar campos (reforçado por fontes >= 16px nos inputs — ver globals.css).
  maximumScale: 1,
  userScalable: false,
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
        <RegisterServiceWorker />
        <InstallPwaPrompt />
      </body>
    </html>
  );
}
