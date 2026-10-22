// @ts-check
// Kino plugin: LACartoons -- classic cartoons dubbed in Spanish from www.lacartoons.com, sorted by the TV network that aired them.
// Home rows, a section of its own (a tab per network), categories, search, seasons and episodes come from the site; an episode's players
// (RPMVid and ok.ru) are opened with the extractors in ./extractors. The site's images load for Kino, so the covers are the site's own.
// Declared hosts: the site and the two players. `streamHosts: "any"` is for the CDNs the playlists sit on.

import { SITE, NETWORKS, parseCards, parseSeries, parseEmbeds } from "./lacartoons.js";
import { extractorFor } from "./extractors/index.js";
import { makeReq, UA } from "./util/http.js";

const RESOLVE_MS = 40000;
const MAX_COPIES = 5;
const CACHE_MS = 10 * 60 * 1000;

// ---- i18n ----

const STRINGS = {
  es: {
    more: "Más de", heroText: "Dibujos animados clásicos, doblados al español.", series: "Serie", season: "Temporada", episode: "Capítulo",
    unavailable: "El servicio no está disponible en este momento.", noEpisodes: "No se encontraron capítulos de esta serie.", noStreams: "Ningún servidor de este capítulo abrió. Prueba más tarde.",
    statusLine: "Listas guardadas: {n}", cacheCleared: "Caché vaciada.",
  },
  en: {
    more: "More from", heroText: "Classic cartoons, dubbed in Spanish.", series: "Series", season: "Season", episode: "Episode",
    unavailable: "The service is not available right now.", noEpisodes: "No episodes found for this series.", noStreams: "No server of this episode opened. Try again later.",
    statusLine: "Lists kept: {n}", cacheCleared: "Cache cleared.",
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
  return (await Promise.all(NETWORKS.map((n) => safeRow(n.slug, () => rowOf(n))))).filter(Boolean);
}

export async function browse(ref, cursor) {
  const m = /^cat:(\d)$/.exec(String(ref || ""));
  const network = m && networkOf(m[1]);
  if (!network) return { items: [] };
  const page = cursor ? Math.max(1, parseInt(cursor, 10) || 1) : 1;
  const cards = await networkPage(network, page);
  return { items: cards.map((c) => toItem(c, network)), next: cards.length >= 16 ? String(page + 1) : undefined };
}

export async function search(arg) {
  const q = String((typeof arg === "string" ? arg : arg && arg.q) || "").trim();
  if (q.length < 1) return [];
  const cards = await cached("s:" + q.toLowerCase(), async () => parseCards(await getPage(`${SITE}/?Titulo=${encodeURIComponent(q)}`)));
  return cards.slice(0, 60).map((c) => toItem(c));
}

// ---- the plugin's own section and categories ----

export async function section({ tab } = {}) {
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

export async function categories() {
  return NETWORKS.map((n) => ({ id: "n-" + n.slug, title: n.title, ref: "cat:" + n.id }));
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

/** Which player to open first: Ajustes ▸ LACartoons (ok.ru by default: a plain MP4; RPMVid is HLS and needs its Referer). */
function order(embeds) {
  let pref = "auto";
  try { pref = String(kino.config.get("server") || "auto"); } catch (_) { pref = "auto"; }
  const known = embeds.map((url) => ({ url, ex: extractorFor(url) })).filter((e) => e.ex);
  const rank = (e) => (pref !== "auto" && e.ex.name === pref ? -1 : e.ex.name === "okru" ? 0 : 1);
  return known.sort((a, b) => rank(a) - rank(b)).slice(0, MAX_COPIES);
}

const NAMES = { okru: "ok.ru", rpmvid: "RPMVid" };

/** `ref` is an episode ("e:<id>:<season>") or one of its other servers ("c:<id>:<season>:<i>"). */
export async function resolve(ref) {
  const m = /^(?:e:(\d+):(\d+)|c:(\d+):(\d+):(\d))$/.exec(String(ref || ""));
  if (!m) throw kino.error("not_found", "unknown ref: " + ref);
  const id = m[1] || m[3], season = m[2] || m[4];
  const only = m[5] != null ? Number(m[5]) : null;
  const pageUrl = `${SITE}/serie/capitulo/${id}?t=${season}`;
  const players = order(parseEmbeds(await getPage(pageUrl, { Referer: SITE + "/" })));
  if (!players.length) throw kino.error("not_found", "no usable players on " + pageUrl, { userMessage: t("noStreams") });

  const req = makeReq(kino, { deadline: Date.now() + RESOLVE_MS });
  const indexes = only != null ? [only] : players.map((_, i) => i);
  const failures = [];
  for (const i of indexes) {
    const p = players[i];
    if (!p) continue;
    try {
      const out = await p.ex.extract(p.url, req, kino);
      if (!out) { failures.push(`${p.ex.name}: no stream`); continue; }
      const stream = { url: out.url, mime: out.mime, headers: { "User-Agent": UA, ...(out.headers || {}) }, label: NAMES[p.ex.name] || p.ex.name };
      if (only == null) {
        const others = players.map((_, j) => j).filter((j) => j !== i);
        if (others.length) stream.alternatives = others.map((j) => ({ ref: `c:${id}:${season}:${j}`, label: NAMES[players[j].ex.name] || players[j].ex.name }));
      }
      return stream;
    } catch (e) {
      failures.push(`${p.ex.name}: ${(e && e.message) || e}`);
    }
  }
  kino.log(`resolve ${id}/${season} failed: ${failures.join("; ")}`);
  throw kino.error("not_found", "no player opened for " + pageUrl, { userMessage: t("noStreams") });
}

// ---- Ajustes ▸ LACartoons ----

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
