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
  test("maps every author listed in the Vault", () => {
    const markdown = fs.readFileSync(new URL("../../../Vault/index.md", import.meta.url), "utf8")
    const allPapers = markdown.slice(markdown.indexOf("### All Papers"))
    const authorLines = allPapers.split("\n").filter((line) => /^_.*_$/.test(line))
    const authors = authorLines.flatMap((line) => {
      const withoutNote = line.replace(/\s*\(\\?\*equal contribution[^)]*\)/, "")
      return withoutNote
        .slice(1, -1)
        .replaceAll("\\*", "*")
        .split(/,\s*|\s+and\s+/)
        .map((name) => name.replace(/\*$/, ""))
    })

    for (const author of authors) {
      assert(authorPages[author], `missing author page for ${author}`)
    }
  })

  test("links exact names only in All Papers author lines", () => {
    const tree = document([
      element("p", [element("em", [{ type: "text", value: "Alice Smith" }])]),
      element("h3", [], { id: "all-papers" }),
      element("h4"),
      element("p", [{ type: "text", value: "paper links" }]),
      element("p", [
        element("em", [{ type: "text", value: "Alice Smith*, Bob Jones (*equal contribution)" }]),
      ]),
      element("h3", [], { id: "next-section" }),
      element("p", [element("em", [{ type: "text", value: "Bob Jones" }])]),
    ])

    authorLinks.linkAuthorNames(tree, {
      "Alice Smith": "https://example.com/alice",
      "Bob Jones": "https://example.com/bob",
    })

    const html = toHtml(tree)
    assert.strictEqual(html.match(/href="https:\/\/example.com\/alice"/g)?.length, 1)
    assert.strictEqual(html.match(/href="https:\/\/example.com\/bob"/g)?.length, 1)
    assert.match(
      html,
      /<em><a href="https:\/\/example.com\/alice">Alice Smith<\/a>\*, <a href="https:\/\/example.com\/bob">Bob Jones<\/a> \(\*equal contribution\)<\/em>/,
    )
  })

  test("does not nest links or match names inside longer words", () => {
    const tree = document([
      element("h3", [], { id: "all-papers" }),
      element("h4"),
      element("p", [{ type: "text", value: "paper links" }]),
      element("p", [
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
