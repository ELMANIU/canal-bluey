// BLUEY 24/7 & GRAVITY FALLS 24/7 & BAJOTERRA 24/7 - Cloudflare Worker HLS lineal

// ============ CONFIGURACIÓN DE CANALES ============
const CANALES = {
  bluey: {
    nombre: "Bluey 24/7",
    epoch: Date.UTC(2026, 0, 1, 0, 0, 0) / 1000,
    episodios: [
      {
        nombre: "Bluey S01E01",
        url: "https://pub-31c3df763d1f4f2bbd2602595581aa82.r2.dev/Bluey/S01e01/bluey/BlueyS01E01.m3u8",
      },
      {
        nombre: "Bluey S01E02",
        url: "https://pub-31c3df763d1f4f2bbd2602595581aa82.r2.dev/Bluey/S01e01/bluey%20s02/BlueyS01E02.m3u8",
      },
    ],
  },
  gravityfalls: {
    nombre: "Gravity Falls 24/7",
    epoch: Date.UTC(2024, 6, 1, 0, 0, 0) / 1000,
    episodios: [
      {
        nombre: "Gravity Falls S01E01",
        url: "https://hugh.cdn.rumble.cloud/video/fwe2/06/s8/2/G/M/D/V/GMDVA.caa.tar?r_file=chunklist.m3u8&r_type=application%2Fvnd.apple.mpegurl&r_range=166684672-166697264",
      },
      {
        nombre: "Gravity Falls S01E02",
        url: "https://hugh.cdn.rumble.cloud/video/fww1/9f/s8/2/o/P/D/V/oPDVA.haa.tar?r_file=chunklist.m3u8&r_type=application%2Fvnd.apple.mpegurl&r_range=665805824-665818855",
      },
      {
        nombre: "Gravity Falls S01E03",
        url: "https://hugh.cdn.rumble.cloud/video/fww1/79/s8/2/Q/Q/D/V/QQDVA.haa.tar?r_file=chunklist.m3u8&r_type=application%2Fvnd.apple.mpegurl&r_range=675152384-675165606",
      },
      {
        nombre: "Gravity Falls S01E04",
        url: "https://hugh.cdn.rumble.cloud/video/fww1/69/s8/2/M/S/D/V/MSDVA.haa.tar?r_file=chunklist.m3u8&r_type=application%2Fvnd.apple.mpegurl&r_range=689944064-689957599",
      },
      {
        nombre: "Gravity Falls S01E05",
        url: "https://hugh.cdn.rumble.cloud/video/fwe2/11/s8/2/m/U/D/V/mUDVA.haa.tar?r_file=chunklist.m3u8&r_type=application%2Fvnd.apple.mpegurl&r_range=632708096-632720414",
      },
      {
        nombre: "Gravity Falls S01E06",
        url: "https://hugh.cdn.rumble.cloud/video/fwe2/58/s8/2/K/e/L/V/KeLVA.haa.tar?r_file=chunklist.m3u8&r_type=application%2Fvnd.apple.mpegurl&r_range=698421760-698435390",
      },
      {
        nombre: "Gravity Falls S01E07",
        url: "https://hugh.cdn.rumble.cloud/video/fwe2/5d/s8/2/u/s/L/V/usLVA.haa.tar?r_file=chunklist.m3u8&r_type=application%2Fvnd.apple.mpegurl&r_range=698655744-698669370",
      },
      {
        nombre: "Gravity Falls S01E08",
        url: "https://hugh.cdn.rumble.cloud/video/fww1/50/s8/2/4/y/L/V/4yLVA.haa.tar?r_file=chunklist.m3u8&r_type=application%2Fvnd.apple.mpegurl&r_range=665725440-665738471",
      },
      {
        nombre: "Gravity Falls S01E09",
        url: "https://hugh.cdn.rumble.cloud/video/fwe2/23/s8/2/6/B/L/V/6BLVA.haa.tar?r_file=chunklist.m3u8&r_type=application%2Fvnd.apple.mpegurl&r_range=697114112-697127735",
      },
      {
        nombre: "Gravity Falls S01E10",
        url: "https://hugh.cdn.rumble.cloud/video/fww1/57/s8/2/q/E/L/V/qELVA.haa.tar?r_file=chunklist.m3u8&r_type=application%2Fvnd.apple.mpegurl&r_range=698099712-698113339",
      },
    ],
  },
  bajoterra: {
    nombre: "Bajoterra 24/7",
    epoch: Date.UTC(2024, 6, 1, 0, 0, 0) / 1000,
    episodios: [
      {
        nombre: "Bajoterra S01E01",
        url: "https://hugh.cdn.rumble.cloud/video/fww1/38/s8/2/A/F/Z/V/AFZVA.haa.tar?r_file=chunklist.m3u8&r_type=application%2Fvnd.apple.mpegurl&r_range=678022144-678035468",
      },
      {
        nombre: "Bajoterra S01E02",
        url: "https://hugh.cdn.rumble.cloud/video/fwe2/73/s8/2/i/P/Z/V/iPZVA.haa.tar?r_file=chunklist.m3u8&r_type=application%2Fvnd.apple.mpegurl&r_range=678354944-678368272",
      },
      {
        nombre: "Bajoterra S01E03",
        url: "https://hugh.cdn.rumble.cloud/video/fww1/89/s8/2/2/U/Z/V/2UZVA.haa.tar?r_file=chunklist.m3u8&r_type=application%2Fvnd.apple.mpegurl&r_range=679327232-679340467",
      },
      {
        nombre: "Bajoterra S01E04",
        url: "https://hugh.cdn.rumble.cloud/video/fww1/21/s8/2/Y/s/0/V/Ys0VA.haa.tar?r_file=chunklist.m3u8&r_type=application%2Fvnd.apple.mpegurl&r_range=679844352-679857677",
      },
    ],
  },
};

