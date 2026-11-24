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

// src/std/model.js
var MAX_SLIDES = 5;
var MAX_RAILS = 8;
var MAX_RAIL_ITEMS = 20;
var MAX_SLIDE_TEXT = 160;
var HTTPS = /^https:\/\//;
function cardOf(item) {
  const out = { id: item.id, ref: item.ref, title: item.title, kind: item.kind };
  if (item.poster && HTTPS.test(item.poster)) out.poster = item.poster;
  if (item.backdrop && HTTPS.test(item.backdrop)) out.backdrop = item.backdrop;
  if (item.badges) out.badges = item.badges;
  if (item.rating !== void 0) out.rating = item.rating;
  if (item.year !== void 0) out.year = item.year;
  if (item.ids && item.ids.tmdb) out.ids = { tmdb: item.ids.tmdb };
  if (item.lang) out.lang = item.lang;
  if (item.adult === true) out.adult = true;
  return out;
}
var slidesOf = (rows) => pickSlides(rows, (item) => item.backdrop);
var posterSlidesOf = (rows) => pickSlides(rows, (item) => item.poster);
function slideText(overview, item = {}) {
  const text = typeof overview === "string" ? overview.trim() : "";
  if (text === "") return [item.year, item.rating ? "\u2605 " + item.rating : null].filter(Boolean).join(" \xB7 ");
  return text.length <= MAX_SLIDE_TEXT ? text : `${text.slice(0, MAX_SLIDE_TEXT - 1).trimEnd()}\u2026`;
}
function pickSlides(rows, pictureOf) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const row of rows) {
    for (const item of row.items || []) {
      if (out.length >= MAX_SLIDES) return out;
      const image = pictureOf(item);
      if (item.adult === true || seen.has(item.id) || !image || !HTTPS.test(image)) continue;
      seen.add(item.id);
      out.push({ id: item.id, ref: item.ref, kind: item.kind, title: item.title, image, text: slideText(item.overview, item) });
    }
  }
  return out;
}
var uniform = (items) => items.every((i) => i.backdrop) ? items : items.map(({ backdrop, ...rest }) => rest);
function railsOf(rows) {
  return rows.filter((r) => !r.hidden && r.items && r.items.length > 0).slice(0, MAX_RAILS).map((r) => ({
    id: r.id,
    title: r.title,
    ...r.titleEn ? { titleEn: r.titleEn } : {},
    ...r.ref ? { ref: r.ref } : {},
    items: uniform(r.items.slice(0, MAX_RAIL_ITEMS).map(cardOf))
  }));
}
function tabOf(page) {
  const rows = page && Array.isArray(page.rows) ? page.rows : [];
  const rails = railsOf(rows);
  if (rails.length === 0) return null;
  return { slides: slidesOf(rows), posterSlides: posterSlidesOf(rows), rails };
}
function playedKey(ref) {
  const m = /^(?:m|s|e):(\d{1,10})(?::|$)/.exec(String(ref || ""));
  return m ? `t:${m[1]}` : String(ref || "");
}
function recentOf(keys, tabs) {
  if (keys.length === 0) return [];
  const byKey = /* @__PURE__ */ new Map();
  for (const data of tabs) {
    for (const rail2 of data.rails) {
      for (const card of rail2.items) {
        const ks = [card.ref];
        if (card.ids && card.ids.tmdb) ks.push(`t:${card.ids.tmdb}`);
        for (const k of ks) if (!byKey.has(k)) byKey.set(k, card);
      }
    }
  }
  const out = [];
  const used = /* @__PURE__ */ new Set();
  for (const key of keys) {
    const card = byKey.get(key);
    if (card && !used.has(card.id)) {
      used.add(card.id);
      out.push(card);
    }
  }
  return out;
}

// src/std/strings.js
var WORDS = {
  watch: ["Ver", "Watch"],
  info: ["M\xE1s informaci\xF3n", "More info"],
  recent: ["Continuar viendo", "Continue watching"],
  search: ["Buscar", "Search"],
  searchHint: ["Buscar en {name}", "Search {name}"],
  failed: ["No se pudo cargar esta secci\xF3n. Revisa tu conexi\xF3n e int\xE9ntalo de nuevo.", "This section could not be loaded. Check your connection and try again."],
  retry: ["Reintentar", "Retry"],
  empty: ["A\xFAn no hay nada aqu\xED.", "Nothing here yet."],
  back: ["Atr\xE1s", "Back"],
  close: ["Cerrar", "Close"],
  settings: ["Ajustes", "Settings"],
  resultsTitle: ["Resultados: {q}", "Results: {q}"],
  resultsIn: ["En {name}", "In {name}"],
  resultsSearching: ["Buscando en {name}\u2026", "Searching {name}\u2026"],
  resultsFailed: ["{name} no respondi\xF3 esta vez.", "{name} did not answer this time."],
  noResults: ["No encontramos nada con esas palabras en tus plugins.", "Nothing in your plugins matched those words."],
  supportTv: ["Si te gusta mi trabajo, escan\xE9alo y ap\xF3yame", "If you like my work, scan it and support me"],
  support: ["Si te gusta mi trabajo, ap\xF3yame", "If you like my work, support me"],
  gateTitle: ["Necesitas el motor de reproducci\xF3n", "You need the playback engine"],
  gateText: [
    "{name} reproduce a trav\xE9s de Kino Resolver (gratis). Inst\xE1lalo una vez y sirve para este y para otros plugins de sitios.",
    "{name} plays through Kino Resolver (free). Install it once and it works here and in other site plugins."
  ],
  gateInstall: ["Instalar Kino Resolver", "Install Kino Resolver"]
};
var fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => vars && vars[k] != null ? String(vars[k]) : m);
function twin(key, field = "text", vars) {
  const [es, en] = WORDS[key];
  const pick = (i) => vars && Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, Array.isArray(v) ? v[i] : v]));
  return { [field]: fill(es, pick(0)), [field + "En"]: fill(en, pick(1)) };
}
var STRING_KEYS = Object.keys(WORDS);

