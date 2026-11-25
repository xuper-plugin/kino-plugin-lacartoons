# Changelog

## 0.4.10

- Home rows open their full list with Ver más

## 0.4.9

- The catalog door also lists a series' episodes, for the author's other plugins (std 1.10.1)

## 0.4.8

- Categorías: every network tile now shows a picture (a famous cartoon of the network, static, no extra requests; Otros stays plain)

## 0.4.7

- A rich Home that opens at once: a ready slider (TMDB backdrops and synopses) and at least 4 rows, from a snapshot in this repository refreshed every 6 hours (the site only as a fallback) (std 1.8.1)

## 0.4.6

- Back arrow instead of the X: leaving goes back to where you came from (std 1.7.1)

## 0.4.5

- Catalog door: Da-Video finds titles here (std 1.7.0)

## 0.4.4

- Kino's own settings form shows again in Ajustes (settingsIn both); Retry keeps the queued work (std 1.6.2)

## 0.4.3

- Back closes the search box (the screen declares onBack while searching) instead of the whole screen (std 1.6.1)

## 0.4.2

- Back closes the search box instead of the screen; a tab Kino cut short offers Retry instead of skeletons; fewer TMDB lookups per tick (std 1.6.0)

## 0.4.1

- The standard screen catches up: a hero from TMDB backdrops when the site has none, TMDB lookups three at a time, one card shape per rail, a row's English title (std 1.5.1)

## 0.4.0

- The standard xuper-plugin screen (src/std 1.4.0): one bar with the logo and the name, Buscar (the words go to Kino's own search) and Ajustes (Kino's own form of the settings, and the donation); a hero of slides; cards and slides open Kino's own title page. The plugin's own search page is gone. apiVersion 30 (Kino 0.9.91).

## 0.1.5

- Home (and every call) leaves at its own budget: Kino waits for every request a call left running before it delivers the answer, so a Home that skipped a slow row was still held until that request ended or retried (measured on users' devices: Home ran 21-34 s with rows logged as skipped, and Kino threw the answer away at 20 s). The plugin now asks Kino to drop what a call leaves running (`globalThis.__kinoDropPendingFetches = true`, read by Kino 0.9.55 and later; an older Kino ignores it), with a test (`test/dropFetches.test.mjs`).

## 0.1.4

- Home answers inside Kino's 20 s. Measured on users' devices (TV boxes and sticks) Home ran 21-26 s and Kino threw the whole answer away: the rows were asked with `Promise.all`, so the slowest site (each request may wait 15 s) decided. Now the rows are asked together and the ones that answer inside 11 s are shown; slow ones go on filling the cache for the next opening, and the last Home that worked is kept (12 h) for when none answers in time (`src/util/home.js`, tests in `test/home.test.mjs`).

## 0.1.3

- A search that finds nothing now tries the work's original title and the other titles Kino knows (`originalTitle`, `altTitles`) and the typed text cut at its first colon or dash, and an empty answer is no longer kept in the cache for ten minutes. (Found searching "Yosuga no Sora" in SoloLatino.)
  / Una búsqueda sin resultados ahora prueba el título original, los otros títulos que Kino conoce y el texto cortado en el primer dos puntos o guion; una respuesta vacía ya no se guarda diez minutos en la caché.

## 0.1.2

- The plugin is now called **LA Cartoons Plus** (its id, `lacartoons`, stays, so installed copies keep updating).
  / El plugin ahora se llama **LA Cartoons Plus** (su id, `lacartoons`, no cambia: las copias instaladas se siguen actualizando).

## 0.1.1

- `telemetry` added: with the person's consent, failed calls send their log lines to Kino's error log.
  / Se agrega `telemetry`: con permiso de la persona, las llamadas que fallan envían sus líneas al registro de errores de Kino.

## 0.1.0

- First version, built on Kino's plugin API from the start: eight **Home rows** (one per TV network: Nickelodeon, Cartoon Network, Fox Kids,
  Hanna Barbera, Disney, Warner Channel, Marvel, Otros), a **section of its own** ("Dibujos", a tab per network, a hero with the first
  cover), **categories**, **search**, **seasons and episodes**, a **settings form** (preferred server, status, clear the cache), an amber
  **theme**, the **download** capability and English texts. Playback with the site's two players: ok.ru (a plain MP4) and RPMVid (HLS).
  Needs Kino 0.9.55.
  / Primera versión, con la API de Kino desde el principio: filas por cadena, sección propia con una pestaña por cadena, categorías,
  búsqueda, temporadas y capítulos, ajustes, tema ámbar, descargas y textos en inglés; reproducción con ok.ru y RPMVid.
