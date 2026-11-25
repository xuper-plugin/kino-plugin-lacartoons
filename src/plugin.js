// @ts-check
// Kino plugin: LA Cartoons Plus -- classic cartoons dubbed in Spanish from www.lacartoons.com, sorted by the TV network that aired them.
// Home rows, a section of its own (a tab per network), categories, search, seasons and episodes come from the site; an episode's players
// (ok.ru, RPMVid, vidhide mirrors such as dhtpre.com, ...) are opened by the shared Kino Resolver. The site's images load for Kino, so
// the covers are the site's own. `streamHosts: "any"` is for the CDNs the playlists sit on.

import { SITE, NETWORKS, parseCards, parseSeries, parseEmbeds } from "./lacartoons.js";
import { makeReq, UA } from "./util/http.js";
import { makeStandardScreen } from "./std/index.js";
import { LOGO, LOGO_ASPECT } from "./logo.js";
import { resolveViaHelper, resolverInstalled } from "./resolve-door.js";
import { searchWithTerms } from "./util/terms.js";
import { homeWithin } from "./util/home.js";

// Kino waits for every request a call left running before it delivers the call's answer (quickjs-kt joins the pending async work), so a Home that
// gave up on a slow row at its own budget was still held until that row's request ended, or retried: measured on users' devices Home ran 21-34 s
// with rows logged as "skipped: its source did not answer in time", and Kino threw the whole answer away at 20 s. Asking Kino to drop what a call
// leaves running (the prelude reads this flag after every call; Kino 0.9.55 and later, an older one ignores it) lets the answer leave at the budget.
globalThis.__kinoDropPendingFetches = true;


const RESOLVE_MS = 40000;
const MAX_COPIES = 5;
const CACHE_MS = 10 * 60 * 1000;

// ---- i18n ----

const STRINGS = {
  es: {
    more: "Más de", heroText: "Dibujos animados clásicos, doblados al español.", series: "Serie", season: "Temporada", episode: "Capítulo",
    unavailable: "El servicio no está disponible en este momento.", noEpisodes: "No se encontraron capítulos de esta serie.", noStreams: "Ningún servidor de este capítulo abrió. Prueba más tarde.", removed: "Este capítulo fue retirado del servidor donde estaba (por ejemplo, por derechos de autor). Prueba con otro capítulo.",
    statusLine: "Listas guardadas: {n}", cacheCleared: "Caché vaciada.",
    needResolver: "Para reproducir, abre LA Cartoons Plus desde el menú e instala el motor de reproducción que te pedirá.",
  },
  en: {
    more: "More from", heroText: "Classic cartoons, dubbed in Spanish.", series: "Series", season: "Season", episode: "Episode",
    unavailable: "The service is not available right now.", noEpisodes: "No episodes found for this series.", noStreams: "No server of this episode opened. Try again later.", removed: "This episode was taken down from the server that had it (for example, for copyright). Try another episode.",
    statusLine: "Lists kept: {n}", cacheCleared: "Cache cleared.",
    needResolver: "To play, open LA Cartoons Plus from the menu and install the playback engine it asks for.",
  },
};
const t = (key) => {
  const lang = String(kino.lang || "").toLowerCase().startsWith("es") ? "es" : "en";
  return STRINGS[lang][key] || STRINGS.es[key] || key;
};

// ---- helpers ----

async function getPage(url, headers) {
  const r = await kino.fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-MX,es;q=0.9", ...(headers || {}) }, timeoutMs: 15000 });
  if (!r.ok) throw kino.error("unavailable", `LACartoons ${r.status} ${url}`, { userMessage: t("unavailable") });
  return r.text();
}

async function cached(key, fn) {
  try {
    const raw = kino.storage.get("c:" + key);
    const e = raw ? JSON.parse(raw) : null;
    if (e && Date.now() - e.at < CACHE_MS) return e.v;
  } catch (_) { /* no cache */ }
  const v = await fn();
  if (Array.isArray(v) && !v.length) return v; // an empty answer may be a throttle or a hiccup: not kept
  try { kino.storage.set("c:" + key, JSON.stringify({ at: Date.now(), v }), { ttlMs: CACHE_MS }); } catch (_) { /* a full storage only costs a refetch */ }
  return v;
}

