// OkRu: the videoembed page keeps its player settings in one attribute, data-options, as HTML-escaped JSON. Its
// flashvars.metadata is a second JSON document (usually a string) listing the MP4 renditions by name, plus an HLS
// manifest. The best rendition is picked by height, the same order the resolver uses for qualities.

import { HLS_MIME, miss } from "./shared.js";

export const HOSTS = ["ok.ru"];

// Rendition names and the height each one stands for.
const HEIGHT_OF = { mobile: 144, lowest: 240, low: 360, sd: 480, hd: 720, full: 1080, quad: 1440, ultra: 2160 };
const HEADERS = { Referer: "https://ok.ru/" };

const ENTITIES = { quot: '"', amp: "&", apos: "'", lt: "<", gt: ">" };

/** An attribute value with its HTML entities (named, decimal and hex) turned back into text. */
export function unescapeAttr(value) {
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCharCode(n) : all;
    }
    return ENTITIES[code.toLowerCase()] ?? all;
  });
}

const parse = (text) => { try { return JSON.parse(text); } catch (_) { return null; } };

/** The player's metadata object from the page, or null when the page has no readable player settings. */
export function playerMetadata(html) {
  const attr = /\bdata-options\s*=\s*"([^"]*)"/.exec(html || "");
  if (!attr) return null;
  const options = parse(unescapeAttr(attr[1]));
  const meta = options && options.flashvars && options.flashvars.metadata;
  if (typeof meta === "string") return parse(meta);
  return meta && typeof meta === "object" ? meta : null;
}

/** Sort key: 1080 first, then lower heights from the top down, then the heavy ones above 1080; unknown names last. */
const order = (h) => (h == null ? 99999 : h <= 1080 ? 1080 - h : 1000 + h);

/** The renditions worth playing, best first: `[{ name, height, url }]`. */
export function renditions(meta) {
  const list = meta && Array.isArray(meta.videos) ? meta.videos : [];
  return list
    .filter((v) => v && typeof v.url === "string" && /^https?:\/\//i.test(v.url) && !v.disallowed)
    .map((v) => {
      const name = String(v.name || "").toLowerCase();
      return { name, height: HEIGHT_OF[name] ?? null, url: v.url };
    })
    .filter((v) => v.height !== HEIGHT_OF.mobile) // a phone-sized copy is never the one to play
    .sort((a, b) => order(a.height) - order(b.height));
}

export async function extract(embedUrl, req, kino) {
  const r = await req(embedUrl, { headers: { Accept: "text/html", ...HEADERS } });
  if (!r.ok) return miss(kino, "okru", "status " + r.status);
  const meta = playerMetadata(r.text());
  if (!meta) return miss(kino, "okru", "no player settings (removed or restricted video)");
  const [best] = renditions(meta);
  if (best) return { url: best.url, mime: "video/mp4", headers: HEADERS, ...(best.height ? { quality: best.height + "p" } : {}) };
  const hls = typeof meta.hlsManifestUrl === "string" && /^https?:\/\//i.test(meta.hlsManifestUrl) ? meta.hlsManifestUrl : null;
  return hls ? { url: hls, mime: HLS_MIME, headers: HEADERS } : miss(kino, "okru", "no renditions");
}
