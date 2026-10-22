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
  log: (...a) => logs.push(a.join(" ")),
  error: (code, message, opts = {}) => Object.assign(new Error(message), { code, ...opts }),
};
const plugin = await import("../plugin.js");
const { settingsOf } = await import("../src/extractors/rpmvid.js");
const { extractorFor } = await import("../src/extractors/index.js");

beforeEach(() => { calls.length = 0; pages = {}; logs = []; store = new Map(); lang = "es"; cfg = {}; });

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

test("the manifest passes the kit's contract check and declares the site and both players", async () => {
  const text = readFileSync(new URL("../kino-plugin.json", import.meta.url), "utf8");
  const m = JSON.parse(text);
  const v = validateManifest(text);
  assert.ok(!v.errors?.length && v.ok !== false, JSON.stringify(v));
  const { HOSTS } = await import("../src/extractors/index.js");
  for (const h of ["www.lacartoons.com", "lacartoons.com", ...HOSTS]) assert.ok(m.hosts.includes(h), h);
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

test("rpmvid: the AES answer is read, the playlist is the player's own, and it is sent with the player's Referer and Origin", async () => {
  installEpisode(13, 1, [`${RPM_ORIGIN}/#qldpb`]);
  installRpm();
  const s = await plugin.resolve("e:13:1");
  assert.equal(s.url, `${RPM_ORIGIN}/v4/pl/h/cvo/qldpb/master.m3u8?k=K&kx=1`, "cfNative, not the ad-laden TikTok route");
  assert.equal(s.mime, "application/vnd.apple.mpegurl");
  assert.equal(s.headers.Referer, RPM_ORIGIN + "/");
  assert.equal(s.headers.Origin, RPM_ORIGIN);
  assert.match(s.headers["User-Agent"], /Chrome/);
  assert.equal(s.label, "RPMVid");
  assert.equal(s.alternatives, undefined);
});

test("rpmvid: a garbled answer or a video id that is not one gives nothing, not a crash", async () => {
  assert.equal(settingsOf("zz", kino), null);
  assert.equal(settingsOf(encrypt({ a: 1 }), kino).a, 1);
  installEpisode(13, 1, [`${RPM_ORIGIN}/#qldpb`]);
  pages[`${RPM_ORIGIN}/api/v1/video?id=qldpb&w=1280&h=720&r=www.lacartoons.com`] = { body: "not hex at all" };
  await assert.rejects(plugin.resolve("e:13:1"), (e) => e.code === "not_found" && /Ningún servidor/.test(e.userMessage));
  installEpisode(14, 1, [`${RPM_ORIGIN}/#`]);
  await assert.rejects(plugin.resolve("e:14:1"), (e) => e.code === "not_found");
});

test("resolve: ok.ru is tried first (a plain MP4, best rendition, never the phone-sized one) and RPMVid follows as an alternative; settings can flip the order", async () => {
  installEpisode(500, 2, ["https://ok.ru/videoembed/1398320007753", `${RPM_ORIGIN}/#qldpb`]);
  pages["https://ok.ru/videoembed/1398320007753"] = { body: OKRU_PAGE };
  installRpm();
  const s = await plugin.resolve("e:500:2");
  assert.equal(s.url, "https://vd1.okcdn.ru/hd");
  assert.equal(s.mime, "video/mp4");
  assert.equal(s.label, "ok.ru");
  assert.deepEqual(s.alternatives, [{ ref: "c:500:2:1", label: "RPMVid" }]);
  cfg.server = "rpmvid";
  const r = await plugin.resolve("e:500:2");
  assert.equal(r.label, "RPMVid");
  assert.deepEqual(r.alternatives.map((a) => a.label), ["ok.ru"]);
  const c = await plugin.resolve("c:500:2:0");
  assert.equal(c.label, "RPMVid", "with RPMVid preferred, server 0 of the list is RPMVid");
  assert.equal(c.alternatives, undefined);
});

test("resolve: a server that fails falls through to the next; all failing, or nothing known on the page, is a sentence for the person", async () => {
  installEpisode(500, 2, ["https://ok.ru/videoembed/1", `${RPM_ORIGIN}/#qldpb`]);
  pages["https://ok.ru/videoembed/1"] = { body: "<html>removed</html>" };
  installRpm();
  assert.equal((await plugin.resolve("e:500:2")).label, "RPMVid");
  pages[`${RPM_ORIGIN}/api/v1/video?id=qldpb&w=1280&h=720&r=www.lacartoons.com`] = { status: 503, body: "" };
  await assert.rejects(plugin.resolve("e:500:2"), (e) => e.code === "not_found" && /Ningún servidor/.test(e.userMessage));
  installEpisode(7, 1, ["https://unknown.example/e/1"]);
  await assert.rejects(plugin.resolve("e:7:1"), (e) => e.code === "not_found");
  await assert.rejects(plugin.resolve("x:1"), (e) => e.code === "not_found");
  assert.equal(extractorFor("https://voe.sx/e/1"), null);
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
