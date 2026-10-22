import { HLS_MIME, miss } from "./shared.js";

export const HOSTS = ["cubeembed.rpmvid.com", "rpmvid.com"];

// The player is a single-page app: `https://cubeembed.rpmvid.com/#<id>`. Its own API answers `/api/v1/video?id=<id>&w=..&h=..&r=<host of the
// page that embeds it>` with the player's settings as JSON, encrypted with AES-128-CBC and written in hex. In it, `cfNative` is the HLS
// master on the player's own domain (it opens with no headers); its segments sit on a Cloudflare host that answers 403 to any request without
// the player's Referer and Origin, which Kino then sends with every segment. (`hlsVideoTiktok` is the same stream with ad segments in it: not used.)
const KEY = "kiemtienmua911ca";
const IV = "1234567890oiuytr";
const ORIGIN = "https://cubeembed.rpmvid.com";

/** The settings JSON an API answer holds, or null when it is not an answer this extractor can read. */
export function settingsOf(hex, kino) {
  try {
    const text = kino.crypto.decrypt("aes-128-cbc", { key: KEY, iv: IV, data: String(hex || "").trim(), inputEncoding: "hex" });
    const j = JSON.parse(text);
    return j && typeof j === "object" ? j : null;
  } catch (_) { return null; }
}

export async function extract(embedUrl, req, kino) {
  let id = null;
  try { id = new URL(embedUrl).hash.replace(/^#/, "").split(/[&?/]/)[0]; } catch (_) { id = null; }
  if (!id || !/^[A-Za-z0-9_-]{3,40}$/.test(id)) return miss(kino, "rpmvid", "no video id in " + embedUrl);
  const r = await req(`${ORIGIN}/api/v1/video?id=${id}&w=1280&h=720&r=www.lacartoons.com`, { headers: { Referer: ORIGIN + "/" } });
  if (!r.ok) return miss(kino, "rpmvid", "status " + r.status);
  const j = settingsOf(await r.text(), kino);
  if (!j) return miss(kino, "rpmvid", "unreadable answer");
  const url = typeof j.cfNative === "string" && /^https:\/\//.test(j.cfNative) ? j.cfNative : (typeof j.source === "string" && /^https:\/\//.test(j.source) ? j.source : null);
  if (!url) return miss(kino, "rpmvid", "no playlist in the answer");
  return { url, mime: HLS_MIME, headers: { Referer: ORIGIN + "/", Origin: ORIGIN } };
}
