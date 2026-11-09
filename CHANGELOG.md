# Changelog

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