const networkOf = (id) => NETWORKS.find((n) => n.id === Number(id));

function toItem(card, network) {
  const item = { id: "lc-" + card.id, ref: "s:" + card.id, title: card.title, kind: "series", genres: ["Animación"] };
  if (card.poster) item.poster = card.poster;
  if (network) item.badges = [network.title];
  return item;
}

/** One page (from 1) of a network's list: 16 series. */
function networkPage(network, page) {
  const url = `${SITE}/?Categoria_id=${network.id}${page > 1 ? "&page=" + page : ""}`;
  return cached(`net${network.id}:${page}`, async () => parseCards(await getPage(url)));
}

const safeRow = async (id, fn) => { try { return await fn(); } catch (e) { kino.log("row " + id + ": " + (e && e.message)); return null; } };

async function rowOf(network) {
  const items = (await networkPage(network, 1)).map((c) => toItem(c, network));
  return items.length ? { id: network.slug, title: network.title, items, ref: "cat:" + network.id, genre: "infantil" } : null;
}

// ---- exports ----

export async function home() {
  return homeWithin(NETWORKS.map((n) => () => safeRow(n.slug, () => rowOf(n))));
}

// "cat:<id>" is a network's list; ":p<n>" starts it at page n (the "Más …" row is page 2, so its "Ver más" goes on from there).
export async function browse(ref, cursor) {
  const m = /^cat:(\d)(?::p([1-9]\d{0,3}))?$/.exec(String(ref || ""));
  const network = m && networkOf(m[1]);
  if (!network) return { items: [] };
  const page = cursor ? Math.max(1, parseInt(cursor, 10) || 1) : m[2] ? Number(m[2]) : 1;
  const cards = await networkPage(network, page);
  return { items: cards.map((c) => toItem(c, network)), next: cards.length >= 16 ? String(page + 1) : undefined };
}

async function searchOne(arg) {
  const q = String((typeof arg === "string" ? arg : arg && arg.q) || "").trim();
  if (q.length < 1) return [];
  const cards = await cached("s:" + q.toLowerCase(), async () => parseCards(await getPage(`${SITE}/?Titulo=${encodeURIComponent(q)}`)));
  return cards.slice(0, 60).map((c) => toItem(c));
}

export const search = (arg) => searchWithTerms(arg, searchOne);

// ---- the plugin's own section and categories ----

export async function section({ tab } = {}) {
  const tabs = NETWORKS.map((n) => ({ id: n.slug, label: n.title }));
  const network = NETWORKS.find((n) => n.slug === tab) || NETWORKS[0];
  const rows = [];
  const first = await safeRow(network.slug, () => rowOf(network));
  if (first) rows.push(first);
  const second = await safeRow(network.slug + "-2", async () => {
    const items = (await networkPage(network, 2)).map((c) => toItem(c, network));
    return items.length ? { id: network.slug + "-2", title: `${t("more")} ${network.title}`, items, ref: "cat:" + network.id + ":p2", genre: "infantil" } : null;
  });
  if (second) rows.push(second);
  const answer = { tabs, tab: network.slug, rows };
  const hero = rows.flatMap((r) => r.items).find((i) => i.poster);
  if (hero) answer.hero = { title: hero.title, text: t("heroText"), image: hero.poster };
  return answer;
}

// ---- categories: a picture for every tile ----

/**
 * One picture per network tile: a well-known title of it, as its TMDB backdrop at w780, each checked with a request (200, image/jpeg). Static on purpose: no extra request at runtime. Keys are the network slugs; "otros" is no single network, so it gets no art (Kino draws its plain tile).
 * Kino draws a tile's picture from `art` (any public https image).
 */
