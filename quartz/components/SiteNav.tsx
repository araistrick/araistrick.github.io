import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, pathToRoot, resolveRelative } from "../util/path"

const links = [
  { label: "Research", slug: "research" },
  { label: "Projects", slug: "projects" },
  { label: "Teaching", slug: "teaching" },
  { label: "About", slug: "about" },
] as const

const SiteNav: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const currentSlug = fileData.slug ?? ("index" as FullSlug)
  const currentSection = currentSlug.split("/")[0]

  return (
    <nav class="site-nav" aria-label="Primary navigation">
      <a class="site-mark" href={pathToRoot(currentSlug)} aria-label="Alexander Raistrick home">
        <span class="site-monogram" aria-hidden="true">
          AR
        </span>
        <span class="site-name">Alexander Raistrick</span>
      </a>
      <div class="site-links">
        {links.map(({ label, slug }) => (
          <a
            href={resolveRelative(currentSlug, slug as FullSlug)}
            aria-current={currentSection === slug ? "page" : undefined}
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  )
}

export default (() => SiteNav) satisfies QuartzComponentConstructor
