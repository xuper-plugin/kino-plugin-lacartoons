// node --test test/plugin.test.mjs
// Offline: a fake www.lacartoons.com built from real fragments (test/fixtures), fake players and a stub of `kino`.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import { validateManifest } from "../sdk/contract.mjs";

const fixture = (n) => readFileSync(new URL("./fixtures/" + n, import.meta.url), "utf8");
const calls = [];
let pages = {};
let logs = [];
let store = new Map();
let lang = "es";
let cfg = {};
globalThis.kino = {
  get lang() { return lang; },
  config: { get: (k) => cfg[k] },
  fetch: async (url, opts = {}) => {
    calls.push({ url, opts });
    const p = pages[url];
    // A stream the resolver handed back answers a peek, unless a test lists it as down.
    if (!p && /\.(m3u8|mp4)(\?|$)|okcdn/.test(url)) {
      if (deadStreams.has(url)) return { ok: false, status: 504, url, text: () => "" };
      return { ok: true, status: 206, url, text: () => (/\.m3u8/.test(url) ? "#EXTM3U\n" : "\0\0 ftyp") };
    }
    const status = p?.status ?? (p ? 200 : 404);
    return { ok: status < 400, status, url, text: () => p?.body ?? "", json: () => JSON.parse(p?.body ?? "{}") };
  },
  // the real one: AES in hex or base64, text out
  crypto: {
    decrypt: (alg, o) => {
      const bits = Number(/aes-(\d+)-cbc/.exec(alg)[1]);
      const d = crypto.createDecipheriv(`aes-${bits}-cbc`, Buffer.from(o.key), Buffer.from(o.iv));
      return Buffer.concat([d.update(Buffer.from(o.data, o.inputEncoding || "base64")), d.final()]).toString("utf8");
    },
  },
  storage: { get: (k) => store.get(k) ?? null, set: (k, v) => store.set(k, String(v)), keys: () => [...store.keys()], remove: (k) => store.delete(k) },
  sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 5))), // the runtime has it; Home waits on short sleeps
  log: (...a) => logs.push(a.join(" ")),
  error: (code, message, opts = {}) => Object.assign(new Error(message), { code, ...opts }),
  // The shared kino-resolver door: [door] answers `resolve`; `resolverUp` false = not installed.
  plugins: { call: async (alias, method, args) => {
    if (method === "normalizeHost") { if (!resolverUp) throw Object.assign(new Error("missing"), { code: "provider_missing" }); return { server: "x" }; }
    if (method === "resolve") { doorAsked.push(args.url); return door(args); }
    throw Object.assign(new Error(method), { code: "not_declared" });
  } },
};
let resolverUp = true;
const deadStreams = new Set();
const doorAsked = [];
const NONE = { streams: [], error: "needs_browser" };
let door = () => NONE;
const plugin = await import("../plugin.js");

beforeEach(() => { calls.length = 0; pages = {}; logs = []; store = new Map(); lang = "es"; cfg = {}; resolverUp = true; deadStreams.clear(); doorAsked.length = 0; door = () => NONE; });

const S = "https://www.lacartoons.com";
const LISTING = fixture("listing.html");
const SERIES = fixture("series.html");

const encrypt = (obj) => { const c = crypto.createCipheriv("aes-128-cbc", Buffer.from("kiemtienmua911ca"), Buffer.from("1234567890oiuytr")); return Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]).toString("hex"); };
const RPM_ORIGIN = "https://cubeembed.rpmvid.com";
const installEpisode = (id, season, embeds) => {
  pages[`${S}/serie/capitulo/${id}?t=${season}`] = { body: `<div class="serie-video-informacion">${embeds.map((u) => `<iframe src="${u}" allowfullscreen></iframe>`).join("")}</div>` };
};
const installRpm = (vid = "qldpb") => {
  pages[`${RPM_ORIGIN}/api/v1/video?id=${vid}&w=1280&h=720&r=www.lacartoons.com`] = { body: encrypt({ cf: "https://cf.example/master.txt", cfNative: `${RPM_ORIGIN}/v4/pl/h/cvo/${vid}/master.m3u8?k=K&kx=1`, source: "https://1.2.3.4/master.m3u8", hlsVideoTiktok: "/hls/x/tt/master.m3u8", title: "an episode" }) };
};
const OKRU_PAGE = `<div data-module="OKVideo" data-options="${JSON.stringify({ flashvars: { metadata: JSON.stringify({ videos: [{ name: "mobile", url: "https://vd1.okcdn.ru/m" }, { name: "hd", url: "https://vd1.okcdn.ru/hd" }, { name: "sd", url: "https://vd1.okcdn.ru/sd" }] }) } }).replace(/"/g, "&quot;")}"></div>`;

