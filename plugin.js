var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lacartoons.js
var SITE = "https://www.lacartoons.com";
var NETWORKS = [
  { id: 1, slug: "nickelodeon", title: "Nickelodeon" },
  { id: 2, slug: "cartoon-network", title: "Cartoon Network" },
  { id: 3, slug: "fox-kids", title: "Fox Kids" },
  { id: 4, slug: "hanna-barbera", title: "Hanna Barbera" },
  { id: 5, slug: "disney", title: "Disney" },
  { id: 6, slug: "warner", title: "Warner Channel" },
  { id: 7, slug: "marvel", title: "Marvel" },
  { id: 8, slug: "otros", title: "Otros" }
];
var decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
var strip = (s) => decode(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
var abs = (u) => {
  try {
    return new URL(decode(u), SITE + "/").href;
  } catch (_) {
    return void 0;
  }
};
function parseCards(html) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const m of String(html || "").matchAll(/<a\b[^>]*\bhref="(\/serie\/(\d+))"[^>]*>([\s\S]*?)<\/a>/g)) {
    const title = strip((/<p class="nombre-serie"[^>]*>([\s\S]*?)<\/p>/.exec(m[3]) || [])[1]);
    if (!title || seen.has(m[2])) continue;
    seen.add(m[2]);
    const img = (/<img\b[^>]*\bsrc="([^"]+)"/.exec(m[3]) || [])[1];
    out.push({ id: m[2], title, poster: img ? abs(img) : void 0 });
  }
  return out;
}
function parseSeries(html) {
  const s = String(html || "");
  const h2 = /<h2 class="[^"]*\btext-center\b[^"]*"[^>]*>([\s\S]*?)<\/h2>/.exec(s);
  const title = h2 ? strip(h2[1].replace(/<span[\s\S]*?<\/span>/g, " ")) : "";
  const network = h2 ? strip((/<span[^>]*>([\s\S]*?)<\/span>/.exec(h2[1]) || [])[1]) : "";
  const overview = strip((/<p[^>]*>\s*(?:<[^>]+>\s*)*Rese(?:ñ|&ntilde;|n)a:?([\s\S]*?)<\/p>/i.exec(s) || [])[1]);
  const poster = (/<div class="imagen-serie"[\s\S]*?<img[^>]*\bsrc="([^"]+)"/.exec(s) || [])[1];
  const backdrop = (/<img[^>]*class="[^"]*fondo-serie-seccion[^"]*"[^>]*\bsrc="([^"]+)"/.exec(s) || /<img[^>]*\bsrc="([^"]+)"[^>]*class="[^"]*fondo-serie-seccion/.exec(s) || [])[1];
  const seasons = [];
  for (const block of s.split(/<h4\b[^>]*data-temporada-id="/).slice(1)) {
    const number = Number((/^(\d+)/.exec(block) || [])[1]);
    if (!number) continue;
    const episodes2 = [];
    for (const m of block.matchAll(/<li>\s*<a\b[^>]*\bhref="\/serie\/capitulo\/(\d+)\?t=(\d+)"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/g)) {
      const label = strip((/<span[^>]*>([\s\S]*?)<\/span>/.exec(m[3]) || [])[1]);
      const n = Number((/(\d+)/.exec(label) || [])[1]);
      episodes2.push({ id: m[1], season: Number(m[2]) || number, number: n || episodes2.length + 1, title: strip(m[3].replace(/<span[\s\S]*?<\/span>/, "")) || label });
    }
    if (episodes2.length) seasons.push({ number, episodes: episodes2 });
  }
  return { title, network, overview, poster: poster ? abs(poster) : void 0, backdrop: backdrop ? abs(backdrop) : void 0, seasons };
}
function parseEmbeds(html) {
  return [...String(html || "").matchAll(/<iframe\b[^>]*\bsrc="([^"]+)"/gi)].map((m) => decode(m[1]).replace(/^https:\/\/short\.ink\//, "https://abysscdn.com/?v=")).filter((u) => /^https?:\/\//.test(u));
}

