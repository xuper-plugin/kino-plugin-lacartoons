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

// src/util/http.js
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

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

// src/util/home.js
var BUDGET_MS = 11e3;
var KEEP_MS = 12 * 60 * 60 * 1e3;
var MAX_CHARS = 60 * 1024;
function keep(key, rows) {
  try {
    for (let per = 20; per >= 4; per -= 4) {
      const text = JSON.stringify({ at: Date.now(), rows: rows.map((r) => ({ ...r, items: Array.isArray(r.items) ? r.items.slice(0, per) : r.items })) });
      if (text.length <= MAX_CHARS) {
        kino.storage.set(key, text, { ttlMs: KEEP_MS });
        return;
      }
    }
  } catch (_) {
  }
}
function kept(key) {
  try {
    const o = JSON.parse(kino.storage.get(key) || "null");
    return o && Date.now() - o.at < KEEP_MS && Array.isArray(o.rows) && o.rows.length ? o.rows : null;
  } catch (_) {
    return null;
  }
}
async function homeWithin(jobs, { key = "home:last", budgetMs = BUDGET_MS } = {}) {
  const out = jobs.map(() => null);
  let done = false;
  const all = Promise.all(jobs.map((job, i) => Promise.resolve().then(job).then((row) => {
    out[i] = row;
  }, () => {
  }))).then(() => {
    done = true;
  });
  const end = Date.now() + budgetMs;
  while (!done && Date.now() < end) await Promise.race([all, kino.sleep(Math.min(250, Math.max(1, end - Date.now())))]);
  const rows = out.filter(Boolean);
  if (rows.length) {
    keep(key, rows);
    return rows;
  }
  return kept(key) || [];
}