// src/std/view.js
var SUPPORT_URL = "https://ko-fi.com/xuperplugins";
var RESOLVER_REPO = "xuper-plugin/kino-plugin-kino-resolver";
var POLL_MS = 1500;
function brand(cfg) {
  return {
    type: "Row",
    key: "brand",
    gap: 12,
    crossAxisAlignment: "center",
    children: [
      ...cfg.logo ? [{ type: "Image", key: "logo", url: cfg.logo, aspect: cfg.logoAspect || "1:1", fit: "contain", h: 32, alt: cfg.name, altEn: cfg.nameEn || cfg.name }] : [],
      { type: "Text", key: "name", style: "h4", text: cfg.name, textEn: cfg.nameEn || cfg.name }
    ]
  };
}
var tabBar = (tabs, active) => ({
  type: "TabBar",
  key: "tabs",
  divider: false,
  value: active,
  onChanged: "tab",
  tabs: tabs.map((t2) => ({ value: t2.id, label: t2.label, labelEn: t2.labelEn || t2.label }))
});
var iconButton = (key, icon, word, onPressed) => ({ type: "IconButton", key, icon, ...twin(word, "labelText"), ...twin(word, "tooltip"), onPressed });
var searchOpenOps = (tabsInBar) => [
  { hide: "close" },
  { hide: "brand" },
  { hide: "searchButton" },
  { hide: "settingsButton" },
  ...tabsInBar ? [{ hide: "tabs" }] : [],
  { show: "closeSearch" },
  { show: "q" },
  { focus: "q" }
];
var searchClosedOps = (tabsInBar) => [
  { hide: "closeSearch" },
  { hide: "q" },
  { clear: "q" },
  { show: "close" },
  { show: "brand" },
  { show: "searchButton" },
  { show: "settingsButton" },
  ...tabsInBar ? [{ show: "tabs" }] : []
];
var leaveButton = (cfg) => cfg.backArrow ? iconButton("close", "arrow_back", "back", { go: { close: true } }) : iconButton("close", "close", "close", { go: { close: true } });
function supportNode(device) {
  if (device === "tv") return { type: "QrImage", key: "donate", value: SUPPORT_URL, size: "large", ...twin("supportTv", "labelText") };
  return { type: "ElevatedButton", key: "donate", icon: "heart", ...twin("support", "labelText"), onPressed: { go: { url: { href: SUPPORT_URL } } } };
}
var bar = ({ leading, title, actions = [] }) => ({ type: "AppBar", mergeWithKinoBar: true, dense: true, divider: false, leading, title, actions });
var railSkeleton = (n) => ({
  type: "Column",
  key: "skel" + n,
  gap: 8,
  children: [
    { type: "Skeleton", shape: "line", width: 120 },
    { type: "Row", gap: 12, sizes: ["compact"], children: [1, 2, 3].map((i) => ({ type: "Skeleton", shape: "card", key: `sk${n}c${i}`, flex: 1 })) },
    { type: "Row", gap: 12, sizes: ["medium", "expanded"], children: [1, 2, 3, 4, 5, 6].map((i) => ({ type: "Skeleton", shape: "card", key: `sk${n}w${i}`, flex: 1 })) }
  ]
});
var heroSkeleton = () => ({ type: "Skeleton", key: "heroSkeleton", shape: "block", height: { compact: 200, expanded: 320 } });
var titleOf = (s) => ({ ref: s.ref, kind: s.kind, id: s.id, title: s.title });
var withHeaders = (headers) => headers ? { headers } : {};
var slideNode = (s, headers) => ({
  type: "heroCard",
  key: "slide-" + s.id,
  h: { compact: 200, expanded: 240 },
  ...s.logo ? { logo: s.logo } : {},
  title: s.title,
  text: s.text,
  image: s.image,
  ...withHeaders(headers),
  buttons: [
    { type: "ElevatedButton", key: "watch-" + s.id, ...twin("watch", "labelText"), icon: "play", onPressed: { go: { play: titleOf(s) } } },
    { type: "TextButton", key: "info-" + s.id, ...twin("info", "labelText"), onPressed: { go: { title: titleOf(s) } } }
  ]
});
var hero = (slides, headers) => slides.length === 1 ? slideNode(slides[0], headers) : {
  type: "PageView",
  key: "hero" + slides.length,
  autoPlayMs: 6e3,
  children: slides.map((s) => slideNode(s, headers))
};
var rail = (r, key, words, headers) => ({
  type: "titleRail",
  key,
  ...words || { title: r.title, titleEn: r.titleEn || r.title },
  ...r.ref ? { ref: r.ref } : {},
  items: r.items,
  ...withHeaders(headers)
});
function browseView(cfg, { tab, data, recent, pending, failed, searching = false, device = "phone", own = null }) {
  const tv = device === "tv";
  const tabs = own ? [cfg.tabs[0]] : cfg.tabs;
  const active = tabs.some((t2) => t2.id === tab) ? tab : tabs[0].id;
  const withTabs = tabs.length > 1;
  const body = [];
  if (own) {
    body.push(...own);
  } else if (data) {
    const h = cfg.imageHeaders;
    if (data.slides.length > 0) body.push(hero(data.slides, h));
    if (recent.length > 0) body.push(rail({ items: recent }, "recent", twin("recent", "title"), h));
    for (const r of data.rails) body.push(rail(r, "rail-" + String(r.id).replace(/[^A-Za-z0-9_-]/g, "_"), null, h));
    if (data.rails.length === 0) body.push({ type: "Text", key: "empty", ...twin("empty"), color: "muted" });
  } else if (failed) {
    body.push({ type: "MaterialBanner", key: "loadFailed", role: "error", ...twin("failed"), action: { ...twin("retry", "label"), onTap: "retry" } });
  } else {
    body.push(heroSkeleton(), railSkeleton(1), railSkeleton(2), railSkeleton(3));
  }
  const isBanner = (n) => !!n && (n.type === "heroCard" || n.key === "heroSkeleton" || n.type === "PageView" && String(n.key).startsWith("hero"));
  const banner = body.length > 0 && isBanner(body[0]) ? body.shift() : null;
  const tabsInBar = tv && withTabs;
  const appBar = bar({
    leading: leaveButton(cfg),
    title: { type: "Row", key: "titleRow", gap: tabsInBar ? 24 : 8, crossAxisAlignment: "center", children: [
      { ...iconButton("closeSearch", "arrow_back", "back", { ui: searchClosedOps(tabsInBar), event: "searchClosed" }), hidden: true },
      brand(cfg),
      ...tabsInBar ? [tabBar(tabs, active)] : [],
      {
        type: "TextField",
        key: "q",
        hidden: true,
        flex: 1,
        kind: "search",
        maxLength: 200,
        ...twin("searchHint", "hintText", { name: [cfg.name, cfg.nameEn || cfg.name] }),
        onSubmitted: "search",
        trailingIcon: "search",
        ...twin("search", "trailingLabel"),
        onTrailingTap: "search"
      }
    ] },
    actions: [
      // barSearch: false (std 1.7.0): the plugin draws its own search field in its page instead of the bar's icon.
      ...cfg.barSearch ? [iconButton("searchButton", "search", "search", { ui: searchOpenOps(tabsInBar), event: "searchOpened" })] : [],
      iconButton("settingsButton", "settings", "settings", "openSettings")
    ]
  });
  return {
    type: "Scaffold",
    ...searching ? { onBack: { ui: searchClosedOps(tabsInBar), event: "searchClosed" } } : {},
    appBar,
    body: { type: "Column", key: "page", children: [
      ...withTabs && !tv ? [{ type: "Column", key: "tabsRow", padding: { compact: 0, expanded: 24 }, children: [tabBar(tabs, active)] }] : [],
      { type: "SingleChildScrollView", key: "browse-" + active, flex: 1, children: [...banner ? [banner] : [], { type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: body }] }
    ] },
    ...pending ? { every: { ms: POLL_MS, event: "tick" } } : {}
  };
}
function resultsView(cfg, { q, order: order2, names, pending, found, device = "phone" }) {
  const body = [];
  let shown = 0;
  order2.forEach((repo, i) => {
    const name = [names[repo] || repo, names[repo] || repo];
    if (pending.includes(repo)) {
      body.push({ type: "Column", key: "wait-" + i, gap: 8, children: [{ type: "Text", key: "waitText-" + i, color: "muted", ...twin("resultsSearching", "text", { name }) }, railSkeleton(i)] });
      return;
    }
    const r = found.get(repo);
    if (!r || !r.ok) {
      body.push({ type: "Text", key: "failed-" + i, color: "muted", ...twin("resultsFailed", "text", { name }) });
      return;
    }
    if (!r.items.length) return;
    shown++;
    body.push(rail({ items: r.items }, "found-" + i, twin("resultsIn", "title", { name }), cfg.imageHeaders));
  });
  if (!pending.length && shown === 0 && order2.some((r) => {
    const x = found.get(r);
    return x && x.ok;
  })) body.unshift({ type: "Text", key: "noResults", ...twin("noResults") });
  return {
    type: "Scaffold",
    appBar: bar({ leading: iconButton("back", "arrow_back", "back", "back"), title: { type: "Text", key: "resultsTitle", style: "h4", ...twin("resultsTitle", "text", { q }) } }),
    body: { type: "SingleChildScrollView", key: "results-page", children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: body }] },
    ...pending.length ? { every: { ms: 1500, event: "tick" } } : {}
  };
}
function settingsView(cfg, device = "phone") {
  return {
    type: "Scaffold",
    appBar: bar({ leading: iconButton("back", "arrow_back", "back", "back"), title: brand(cfg) }),
    body: { type: "SingleChildScrollView", key: "settings-page", children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: [
      ...cfg.hasSettings ? [{ type: "settings", key: "form" }, { type: "Divider", key: "supportDivider" }] : [],
      supportNode(device)
    ] }] }
  };
}
function gateView(cfg, device = "phone") {
  const name = [cfg.name, cfg.nameEn || cfg.name];
  return {
    type: "Scaffold",
    appBar: bar({ leading: leaveButton(cfg), title: brand(cfg) }),
    body: { type: "Column", key: "gate", mainAxisAlignment: "center", crossAxisAlignment: "center", padding: 24, gap: 16, children: [
      { type: "Text", key: "gateTitle", style: "h3", ...twin("gateTitle") },
      { type: "Text", key: "gateText", style: "p", ...twin("gateText", "text", { name }) },
      { type: "ElevatedButton", key: "installResolver", ...twin("gateInstall", "labelText"), onPressed: { go: { installPlugin: { repo: RESOLVER_REPO } } } },
      supportNode(device)
    ] }
  };
}

