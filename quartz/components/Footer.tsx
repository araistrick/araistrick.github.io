import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/footer.scss"

export default (() => {
  const Footer: QuartzComponent = ({ displayClass, fileData }: QuartzComponentProps) => {
    const updated = fileData.dates?.modified ?? new Date()
    const timestamp = updated.toISOString()
    const date = timestamp.slice(0, 10)
    return (
      <footer class={`${displayClass ?? ""}`}>
        <p>
          Last updated <time datetime={timestamp}>{date}</time> — Font from{" "}
          <a href="https://open-foundry.com/fonts/junicode">here</a>
        </p>
      </footer>
    )
  }

  Footer.css = style
  return Footer
}) satisfies QuartzComponentConstructor
