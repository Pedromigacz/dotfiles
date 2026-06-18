/**
 * Web Fetch Extension
 *
 * Registers a `web_fetch` tool the LLM can call to retrieve a URL and read its
 * contents. HTML responses are reduced to readable plain text; JSON and other
 * text responses are returned as-is. Output is truncated to keep context small.
 *
 * Dependency-free: uses the global `fetch` (undici-backed in Node) and a small
 * built-in HTML-to-text converter.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const DEFAULT_MAX_LENGTH = 50_000;
const REQUEST_TIMEOUT_MS = 30_000;

const WEB_FETCH_PARAMS = Type.Object({
  url: Type.String({
    description: "Absolute http(s) URL to fetch.",
  }),
  max_length: Type.Optional(
    Type.Integer({
      minimum: 1,
      description: `Maximum characters of body text to return (default ${DEFAULT_MAX_LENGTH}).`,
    }),
  ),
  raw: Type.Optional(
    Type.Boolean({
      description:
        "Return the raw response body without HTML-to-text conversion (default false).",
    }),
  ),
});

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: "©",
  reg: "®",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g,
    (match, body: string) => {
      if (body[0] === "#") {
        const codePoint =
          body[1] === "x" || body[1] === "X"
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10);
        if (Number.isFinite(codePoint)) {
          try {
            return String.fromCodePoint(codePoint);
          } catch {
            return match;
          }
        }
        return match;
      }
      return NAMED_ENTITIES[body.toLowerCase()] ?? match;
    },
  );
}

function htmlToText(html: string): string {
  let text = html;
  // Drop non-content elements wholesale.
  text = text.replace(
    /<(script|style|noscript|template|svg|head)\b[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  // Turn anchors into "text (href)" markdown-ish form.
  text = text.replace(
    /<a\b[^>]*?href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, inner: string) => {
      const label = inner.replace(/<[^>]+>/g, "").trim();
      if (!href || href.startsWith("javascript:")) return label;
      return label ? `${label} (${href})` : href;
    },
  );
  // Block-level tags become line breaks.
  text = text.replace(
    /<\/(p|div|section|article|header|footer|li|tr|h[1-6]|blockquote)>/gi,
    "\n",
  );
  text = text.replace(/<(br|hr)\s*\/?>/gi, "\n");
  text = text.replace(/<li\b[^>]*>/gi, "\n- ");
  // Strip remaining tags.
  text = text.replace(/<[^>]+>/g, "");
  text = decodeEntities(text);
  // Collapse excess whitespace.
  text = text.replace(/[ \t\f\v]+/g, " ");
  text = text.replace(/ *\n */g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

export default function webFetchExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_fetch",
    label: "Web Fetch",
    description:
      "Fetch the contents of an http(s) URL. HTML pages are converted to readable text; " +
      "JSON and plain-text responses are returned as-is. Output is truncated to a character limit.",
    promptSnippet: "Fetch a URL and read its page contents",
    promptGuidelines: [
      "Use web_fetch when the user shares a URL or asks you to read a web page or online resource.",
      "web_fetch only accepts absolute http(s) URLs; resolve relative links before calling it.",
    ],
    parameters: WEB_FETCH_PARAMS,
    // Thrown errors are surfaced to the agent as tool errors (isError=true).
    async execute(_toolCallId, params, signal, onUpdate) {
      const { url } = params;
      const maxLength = params.max_length ?? DEFAULT_MAX_LENGTH;

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error(`Invalid URL: ${url}`);
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error(
          `Unsupported protocol "${parsed.protocol}". Use http or https.`,
        );
      }

      onUpdate?.({
        content: [{ type: "text", text: `Fetching ${parsed.href}…` }],
        details: { url: parsed.href, status: "fetching" },
      });

      // Combine the session abort signal with a per-request timeout.
      const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
      const composite = signal ? AbortSignal.any([signal, timeout]) : timeout;

      let response: Response;
      try {
        response = await fetch(parsed.href, {
          signal: composite,
          redirect: "follow",
          headers: {
            "User-Agent":
              "pi-web-fetch/1.0 (+https://github.com/earendil-works/pi)",
            Accept:
              "text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.8",
          },
        });
      } catch (err) {
        const reason = signal?.aborted
          ? "request cancelled"
          : timeout.aborted
            ? `request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`
            : err instanceof Error
              ? err.message
              : String(err);
        throw new Error(`Failed to fetch ${parsed.href}: ${reason}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      const body = await response.text();

      const isHtml = /\b(text\/html|application\/xhtml\+xml)\b/i.test(
        contentType,
      );
      let rendered = params.raw || !isHtml ? body : htmlToText(body);

      let truncated = false;
      if (rendered.length > maxLength) {
        rendered = rendered.slice(0, maxLength);
        truncated = true;
      }

      const header =
        `URL: ${response.url || parsed.href}\n` +
        `Status: ${response.status} ${response.statusText}\n` +
        `Content-Type: ${contentType || "unknown"}\n` +
        (truncated
          ? `Note: output truncated to ${maxLength} characters.\n`
          : "") +
        `\n`;

      return {
        content: [{ type: "text", text: header + rendered }],
        details: {
          url: response.url || parsed.href,
          status: response.status,
          contentType,
          bytes: body.length,
          truncated,
        },
      };
    },
  });
}