// src/std/metaCache.js
var KEY = "meta3";
var MAX = 160;
var CONCURRENCY = 3;
var OVERVIEW_MAX = 160;
var HTTPS2 = /^https:\/\//;
function makeMetaCache({ kino: kino2, titleOf: titleOf2 = (c) => c.title, typeOf = (c) => c.kind === "series" ? "series" : "movie", tmdbPictures = false, clock = { now: () => Date.now() } }) {
  const usable = () => {
    try {
      return typeof kino2.meta === "function" && kino2.meta.byTitle === true;
    } catch (_) {
      return false;
    }
  };
  let book = null;
  function read() {
    if (book) return book;
    try {
      const o = JSON.parse(kino2.storage.get(KEY) || "null");
      book = o && typeof o === "object" && !Array.isArray(o) ? o : {};
    } catch (_) {
      book = {};
    }
    return book;
  }
  function write() {
    try {
      const ids = Object.keys(book);
      if (ids.length > MAX) for (const id of ids.slice(0, ids.length - MAX)) delete book[id];
      kino2.storage.set(KEY, JSON.stringify(book));
    } catch (_) {
    }
  }
  function known(id) {
    const e = read()[id];
    if (!e) return {};
    return {
      ...e.t > 0 ? { tmdb: e.t } : {},
      ...e.l && HTTPS2.test(e.l) ? { logo: e.l } : {},
      ...e.p && HTTPS2.test(e.p) ? { poster: e.p } : {},
      ...e.b && HTTPS2.test(e.b) ? { backdrop: e.b } : {},
      ...typeof e.o === "string" && e.o ? { overview: e.o } : {}
    };
  }
  const asked = (id) => Object.hasOwn(read(), id);
  function dress(cards) {
    return cards.map((c) => {
      const k = known(c.id);
      const poster = tmdbPictures && k.poster ? k.poster : null;
      if (!k.tmdb && !poster) return c;
      return { ...c, ...k.tmdb && !(c.ids && c.ids.tmdb) ? { ids: { ...c.ids || {}, tmdb: k.tmdb } } : {}, ...poster ? { poster } : {} };
    });
  }
  async function fill2(cards, budgetMs) {
    if (!usable()) return 0;
    const b = read();
    const end = clock.now() + budgetMs;
    let count = 0;
    let stop = false;
    const seen = /* @__PURE__ */ new Set();
    const todo = cards.filter((c) => {
      if (!c || typeof c.id !== "string" || seen.has(c.id) || Object.hasOwn(b, c.id) || c.ids && c.ids.tmdb && c.noLogo) return false;
      seen.add(c.id);
      return true;
    });
    let next = 0;
    const str = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
    const worker = async () => {
      while (!stop && next < todo.length && clock.now() < end) {
        const c = todo[next++];
        const year = c.year !== void 0 ? { year: c.year } : {};
        try {
          const a = await kino2.meta({ type: typeOf(c), title: titleOf2(c), ...year });
          b[c.id] = {
            t: a && a.ids && Number.isInteger(a.ids.tmdb) ? a.ids.tmdb : 0,
            l: str(a && a.logo, 2048),
            p: str(a && a.poster, 2048),
            b: str(a && a.backdrop, 2048),
            o: str(a && a.overview, OVERVIEW_MAX)
          };
          count++;
        } catch (e) {
          if (e && e.code === "rate_limited") stop = true;
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (count > 0) write();
    return count;
  }
  return { known, asked, dress, fill: fill2, usable, tmdbPictures };
}

// src/std/index.js
var TAB_KEY = "browseTab";
var SNAP_PREFIX = "browse1:";
var SNAP_TTL_MS = 7 * 24 * 3600 * 1e3;
var SNAP_MAX = 20 * 1024;
var SNAPS_TOTAL = 96 * 1024;
var RECENT_KEY = "recent1";
var RECENT_MAX = 12;
var Q_MAX = 200;
var META_TICK_MS = 3e3;
var META_TICK_CARDS = 24;
var INFLIGHT_KEY = "std:inflight";
var INFLIGHT_STALE_MS = 18e3;
var MAX_META_TICKS = 10;
var DEFAULT_TABS = [{ id: "inicio", label: "Inicio", labelEn: "Home" }];
var SNAPSHOT_VERSION = 1;
var SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1e3;
var SNAPSHOT_TIMEOUT_MS = 8e3;
var snapshotUrl = (repo, tab) => "https://raw.githubusercontent.com/" + repo + "/main/home/" + encodeURIComponent(tab) + ".json";
function snapshotRows(text, tab, now = Date.now()) {
  let o;
  try {
    o = JSON.parse(String(text));
  } catch (_) {
    return null;
  }
  if (!o || o.v !== SNAPSHOT_VERSION || o.tab !== tab || !Array.isArray(o.rows) || o.rows.length === 0) return null;
  const at = Number(o.at);
  if (!Number.isFinite(at) || now - at > SNAPSHOT_MAX_AGE_MS || at - now > 60 * 60 * 1e3) return null;
  return o.rows;
}
var lastSource = null;
function makeStandardScreen({ kino: kino2, name, nameEn, logo = null, logoAspect = "1:1", needsResolver, hasSettings, tabs, loadTab, homeKey = null, titleOf: titleOf2, typeOf, tmdbPictures = false, imageHeaders = null, searchHere = null, page = null, barSearch = true, backArrow = true, snapshot = null }) {
  const cfg = { name, nameEn, logo, logoAspect, imageHeaders, hasSettings: !!hasSettings, barSearch: barSearch !== false, backArrow: backArrow !== false, tabs: Array.isArray(tabs) && tabs.length > 0 ? tabs : DEFAULT_TABS };
  const TAB_IDS = cfg.tabs.map((t2) => t2.id);
  lastSource = { tabs: cfg.tabs, loadTab, titleOf: titleOf2, typeOf };
  async function fromSnapshot(tab) {
    if (typeof snapshot !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(snapshot)) return null;
    try {
      const r = await kino2.fetch(snapshotUrl(snapshot, tab), { timeoutMs: SNAPSHOT_TIMEOUT_MS });
      if (!r || !r.ok) return null;
      const rows = snapshotRows(await r.text(), tab);
      return rows ? { rows } : null;
    } catch (_) {
      return null;
    }
  }
  const meta = makeMetaCache({ kino: kino2, titleOf: titleOf2, typeOf, tmdbPictures });
  function slidesFromMeta(rails) {
    const out = [];
    for (const r of rails) {
      for (const c of r.items) {
        if (out.length >= MAX_SLIDES) return out;
        const k = meta.known(c.id);
        if (!k.backdrop || c.adult === true || out.some((x) => x.id === c.id)) continue;
        out.push({ id: c.id, ref: c.ref, kind: c.kind, title: c.title, image: k.backdrop, text: slideText(k.overview, c), ...k.logo ? { logo: k.logo } : {} });
      }
    }
    return out;
  }
  const enrich = (data) => {
    if (!data) return data;
    const own = data.slides.map((s) => {
      const k = meta.known(s.id);
      const image = tmdbPictures && k.backdrop ? k.backdrop : null;
      return k.logo || image ? { ...s, ...k.logo ? { logo: k.logo } : {}, ...image ? { image } : {} } : s;
    });
    const learned = own.length > 0 ? [] : slidesFromMeta(data.rails);
    return {
      // The site's own backdrops, else TMDB's, else the posters: every plugin has a hero.
      slides: own.length > 0 ? own : learned.length > 0 ? learned : data.posterSlides || [],
      rails: data.rails.map((r) => ({ ...r, items: meta.dress(r.items) }))
    };
  };
  const metaTicks = /* @__PURE__ */ new Map();
  const found = /* @__PURE__ */ new Map();
  const SOURCES_PER_TICK = 3;
  const asFound = (a, index) => ({
    ok: !!(a && a.ok),
    items: a && a.ok && Array.isArray(a.items) ? a.items.filter((x) => x && x.id && x.ref && x.title).slice(0, 40).map((x) => ({ ...x, id: ("p" + index + "~" + x.id).slice(0, 128), origin: a.repo })) : []
  });
  const memo = /* @__PURE__ */ new Map();
  const log = (...a) => {
    try {
      kino2.log("[std]", ...a);
    } catch (_) {
    }
  };
  const get = (k) => {
    try {
      return kino2.storage.get(k);
    } catch (_) {
      return null;
    }
  };
  const set = (k, v, opts) => {
    try {
      kino2.storage.set(k, v, opts);
    } catch (_) {
    }
  };
  function readSnap(tab) {
    try {
      const o = JSON.parse(get(SNAP_PREFIX + tab) || "null");
      return o && Date.now() - o.at < SNAP_TTL_MS && o.data && Array.isArray(o.data.rails) ? o.data : null;
    } catch (_) {
      return null;
    }
  }
  const snapMax = Math.min(SNAP_MAX, Math.floor(SNAPS_TOTAL / TAB_IDS.length));
  function writeSnap(tab, data) {
    for (let per = 10; per >= 3; per -= 2) {
      const slim = { slides: data.slides, posterSlides: data.posterSlides || [], rails: data.rails.map((r) => ({ ...r, items: r.items.slice(0, per) })) };
      const text = JSON.stringify({ at: Date.now(), data: slim });
      if (text.length <= snapMax) {
        set(SNAP_PREFIX + tab, text, { ttlMs: SNAP_TTL_MS });
        return;
      }
    }
  }
  function homeSeed(tab) {
    if (!homeKey || tab !== TAB_IDS[0]) return null;
    try {
      const o = JSON.parse(get(homeKey) || "null");
      return o && Array.isArray(o.rows) && o.rows.length ? tabOf({ rows: o.rows }) : null;
    } catch (_) {
      return null;
    }
  }
  const stored = () => {
    const t2 = get(TAB_KEY);
    return TAB_IDS.includes(t2) ? t2 : null;
  };
  function dataOf(tab) {
    if (memo.has(tab)) return memo.get(tab).data;
    const snap = readSnap(tab) || homeSeed(tab);
    if (snap) {
      memo.set(tab, { data: snap, whole: false });
      return snap;
    }
    return null;
  }
  const readKeys = () => {
    try {
      const a = JSON.parse(get(RECENT_KEY) || "[]");
      return Array.isArray(a) ? a.filter((k) => typeof k === "string") : [];
    } catch (_) {
      return [];
    }
  };
  function notePlayed(ref) {
    try {
      const key = playedKey(ref);
      if (key === "" || key.startsWith("x|")) return;
      const keys = readKeys();
      if (keys[0] === key) return;
      set(RECENT_KEY, JSON.stringify([key, ...keys.filter((k) => k !== key)].slice(0, RECENT_MAX)));
    } catch (_) {
    }
  }
  const tabFromArgs = (route) => {
    const a = route && route.args && typeof route.args === "object" ? route.args : {};
    return TAB_IDS.includes(a.tab) ? a.tab : null;
  };
  function needed(tab) {
    return memo.get(tab) && memo.get(tab).whole ? [] : [tab];
  }
  function screen2(ctx) {
    const c = ctx || {};
    const device = c.device || "phone";
    if (needsResolver && !(c.installed && c.installed[RESOLVER_REPO])) return gateView(cfg, device);
    if (c.route && c.route.name === "settings") return settingsView(cfg, device);
    if (searchHere && c.route && c.route.name === "results") {
      const st0 = c.state && typeof c.state === "object" ? c.state : {};
      return resultsView(cfg, {
        q: String(st0.rq || ""),
        order: Array.isArray(st0.rorder) ? st0.rorder : [],
        names: st0.rnames || {},
        pending: Array.isArray(st0.rpending) ? st0.rpending : [],
        found,
        device
      });
    }
    const st = c.state && typeof c.state === "object" ? c.state : {};
    const tab = TAB_IDS.includes(st.tab) ? st.tab : tabFromArgs(c.route) ?? stored() ?? TAB_IDS[0];
    const data = enrich(dataOf(tab));
    const loaded = TAB_IDS.map((t2) => memo.get(t2)).filter(Boolean).map((m) => m.data);
    const pending = Array.isArray(st.pending) && st.pending.length > 0;
    const searching = st.searching === true;
    if (page) {
      const tree = browseView(cfg, { tab: TAB_IDS[0], data: null, recent: [], pending: false, failed: false, searching, device, own: page.view({ ...c, state: st }) || [] });
      const every = page.every ? page.every({ ...c, state: st }) : null;
      return every ? { ...tree, every } : tree;
    }
    return browseView(cfg, { tab, data, recent: meta.dress(recentOf(readKeys(), loaded)), pending, failed: !!(st.failed && st.failed[tab]), searching, device });
  }
  function cutShort() {
    try {
      const o = JSON.parse(get(INFLIGHT_KEY) || "null");
      if (!o || typeof o.tab !== "string") return null;
      if (Date.now() - Number(o.at) < INFLIGHT_STALE_MS) return null;
      kino2.storage.remove(INFLIGHT_KEY);
      return o.tab;
    } catch (_) {
      return null;
    }
  }
  async function load(tab) {
    set(INFLIGHT_KEY, JSON.stringify({ tab, at: Date.now() }));
    let page2;
    try {
      page2 = await fromSnapshot(tab) || await loadTab(tab);
    } finally {
      try {
        kino2.storage.remove(INFLIGHT_KEY);
      } catch (_) {
      }
    }
    const data = tabOf(page2);
    if (data) {
      memo.set(tab, { data, whole: true });
      writeSnap(tab, data);
    }
    return data !== null;
  }
  const events = {
    async open(ev) {
      if (page) {
        let patch = {};
        try {
          patch = (page.open ? await page.open(ev) : {}) || {};
        } catch (e) {
          log("page open", e && e.code || "error");
        }
        return { state: { ...patch, tab: TAB_IDS[0], pending: [], failed: null } };
      }
      return events.openTabs(ev);
    },
    openTabs({ route, state, device }) {
      const tab = tabFromArgs(route) ?? (TAB_IDS.includes(state.tab) ? state.tab : stored() ?? TAB_IDS[0]);
      for (const t2 of TAB_IDS) dataOf(t2);
      return { state: { tab, pending: needed(tab), failed: null } };
    },
    tab({ value, arg, state }) {
      const tab = TAB_IDS.includes(value) ? value : TAB_IDS.includes(arg) ? arg : null;
      if (!tab) return null;
      set(TAB_KEY, tab);
      dataOf(tab);
      const failed = { ...state.failed || {} };
      delete failed[tab];
      const pending = [tab, ...Array.isArray(state.pending) ? state.pending.filter((t2) => t2 !== tab) : []];
      return { state: { tab, pending: memo.get(tab) && memo.get(tab).whole ? pending.slice(1) : pending, failed } };
    },
    retry({ state }) {
      const tab = TAB_IDS.includes(state.tab) ? state.tab : TAB_IDS[0];
      const queued = Array.isArray(state.pending) ? state.pending.filter((t2) => t2 !== tab) : [];
      return { state: { failed: null, pending: [tab, ...queued] } };
    },
    async tick({ state, route }) {
      if (searchHere && route && route.name === "results") {
        const rp = Array.isArray(state.rpending) ? state.rpending : [];
        if (rp.length === 0) return null;
        const batch = rp.slice(0, SOURCES_PER_TICK);
        const order2 = Array.isArray(state.rorder) ? state.rorder : [];
        let answers2 = [];
        try {
          answers2 = await searchHere.searchIn(String(state.rq || ""), batch);
        } catch (e) {
          log("results", (e && e.code || "error") + " " + String(e && e.message || "").slice(0, 200));
        }
        for (const repo of batch) {
          const a = (Array.isArray(answers2) ? answers2 : []).find((x) => x && x.repo === repo);
          found.set(repo, asFound(a, order2.indexOf(repo)));
        }
        return { state: { rpending: rp.slice(SOURCES_PER_TICK) } };
      }
      const pending = Array.isArray(state.pending) ? state.pending : [];
      if (pending.length === 0) return null;
      const [next, ...rest] = pending;
      const failed = { ...state.failed || {} };
      if (next.startsWith("meta:")) {
        const tab = next.slice(5);
        const m = memo.get(tab);
        if (!m) return { state: { pending: rest } };
        const ask = (x) => ({ id: x.id, title: x.title, kind: x.kind, ...x.year !== void 0 ? { year: x.year } : {} });
        const noOwnSlides = m.data.slides.length === 0;
        const cards = [...m.data.slides.map(ask), ...m.data.rails.flatMap((r) => r.items.slice(0, noOwnSlides ? MAX_SLIDES * 3 : 6).map(ask))].filter((c) => !meta.asked(c.id)).slice(0, META_TICK_CARDS);
        const count = await meta.fill(cards, META_TICK_MS);
        const ticks = (metaTicks.get(tab) || 0) + 1;
        metaTicks.set(tab, ticks);
        const again = noOwnSlides && count > 0 && ticks < MAX_META_TICKS && slidesFromMeta(m.data.rails).length < MAX_SLIDES && cards.some((c) => !meta.asked(c.id));
        return { state: { pending: again ? [next, ...rest] : rest } };
      }
      if (cutShort() === next) {
        log("tab", next, "cut short by Kino last time");
        failed[next] = true;
        return { state: { pending: rest, failed } };
      }
      try {
        const ok = await load(next);
        if (!ok) failed[next] = true;
        else delete failed[next];
        if (ok && meta.usable()) rest.unshift("meta:" + next);
      } catch (e) {
        log("tab", e && e.code || "error");
        failed[next] = true;
      }
      return { state: { pending: rest, failed } };
    },
    // The words go to Kino's own search, with this plugin as the source; the bar is put back as it was, locally.
    // The search button's own event (after its local ops): while searching, the tree declares onBack, so Back closes the box.
    searchOpened() {
      return { state: { searching: true } };
    },
    // The box was closed (its arrow, or Back through onBack, already ran the local ops): the flag and the ops go, so the next
    // tree declares no onBack and draws the bar's defaults.
    searchClosed() {
      return { state: { searching: false, ui: null } };
    },
    async search({ value, state, device }) {
      const typed = value && typeof value === "object" ? value.q : value;
      const raw = typed != null && String(typed).trim() !== "" ? typed : state.inputs && state.inputs.q;
      const q = String(raw == null ? "" : raw).trim().slice(0, Q_MAX);
      if (!q) return null;
      const closed = searchClosedOps(device === "tv" && TAB_IDS.length > 1);
      if (searchHere) {
        let sources = [];
        try {
          sources = await searchHere.sources() || [];
        } catch (e) {
          log("sources", e && e.code || "error");
        }
        const order2 = sources.map((x) => x.repo).filter((r) => typeof r === "string");
        found.clear();
        return { route: { push: "results" }, ui: closed, state: {
          searching: false,
          ui: null,
          rq: q,
          rorder: order2,
          rnames: Object.fromEntries(sources.map((x) => [x.repo, String(x.name || x.repo)])),
          rpending: order2
        } };
      }
      return { go: { search: { q } }, ui: closed, state: { searching: false, ui: null } };
    },
    openSettings() {
      return { route: { push: "settings" }, state: { fromBrowse: true } };
    },
    back({ state, route }) {
      if (route && route.name === "settings" && !state.fromBrowse) return { close: true };
      return { route: { pop: true }, state: { fromBrowse: false } };
    }
  };
  async function screenEvent2(ev) {
    const e = ev || {};
    const name2 = e.name != null ? e.name : e.event;
    const own = page && page.events && typeof name2 === "string" && Object.hasOwn(page.events, name2) && !Object.hasOwn(events, name2) ? page.events[name2] : null;
    if (own) return await own({ ...e, state: e.state || {} }) ?? null;
    const handler = typeof name2 === "string" && name2 !== "openTabs" && Object.hasOwn(events, name2) ? events[name2] : null;
    return handler ? await handler({ ...e, state: e.state || {} }) ?? null : null;
  }
  return { screen: screen2, screenEvent: screenEvent2, notePlayed };
}

// src/logo.js
var LOGO = "data:image/png;base64,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";
var LOGO_ASPECT = "1:1";

// src/resolve-door.js
var HLS_MIME = "application/vnd.apple.mpegurl";
var RESOLVER_ALIAS = "resolver";
var CAPTURE_MS = 2e4;
function headersOf(s) {
  const out = {};
  if (s.referer) out.Referer = s.referer;
  const h = s.headers;
  if (Array.isArray(h)) for (const x of h) {
    if (x && x.name) out[x.name] = String(x.value);
  }
  else if (h && typeof h === "object") for (const [k, v] of Object.entries(h)) {
    if (v != null) out[k] = String(v);
  }
  return out;
}
function pickBest(streams) {
  return streams.find((s) => s && s.url && (s.kind === "hls" || /\.m3u8(\?|$)/i.test(s.url))) || streams.find((s) => s && s.url) || null;
}
async function captureStreams(kino2, embedUrl, referer) {
  const b = kino2 && kino2.browser;
  if (!b || typeof b.capture !== "function") return [];
  const opts = { timeoutMs: CAPTURE_MS, match: "\\.m3u8|\\.mp4|\\.mpd" };
  if (referer) opts.headers = { Referer: referer };
  let cap;
  try {
    cap = await b.capture(embedUrl, opts);
  } catch (_) {
    return [];
  }
  const out = [];
  for (const m of cap && cap.media || []) {
    if (!m || !m.url) continue;
    out.push({ url: m.url, kind: /\.m3u8(\?|$)/i.test(m.url) ? "hls" : "mp4", server: "browser", headers: m.headers || {} });
  }
  return out;
}
async function resolveViaHelper(embedUrl, kino2, referer, allowCapture = true) {
  let res = null;
  try {
    res = await kino2.plugins.call(RESOLVER_ALIAS, "resolve", { url: embedUrl, referer });
  } catch (err) {
    try {
      kino2.log("[lacartoons]", "resolver", err && err.code || "call_failed");
    } catch (_) {
    }
  }
  let streams = res && Array.isArray(res.streams) ? res.streams.slice() : [];
  const subtitles = res && Array.isArray(res.subtitles) ? res.subtitles.filter((x) => x && x.lang && x.url) : [];
  let captured = false;
  const dead = !streams.length && res && res.error === "dead";
  if (!streams.length && !dead && (typeof allowCapture === "function" ? allowCapture() : allowCapture)) {
    streams = await captureStreams(kino2, embedUrl, referer);
    captured = streams.length > 0;
  }
  const s = pickBest(streams);
  if (!s) return dead ? { dead: true } : null;
  const headers = headersOf(s);
  const isHls = s.kind === "hls" || /\.m3u8(\?|$)/i.test(s.url);
  return {
    url: s.url,
    mime: isHls ? HLS_MIME : s.kind === "mp4" || /\.mp4(\?|$)/i.test(s.url) ? "video/mp4" : void 0,
    ...Object.keys(headers).length ? { headers } : {},
    ...captured ? { captured: true } : {},
    ...subtitles.length ? { subtitles } : {}
  };
}
async function resolverInstalled(kino2) {
  try {
    await kino2.plugins.call(RESOLVER_ALIAS, "normalizeHost", { url: "https://probe.invalid/" });
    return true;
  } catch (err) {
    return (err && err.code) !== "provider_missing";
  }
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

// src/std/catalog.js
var CATALOG_MAX = 40;
var OVERVIEW_MAX2 = 300;
var HTTPS3 = /^https:\/\//;
function catalogItems(found) {
  const out = [];
  const list = Array.isArray(found) ? found : found && Array.isArray(found.items) ? found.items : [];
  for (const it of list) {
    if (out.length >= CATALOG_MAX) break;
    if (!it || typeof it.id !== "string" || !it.id || typeof it.ref !== "string" || !it.ref || typeof it.title !== "string" || !it.title) continue;
    const item = { id: it.id, ref: it.ref, title: it.title, kind: typeof it.kind === "string" && it.kind ? it.kind : "movie" };
    if (typeof it.poster === "string" && HTTPS3.test(it.poster)) item.poster = it.poster;
    if (typeof it.backdrop === "string" && HTTPS3.test(it.backdrop)) item.backdrop = it.backdrop;
    if (it.year !== void 0 && it.year !== null && String(it.year)) item.year = String(it.year);
    if (typeof it.overview === "string" && it.overview.trim()) item.overview = it.overview.trim().slice(0, OVERVIEW_MAX2);
    const tmdb = it.ids && Number.isInteger(it.ids.tmdb) ? it.ids.tmdb : Number.isInteger(it.tmdb) ? it.tmdb : 0;
    if (tmdb > 0) item.tmdb = tmdb;
    out.push(item);
  }
  return out;
}
function catalogQuery(arg) {
  const q = String(arg && arg.q || "").trim().slice(0, 200);
  const type = arg && (arg.type === "movie" || arg.type === "series") ? arg.type : "any";
  return { q, type, season: 0, episode: 0, tmdbId: 0, year: 0, originalTitle: "", altTitles: [], cursor: null };
}
function catalogDoor(search2) {
  return async (arg) => {
    const query = catalogQuery(arg);
    if (!query.q) return [];
    return catalogItems(await search2(query));
  };
}

// src/plugin.js
globalThis.__kinoDropPendingFetches = true;
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
    removed: "Este cap\xEDtulo fue retirado del servidor donde estaba (por ejemplo, por derechos de autor). Prueba con otro cap\xEDtulo.",
    statusLine: "Listas guardadas: {n}",
    cacheCleared: "Cach\xE9 vaciada.",
    needResolver: "Para reproducir, abre LA Cartoons Plus desde el men\xFA e instala el motor de reproducci\xF3n que te pedir\xE1."
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
    removed: "This episode was taken down from the server that had it (for example, for copyright). Try another episode.",
    statusLine: "Lists kept: {n}",
    cacheCleared: "Cache cleared.",
    needResolver: "To play, open LA Cartoons Plus from the menu and install the playback engine it asks for."
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
  const hero2 = rows.flatMap((r) => r.items).find((i) => i.poster);
  if (hero2) answer.hero = { title: hero2.title, text: t("heroText"), image: hero2.poster };
  return answer;
}
var TM = "https://image.tmdb.org/t/p/w780";
var TILE_ART = {
  nickelodeon: TM + "/f3f5OzzYd8m3zN47DAjKs0sbx00.jpg",
  "cartoon-network": TM + "/gnK2nptRXra4RnKgGqAWFSqP5aG.jpg",
  "fox-kids": TM + "/8GlKBQJTFZp9mpLXJrmNCtdTyxx.jpg",
  "hanna-barbera": TM + "/wtIJW0ee02l9FDnklPIMAuYdhqS.jpg",
  disney: TM + "/xITlloKrbhwDsY1L8eaMMHHXCf.jpg",
  warner: TM + "/8TThBwlIZnzCFkj21rv5Nv2lTNG.jpg",
  marvel: TM + "/tszlsbfyTOPSZe2z6K4mwHtcnmI.jpg"
};
var withArt = (tile, art) => art ? { ...tile, art } : tile;
async function categories() {
  return NETWORKS.map((n) => withArt({ id: "n-" + n.slug, title: n.title, ref: "cat:" + n.id }, TILE_ART[n.slug]));
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
var MAX_CAPTURES = 2;
var CAPTURE_PAGE_MS = 23e3;
function takeCapture(budget) {
  if (!budget || budget.captures <= 0 || budget.deadline - Date.now() < CAPTURE_PAGE_MS) return false;
  budget.captures -= 1;
  return true;
}
async function answers(stream) {
  try {
    const r = await kino.fetch(stream.url, { headers: { ...stream.headers, Range: "bytes=0-2047" }, timeoutMs: 5e3, maxBytes: 2048 });
    if (r.status === 401 || r.status === 403) return true;
    if (!r.ok) return false;
    return !/\.m3u8(\?|$)/i.test(stream.url) || /^\s*#EXTM3U/.test(r.text() || "");
  } catch (e) {
    return !!(e && (e.code === "host_not_allowed" || e.code === "too_large" || e.code === "timeout"));
  }
}
async function open(p, budget) {
  try {
    const out = await resolveViaHelper(p.url, kino, SITE + "/", () => takeCapture(budget));
    if (out && out.dead) {
      kino.log("[lacartoons]", p.kind, "dead");
      return "dead";
    }
    if (!out || typeof out.url !== "string" || !out.url) {
      kino.log("[lacartoons]", p.kind, "no_stream");
      return null;
    }
    const stream = { url: out.url, ...out.mime ? { mime: out.mime } : {}, headers: { "User-Agent": UA, ...out.headers || {} }, label: labelOf(p) };
    if (out.subtitles) stream.subtitles = out.subtitles;
    return out.captured || await answers(stream) ? stream : null;
  } catch (e) {
    kino.log("[lacartoons]", p.kind, e && e.code || "resolve_failed");
    return null;
  }
}
async function resolve(ref) {
  const m = /^(?:e:(\d+):(\d+)|c:(\d+):(\d+):(\d))$/.exec(String(ref || ""));
  if (!m) throw kino.error("not_found", "unknown ref: " + ref);
  if (!await resolverInstalled(kino)) throw kino.error("unavailable", "resolver missing", { userMessage: t("needResolver") });
  const id = m[1] || m[3], season = m[2] || m[4];
  const only = m[5] != null ? Number(m[5]) : null;
  const pageUrl = `${SITE}/serie/capitulo/${id}?t=${season}`;
  const players = order(parseEmbeds(await getPage(pageUrl, { Referer: SITE + "/" })));
  if (!players.length) throw kino.error("not_found", "no players on " + pageUrl, { userMessage: t("noStreams") });
  const stats = readStats();
  const budget = { captures: MAX_CAPTURES, deadline: Date.now() + RESOLVE_MS };
  const indexes = only != null ? [only] : players.map((_, i) => i).sort((a, b) => scoreOf(players[b].kind, stats) - scoreOf(players[a].kind, stats) || a - b);
  const failures = [];
  let gone = 0;
  for (const i of indexes) {
    const p = players[i];
    if (!p) continue;
    const got = await open(p, budget);
    if (got === "dead") {
      gone++;
      failures.push(`${p.kind}: removed`);
      continue;
    }
    const stream = got;
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
  const all = only != null ? 1 : indexes.length;
  throw kino.error("not_found", "no player opened for " + pageUrl, { userMessage: t(gone && gone === all ? "removed" : "noStreams") });
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
var std = null;
var standard = () => std ?? (std = makeStandardScreen({
  snapshot: "xuper-plugin/kino-plugin-lacartoons",
  kino,
  name: "LA Cartoons Plus",
  logo: LOGO,
  logoAspect: LOGO_ASPECT,
  needsResolver: true,
  hasSettings: true,
  tabs: NETWORKS.map((n) => ({ id: n.slug, label: n.title, labelEn: n.title })),
  loadTab: async (tabId) => ({ rows: (await section({ tab: tabId })).rows })
}));
async function screen(ctx) {
  await null;
  return standard().screen(ctx && typeof ctx === "object" ? ctx : {});
}
async function screenEvent(ev) {
  await null;
  return standard().screenEvent(ev && typeof ev === "object" ? ev : {});
}
var proto_catalog_search = catalogDoor(search);
export {
  action,
  browse,
  categories,
  episodes,
  home,
  proto_catalog_search,
  resolve,
  screen,
  screenEvent,
  search,
  section,
  settingsStatus
};