// ============ CONFIGURACIÓN GLOBAL ============
const SCHEDULE_TTL_MS = 5 * 60 * 1000;
const SOURCE_CACHE_TTL_SECONDS = 60 * 60;
const SEGMENTOS_ATRAS = 15;
const SEGMENTOS_ADELANTOS = 12;

// ============ CACHÉ POR CANAL ============
const scheduleCache = {};
const scheduleCacheTime = {};
let schedulePromise = {};

// ============ FUNCIONES AUXILIARES ============
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

function makeTagAbsolute(tag, baseUrl) {
  return tag.replace(/URI\s*=\s*"([^"]+)"/i, (_whole, uri) => {
    return `URI="${resolveUri(uri, baseUrl)}"`;
  });
}

function parseBandwidth(tag) {
  const match = tag.match(/(?:^|,)BANDWIDTH\s*=\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
}

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

async function loadEpisode(episode, episodeIndex, depth = 0, channelName) {
  if (depth > 2) {
    throw new Error(`Demasiadas playlists maestras encadenadas en ${episode.nombre}`);
  }

  const loaded = await fetchPlaylist(episode.url);
  const baseUrl = new URL(loaded.finalUrl);
  const text = loaded.text;

  if (/#EXT-X-STREAM-INF:/i.test(text)) {
    const variantUrl = findBestVariant(text, baseUrl);
    return loadEpisode({ ...episode, url: variantUrl }, episodeIndex, depth + 1, channelName);
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

async function buildSchedule(channelKey) {
  const channel = CANALES[channelKey];
  const episodeLists = await Promise.all(
    channel.episodios.map((episode, index) => loadEpisode(episode, index, 0, channelKey)),
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
    cycleDiscontinuities: discontinuitiesBefore[segments.length] + 1,
    channelName: channel.nombre,
    epoch: channel.epoch,
  };
}

async function getSchedule(channelKey) {
  const now = Date.now();
  if (scheduleCache[channelKey] && now - scheduleCacheTime[channelKey] < SCHEDULE_TTL_MS) {
    return scheduleCache[channelKey];
  }

  if (!schedulePromise[channelKey]) {
    schedulePromise[channelKey] = buildSchedule(channelKey)
      .then((schedule) => {
        scheduleCache[channelKey] = schedule;
        scheduleCacheTime[channelKey] = Date.now();
        return schedule;
      })
      .catch((error) => {
        if (scheduleCache[channelKey]) {
          console.error(`No se pudo actualizar ${channelKey}; se conserva el anterior:`, error);
          return scheduleCache[channelKey];
        }
        throw error;
      })
      .finally(() => {
        schedulePromise[channelKey] = null;
      });
  }

  return schedulePromise[channelKey];
}

function getLiveState(schedule, nowSeconds) {
  const elapsed = Math.max(0, nowSeconds - schedule.epoch);
  let cycle = Math.floor(elapsed / schedule.total);
  let position = elapsed - cycle * schedule.total;

  if (position < 0) position = 0;
  if (position >= schedule.total - 0.05) {
    cycle += 1;
    position = 0;
  }

  let low = 0;
  let high = schedule.segments.length - 1;
  let index = high;

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
  return schedule.epoch + cycle * schedule.total + segment.start;
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
      previousMapTag = null;
      previousKeyTag = null;
    }

    if (segment.mapTag && segment.mapTag !== previousMapTag) {
      lines.push(segment.mapTag);
      previousMapTag = segment.mapTag;
    }

    if (segment.keyTag !== previousKeyTag) {
      lines.push(segment.keyTag || "#EXT-X-KEY:METHOD=NONE");
      previousKeyTag = segment.keyTag;
    }

    const pdt = programDateTimeFor(schedule, absolute, segment);
    lines.push(`#EXT-X-PROGRAM-DATE-TIME:${new Date(pdt * 1000).toISOString()}`);

    if (segment.byteRange) lines.push(segment.byteRange);

    lines.push(`#EXTINF:${segment.duration.toFixed(6)},`);
    lines.push(segment.uri);
  }

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

// ============ MANEJADOR PRINCIPAL ============
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

    // ===== DETECTAR CANAL =====
    let channelKey = null;
    
    const pathParts = url.pathname.split('/').filter(p => p);
    if (pathParts.length >= 1) {
      const possibleKey = pathParts[0];
      if (CANALES[possibleKey]) {
        channelKey = possibleKey;
      }
    }

    // Si no se especificó canal, mostrar índice
    if (!channelKey) {
      return jsonResponse({
        mensaje: "Canales disponibles",
        canales: Object.keys(CANALES).map(key => ({
          nombre: CANALES[key].nombre,
          url: `/${key}/live.m3u8`,
          status: `/${key}/status`,
        })),
      });
    }

    try {
      const schedule = await getSchedule(channelKey);
      const state = getLiveState(schedule, Date.now() / 1000);

      // ===== RUTAS DEL CANAL =====
      const remainingPath = '/' + pathParts.slice(1).join('/');

      if (remainingPath === '/live.m3u8' || remainingPath === '') {
        const playlist = buildLivePlaylist(schedule, state);
        return new Response(request.method === "HEAD" ? null : playlist, {
          headers: hlsHeaders(),
        });
      }

      if (remainingPath === '/status') {
        const segment = schedule.segments[state.index];
        return jsonResponse({
          channel: schedule.channelName,
          episode: segment.episodeName,
          segment: segment.localIndex,
          cycle: state.cycle,
          positionInCycle: Number(state.position.toFixed(3)),
          cycleDuration: Number(schedule.total.toFixed(3)),
          mediaSequence: state.absolute,
          nextSegment: segmentForAbsolute(schedule, state.absolute + 1).uri,
        });
      }

      return new Response(`Canal ${schedule.channelName}. Usa /${channelKey}/live.m3u8`, {
        headers: hlsHeaders(),
      });
    } catch (error) {
      console.error(`Error en ${channelKey}:`, error);
      return new Response(`Error generando la señal: ${errorText(error)}`, {
        status: 502,
        headers: hlsHeaders(),
      });
    }
  },
};