test("the manifest passes the kit's contract check, declares the site and uses the shared resolver", async () => {
  const text = readFileSync(new URL("../kino-plugin.json", import.meta.url), "utf8");
  const m = JSON.parse(text);
  const v = validateManifest(text);
  assert.ok(!v.errors?.length && v.ok !== false, JSON.stringify(v));
  for (const h of ["www.lacartoons.com", "lacartoons.com"]) assert.ok(m.hosts.includes(h), h);
  assert.deepEqual(m.recommends, ["xuper-plugin/kino-plugin-kino-resolver"]);
  assert.equal(m.apiVersion, 20);
  assert.equal(m.browser, true);
  assert.ok(m.capabilities.includes("screen") && m.screen);
  assert.deepEqual(m.consumes.resolver, { repo: "xuper-plugin/kino-plugin-kino-resolver", door: "resolver", calls: ["resolve"] });
  assert.ok(m.capabilities.includes("download") && m.section && m.theme && m.icon);
});

test("home: a row per network, each card a series with the site's poster and its network as a badge; ids Kino accepts", async () => {
  for (let n = 1; n <= 8; n++) pages[`${S}/?Categoria_id=${n}`] = { body: LISTING };
  const rows = await plugin.home();
  assert.deepEqual(rows.map((r) => r.title), ["Nickelodeon", "Cartoon Network", "Fox Kids", "Hanna Barbera", "Disney", "Warner Channel", "Marvel", "Otros"]);
  assert.equal(rows[1].ref, "cat:2");
  const first = rows[1].items[0];
  assert.equal(first.kind, "series");
  assert.match(first.id, /^[A-Za-z0-9._~-]{1,128}$/);
  assert.match(first.ref, /^s:\d+$/);
  assert.deepEqual(first.badges, ["Cartoon Network"]);
  assert.ok(first.poster.startsWith("https://www.lacartoons.com/rails/"));
  assert.equal(rows[0].items.length, 4);
});

test("browse: pages of a network, the next page only on a full page of sixteen", async () => {
  const sixteen = `<div class="conjuntos-series">${Array.from({ length: 16 }, (_, i) => `<a href="/serie/${100 + i}"><img src="/rails/p${i}.jpg"><p class="nombre-serie">Serie ${i}</p></a>`).join("")}</div>`;
  pages[`${S}/?Categoria_id=3&page=2`] = { body: sixteen };
  const p = await plugin.browse("cat:3", "2");
  assert.equal(p.items.length, 16);
  assert.equal(p.next, "3");
  pages[`${S}/?Categoria_id=3&page=5`] = { body: LISTING };
  assert.equal((await plugin.browse("cat:3", "5")).next, undefined);
  assert.deepEqual((await plugin.browse("cat:9", null)).items, []);
});

test("search: the site's own search, one letter allowed, never more than sixty", async () => {
  const many = `<div class="conjuntos-series">${Array.from({ length: 90 }, (_, i) => `<a href="/serie/${i + 1}"><img src="/r${i}.jpg"><p class="nombre-serie">S ${i}</p></a>`).join("")}</div>`;
  pages[`${S}/?Titulo=a`] = { body: many };
  assert.equal((await plugin.search("a")).length, 60);
  pages[`${S}/?Titulo=zodiaco`] = { body: LISTING };
  assert.equal((await plugin.search({ q: "zodiaco" })).length, 4);
  assert.deepEqual(await plugin.search(""), []);
});

test("section: a tab per network, an unknown tab is the first, two rows (the page and the next one) and a hero with the first cover", async () => {
  pages[`${S}/?Categoria_id=5`] = { body: LISTING };
  pages[`${S}/?Categoria_id=5&page=2`] = { body: LISTING };
  const r = await plugin.section({ tab: "disney" });
  assert.equal(r.tabs.length, 8);
  assert.equal(r.tab, "disney");
  assert.deepEqual(r.rows.map((x) => x.title), ["Disney", "Más de Disney"]);
  assert.equal(r.rows[0].ref, "cat:5");
  assert.ok(r.hero.image.startsWith("https://www.lacartoons.com/"));
  assert.match(r.hero.text, /Dibujos animados/);
  pages[`${S}/?Categoria_id=1`] = { body: LISTING };
  assert.equal((await plugin.section({ tab: "nope" })).tab, "nickelodeon");
});

