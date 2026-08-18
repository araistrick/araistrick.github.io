import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

const config: QuartzConfig = {
  configuration: {
    pageTitle: "Alexander Raistrick",
    pageTitleSuffix: " · Alexander Raistrick",
    enableSPA: true,
    enablePopovers: true,
    analytics: {
      provider: "google",
      tagId: "G-3NSVCNJD90",
    },
    locale: "en-US",
    baseUrl: "araistrick.com",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "published",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Space Grotesk",
        body: "Inter",
        code: "IBM Plex Mono",
      },
      colors: {
        lightMode: {
          light: "#f4f1ea",
          lightgray: "#d8d6cf",
          gray: "#8b8d8f",
          darkgray: "#27323a",
          dark: "#101820",
          secondary: "#0d6575",
          tertiary: "#d95d43",
          highlight: "rgba(13, 101, 117, 0.12)",
          textHighlight: "#f4c95d80",
        },
        darkMode: {
          light: "#0e151b",
          lightgray: "#29343d",
          gray: "#78838b",
          darkgray: "#cbd3d8",
          dark: "#f4f1ea",
          secondary: "#74c8d4",
          tertiary: "#ff8d73",
          highlight: "rgba(116, 200, 212, 0.14)",
          textHighlight: "#f4c95d55",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
    ],
  },
}

export default config
