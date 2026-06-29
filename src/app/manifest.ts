import type { MetadataRoute } from "next";

/**
 * Web App Manifest (PWA) do SEV SINDSERM. Gerado em /manifest.webmanifest.
 * O ícone é o public/icones/LOGO_SEV.png (512x512). O mesmo arquivo cobre os
 * tamanhos 192 e 512 — o navegador reduz quando necessário.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SEV SINDSERM — Sistema Eletrônico de Votação",
    short_name: "SEV SINDSERM",
    description:
      "Sistema Eletrônico de Votação do SINDSERM — eleições de representantes de base.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/icones/LOGO_SEV.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icones/LOGO_SEV.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
