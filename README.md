# LA Cartoons Plus para Kino

Plugin de [Kino](https://github.com/kinotvapp/kino-light) para ver **dibujos animados clásicos doblados al español** de
[lacartoons.com](https://www.lacartoons.com/): unos 400, organizados por la cadena de TV que los emitió.

> Plugin no oficial. El catálogo y los videos pertenecen a lacartoons.com y a los servidores donde están alojados; este plugin solo los
> lista y abre dentro de Kino.

## Instalar

En Kino: **Ajustes ▸ Plugins ▸ Agregar**, y pega:

```
xuper-plugin/kino-plugin-lacartoons
```

## Qué trae

- **Una sección propia** («Dibujos», en Inicio en el teléfono y en la barra lateral en la TV) con una pestaña por cadena —*Nickelodeon*,
  *Cartoon Network*, *Fox Kids*, *Hanna Barbera*, *Disney*, *Warner Channel*, *Marvel* y *Otros*— y un destacado con la primera carátula.
- **Inicio** con una fila por cadena (cada una con «Ver más» y páginas), **categorías** con las ocho cadenas y **búsqueda** por título.
- **Series con sus temporadas y capítulos**, con sinopsis, carátula y fondo del sitio.
- **Reproducción** con los dos reproductores del sitio: ok.ru (un MP4) y RPMVid (HLS). Kino abre el primero que funcione y deja el otro en
  el menú **Servidor**. También se puede **descargar**.
- **Ajustes ▸ LA Cartoons Plus**: servidor preferido (automático, ok.ru o RPMVid) y vaciar la caché.
- Las carátulas son las del propio sitio. El icono usa su marca: el texto «LACARTOONS» en la tipografía Luckiest Guy (licencia libre) que el
  sitio emplea en su cabecera.

## Cómo funciona RPMVid

El reproductor RPMVid es una aplicación de JavaScript. El plugin le pide a su API los datos del video, que llegan cifrados con AES-128-CBC
(en hexadecimal); los descifra con `kino.crypto` y toma la lista HLS del propio dominio del reproductor. Los segmentos del video solo se
entregan con el `Referer` y el `Origin` del reproductor, que Kino envía con cada uno. La variante «TikTok» de la lista se descarta: lleva
segmentos de anuncios.

## Límites

- Si un capítulo solo ofrece un reproductor que no está en la lista (por ahora solo ok.ru y RPMVid), no se abre y Kino lo dice.
- El sitio no combina el filtro de cadena con el de título, así que la búsqueda dentro de una cadena la hace Kino sobre lo ya cargado.

## Desarrollo

```
npm test            # pruebas sin red
npm run validate    # compila plugin.js y valida el manifiesto con el kit
node sdk/run.mjs ./plugin.js home
node sdk/run.mjs ./plugin.js resolve 'e:13:1'
```

Licencia Apache-2.0 (ver `LICENSE` y `NOTICE`).