// src/extractors/okru.js
var okru_exports = {};
__export(okru_exports, {
  HOSTS: () => HOSTS,
  extract: () => extract,
  playerMetadata: () => playerMetadata,
  renditions: () => renditions,
  unescapeAttr: () => unescapeAttr
});

// src/extractors/shared.js
var HLS_MIME = "application/vnd.apple.mpegurl";
function miss(kino2, server, reason) {
  if (kino2 && typeof kino2.log === "function") kino2.log("[lacartoons]", server, reason);
  return null;
}

// src/extractors/okru.js
var HOSTS = ["ok.ru"];
var HEIGHT_OF = { mobile: 144, lowest: 240, low: 360, sd: 480, hd: 720, full: 1080, quad: 1440, ultra: 2160 };
var HEADERS = { Referer: "https://ok.ru/" };
var ENTITIES = { quot: '"', amp: "&", apos: "'", lt: "<", gt: ">" };
function unescapeAttr(value) {
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCharCode(n) : all;
    }
    return ENTITIES[code.toLowerCase()] ?? all;
  });
}
var parse = (text) => {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
};
function playerMetadata(html) {
  const attr = /\bdata-options\s*=\s*"([^"]*)"/.exec(html || "");
  if (!attr) return null;
  const options = parse(unescapeAttr(attr[1]));
  const meta = options && options.flashvars && options.flashvars.metadata;
  if (typeof meta === "string") return parse(meta);
  return meta && typeof meta === "object" ? meta : null;
}
var order = (h) => h == null ? 99999 : h <= 1080 ? 1080 - h : 1e3 + h;
function renditions(meta) {
  const list = meta && Array.isArray(meta.videos) ? meta.videos : [];
  return list.filter((v) => v && typeof v.url === "string" && /^https?:\/\//i.test(v.url) && !v.disallowed).map((v) => {
    const name = String(v.name || "").toLowerCase();
    return { name, height: HEIGHT_OF[name] ?? null, url: v.url };
  }).filter((v) => v.height !== HEIGHT_OF.mobile).sort((a, b) => order(a.height) - order(b.height));
}
async function extract(embedUrl, req, kino2) {
  const r = await req(embedUrl, { headers: { Accept: "text/html", ...HEADERS } });
  if (!r.ok) return miss(kino2, "okru", "status " + r.status);
  const meta = playerMetadata(r.text());
  if (!meta) return miss(kino2, "okru", "no player settings (removed or restricted video)");
  const [best] = renditions(meta);
  if (best) return { url: best.url, mime: "video/mp4", headers: HEADERS, ...best.height ? { quality: best.height + "p" } : {} };
  const hls = typeof meta.hlsManifestUrl === "string" && /^https?:\/\//i.test(meta.hlsManifestUrl) ? meta.hlsManifestUrl : null;
  return hls ? { url: hls, mime: HLS_MIME, headers: HEADERS } : miss(kino2, "okru", "no renditions");
}

