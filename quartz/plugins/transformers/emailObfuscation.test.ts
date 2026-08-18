import assert from "node:assert"
import fs from "node:fs"
import test, { describe } from "node:test"
import { Element, ElementContent, Root, RootContent } from "hast"
import { toHtml } from "hast-util-to-html"
import * as emailObfuscation from "./emailObfuscation"

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

function decode(value: string): string {
  const base64 = [...value].filter((_, index) => index % 4 === 0).join("")
  return Buffer.from(base64, "base64").toString("utf8")
}

function runtimeElement(attributes: Record<string, string>) {
  const values = new Map(Object.entries(attributes))
  return {
    textContent: "Email",
    getAttribute: (name: string) => values.get(name) ?? null,
    setAttribute: (name: string, value: string) => values.set(name, value),
    removeAttribute: (name: string) => values.delete(name),
  }
}

describe("email obfuscation", () => {
  test("removes mailto targets and visible email addresses from HTML", () => {
    const mailto = element("a", [{ type: "text", value: "Write Alice" }], {
      href: "mailto:alice@example.com?subject=Hello",
    })
    const tree = document([
      element("p", [mailto, { type: "text", value: " or bob.smith+lab@example.org for help." }]),
    ])

    emailObfuscation.obfuscateEmailAddresses(tree)

    const html = toHtml(tree)
    assert(!html.includes("alice@example.com"))
    assert(!html.includes("bob.smith+lab@example.org"))
    assert(!html.includes("mailto:"))
    assert.strictEqual(
      decode(String(mailto.properties["data-email-obfuscated"])),
      "mailto:alice@example.com?subject=Hello",
    )

    const paragraph = tree.children[0] as Element
    const visibleEmail = paragraph.children[2] as Element
    assert.strictEqual(visibleEmail.tagName, "a")
    assert.strictEqual(
      decode(String(visibleEmail.properties["data-email-obfuscated"])),
      "mailto:bob.smith+lab@example.org",
    )
    assert.strictEqual(
      decode(String(visibleEmail.properties["data-email-text"])),
      "bob.smith+lab@example.org",
    )
  })

  test("obfuscates linked address labels without nesting anchors", () => {
    const tree = document([
      element("a", [{ type: "text", value: "alice@example.com" }], {
        href: "MAILTO:alice@example.com",
      }),
    ])

    emailObfuscation.obfuscateEmailAddresses(tree)

    const html = toHtml(tree)
    assert.strictEqual(html.match(/<a(?: |\>)/g)?.length, 1)
    assert.match(html, /<span data-email-text="[^"]+">Email<\/span>/)
    assert(!html.includes("alice@example.com"))
  })

  test("preserves ordinary text and links", () => {
    const tree = document([
      element("p", [
        { type: "text", value: "Use @mentions or visit " },
        element("a", [{ type: "text", value: "example.com" }], {
          href: "https://example.com",
        }),
      ]),
    ])
    const before = toHtml(tree)

    emailObfuscation.obfuscateEmailAddresses(tree)

    assert.strictEqual(toHtml(tree), before)
  })

  test("reconstructs links and visible addresses in the browser", () => {
    const tree = document([
      element("a", [{ type: "text", value: "alice@example.com" }], {
        href: "mailto:alice@example.com",
      }),
    ])
    emailObfuscation.obfuscateEmailAddresses(tree)
    const anchor = tree.children[0] as Element
    const text = anchor.children[0] as Element
    const linkElement = runtimeElement({
      "data-email-obfuscated": String(anchor.properties["data-email-obfuscated"]),
    })
    const textElement = runtimeElement({
      "data-email-text": String(text.properties["data-email-text"]),
    })
    const browserDocument = {
      querySelectorAll: (selector: string) =>
        selector === "[data-email-obfuscated]" ? [linkElement] : [textElement],
      addEventListener: () => undefined,
    }
    const run = new Function(
      "document",
      "atob",
      "TextDecoder",
      emailObfuscation.emailObfuscationScript,
    )

    run(browserDocument, atob, TextDecoder)

    assert.strictEqual(linkElement.getAttribute("href"), "mailto:alice@example.com")
    assert.strictEqual(textElement.textContent, "alice@example.com")
  })

  test("runs after link processing and before descriptions", () => {
    const source = fs.readFileSync(new URL("../../../quartz.config.ts", import.meta.url), "utf8")
    const links = source.indexOf("Plugin.CrawlLinks(")
    const email = source.indexOf("Plugin.EmailObfuscation(")
    const description = source.indexOf("Plugin.Description(")

    assert(links < email, "expected EmailObfuscation after CrawlLinks")
    assert(email < description, "expected EmailObfuscation before Description")
  })
})