test("categories: the eight networks, each a paged list", async () => {
  const c = await plugin.categories();
  assert.deepEqual(c.map((x) => x.ref), ["cat:1", "cat:2", "cat:3", "cat:4", "cat:5", "cat:6", "cat:7", "cat:8"]);
  assert.ok(c.every((x) => /^n-[a-z-]+$/.test(x.id) && x.title.length <= 40));
});

test("episodes: the series' name, network, synopsis and art, then every season with its episodes numbered as the site numbers them", async () => {
  pages[`${S}/serie/2`] = { body: SERIES };
  const r = await plugin.episodes("s:2");
  assert.equal(r.series.title, "Caballeros del Zodiaco");
  assert.deepEqual(r.series.genres, ["Animación", "Cartoon Network"]);
  assert.match(r.series.overview, /^Saori Kido/);
  assert.ok(r.series.poster && r.series.backdrop);
  assert.deepEqual(r.episodes.map((e) => [e.season, e.number, e.ref]), [[1, 1, "e:13:1"], [1, 2, "e:14:1"], [1, 3, "e:15:1"], [2, 1, "e:86:2"], [2, 2, "e:87:2"], [2, 3, "e:88:2"]]);
  assert.equal(r.episodes[0].title, "Las Leyendas de una Nueva era");
  pages[`${S}/serie/9`] = { body: "<html>nothing</html>" };
  await assert.rejects(plugin.episodes("s:9"), (e) => e.code === "not_found" && /capítulos/.test(e.userMessage));
  await assert.rejects(plugin.episodes("zz"), (e) => e.code === "not_found");
});

