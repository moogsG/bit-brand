/**
 * Theme configuration for BIT Brand Anarchy portal.
 * Replace these values when branding assets are provided.
 * All values map to CSS custom properties in globals.css.
 */
export const themeConfig = {
  brand: {
    name: "BIT Brand Anarchy",
    shortName: "BBA",
    tagline: "SEO Intelligence Portal",
  },
  colors: {
    // Override these with BIT Brand Anarchy brand colors
    primary: "222.2 47.4% 11.2%",
    primaryForeground: "210 40% 98%",
    accent: "210 40% 96.1%",
    accentForeground: "222.2 47.4% 11.2%",
  },
} as const;

export type ThemeConfig = typeof themeConfig;
