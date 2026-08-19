import { Element, ElementContent, Root, RootContent, Text } from "hast"
import { QuartzTransformerPlugin } from "../types"

export interface Options {
  authors: Readonly<Record<string, string>>
}

function isElement(node: RootContent | ElementContent, tagName?: string): node is Element {
  if (node.type !== "element") {
    return false
  }

  return tagName === undefined || node.tagName === tagName
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function authorMatcher(authors: Readonly<Record<string, string>>): RegExp | undefined {
  const names = Object.keys(authors).sort((left, right) => right.length - left.length)
  if (names.length === 0) {
    return undefined
  }

  const alternatives = names.map(escapeRegex).join("|")
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, "gu")
}

function linkedText(
  text: Text,
  matcher: RegExp,
  authors: Readonly<Record<string, string>>,
): ElementContent[] {
  const children: ElementContent[] = []
  let cursor = 0

  for (const match of text.value.matchAll(matcher)) {
    const index = match.index
    if (index > cursor) {
      children.push({ type: "text", value: text.value.slice(cursor, index) })
    }

    const name = match[0]
    children.push({
      type: "element",
      tagName: "a",
      properties: { href: authors[name] },
      children: [{ type: "text", value: name }],
    })
    cursor = index + name.length
  }

  if (cursor < text.value.length) {
    children.push({ type: "text", value: text.value.slice(cursor) })
  }

  return children
}

function linkChildren(
  children: ElementContent[],
  matcher: RegExp,
  authors: Readonly<Record<string, string>>,
): ElementContent[] {
  return children.flatMap((child) => {
    if (child.type === "text") {
      return linkedText(child, matcher, authors)
    }

    if (!isElement(child) || child.tagName === "a") {
      return child
    }

    child.children = linkChildren(child.children, matcher, authors)
    return child
  })
}

function authorEmphasis(node: RootContent): Element | undefined {
  if (!isElement(node, "p") || node.children.length !== 1) {
    return undefined
  }

  const child = node.children[0]
  return isElement(child, "em") ? child : undefined
}

function linkAuthorLines(
  node: Root | Element,
  matcher: RegExp,
  authors: Readonly<Record<string, string>>,
): void {
  for (const child of node.children) {
    const emphasis = authorEmphasis(child)
    if (emphasis !== undefined) {
      emphasis.children = linkChildren(emphasis.children, matcher, authors)
      continue
    }

    if (isElement(child)) {
      linkAuthorLines(child, matcher, authors)
    }
  }
}

export function linkAuthorNames(tree: Root, authors: Readonly<Record<string, string>>): void {
  const matcher = authorMatcher(authors)
  if (matcher === undefined) {
    return
  }

  linkAuthorLines(tree, matcher, authors)
}

export const AuthorLinks: QuartzTransformerPlugin<Options> = (options) => {
  const authors = options?.authors ?? {}
  return {
    name: "AuthorLinks",
    htmlPlugins() {
      return [() => (tree: Root) => linkAuthorNames(tree, authors)]
    },
  }
}
