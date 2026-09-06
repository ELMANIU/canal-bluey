// BLUEY 24/7 - Cloudflare Worker HLS lineal
//
// El Worker crea una línea temporal continua con las duraciones REALES de los
// segmentos de cada episodio. Al terminar el último segmento vuelve al primero
// y continúa indefinidamente.

const EPISODIOS = [
  {
    nombre: "Bluey S01E01",
    url: "https://pub-31c3df763d1f4f2bbd2602595581aa82.r2.dev/Bluey/S01e01/bluey/BlueyS01E01.m3u8",
  },
  {
    nombre: "Bluey S01E02",
    url: "https://hugh.cdn.rumble.cloud/video/fwe2/06/s8/2/G/M/D/V/GMDVA.aaa.mp4",
  },
];

// Punto fijo de inicio de la señal. No se reinicia cuando se reinicia el Trabajador.
const EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0) / 1000;

// El calendario se vuelve a leer cada cinco minutos. Los M3U8 de episodios se
// almacenan en la caché de Cloudflare durante una hora porque son archivos VOD.
const SCHEDULE_TTL_MS = 5 * 60 * 1000;
const SOURCE_CACHE_TTL_SECONDS = 60 * 60;

// Ventana de reproducción. Se dejan algunos segmentos atrás para permitir
// retroceder y algunos adelante para que Roku tenga buffer al cambiar de episodio.
const SEGMENTOS_ATRAS = 15;
const SEGMENTOS_ADELANTOS = 12;

let scheduleCache = null;
let scheduleCacheTime = 0;
let schedulePromise = null;

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

function resolveUri(uri, baseUrl) {
  try {
    return new URL(uri.trim(), baseUrl).href;
  } catch {
    throw new Error(`URI inválida en el M3U8: ${uri}`);
  }
}

// Convierte URI="segmento.ts" de etiquetas como EXT-X-MAP o EXT-X-KEY a una URI
// absoluta. Sin esto, el cliente intentaría buscarla dentro del Worker.
function makeTagAbsolute(tag, baseUrl) {
  return tag.replace(/URI\s*=\s*"([^"]+)"/i, (_whole, uri) => {
    return `URI="${resolveUri(uri, baseUrl)}"`;
  });
}

function parseBandwidth(tag) {
  const match = tag.match(/(?:^|,)BANDWIDTH\s*=\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
}

// Si el enlace entregado es una playlist maestra, se selecciona la variante de
// mayor bitrate y luego se procesa como playlist de medios.
function findBestVariant(text, baseUrl) {
  const lines = text.split(/\r?\n/);
  const variants = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.toUpperCase().startsWith("#EXT-X-STREAM-INF:")) continue;

    let uri = null;
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j].trim();
      if (!next) continue;
      if (!next.startsWith("#")) {
        uri = resolveUri(next, baseUrl);
      }
      break;
    }

    if (uri) variants.push({ uri, bandwidth: parseBandwidth(line) });
  }

  if (!variants.length) {
    throw new Error("La playlist maestra no contiene variantes de video");
  }

  variants.sort((a, b) => a.bandwidth - b.bandwidth);
  return variants[variants.length - 1].uri;
}

