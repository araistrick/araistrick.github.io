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

function obfuscatedEmail(email: string): Element {
  return {
    type: "element",
    tagName: "span",
    properties: { "data-email-text": encode(email) },
    children: [{ type: "text", value: "Email" }],
  }
}

function obfuscateText(text: Text): ElementContent[] {
  const children: ElementContent[] = []
  let cursor = 0

  for (const match of text.value.matchAll(emailPattern)) {
    const index = match.index
    if (index > cursor) {
      children.push({ type: "text", value: text.value.slice(cursor, index) })
    }

    const email = match[0]
    children.push(obfuscatedEmail(email))
    cursor = index + email.length
  }

  if (cursor < text.value.length) {
    children.push({ type: "text", value: text.value.slice(cursor) })
  }

  return children.length === 0 ? [text] : children
}

function obfuscateElement(element: Element): void {
  const href = element.properties.href
  if (
    element.tagName === "a" &&
    typeof href === "string" &&
    href.toLowerCase().startsWith("mailto:")
  ) {
    const email = href.slice(7).split("?", 1)[0]
    element.tagName = "span"
    element.properties = { "data-email-text": encode(email) }
    element.children = [{ type: "text", value: "Email" }]
    return
  }

  element.children = element.children.flatMap((child) => {
    if (child.type === "text") {
      return obfuscateText(child)
    }

    if (isElement(child)) {
      obfuscateElement(child)
    }

    return child
  })
}

export function obfuscateEmailAddresses(tree: Root): void {
  const children: RootContent[] = []
  for (const child of tree.children) {
    if (child.type === "text") {
      children.push(...obfuscateText(child))
      continue
    }

    if (isElement(child)) {
      obfuscateElement(child)
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
