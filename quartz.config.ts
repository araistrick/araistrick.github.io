import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

const config: QuartzConfig = {
  configuration: {
    pageTitle: "Alexander Raistrick",
    pageTitleSuffix: " - Alexander Raistrick",
    enableSPA: false,
    enablePopovers: false,
    analytics: null,
    locale: "en-US",
    baseUrl: "araistrick.com",
    ignorePatterns: ["private", "templates", ".obsidian", "images"],
    defaultDateType: "published",
    theme: {
      fontOrigin: "local",
      cdnCaching: false,
      typography: {
        header: "serif",
        body: "serif",
        code: "monospace",
      },
      colors: {
        lightMode: {
          light: "#ffffff",
          lightgray: "#ffffff",
          gray: "#000000",
          darkgray: "#000000",
          dark: "#000000",
          secondary: "#000000",
          tertiary: "#000000",
          highlight: "transparent",
          textHighlight: "#ffffff",
        },
        darkMode: {
          light: "#ffffff",
          lightgray: "#ffffff",
          gray: "#000000",
          darkgray: "#000000",
          dark: "#000000",
          secondary: "#000000",
          tertiary: "#000000",
          highlight: "transparent",
          textHighlight: "#ffffff",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.Assets(),
      Plugin.NotFoundPage(),
    ],
  },
}

export default config