const TM = "https://image.tmdb.org/t/p/w780";
const TILE_ART = {
  nickelodeon: TM + "/f3f5OzzYd8m3zN47DAjKs0sbx00.jpg",
  "cartoon-network": TM + "/gnK2nptRXra4RnKgGqAWFSqP5aG.jpg",
  "fox-kids": TM + "/8GlKBQJTFZp9mpLXJrmNCtdTyxx.jpg",
  "hanna-barbera": TM + "/wtIJW0ee02l9FDnklPIMAuYdhqS.jpg",
  disney: TM + "/xITlloKrbhwDsY1L8eaMMHHXCf.jpg",
  warner: TM + "/8TThBwlIZnzCFkj21rv5Nv2lTNG.jpg",
  marvel: TM + "/tszlsbfyTOPSZe2z6K4mwHtcnmI.jpg",
};
const withArt = (tile, art) => (art ? { ...tile, art } : tile);

export async function categories() {
  return NETWORKS.map((n) => withArt({ id: "n-" + n.slug, title: n.title, ref: "cat:" + n.id }, TILE_ART[n.slug]));
}

// ---- a series: its seasons and episodes ----

export async function episodes(ref) {
  const m = /^s:(\d+)$/.exec(String(ref || ""));
  if (!m) throw kino.error("not_found", "unknown ref: " + ref);
  const info = parseSeries(await getPage(`${SITE}/serie/${m[1]}`));
  const eps = info.seasons.flatMap((s) => s.episodes.map((e) => ({ season: e.season, number: e.number, ref: `e:${e.id}:${e.season}`, title: e.title })));
  if (!eps.length) throw kino.error("not_found", "no episodes for series " + m[1], { userMessage: t("noEpisodes") });
  const series = { title: info.title || undefined, poster: info.poster, backdrop: info.backdrop, overview: info.overview || undefined, genres: info.network ? ["Animación", info.network] : ["Animación"] };
  for (const k of Object.keys(series)) if (series[k] === undefined) delete series[k];
  return { series, episodes: eps };
}

// ---- resolve ----

// A player's name, from its host: the names the "server" setting uses (okru, rpmvid) and the vidhide family LA Cartoons now uses
// (dhtpre.com); another host keeps its first label. Every player the page lists is offered: the shared resolver opens them.
const FAMILIES = [["okru", /(^|\.)ok\.ru$/i], ["rpmvid", /rpmvid/i], ["vidhide", /dhtpre|vidhide|callistanise|morencius|smoothpre|minochinos|filelions|mivalyo/i], ["streamwish", /streamwish|hglink|vibuxer|embedwish|playerwish/i]];
function kindOf(url) {
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (_) { return "player"; }
  const hit = FAMILIES.find(([, rx]) => rx.test(host));
  return hit ? hit[0] : (host.split(".")[0] || "player").toLowerCase();
}
const NAMES = { okru: "ok.ru", rpmvid: "RPMVid", vidhide: "VidHide", streamwish: "StreamWish" };
const labelOf = (p) => NAMES[p.kind] || p.kind;
// The usual order, before anything is learned: the players the resolver reads quickly first; RPMVid last (since 2026-11 it only
// redirects to a player, turboembed, that plays in the hidden browser: a capture of up to 20 s).
const STATIC = ["vidhide", "streamwish", "okru"];
const staticRank = (k) => { const i = STATIC.indexOf(k); return k === "rpmvid" ? 99 : i < 0 ? STATIC.length : i; };

/** The players in the STABLE order a lazy ref ("c:<id>:<season>:<i>") points into: the preferred one (Ajustes), then the usual order. */
function order(embeds) {
  let pref = "auto";
  try { pref = String(kino.config.get("server") || "auto"); } catch (_) { pref = "auto"; }
  const list = embeds.map((url, n) => ({ url, n, kind: kindOf(url) }));
  const rank = (p) => (pref !== "auto" && p.kind === pref ? -1 : staticRank(p.kind));
  return list.sort((a, b) => rank(a) - rank(b) || a.n - b.n).slice(0, MAX_COPIES);
}

