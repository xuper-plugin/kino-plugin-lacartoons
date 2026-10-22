// LACartoons (www.lacartoons.com): classic cartoons dubbed in Spanish, sorted by the TV network that aired them. Pages: /?Categoria_id=<1..8>[&page=<n>]
// (16 series a page), /?Titulo=<text> (search; one letter lists the whole catalogue), /serie/<id> (seasons and episodes, in accordions) and
// /serie/capitulo/<id>?t=<season> (an episode, with its players in iframes).

export const SITE = "https://www.lacartoons.com";

/** The eight networks of the site's menu: the id it uses, the name it shows. */
export const NETWORKS = [
  { id: 1, slug: "nickelodeon", title: "Nickelodeon" }, { id: 2, slug: "cartoon-network", title: "Cartoon Network" }, { id: 3, slug: "fox-kids", title: "Fox Kids" },
  { id: 4, slug: "hanna-barbera", title: "Hanna Barbera" }, { id: 5, slug: "disney", title: "Disney" }, { id: 6, slug: "warner", title: "Warner Channel" },
  { id: 7, slug: "marvel", title: "Marvel" }, { id: 8, slug: "otros", title: "Otros" },
];

const decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const strip = (s) => decode(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const abs = (u) => { try { return new URL(decode(u), SITE + "/").href; } catch (_) { return undefined; } };

/** The series cards of a listing or search page: `{ id, title, poster }`. */
export function parseCards(html) {
  const out = [];
  const seen = new Set();
  for (const m of String(html || "").matchAll(/<a\b[^>]*\bhref="(\/serie\/(\d+))"[^>]*>([\s\S]*?)<\/a>/g)) {
    const title = strip((/<p class="nombre-serie"[^>]*>([\s\S]*?)<\/p>/.exec(m[3]) || [])[1]);
    if (!title || seen.has(m[2])) continue;
    seen.add(m[2]);
    const img = (/<img\b[^>]*\bsrc="([^"]+)"/.exec(m[3]) || [])[1];
    out.push({ id: m[2], title, poster: img ? abs(img) : undefined });
  }
  return out;
}

/** What a series page says, and its seasons with their episodes: `{ title, network, overview, poster, backdrop, seasons: [{ number, episodes: [{ id, season, number, title }] }] }`. */
export function parseSeries(html) {
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
    const episodes = [];
    for (const m of block.matchAll(/<li>\s*<a\b[^>]*\bhref="\/serie\/capitulo\/(\d+)\?t=(\d+)"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/g)) {
      const label = strip((/<span[^>]*>([\s\S]*?)<\/span>/.exec(m[3]) || [])[1]);
      const n = Number((/(\d+)/.exec(label) || [])[1]);
      episodes.push({ id: m[1], season: Number(m[2]) || number, number: n || episodes.length + 1, title: strip(m[3].replace(/<span[\s\S]*?<\/span>/, "")) || label });
    }
    if (episodes.length) seasons.push({ number, episodes });
  }
  return { title, network, overview, poster: poster ? abs(poster) : undefined, backdrop: backdrop ? abs(backdrop) : undefined, seasons };
}

/** The players of an episode page, in the order the site lists them: the `src` of each iframe. */
export function parseEmbeds(html) {
  return [...String(html || "").matchAll(/<iframe\b[^>]*\bsrc="([^"]+)"/gi)].map((m) => decode(m[1]).replace(/^https:\/\/short\.ink\//, "https://abysscdn.com/?v=")).filter((u) => /^https?:\/\//.test(u));
}