async function fetchPlaylist(url) {
  const response = await fetch(url, {
    cf: {
      cacheTtl: SOURCE_CACHE_TTL_SECONDS,
      cacheEverything: true,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} al cargar ${url}`);
  }

  return {
    text: await response.text(),
    finalUrl: response.url || url,
  };
}

// Lee una playlist de medios y conserva también MAP, KEY y BYTERANGE cuando
// existe. Así funciona tanto con segmentos MPEG-TS como con fMP4.
async function loadEpisode(episode, episodeIndex, depth = 0) {
  if (depth > 2) {
    throw new Error(`Demasiadas playlists maestras encadenadas en ${episode.nombre}`);
  }

  const loaded = await fetchPlaylist(episode.url);
  const baseUrl = new URL(loaded.finalUrl);
  const text = loaded.text;

  if (/#EXT-X-STREAM-INF:/i.test(text)) {
    const variantUrl = findBestVariant(text, baseUrl);
    return loadEpisode({ ...episode, url: variantUrl }, episodeIndex, depth + 1);
  }

  const lines = text.split(/\r?\n/);
  const segments = [];
  let pendingDuration = null;
  let pendingByteRange = null;
  let pendingDiscontinuity = false;
  let currentMapTag = null;
  let currentKeyTag = null;
  let localIndex = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.toUpperCase().startsWith("#EXT-X-MAP:")) {
      currentMapTag = makeTagAbsolute(line, baseUrl);
      continue;
    }

    if (line.toUpperCase().startsWith("#EXT-X-KEY:")) {
      currentKeyTag = makeTagAbsolute(line, baseUrl);
      continue;
    }

    if (line.toUpperCase().startsWith("#EXT-X-BYTERANGE:")) {
      pendingByteRange = line;
      continue;
    }

    if (line.toUpperCase() === "#EXT-X-DISCONTINUITY") {
      pendingDiscontinuity = true;
      continue;
    }

    if (line.toUpperCase().startsWith("#EXTINF:")) {
      const match = line.match(/^#EXTINF:\s*([0-9]+(?:\.[0-9]+)?)/i);
      if (!match) {
        throw new Error(`EXTINF inválido en ${episode.nombre}: ${line}`);
      }

      pendingDuration = Number(match[1]);
      if (!Number.isFinite(pendingDuration) || pendingDuration <= 0) {
        throw new Error(`Duración inválida en ${episode.nombre}: ${line}`);
      }
      continue;
    }

    // Una línea que no comienza con # es la URI del segmento que sigue a EXTINF.
    if (!line.startsWith("#") && pendingDuration !== null) {
      segments.push({
        duration: pendingDuration,
        uri: resolveUri(line, baseUrl),
        mapTag: currentMapTag,
        keyTag: currentKeyTag,
        byteRange: pendingByteRange,
        sourceDiscontinuity: pendingDiscontinuity,
        episodeIndex,
        episodeName: episode.nombre,
        localIndex,
      });

      localIndex += 1;
      pendingDuration = null;
      pendingByteRange = null;
      pendingDiscontinuity = false;
    }
  }

  if (!segments.length) {
    throw new Error(`No se encontraron segmentos en ${episode.nombre}`);
  }

  return segments;
}

async function buildSchedule() {
  const episodeLists = await Promise.all(
    EPISODIOS.map((episode, index) => loadEpisode(episode, index)),
  );

  const segments = [];
  let total = 0;
  let targetDuration = 1;

  for (const episodeSegments of episodeLists) {
    for (const sourceSegment of episodeSegments) {
      const duration = sourceSegment.duration;
      segments.push({
        ...sourceSegment,
        start: total,
        end: total + duration,
      });
      total += duration;
      targetDuration = Math.max(targetDuration, Math.ceil(duration));
    }
  }

  if (!segments.length || !Number.isFinite(total) || total <= 0) {
    throw new Error("El calendario no tiene una duración válida");
  }

  // Prefijo[i] = cantidad de discontinuidades anteriores al segmento i dentro de
  // una vuelta. Se conservan discontinuidades que ya vinieran en el M3U8 de
  // origen y se añadió una al cambiar de episodio.
  const discontinuitiesBefore = new Array(segments.length + 1).fill(0);
  for (let i = 0; i < segments.length; i += 1) {
    const episodeChanged =
      i > 0 && segments[i - 1].episodeIndex !== segments[i].episodeIndex;
    const hasSourceDiscontinuity = Boolean(segments[i].sourceDiscontinuity);
    discontinuitiesBefore[i + 1] =
      discontinuitiesBefore[i] +
      (episodeChanged || hasSourceDiscontinuity ? 1 : 0);
  }

  return {
    segments,
    total,
    targetDuration,
    playlistVersion: segments.some((segment) => segment.mapTag)
      ? 6
      : segments.some((segment) => segment.byteRange)
        ? 4
        : 3,
    discontinuitiesBefore,
    // Una vuelta incluye las discontinuidades internas y el salto cicloâ†'ciclo.
    cycleDiscontinuities: discontinuitiesBefore[segments.length] + 1,
  };
}

async function getSchedule() {
  const now = Date.now();
  if (scheduleCache && now - scheduleCacheTime < SCHEDULE_TTL_MS) {
    return scheduleCache;
  }

  // Evita que muchas solicitudes simultáneas descarguen todos los M3U8 a la vez.
  if (!schedulePromise) {
    schedulePromise = buildSchedule()
      .then((schedule) => {
        scheduleCache = schedule;
        scheduleCacheTime = Date.now();
        return schedule;
      })
      .catch((error) => {
        // Si ya existe un calendario válido, conserva la señal aunque un M3U8
        // tenga un fallo temporal de red. La siguiente solicitud volverá a
        // intentar actualizarlo porque no se modifica ScheduleCacheTime.
        if (scheduleCache) {
          console.error("No se pudo actualizar el calendario; se conserva el anterior:", error);
          return scheduleCache;
        }
        throw error;
      })
      .finally(() => {
        schedulePromise = null;
      });
  }

  return schedulePromise;
}

function getLiveState(schedule, nowSeconds) {
  // Antes del EPOCH la señal queda posicionada en el primer segmento.
  const elapsed = Math.max(0, nowSeconds - EPOCH);
  let cycle = Math.floor(elapsed / schedule.total);
  let position = elapsed - cycle * schedule.total;

  // Evita que un pequeño error de coma flotante coloque la señal en un
  // segmento inexistente justo al cambiar de vuelta.
  if (position < 0) position = 0;
  if (position >= schedule.total - 0.05) {
    cycle += 1;
    position = 0;
  }

  let low = 0;
  let high = schedule.segments.length - 1;
  let index = high;

  // Búsqueda binaria con las duraciones acumuladas reales.
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const segment = schedule.segments[middle];

    if (position < segment.start) {
      high = middle - 1;
    } else if (position >= segment.end) {
      low = middle + 1;
    } else {
      index = middle;
      break;
    }
  }

  return {
    cycle,
    position,
    index,
    absolute: cycle * schedule.segments.length + index,
  };
}

function segmentForAbsolute(schedule, absolute) {
  const count = schedule.segments.length;
  const index = ((absolute % count) + count) % count;
  return schedule.segments[index];
}

function hasDiscontinuityBefore(schedule, absolute) {
  if (absolute <= 0) return false;

  const count = schedule.segments.length;
  const index = absolute % count;

  // Nuevo ciclo: último episodio -> primer episodio
  if (index === 0) {
    return true;
  }

  const previous = schedule.segments[index - 1];
  const current = schedule.segments[index];

  return (
    previous.episodeIndex !== current.episodeIndex ||
    Boolean(current.sourceDiscontinuity)
  );
}

function discontinuitySequenceBefore(schedule, absolute) {
  if (absolute <= 0) return 0;

  const count = schedule.segments.length;
  const cycle = Math.floor(absolute / count);
  const index = absolute - cycle * count;

  return (
    cycle * schedule.cycleDiscontinuities +
    schedule.discontinuitiesBefore[index]
  );
}

function programDateTimeFor(schedule, absolute, segment) {
  const cycle = Math.floor(absolute / schedule.segments.length);
  return EPOCH + cycle * schedule.total + segment.start;
}

function buildLivePlaylist(schedule, state) {
  const first = Math.max(0, state.absolute - 15);
  const last = state.absolute + 12;
  const lines = [
    "#EXTM3U",
    `#EXT-X-VERSION:${schedule.playlistVersion}`,
    `#EXT-X-TARGETDURATION:${schedule.targetDuration}`,
    `#EXT-X-MEDIA-SEQUENCE:${first}`,
    `#EXT-X-DISCONTINUITY-SEQUENCE:${discontinuitySequenceBefore(schedule, first)}`,
  ];

  let previousMapTag = null;
  let previousKeyTag = null;

  for (let absolute = first; absolute <= last; absolute += 1) {
    const segment = segmentForAbsolute(schedule, absolute);
    const discontinuity = hasDiscontinuityBefore(schedule, absolute);

    if (discontinuity) {
      lines.push("#EXT-X-DISCONTINUITY");
      // Al cruzar una discontinuidad, el decodificador debe volver a recibir
      // el mapa de inicialización si el origen usa fMP4.
      previousMapTag = null;
      // Reafirma también la clave del nuevo tramo si el origen usa cifrado.
      previousKeyTag = null;
    }

    if (segment.mapTag && segment.mapTag !== previousMapTag) {
      lines.push(segment.mapTag);
      previousMapTag = segment.mapTag;
    }

    if (segment.keyTag !== previousKeyTag) {
      // METHOD=NONE limpia una clave de un episodio anterior si el siguiente no
      // está cifrado.
      lines.push(segment.keyTag || "#EXT-X-KEY:METHOD=NONE");
      previousKeyTag = segment.keyTag;
    }

    const pdt = programDateTimeFor(schedule, absolute, segment);
    lines.push(`#EXT-X-PROGRAM-DATE-TIME:${new Date(pdt * 1000).toISOString()}`);

    if (segment.byteRange) lines.push(segment.byteRange);

    lines.push(`#EXTINF:${segment.duration.toFixed(6)},`);
    lines.push(segment.uri);
  }

  // No se agrega EXT-X-ENDLIST: esta lista de reproducción es deliberadamente infinita y
  // seguirÃ¡ cambiando al avanzar el reloj.
  return `${lines.join("\n")}\n`;
}

function hlsHeaders() {
  return {
    "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
    "cdn-cache-control": "no-store",
    pragma: "no-cache",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, HEAD, OPTIONS",
    "access-control-allow-headers": "*",
  };
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, HEAD, OPTIONS",
      "access-control-allow-headers": "*",
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: hlsHeaders() });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Método no permitido", {
        status: 405,
        headers: { ...hlsHeaders(), allow: "GET, HEAD, OPTIONS" },
      });
    }

    try {
      const schedule = await getSchedule();
      // Se conserva la fracción de segundo para que el cambio de segmento no
      // se retrocede hasta un segundo completo cuando termina un episodio.
      const state = getLiveState(schedule, Date.now() / 1000);

      if (url.pathname === "/live.m3u8") {
        const playlist = buildLivePlaylist(schedule, state);
        return new Response(request.method === "HEAD" ? null : playlist, {
          headers: hlsHeaders(),
        });
      }

      if (url.pathname === "/status") {
        const segment = schedule.segments[state.index];
        return jsonResponse({
          channel: "Bluey 24/7",
          episode: segment.episodeName,
          segment: segment.localIndex,
          cycle: state.cycle,
          positionInCycle: Number(state.position.toFixed(3)),
          cycleDuration: Number(schedule.total.toFixed(3)),
          mediaSequence: state.absolute,
          nextSegment: segmentForAbsolute(schedule, state.absolute + 1).uri,
        });
      }

      return new Response("Bluey 24/7 EN VIVO. Usa /live.m3u8", {
        headers: hlsHeaders(),
      });
    } catch (error) {
      console.error("Error en Bluey 24/7:", error);
      return new Response(`Error generando la señal: ${errorText(error)}`, {
        status: 502,
        headers: hlsHeaders(),
      });
    }
  },
};