// ---- what each player has done for this person (the ranking): Laplace-smoothed, halved past STATS_CAP, kept in storage ----
const STATS_KEY = "srvStats";
const STATS_CAP = 24;
function readStats() { try { const o = JSON.parse(kino.storage.get(STATS_KEY) || "{}"); return o && typeof o === "object" ? o : {}; } catch (_) { return {}; } }
const scoreOf = (k, stats) => { const s = stats[k] || { ok: 0, fail: 0 }; return (s.ok + 1) / (s.ok + s.fail + 2); };
function noteServer(k, ok) {
  try {
    const stats = readStats();
    const s = stats[k] || { ok: 0, fail: 0 };
    s[ok ? "ok" : "fail"] += 1;
    if (s.ok + s.fail > STATS_CAP) { s.ok = Math.round(s.ok / 2); s.fail = Math.round(s.fail / 2); }
    stats[k] = s;
    kino.storage.set(STATS_KEY, JSON.stringify(stats));
  } catch (_) { /* the stats are a nicety */ }
}

// A hidden-browser capture costs up to 20 s whether or not it finds the video, so the budget is spent on the ATTEMPT, and a capture
// only starts if a whole page still fits before this resolve's deadline.
const MAX_CAPTURES = 2;
const CAPTURE_PAGE_MS = 23000;
function takeCapture(budget) {
  if (!budget || budget.captures <= 0 || budget.deadline - Date.now() < CAPTURE_PAGE_MS) return false;
  budget.captures -= 1;
  return true;
}

/** Whether a stream answers: a 2 KB peek (maxBytes + Range); a playlist must read like one; a 401/403 (a token) is trusted. */
async function answers(stream) {
  try {
    const r = await kino.fetch(stream.url, { headers: { ...stream.headers, Range: "bytes=0-2047" }, timeoutMs: 5000, maxBytes: 2048 });
    if (r.status === 401 || r.status === 403) return true;
    if (!r.ok) return false;
    return !/\.m3u8(\?|$)/i.test(stream.url) || /^\s*#EXTM3U/.test(r.text() || "");
  } catch (e) {
    // A timeout is a slow CDN, not a dead one (a Redmi took 4.3 s for the TLS handshake of acek-cdn.com, then played): the
    // player gets it. Only an answer that says "dead" (an error status, a non-playlist) passes the stream over.
    return !!(e && (e.code === "host_not_allowed" || e.code === "too_large" || e.code === "timeout"));
  }
}

/**
 * One player opened through the shared kino-resolver; one it can't open inline (RPMVid's turboembed, a gated host) is captured in
 * LA Cartoons Plus's own hidden WebView while the budget allows. A resolved stream is peeked at first. "dead" when the player
 * is gone (the resolver says so: deleted, blocked for copyright); null when nothing plays.
 */
async function open(p, budget) {
  try {
    const out = await resolveViaHelper(p.url, kino, SITE + "/", () => takeCapture(budget));
    if (out && out.dead) { kino.log("[lacartoons]", p.kind, "dead"); return "dead"; }
    if (!out || typeof out.url !== "string" || !out.url) { kino.log("[lacartoons]", p.kind, "no_stream"); return null; }
    const stream = { url: out.url, ...(out.mime ? { mime: out.mime } : {}), headers: { "User-Agent": UA, ...(out.headers || {}) }, label: labelOf(p) };
    if (out.subtitles) stream.subtitles = out.subtitles;
    return out.captured || (await answers(stream)) ? stream : null;
  } catch (e) {
    kino.log("[lacartoons]", p.kind, (e && e.code) || "resolve_failed");
    return null;
  }
}