// src/extractors/rpmvid.js
var rpmvid_exports = {};
__export(rpmvid_exports, {
  HOSTS: () => HOSTS2,
  extract: () => extract2,
  settingsOf: () => settingsOf
});
var HOSTS2 = ["cubeembed.rpmvid.com", "rpmvid.com"];
var KEY = "kiemtienmua911ca";
var IV = "1234567890oiuytr";
var ORIGIN = "https://cubeembed.rpmvid.com";
function settingsOf(hex, kino2) {
  try {
    const text = kino2.crypto.decrypt("aes-128-cbc", { key: KEY, iv: IV, data: String(hex || "").trim(), inputEncoding: "hex" });
    const j = JSON.parse(text);
    return j && typeof j === "object" ? j : null;
  } catch (_) {
    return null;
  }
}
async function extract2(embedUrl, req, kino2) {
  let id = null;
  try {
    id = new URL(embedUrl).hash.replace(/^#/, "").split(/[&?/]/)[0];
  } catch (_) {
    id = null;
  }
  if (!id || !/^[A-Za-z0-9_-]{3,40}$/.test(id)) return miss(kino2, "rpmvid", "no video id in " + embedUrl);
  const r = await req(`${ORIGIN}/api/v1/video?id=${id}&w=1280&h=720&r=www.lacartoons.com`, { headers: { Referer: ORIGIN + "/" } });
  if (!r.ok) return miss(kino2, "rpmvid", "status " + r.status);
  const j = settingsOf(await r.text(), kino2);
  if (!j) return miss(kino2, "rpmvid", "unreadable answer");
  const url = typeof j.cfNative === "string" && /^https:\/\//.test(j.cfNative) ? j.cfNative : typeof j.source === "string" && /^https:\/\//.test(j.source) ? j.source : null;
  if (!url) return miss(kino2, "rpmvid", "no playlist in the answer");
  return { url, mime: HLS_MIME, headers: { Referer: ORIGIN + "/", Origin: ORIGIN } };
}

// src/extractors/index.js
var TABLE = { okru: okru_exports, rpmvid: rpmvid_exports };
function extractorFor(embedUrl) {
  let host;
  try {
    host = new URL(embedUrl).hostname.replace(/^www\./, "");
  } catch (_) {
    return null;
  }
  for (const [name, mod] of Object.entries(TABLE)) {
    if (mod.HOSTS.some((h) => host === h || host.endsWith("." + h))) return { name, extract: mod.extract };
  }
  return null;
}
var HOSTS3 = Object.values(TABLE).flatMap((m) => m.HOSTS);

// src/util/http.js
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
var REQUEST_MS = 8e3;
var MIN_MS = 1500;
function makeReq(kino2, { deadline }) {
  const req = async (url, opts = {}) => {
    const left = deadline - Date.now();
    if (left < MIN_MS) throw kino2.error("timeout", "no time left for " + new URL(url).hostname);
    return kino2.fetch(url, { headers: { "User-Agent": UA, ...opts.headers || {} }, method: opts.method, body: opts.body, timeoutMs: Math.min(REQUEST_MS, left) });
  };
  req.left = () => Math.max(0, deadline - Date.now());
  return req;
}

// src/util/terms.js
function searchTerms(arg) {
  const q = String((typeof arg === "string" ? arg : arg && arg.q) || "").trim();
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const out = [];
  const add = (s) => {
    const v = String(s || "").trim();
    if (v.length >= 1 && !out.some((x) => norm(x) === norm(v))) out.push(v);
  };
  add(q);
  if (arg && typeof arg === "object") {
    add(arg.originalTitle);
    for (const a of Array.isArray(arg.altTitles) ? arg.altTitles : []) add(a);
  }
  add(q.split(/\s*[:\-–—]\s*/)[0]);
  return out.slice(0, 4);
}
async function searchWithTerms(arg, one) {
  for (const q of searchTerms(arg)) {
    const found = await one(arg && typeof arg === "object" ? { ...arg, q } : q);
    if (found.length) return found;
  }
  return [];
}

// src/plugin.js
var RESOLVE_MS = 4e4;
var MAX_COPIES = 5;
var CACHE_MS = 10 * 60 * 1e3;
var STRINGS = {
  es: {
    more: "M\xE1s de",
    heroText: "Dibujos animados cl\xE1sicos, doblados al espa\xF1ol.",
    series: "Serie",
    season: "Temporada",
    episode: "Cap\xEDtulo",
    unavailable: "El servicio no est\xE1 disponible en este momento.",
    noEpisodes: "No se encontraron cap\xEDtulos de esta serie.",
    noStreams: "Ning\xFAn servidor de este cap\xEDtulo abri\xF3. Prueba m\xE1s tarde.",
    statusLine: "Listas guardadas: {n}",
    cacheCleared: "Cach\xE9 vaciada."
  },
  en: {
    more: "More from",
    heroText: "Classic cartoons, dubbed in Spanish.",
    series: "Series",
    season: "Season",
    episode: "Episode",
    unavailable: "The service is not available right now.",
    noEpisodes: "No episodes found for this series.",
    noStreams: "No server of this episode opened. Try again later.",
    statusLine: "Lists kept: {n}",
    cacheCleared: "Cache cleared."
  }
};
var t = (key) => {
  const lang = String(kino.lang || "").toLowerCase().startsWith("es") ? "es" : "en";
  return STRINGS[lang][key] || STRINGS.es[key] || key;
};
async function getPage(url, headers) {
  const r = await kino.fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-MX,es;q=0.9", ...headers || {} }, timeoutMs: 15e3 });
  if (!r.ok) throw kino.error("unavailable", `LACartoons ${r.status} ${url}`, { userMessage: t("unavailable") });
  return r.text();
}
async function cached(key, fn) {
  try {
    const raw = kino.storage.get("c:" + key);
    const e = raw ? JSON.parse(raw) : null;
    if (e && Date.now() - e.at < CACHE_MS) return e.v;
  } catch (_) {
  }
  const v = await fn();
  if (Array.isArray(v) && !v.length) return v;
  try {
    kino.storage.set("c:" + key, JSON.stringify({ at: Date.now(), v }), { ttlMs: CACHE_MS });
  } catch (_) {
  }
  return v;
}
var networkOf = (id) => NETWORKS.find((n) => n.id === Number(id));
function toItem(card, network) {
  const item = { id: "lc-" + card.id, ref: "s:" + card.id, title: card.title, kind: "series", genres: ["Animaci\xF3n"] };
  if (card.poster) item.poster = card.poster;
  if (network) item.badges = [network.title];
  return item;
}
function networkPage(network, page) {
  const url = `${SITE}/?Categoria_id=${network.id}${page > 1 ? "&page=" + page : ""}`;
  return cached(`net${network.id}:${page}`, async () => parseCards(await getPage(url)));
}
var safeRow = async (id, fn) => {
  try {
    return await fn();
  } catch (e) {
    kino.log("row " + id + ": " + (e && e.message));
    return null;
  }
};
async function rowOf(network) {
  const items = (await networkPage(network, 1)).map((c) => toItem(c, network));
  return items.length ? { id: network.slug, title: network.title, items, ref: "cat:" + network.id, genre: "infantil" } : null;
}
async function home() {
  return (await Promise.all(NETWORKS.map((n) => safeRow(n.slug, () => rowOf(n))))).filter(Boolean);
}
async function browse(ref, cursor) {
  const m = /^cat:(\d)$/.exec(String(ref || ""));
  const network = m && networkOf(m[1]);
  if (!network) return { items: [] };
  const page = cursor ? Math.max(1, parseInt(cursor, 10) || 1) : 1;
  const cards = await networkPage(network, page);
  return { items: cards.map((c) => toItem(c, network)), next: cards.length >= 16 ? String(page + 1) : void 0 };
}
async function searchOne(arg) {
  const q = String((typeof arg === "string" ? arg : arg && arg.q) || "").trim();
  if (q.length < 1) return [];
  const cards = await cached("s:" + q.toLowerCase(), async () => parseCards(await getPage(`${SITE}/?Titulo=${encodeURIComponent(q)}`)));
  return cards.slice(0, 60).map((c) => toItem(c));
}
var search = (arg) => searchWithTerms(arg, searchOne);
async function section({ tab } = {}) {
  const tabs = NETWORKS.map((n) => ({ id: n.slug, label: n.title }));
  const network = NETWORKS.find((n) => n.slug === tab) || NETWORKS[0];
  const rows = [];
  const first = await safeRow(network.slug, () => rowOf(network));
  if (first) rows.push(first);
  const second = await safeRow(network.slug + "-2", async () => {
    const items = (await networkPage(network, 2)).map((c) => toItem(c, network));
    return items.length ? { id: network.slug + "-2", title: `${t("more")} ${network.title}`, items, genre: "infantil" } : null;
  });
  if (second) rows.push(second);
  const answer = { tabs, tab: network.slug, rows };
  const hero = rows.flatMap((r) => r.items).find((i) => i.poster);
  if (hero) answer.hero = { title: hero.title, text: t("heroText"), image: hero.poster };
  return answer;
}
async function categories() {
  return NETWORKS.map((n) => ({ id: "n-" + n.slug, title: n.title, ref: "cat:" + n.id }));
}
async function episodes(ref) {
  const m = /^s:(\d+)$/.exec(String(ref || ""));
  if (!m) throw kino.error("not_found", "unknown ref: " + ref);
  const info = parseSeries(await getPage(`${SITE}/serie/${m[1]}`));
  const eps = info.seasons.flatMap((s) => s.episodes.map((e) => ({ season: e.season, number: e.number, ref: `e:${e.id}:${e.season}`, title: e.title })));
  if (!eps.length) throw kino.error("not_found", "no episodes for series " + m[1], { userMessage: t("noEpisodes") });
  const series = { title: info.title || void 0, poster: info.poster, backdrop: info.backdrop, overview: info.overview || void 0, genres: info.network ? ["Animaci\xF3n", info.network] : ["Animaci\xF3n"] };
  for (const k of Object.keys(series)) if (series[k] === void 0) delete series[k];
  return { series, episodes: eps };
}
function order2(embeds) {
  let pref = "auto";
  try {
    pref = String(kino.config.get("server") || "auto");
  } catch (_) {
    pref = "auto";
  }
  const known = embeds.map((url) => ({ url, ex: extractorFor(url) })).filter((e) => e.ex);
  const rank = (e) => pref !== "auto" && e.ex.name === pref ? -1 : e.ex.name === "okru" ? 0 : 1;
  return known.sort((a, b) => rank(a) - rank(b)).slice(0, MAX_COPIES);
}
var NAMES = { okru: "ok.ru", rpmvid: "RPMVid" };
async function resolve(ref) {
  const m = /^(?:e:(\d+):(\d+)|c:(\d+):(\d+):(\d))$/.exec(String(ref || ""));
  if (!m) throw kino.error("not_found", "unknown ref: " + ref);
  const id = m[1] || m[3], season = m[2] || m[4];
  const only = m[5] != null ? Number(m[5]) : null;
  const pageUrl = `${SITE}/serie/capitulo/${id}?t=${season}`;
  const players = order2(parseEmbeds(await getPage(pageUrl, { Referer: SITE + "/" })));
  if (!players.length) throw kino.error("not_found", "no usable players on " + pageUrl, { userMessage: t("noStreams") });
  const req = makeReq(kino, { deadline: Date.now() + RESOLVE_MS });
  const indexes = only != null ? [only] : players.map((_, i) => i);
  const failures = [];
  for (const i of indexes) {
    const p = players[i];
    if (!p) continue;
    try {
      const out = await p.ex.extract(p.url, req, kino);
      if (!out) {
        failures.push(`${p.ex.name}: no stream`);
        continue;
      }
      const stream = { url: out.url, mime: out.mime, headers: { "User-Agent": UA, ...out.headers || {} }, label: NAMES[p.ex.name] || p.ex.name };
      if (only == null) {
        const others = players.map((_, j) => j).filter((j) => j !== i);
        if (others.length) stream.alternatives = others.map((j) => ({ ref: `c:${id}:${season}:${j}`, label: NAMES[players[j].ex.name] || players[j].ex.name }));
      }
      return stream;
    } catch (e) {
      failures.push(`${p.ex.name}: ${e && e.message || e}`);
    }
  }
  kino.log(`resolve ${id}/${season} failed: ${failures.join("; ")}`);
  throw kino.error("not_found", "no player opened for " + pageUrl, { userMessage: t("noStreams") });
}
async function settingsStatus() {
  let n = 0;
  try {
    n = kino.storage.keys().filter((k) => k.startsWith("c:")).length;
  } catch (_) {
  }
  return { info: t("statusLine").replace("{n}", String(n)) };
}
async function action(key) {
  if (key === "clearCache") {
    try {
      for (const k of kino.storage.keys()) if (k.startsWith("c:")) kino.storage.remove(k);
    } catch (_) {
    }
    return { message: t("cacheCleared") };
  }
  return { message: "" };
}
export {
  action,
  browse,
  categories,
  episodes,
  home,
  resolve,
  search,
  section,
  settingsStatus
};
