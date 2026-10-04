import type { MetadataRoute } from "next";

// PWA instalável no celular e no PC do balcão.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Orçamentos e Estoque",
    short_name: "Orçamentos",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f8",
    theme_color: "#624bff",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