/** `ref` is an episode ("e:<id>:<season>") or one of its other servers ("c:<id>:<season>:<i>"). */
export async function resolve(ref) {
  const m = /^(?:e:(\d+):(\d+)|c:(\d+):(\d+):(\d))$/.exec(String(ref || ""));
  if (!m) throw kino.error("not_found", "unknown ref: " + ref);
  // LA Cartoons Plus plays nothing on its own: the shared kino-resolver opens the players.
  if (!(await resolverInstalled(kino))) throw kino.error("unavailable", "resolver missing", { userMessage: t("needResolver") });
  const id = m[1] || m[3], season = m[2] || m[4];
  const only = m[5] != null ? Number(m[5]) : null;
  const pageUrl = `${SITE}/serie/capitulo/${id}?t=${season}`;
  const players = order(parseEmbeds(await getPage(pageUrl, { Referer: SITE + "/" })));
  if (!players.length) throw kino.error("not_found", "no players on " + pageUrl, { userMessage: t("noStreams") });

  // The automatic pick tries the player that has loaded best for this person first; the lazy refs keep the stable order.
  const stats = readStats();
  const budget = { captures: MAX_CAPTURES, deadline: Date.now() + RESOLVE_MS };
  const indexes = only != null ? [only] : players.map((_, i) => i).sort((a, b) => scoreOf(players[b].kind, stats) - scoreOf(players[a].kind, stats) || a - b);
  const failures = [];
  let gone = 0;
  for (const i of indexes) {
    const p = players[i];
    if (!p) continue;
    const got = await open(p, budget);
    if (got === "dead") { gone++; failures.push(`${p.kind}: removed`); continue; } // the video is gone, not the server
    const stream = got;
    noteServer(p.kind, !!stream);
    if (!stream) { failures.push(`${p.kind}: no stream`); continue; }
    if (only == null) {
      const others = players.map((_, j) => j).filter((j) => j !== i);
      if (others.length) stream.alternatives = others.map((j) => ({ ref: `c:${id}:${season}:${j}`, label: labelOf(players[j]) }));
    }
    return stream;
  }
  kino.log(`resolve ${id}/${season} failed: ${failures.join("; ")}`);
  // Every player the episode lists is gone: say so, instead of "try again later" for a video that will not come back.
  const all = only != null ? 1 : indexes.length;
  throw kino.error("not_found", "no player opened for " + pageUrl, { userMessage: t(gone && gone === all ? "removed" : "noStreams") });
}

// ---- Ajustes ▸ LA Cartoons Plus ----

export async function settingsStatus() {
  let n = 0;
  try { n = kino.storage.keys().filter((k) => k.startsWith("c:")).length; } catch (_) { /* no storage */ }
  return { info: t("statusLine").replace("{n}", String(n)) };
}

export async function action(key) {
  if (key === "clearCache") {
    try { for (const k of kino.storage.keys()) if (k.startsWith("c:")) kino.storage.remove(k); } catch (_) { /* nothing to clear */ }
    return { message: t("cacheCleared") };
  }
  return { message: "" };
}

// ---- the screen: the standard xuper-plugin screen (src/std) ----

// LA Cartoons Plus delegates every player to kino-resolver (resolve() refuses with needResolver while it is missing), so the screen is the install gate until it is installed.
let std = null;
const standard = () => (std ??= makeStandardScreen({ snapshot: "xuper-plugin/kino-plugin-lacartoons",
  kino, name: "LA Cartoons Plus", logo: LOGO, logoAspect: LOGO_ASPECT, needsResolver: true, hasSettings: true,
  tabs: NETWORKS.map((n) => ({ id: n.slug, label: n.title, labelEn: n.title })),
  loadTab: async (tabId) => ({ rows: (await section({ tab: tabId })).rows }),
}));

export async function screen(ctx) {
  await null;
  return standard().screen(ctx && typeof ctx === "object" ? ctx : {});
}

export async function screenEvent(ev) {
  await null;
  return standard().screenEvent(ev && typeof ev === "object" ? ev : {});
}

// std 1.7.0: the catalog door -- the author's other plugins (Da-Video) find titles here through Kino, and Kino opens and
// plays what they find in this plugin, with its own resolve.
import { catalogDoor, catalogEpisodesDoor } from "./std/catalog.js";
export const proto_catalog_search = catalogDoor(search);
export const proto_catalog_episodes = catalogEpisodesDoor(episodes);