const OKRU = "https://ok.ru/videoembed/1398320007753", RPM = `${RPM_ORIGIN}/#qldpb`, DHT = "https://dhtpre.com/embed/xzg", ODD = "https://unknown.example/e/1";
const okStream = { url: "https://vd1.okcdn.ru/hd", kind: "mp4", referer: "https://ok.ru/" };
const vhStream = { url: "https://cdn.test/vh/master.m3u8", kind: "hls", referer: "https://callistanise.com/v/xzg", headers: [{ name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0 Safari/537.36" }] };
const rpmStream = { url: `${RPM_ORIGIN}/v4/pl/h/cvo/qldpb/master.m3u8?k=K`, kind: "hls", referer: RPM_ORIGIN + "/", headers: [{ name: "Origin", value: RPM_ORIGIN }] };
const doorFor = (map) => ({ url }) => (map[url] ? { streams: [map[url]] } : NONE);

test("resolve: every player the page lists is offered (vidhide's dhtpre too), the quick ones first, RPMVid last", async () => {
  installEpisode(500, 2, [RPM, OKRU, DHT, ODD]);
  door = doorFor({ [DHT]: vhStream, [OKRU]: okStream, [RPM]: rpmStream });
  const s = await plugin.resolve("e:500:2");
  assert.equal(s.label, "VidHide");
  assert.equal(s.url, "https://cdn.test/vh/master.m3u8");
  assert.equal(s.headers.Referer, "https://callistanise.com/v/xzg");
  assert.match(s.headers["User-Agent"], /Chrome/);
  assert.deepEqual(s.alternatives.map((a) => a.label), ["ok.ru", "unknown", "RPMVid"]);
  assert.deepEqual(s.alternatives.map((a) => a.ref), ["c:500:2:1", "c:500:2:2", "c:500:2:3"]);
});

test("resolve: RPMVid through the resolver keeps the player's Referer and Origin; the settings can put it first, and c:<i> points at the stable list", async () => {
  installEpisode(500, 2, [OKRU, RPM]);
  door = doorFor({ [OKRU]: okStream, [RPM]: rpmStream });
  cfg.server = "rpmvid";
  const r = await plugin.resolve("e:500:2");
  assert.equal(r.label, "RPMVid");
  assert.equal(r.headers.Referer, RPM_ORIGIN + "/");
  assert.equal(r.headers.Origin, RPM_ORIGIN);
  assert.equal(r.mime, "application/vnd.apple.mpegurl");
  const c = await plugin.resolve("c:500:2:0");
  assert.equal(c.label, "RPMVid", "with RPMVid preferred, server 0 of the list is RPMVid");
  assert.equal(c.alternatives, undefined);
});

test("resolve: a player that fails falls through; all failing is a sentence for the person; a bad ref is not_found", async () => {
  installEpisode(500, 2, [OKRU, RPM]);
  door = doorFor({ [RPM]: rpmStream });
  assert.equal((await plugin.resolve("e:500:2")).label, "RPMVid");
  door = () => NONE;
  await assert.rejects(plugin.resolve("e:500:2"), (e) => e.code === "not_found" && /Ningún servidor/.test(e.userMessage));
  await assert.rejects(plugin.resolve("x:1"), (e) => e.code === "not_found");
});

test("resolve: a resolved stream whose CDN does not answer is passed over (peeked at, not downloaded)", async () => {
  installEpisode(500, 2, [DHT, OKRU]);
  door = doorFor({ [DHT]: vhStream, [OKRU]: okStream });
  deadStreams.add(vhStream.url);
  const s = await plugin.resolve("e:500:2");
  assert.equal(s.label, "ok.ru");
  assert.ok(calls.some((c) => c.url === vhStream.url && c.opts.maxBytes === 2048));
});

test("resolve: the ranking learns which player loads for this person and tries it first next time", async () => {
  installEpisode(500, 2, [DHT, OKRU]);
  door = doorFor({ [OKRU]: okStream }); // vidhide (first by default) gives nothing
  assert.equal((await plugin.resolve("e:500:2")).label, "ok.ru");
  door = doorFor({ [DHT]: vhStream, [OKRU]: okStream });
  doorAsked.length = 0;
  assert.equal((await plugin.resolve("e:500:2")).label, "ok.ru", "ok.ru loaded before, so it goes first now");
  assert.equal(doorAsked[0], OKRU);
});

test("resolve: without the shared resolver installed it asks to install the playback engine (never naming the brand)", async () => {
  installEpisode(500, 2, [OKRU]);
  resolverUp = false;
  await assert.rejects(plugin.resolve("e:500:2"), (e) => e.code === "unavailable" && /motor de reproducci/.test(e.userMessage) && !/kino/i.test(e.userMessage));
});

test("settings: the status line counts the lists kept and the action clears them, in both languages", async () => {
  pages[`${S}/?Titulo=zodiaco`] = { body: LISTING };
  await plugin.search("zodiaco");
  assert.match((await plugin.settingsStatus()).info, /Listas guardadas: 1/);
  lang = "en";
  assert.match((await plugin.settingsStatus()).info, /Lists kept: 1/);
  assert.equal((await plugin.action("clearCache")).message, "Cache cleared.");
  assert.equal(store.size, 0);
});

test("the screen is the install gate until the resolver is installed, then the browse screen with a tab per network", async () => {
  const gate = JSON.stringify(await plugin.screen({ device: "phone", installed: {} }));
  assert.match(gate, /Instalar Kino Resolver/);
  assert.match(gate, /installPlugin/);
  assert.match(gate, /"key":"donate"/);
  assert.match(JSON.stringify(await plugin.screen({ device: "tv", installed: {} })), /QrImage/);
  const browse = JSON.stringify(await plugin.screen({ device: "phone", installed: { "xuper-plugin/kino-plugin-kino-resolver": true } }));
  assert.ok(!/Instalar Kino Resolver/.test(browse));
});

test("resolve: RPMVid, which the resolver can't open inline, plays from the hidden browser; one failed page spends the budget", async () => {
  installEpisode(500, 2, [RPM]);
  const pages = [];
  globalThis.kino.browser = { capture: async (url) => { pages.push(url); return { media: [{ url: "https://cdn.test/turbo/master.m3u8", headers: { Referer: "https://turboembed.com/" } }] }; } };
  try {
    const s = await plugin.resolve("e:500:2");
    assert.equal(s.label, "RPMVid");
    assert.equal(s.url, "https://cdn.test/turbo/master.m3u8");
    assert.equal(pages.length, 1);
  } finally { delete globalThis.kino.browser; }
});

test("resolve: a stream whose CDN is only slow (the peek times out) is still handed to the player", async () => {
  installEpisode(500, 2, [DHT]);
  door = doorFor({ [DHT]: vhStream });
  const real = globalThis.kino.fetch;
  globalThis.kino.fetch = async (url, opts) => (url === vhStream.url ? Promise.reject(Object.assign(new Error("slow"), { code: "timeout" })) : real(url, opts));
  try { assert.equal((await plugin.resolve("e:500:2")).url, vhStream.url); } finally { globalThis.kino.fetch = real; }
});
