import { Element, ElementContent, Root, RootContent, Text } from "hast"
import { QuartzTransformerPlugin } from "../types"

const emailPattern =
  /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+/giu
const cover = "analytics"

export const emailObfuscationScript = `
const decodeEmailValue = (value) => {
  const base64 = [...value].filter((_, index) => index % 4 === 0).join("")
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

const revealEmails = () => {
  for (const element of document.querySelectorAll("[data-email-obfuscated]")) {
    const value = element.getAttribute("data-email-obfuscated")
    if (value === null) continue
    element.setAttribute("href", decodeEmailValue(value))
    element.removeAttribute("data-email-obfuscated")
  }

  for (const element of document.querySelectorAll("[data-email-text]")) {
    const value = element.getAttribute("data-email-text")
    if (value === null) continue
    element.textContent = decodeEmailValue(value)
    element.removeAttribute("data-email-text")
  }
}

document.addEventListener("nav", revealEmails)
revealEmails()
`

function isElement(node: RootContent | ElementContent): node is Element {
  return node.type === "element"
}

function encode(value: string): string {
  const base64 = Buffer.from(value, "utf8").toString("base64")
  return [...base64]
    .map((character, index) => {
      const first = cover[index % cover.length]
      const second = cover[(index * 3 + 1) % cover.length]
      const third = cover[(index * 5 + 2) % cover.length]
      return `${character}${first}${second}${third}`
    })
    .join("")
}

function obfuscatedEmail(email: string, insideLink: boolean): Element {
  const properties: Element["properties"] = {
    "data-email-text": encode(email),
  }

  if (!insideLink) {
    properties["data-email-obfuscated"] = encode(`mailto:${email}`)
  }

  return {
    type: "element",
    tagName: insideLink ? "span" : "a",
    properties,
    children: [{ type: "text", value: "Email" }],
  }
}

function obfuscateText(text: Text, insideLink: boolean): ElementContent[] {
  const children: ElementContent[] = []
  let cursor = 0

  for (const match of text.value.matchAll(emailPattern)) {
    const index = match.index
    if (index > cursor) {
      children.push({ type: "text", value: text.value.slice(cursor, index) })
    }

    const email = match[0]
    children.push(obfuscatedEmail(email, insideLink))
    cursor = index + email.length
  }

  if (cursor < text.value.length) {
    children.push({ type: "text", value: text.value.slice(cursor) })
  }

  return children.length === 0 ? [text] : children
}

function obfuscateElement(element: Element, insideLink: boolean): void {
  const isLink = element.tagName === "a"
  const href = element.properties.href
  if (isLink && typeof href === "string" && href.toLowerCase().startsWith("mailto:")) {
    element.properties["data-email-obfuscated"] = encode(href)
    delete element.properties.href
  }

  element.children = element.children.flatMap((child) => {
    if (child.type === "text") {
      return obfuscateText(child, insideLink || isLink)
    }

    if (isElement(child)) {
      obfuscateElement(child, insideLink || isLink)
    }

    return child
  })
}

export function obfuscateEmailAddresses(tree: Root): void {
  const children: RootContent[] = []
  for (const child of tree.children) {
    if (child.type === "text") {
      children.push(...obfuscateText(child, false))
      continue
    }

    if (isElement(child)) {
      obfuscateElement(child, false)
    }

    children.push(child)
  }

  tree.children = children
}

export const EmailObfuscation: QuartzTransformerPlugin = () => {
  return {
    name: "EmailObfuscation",
    htmlPlugins() {
      return [() => (tree: Root) => obfuscateEmailAddresses(tree)]
    },
    externalResources() {
      return {
        js: [
          {
            script: emailObfuscationScript,
            loadTime: "afterDOMReady",
            contentType: "inline",
          },
        ],
      }
    },
  }
}
