import assert from "node:assert"
import fs from "node:fs"
import test, { describe } from "node:test"
import { Element, ElementContent, Root, RootContent } from "hast"
import { toHtml } from "hast-util-to-html"
import { authorLinks as authorPages } from "../../data/authorLinks"
import * as authorLinks from "./authorLinks"

function element(
  tagName: string,
  children: ElementContent[] = [],
  properties: Element["properties"] = {},
): Element {
  return { type: "element", tagName, properties, children }
}

function document(children: RootContent[]): Root {
  return { type: "root", children }
}

describe("author links", () => {
  test("maps every author listed in the website content", () => {
    const markdown = fs.readFileSync(
      new URL("../../../WebsiteContent/index.md", import.meta.url),
      "utf8",
    )
    const authorLines = markdown.split("\n").filter((line) => line.includes("[](#authors)"))
    assert(authorLines.length > 0, "expected marked author rows")
    const authors = authorLines.flatMap((line) => {
      const match = line.match(/\[\]\(#authors\)\s+_([^_]+)_/)
      assert(match, `invalid author row: ${line}`)
      const withoutNote = match[1].replace(/\s*\(\\?\*equal contribution[^)]*\)/, "")
      return withoutNote
        .replaceAll("\\*", "*")
        .split(/,\s*|\s+and\s+/)
        .map((name) => name.replace(/\*$/, ""))
    })

    for (const author of authors) {
      assert(authorPages[author], `missing author page for ${author}`)
    }
  })

  test("links explicitly marked author rows throughout the document", () => {
    const tree = document([
      element("p", [
        element("a", [], { href: "#authors" }),
        { type: "text", value: " " },
        element("em", [{ type: "text", value: "Alice Smith" }]),
        { type: "text", value: " — Released 2026-01-01, Preprint." },
      ]),
      element("ul", [
        element("li", [
          element("h3"),
          element("p", [
            element("a", [], { href: "#authors" }),
            { type: "text", value: " " },
            element("em", [
              { type: "text", value: "Alice Smith*, Bob Jones (*equal contribution)" },
            ]),
            { type: "text", value: " — Released 2025-01-01, Published at Example." },
          ]),
        ]),
      ]),
    ])

    authorLinks.linkAuthorNames(tree, {
      "Alice Smith": "https://example.com/alice",
      "Bob Jones": "https://example.com/bob",
    })

    const html = toHtml(tree)
    assert.strictEqual(html.match(/href="https:\/\/example.com\/alice"/g)?.length, 2)
    assert.strictEqual(html.match(/href="https:\/\/example.com\/bob"/g)?.length, 1)
    assert.doesNotMatch(html, /href="#authors"/)
    assert.match(html, /<\/em> — Released 2026-01-01, Preprint\.<\/p>/)
    assert.match(
      html,
      /<em><a href="https:\/\/example.com\/alice">Alice Smith<\/a>\*, <a href="https:\/\/example.com\/bob">Bob Jones<\/a> \(\*equal contribution\)<\/em>/,
    )
  })

  test("ignores unmarked italic text", () => {
    const tree = document([
      element("p", [element("em", [{ type: "text", value: "Alice Smith" }])]),
      element("p", [
        { type: "text", value: "Inline " },
        element("em", [{ type: "text", value: "Bob Jones" }]),
      ]),
    ])

    authorLinks.linkAuthorNames(tree, {
      "Alice Smith": "https://example.com/alice",
      "Bob Jones": "https://example.com/bob",
    })

    assert.doesNotMatch(toHtml(tree), /href="https:\/\/example.com/)
  })

  test("does not nest links or match names inside longer words", () => {
    const tree = document([
      element("p", [
        element("a", [], { href: "#authors" }),
        { type: "text", value: " " },
        element("em", [
          element("a", [{ type: "text", value: "Ann" }], { href: "https://old.example" }),
          { type: "text", value: ", Joanne, Ann" },
        ]),
      ]),
    ])

    authorLinks.linkAuthorNames(tree, { Ann: "https://new.example" })

    const html = toHtml(tree)
    assert.strictEqual(html.match(/<a /g)?.length, 2)
    assert.match(
      html,
      /<a href="https:\/\/old.example">Ann<\/a>, Joanne, <a href="https:\/\/new.example">Ann<\/a>/,
    )
  })

  test("runs after heading IDs and before link processing", () => {
    const source = fs.readFileSync(new URL("../../../quartz.config.ts", import.meta.url), "utf8")
    const gfm = source.indexOf("Plugin.GitHubFlavoredMarkdown(")
    const authors = source.indexOf("Plugin.AuthorLinks(")
    const links = source.indexOf("Plugin.CrawlLinks(")

    assert(gfm < authors, "expected AuthorLinks after GFM")
    assert(authors < links, "expected AuthorLinks before CrawlLinks")
  })
})