// src/plugin.js
globalThis.__kinoDropPendingFetches = true;
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
    cacheCleared: "Cach\xE9 vaciada.",
    needResolver: "Para reproducir, instala el motor de reproducci\xF3n desde la tienda de plugins (es gratis)."
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
    cacheCleared: "Cache cleared.",
    needResolver: "To play, install the playback engine from the plugin store (it is free)."
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
  return homeWithin(NETWORKS.map((n) => () => safeRow(n.slug, () => rowOf(n))));
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
var FAMILIES = [["okru", /(^|\.)ok\.ru$/i], ["rpmvid", /rpmvid/i], ["vidhide", /dhtpre|vidhide|callistanise|morencius|smoothpre|minochinos|filelions|mivalyo/i], ["streamwish", /streamwish|hglink|vibuxer|embedwish|playerwish/i]];
function kindOf(url) {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch (_) {
    return "player";
  }
  const hit = FAMILIES.find(([, rx]) => rx.test(host));
  return hit ? hit[0] : (host.split(".")[0] || "player").toLowerCase();
}
var NAMES = { okru: "ok.ru", rpmvid: "RPMVid", vidhide: "VidHide", streamwish: "StreamWish" };
var labelOf = (p) => NAMES[p.kind] || p.kind;
var STATIC = ["vidhide", "streamwish", "okru"];
var staticRank = (k) => {
  const i = STATIC.indexOf(k);
  return k === "rpmvid" ? 99 : i < 0 ? STATIC.length : i;
};
function order(embeds) {
  let pref = "auto";
  try {
    pref = String(kino.config.get("server") || "auto");
  } catch (_) {
    pref = "auto";
  }
  const list = embeds.map((url, n) => ({ url, n, kind: kindOf(url) }));
  const rank = (p) => pref !== "auto" && p.kind === pref ? -1 : staticRank(p.kind);
  return list.sort((a, b) => rank(a) - rank(b) || a.n - b.n).slice(0, MAX_COPIES);
}
var STATS_KEY = "srvStats";
var STATS_CAP = 24;
function readStats() {
  try {
    const o = JSON.parse(kino.storage.get(STATS_KEY) || "{}");
    return o && typeof o === "object" ? o : {};
  } catch (_) {
    return {};
  }
}
var scoreOf = (k, stats) => {
  const s = stats[k] || { ok: 0, fail: 0 };
  return (s.ok + 1) / (s.ok + s.fail + 2);
};
function noteServer(k, ok) {
  try {
    const stats = readStats();
    const s = stats[k] || { ok: 0, fail: 0 };
    s[ok ? "ok" : "fail"] += 1;
    if (s.ok + s.fail > STATS_CAP) {
      s.ok = Math.round(s.ok / 2);
      s.fail = Math.round(s.fail / 2);
    }
    stats[k] = s;
    kino.storage.set(STATS_KEY, JSON.stringify(stats));
  } catch (_) {
  }
}
async function resolverInstalled() {
  try {
    await kino.plugins.call("resolver", "normalizeHost", { url: "https://probe.invalid/" });
    return true;
  } catch (e) {
    return (e && e.code) !== "provider_missing";
  }
}
async function answers(stream) {
  try {
    const r = await kino.fetch(stream.url, { headers: { ...stream.headers, Range: "bytes=0-2047" }, timeoutMs: 5e3, maxBytes: 2048 });
    if (r.status === 401 || r.status === 403) return true;
    if (!r.ok) return false;
    return !/\.m3u8(\?|$)/i.test(stream.url) || /^\s*#EXTM3U/.test(r.text() || "");
  } catch (e) {
    return !!(e && (e.code === "host_not_allowed" || e.code === "too_large"));
  }
}
async function open(p) {
  try {
    const res = await kino.plugins.call("resolver", "resolve", { url: p.url, referer: SITE + "/" });
    const st = (res && Array.isArray(res.streams) ? res.streams : []).find((x) => x && x.url);
    if (!st) {
      kino.log("[lacartoons]", p.kind, res && res.error || "no_stream");
      return null;
    }
    const headers = { "User-Agent": UA };
    if (st.referer) headers.Referer = st.referer;
    if (Array.isArray(st.headers)) for (const h of st.headers) {
      if (h && h.name) headers[h.name] = String(h.value);
    }
    const hls = st.kind === "hls" || /\.m3u8(\?|$)/i.test(st.url);
    const mime = hls ? "application/vnd.apple.mpegurl" : /\.mp4(\?|$)/i.test(st.url) ? "video/mp4" : void 0;
    const stream = { url: st.url, ...mime ? { mime } : {}, headers, label: labelOf(p) };
    return await answers(stream) ? stream : null;
  } catch (e) {
    kino.log("[lacartoons]", p.kind, e && e.code || "resolve_failed");
    return null;
  }
}
async function resolve(ref) {
  const m = /^(?:e:(\d+):(\d+)|c:(\d+):(\d+):(\d))$/.exec(String(ref || ""));
  if (!m) throw kino.error("not_found", "unknown ref: " + ref);
  if (!await resolverInstalled()) throw kino.error("unavailable", "resolver missing", { userMessage: t("needResolver") });
  const id = m[1] || m[3], season = m[2] || m[4];
  const only = m[5] != null ? Number(m[5]) : null;
  const pageUrl = `${SITE}/serie/capitulo/${id}?t=${season}`;
  const players = order(parseEmbeds(await getPage(pageUrl, { Referer: SITE + "/" })));
  if (!players.length) throw kino.error("not_found", "no players on " + pageUrl, { userMessage: t("noStreams") });
  const stats = readStats();
  const indexes = only != null ? [only] : players.map((_, i) => i).sort((a, b) => scoreOf(players[b].kind, stats) - scoreOf(players[a].kind, stats) || a - b);
  const failures = [];
  for (const i of indexes) {
    const p = players[i];
    if (!p) continue;
    const stream = await open(p);
    noteServer(p.kind, !!stream);
    if (!stream) {
      failures.push(`${p.kind}: no stream`);
      continue;
    }
    if (only == null) {
      const others = players.map((_, j) => j).filter((j) => j !== i);
      if (others.length) stream.alternatives = others.map((j) => ({ ref: `c:${id}:${season}:${j}`, label: labelOf(players[j]) }));
    }
    return stream;
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
