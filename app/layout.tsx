import type { Metadata, Viewport } from "next";
import "@fontsource-variable/geist";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import { Toaster } from "sonner";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s | ${brand.shortName}` },
  description: brand.tagline,
};

export const viewport: Viewport = {
  themeColor: "#15161a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className="h-full">
      <body className="min-h-full">
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--panel-2)",
              border: "1px solid var(--line-strong)",
              color: "var(--fg)",
            },
          }}
        />
      </body>
    </html>
  );
}
