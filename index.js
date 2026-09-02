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
    url: "https://pub-31c3df763d1f4f2bbd2602595581aa82.r2.dev/Bluey/S01e01/bluey%20s02/BlueyS01E02.m3u8",
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
const SEGMENTOS_ATRÁS = 8;
const SEGMENTOS_ADELANTOS = 4;

let scheduleCache = null;
let scheduleCacheTime = 0;
let schedulePromise = null;

función errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

función resolveUri(uri, baseUrl) {
  intentar {
    devolver nueva URL(uri.trim(), baseUrl).href;
  } atrapar {
    throw new Error(`URI inválida en el M3U8: ${uri}`);
  }
}

// Convierte URI="segmento.ts" de etiquetas como EXT-X-MAP o EXT-X-KEY a una URI
// absoluta. Sin esto, el cliente intentaría buscarla dentro del Worker.
función makeTagAbsolute(etiqueta, baseUrl) {
  return tag.replace(/URI\s*=\s*"([^"]+)"/i, (_whole, uri) => {
    return `URI="${resolveUri(uri, baseUrl)}"`;
  });
}

función parseBandwidth (etiqueta) {
  const match = tag.match(/(?:^|,)BANDWIDTH\s*=\s*(\d+)/i);
  devolver coincidencia ? Número(coincidencia[1]) : 0;
}

// Si el enlace entregado es una playlist maestra, se selecciona la variante de
// mayor bitrate y luego se procesa como playlist de medios.
función findBestVariant(texto, baseUrl) {
  const líneas = texto.split(/\r?\n/);
  const variantes = [];

  para (sea i = 0; i < lines.length; i += 1) {
    const línea = líneas[i].trim();
    if (!line.toUpperCase().startsWith("#EXT-X-STREAM-INF:")) continue;

    sea ​​uri = null;
    para (sea j = i + 1; j < lines.length; j += 1) {
      const next = lines[j].trim();
      si (!siguiente) continuar;
      si (!next.startsWith("#")) {
        uri = resolveUri(next, baseUrl);
      }
      romper;
    }

    if (uri) variants.push({ uri, bandwidth: parseBandwidth(line) });
  }

  si (!variantes.length) {
    throw new Error("La playlist maestra no contiene variantes de video");
  }

  variantes.ordenar((a, b) => a.ancho de banda - b.ancho de banda);
  devolver variantes[variantes.length - 1].uri;
}

función asíncrona fetchPlaylist(url) {
  const respuesta = esperar a obtener(url, {
    cf: {
      cacheTtl: SOURCE_CACHE_TTL_SECONDS,
      cacheEverything: verdadero,
    },
  });

  si (!respuesta.ok) {
    throw new Error(`HTTP ${response.status} al cargar ${url}`);
  }

  devolver {
    texto: esperar respuesta.text(),
    URL final: respuesta.url || url,
  };
}

// Lee una playlist de medios y conserva también MAP, KEY y BYTERANGE cuando
// existe. Así funciona tanto con segmentos MPEG-TS como con fMP4.
función asíncrona loadEpisode(episode, episodeIndex, depth = 0) {
  si (profundidad > 2) {
    throw new Error(`Demasiadas playlists maestras encadenadas en ${episode.nombre}`);
  }

  const loaded = await fetchPlaylist(episode.url);
  const baseUrl = new URL(loaded.finalUrl);
  const texto = texto cargado;

  si (/#EXT-X-STREAM-INF:/i.test(texto)) {
    const variantUrl = findBestVariant(text, baseUrl);
    return loadEpisode({ ...episode, url: variantUrl }, episodeIndex, depth + 1);
  }

  const líneas = texto.split(/\r?\n/);
  const segmentos = [];
  let pendingDuration = null;
  let pendingByteRange = null;
  sea ​​pendingDiscontinuity = falso;
  sea ​​currentMapTag = null;
  let currentKeyTag = null;
  sea ​​localIndex = 0;

  para (const rawLine de líneas) {
    const línea = rawLine.trim();
    si (!línea) continuar;

    if (line.toUpperCase().startsWith("#EXT-X-MAP:")) {
      currentMapTag = makeTagAbsolute(línea, baseUrl);
      continuar;
    }

    if (line.toUpperCase().startsWith("#EXT-X-KEY:")) {
      currentKeyTag = makeTagAbsolute(línea, baseUrl);
      continuar;
    }

    if (line.toUpperCase().startsWith("#EXT-X-BYTERANGE:")) {
      Rango de bytes pendientes = línea;
      continuar;
    }

    if (line.toUpperCase() === "#EXT-X-DISCONTINUITY") {
      DiscontinuidadPendiente = verdadero;
      continuar;
    }

    if (line.toUpperCase().startsWith("#EXTINF:")) {
      const match = line.match(/^#EXTINF:\s*([0-9]+(?:\.[0-9]+)?)/i);
      si (!coincidencia) {
        throw new Error(`EXTINF inválido en ${episode.nombre}: ${line}`);
      }

      pendingDuration = Number(match[1]);
      Si (!Number.isFinite(pendingDuration) || pendingDuration <= 0) {
        throw new Error(`Duración inválida en ${episode.nombre}: ${line}`);
      }
      continuar;
    }

    // Una línea que no comienza con # es la URI del segmento que sigue a EXTINF.
    if (!line.startsWith("#") && pendingDuration !== null) {
      segmentos.push({
        duración: pendienteDuración,
        uri: resolverUri(línea,baseUrl),
        mapTag: currentMapTag,
        keyTag: currentKeyTag,
        rango de bytes: rango de bytes pendientes,
        Discontinuidad de origen: Discontinuidad pendiente,
        índice de episodios,
        episodeName: episode.nombre,
        índice local,
      });

      índice local += 1;
      pendingDuration = null;
      pendingByteRange = null;
      DiscontinuidadPendiente = falso;
    }
  }

  si (!longitud de segmentos) {
    throw new Error(`No se encontraron segmentos en ${episode.nombre}`);
  }

  segmentos de retorno;
}

función asíncrona buildSchedule() {
  const episodeLists = await Promise.all(
    EPISODIOS.map((episodio, índice) => loadEpisode(episodio, índice)),
  );

  const segmentos = [];
  sea ​​total = 0;
  sea ​​targetDuration = 1;

  para (const episodeSegments de episodeLists) {
    para (const sourceSegment de episodeSegments) {
      const duración = sourceSegment.duration;
      segmentos.push({
        ...segmento de origen,
        inicio: total,
        fin: total + duración,
      });
      total += duración;
      targetDuration = Math.max(targetDuration, Math.ceil(duration));
    }
  }

  Si (!segmentos.longitud || !Número.esFinito(total) || total <= 0) {
    throw new Error("El calendario no tiene una duración válida");
  }

  // Prefijo[i] = cantidad de discontinuidades anteriores al segmento i dentro de
  // una vuelta. Se conservan discontinuidades que ya vinieran en el M3U8 de
  // origen y se añadió una al cambiar de episodio.
  const discontinuitiesBefore = new Array(segments.length + 1).fill(0);
  para (sea i = 0; i < segments.length; i += 1) {
    const episodeChanged =
      i > 0 && segmentos[i - 1].episodeIndex !== segmentos[i].episodeIndex;
    const hasSourceDiscontinuity = Boolean(segments[i].sourceDiscontinuity);
    discontinuidadesAntes[i + 1] =
      discontinuidadesAntes[i] +
      (episodeChanged || hasSourceDiscontinuity ? 1 : 0);
  }

  devolver {
    segmentos,
    total,
    duración objetivo,
    playlistVersion: segmentos.some((segmento) => segmento.mapTag)
      ¿6?
      : segmentos.some((segmento) => segmento.byteRange)
        ¿4?
        : 3,
    discontinuidadesAntes,
    // Una vuelta incluye las discontinuidades internas y el salto cicloâ†'ciclo.
    Discontinuidades del ciclo: discontinuidadesAntes[segmentos.longitud] + 1,
  };
}

función asíncrona getSchedule() {
  const ahora = Fecha.ahora();
  si (scheduleCache && ahora - scheduleCacheTime < SCHEDULE_TTL_MS) {
    devolver scheduleCache;
  }

  // Evita que muchas solicitudes simultáneas descarguen todos los M3U8 a la vez.
  si (!schedulePromise) {
    schedulePromise = buildSchedule()
      .then((schedule) => {
        scheduleCache = planificación;
        scheduleCacheTime = Date.now();
        calendario de regreso;
      })
      .catch((error) => {
        // Si ya existe un calendario válido, conserva la señal aunque un M3U8
        // tenga un fallo temporal de red. La siguiente solicitud volverá a
        // intentar actualizarlo porque no se modifica ScheduleCacheTime.
        si (scheduleCache) {
          console.error("No se pudo actualizar el calendario; se conserva el anterior:", error);
          devolver scheduleCache;
        }
        lanzar error;
      })
      .finalmente(() => {
        schedulePromise = null;
      });
  }

  Promesa de regreso del cronograma;
}

función obtenerEstadoEnVivo(horario, ahoraSegundos) {
  // Antes del EPOCH la señal queda posicionada en el primer segmento.
  const transcurrido = Math.max(0, nowSeconds - EPOCH);
  let ciclo = Math.floor(transcurrido / horario.total);
  sea ​​posición = transcurrido - ciclo * horario.total;

  // Evita que un pequeño error de coma flotante coloque la señal en un
  // segmento inexistente justo al cambiar de vuelta.
  Si (posición < 0) posición = 0;
  si (posición >= horario.total) {
    ciclo += 1;
    posición = 0;
  }

  sea ​​bajo = 0;
  sea ​​alto = schedule.segments.length - 1;
  sea ​​índice = alto;

  // Búsqueda binaria con las duraciones acumuladas reales.
  mientras (bajo <= alto) {
    const medio = Math.floor((bajo + alto) / 2);
    const segmento = schedule.segments[middle];

    si (posición < segmento.inicio) {
      alto = medio - 1;
    } else if (posición >= segmento.fin) {
      bajo = medio + 1;
    } demás {
      índice = medio;
      romper;
    }
  }

  devolver {
    ciclo,
    posición,
    índice,
    absoluto: ciclo * longitud.segmentos.programados + índice,
  };
}

función segmentForAbsolute(horario, absoluto) {
  const count = schedule.segments.length;
  const índice = ((conteo absoluto) + conteo) % conteo;
  devolver schedule.segments[index];
}

función hasDiscontinuityBefore(schedule, absolute) {
  Si (absoluto < 0) devolver falso;

  const count = schedule.segments.length;
  const índice = recuento absoluto %;

  si (absoluto === 0) {
    devolver Booleano(schedule.segments[0].sourceDiscontinuity);
  }

  // Cada nueva vuelta empieza con una discontinuidad explícita.
  Si (índice === 0) devolver verdadero;

  const previous = schedule.segments[index - 1];
  const actual = schedule.segments[index];
  devolver (
    índice.episodio.anterior !== índice.episodio.actual ||
    Booleano(current.sourceDiscontinuity)
  );
}

función discontinuitySequenceBefore(schedule, absolute) {
  Si (absoluto <= 0) devuelve 0;

  const count = schedule.segments.length;
  const ciclo = Math.floor(absoluto / conteo);
  const índice = absoluto - ciclo * recuento;

  devolver (
    ciclo * programación.cicloDiscontinuidades +
    horario.discontinuidadesAntes[índice]
  );
}

función programDateTimeFor(horario, absoluto, segmento) {
  const ciclo = Math.floor(absoluto / schedule.segments.length);
  devolver ÉPOCA + ciclo * programa.total + segmento.inicio;
}

función construirListaDeReproducciónEnVivo(horario, estado) {
  const first = Math.max(0, state.absolute - BACK_SEGMENTS);
  const last = state.absolute + AHEAD_SEGMENTS;
  const líneas = [
    "#EXTM3U",
    `#EXT-X-VERSION:${schedule.playlistVersion}`,
    `#EXT-X-TARGETDURATION:${schedule.targetDuration}`,
    `#EXT-X-MEDIA-SEQUENCE:${first}`,
    `#EXT-X-DISCONTINUITY-SEQUENCE:${discontinuitySequenceBefore(schedule, first)}`,
  ];

  let previousMapTag = null;
  let previousKeyTag = null;

  para (sea absoluto = primero; absoluto <= último; absoluto += 1) {
    const segmento = segmentoParaAbsoluto(horario, absoluto);
    const discontinuidad = hasDiscontinuityBefore(programación, absoluto);

    si (discontinuidad) {
      líneas.push("#EXT-X-DISCONTINUITY");
      // Al cruzar una discontinuidad, el decodificador debe volver a recibir
      // el mapa de inicialización si el origen usa fMP4.
      previousMapTag = null;
      // Reafirma también la clave del nuevo tramo si el origen usa cifrado.
      previousKeyTag = null;
    }

    si (segmento.mapTag && segmento.mapTag !== previousMapTag) {
      líneas.push(segmento.mapTag);
      previousMapTag = segmento.mapTag;
    }

    Si (segmento.keyTag !== previousKeyTag) {
      // METHOD=NONE limpia una clave de un episodio anterior si el siguiente no
      // está cifrado.
      líneas.push(segmento.keyTag || "#EXT-X-KEY:METHOD=NONE");
      previousKeyTag = segmento.keyTag;
    }

    const pdt = programDateTimeFor(schedule, absolute, segment);
    líneas.push(`#EXT-X-PROGRAM-DATE-TIME:${new Date(pdt * 1000).toISOString()}`);

    if (segment.byteRange) lines.push(segment.byteRange);

    líneas.push(`#EXTINF:${segmento.duración.toFixed(6)},`);
    líneas.push(segmento.uri);
  }

  // No se agrega EXT-X-ENDLIST: esta lista de reproducción es deliberadamente infinita y
  // seguirÃ¡ cambiando al avanzar el reloj.
  return `${lines.join("\n")}\n`;
}

función hlsHeaders() {
  devolver {
    "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
    "cdn-cache-control": "no-store",
    pragma: "no-cache",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, HEAD, OPTIONS",
    "access-control-allow-headers": "*",
  };
}

función jsonResponse(valor, estado = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    estado,
    encabezados: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, HEAD, OPTIONS",
      "access-control-allow-headers": "*",
    },
  });
}

exportar por defecto {
  obtención asíncrona(solicitud) {
    const url = nueva URL(solicitud.url);

    si (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: hlsHeaders() });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Método no permitido", {
        estado: 405,
        encabezados: { ...hlsHeaders(), permitir: "GET, HEAD, OPTIONS" },
      });
    }

    intentar {
      const schedule = await getSchedule();
      // Se conserva la fracción de segundo para que el cambio de segmento no
      // se retrocede hasta un segundo completo cuando termina un episodio.
      const estado = obtenerEstadoEnVivo(horario, Fecha.ahora() / 1000);

      si (url.pathname === "/live.m3u8") {
        const playlist = buildLivePlaylist(schedule, state);
        return new Response(request.method === "HEAD" ? null : playlist, {
          encabezados: hlsHeaders(),
        });
      }

      if (url.pathname === "/status") {
        const segmento = schedule.segments[state.index];
        return jsonResponse({
          canal: "Bluey 24/7",
          episodio: segment.episodeName,
          segmento: segmento.localIndex,
          ciclo: ciclo.estado,
          posicionEnCiclo: Number(state.position.toFixed(3)),
          duracionDelCiclo: Number(schedule.total.toFixed(3)),
          mediaSequence: estado.absoluto,
          siguienteSegmento: segmentForAbsolute(horario, estado.absoluto + 1).uri,
        });
      }

      return new Response("Bluey 24/7 EN VIVO. Usa /live.m3u8", {
        encabezados: hlsHeaders(),
      });
    } catch (error) {
      console.error("Error en Bluey 24/7:", error);
      return new Response(`Error generando la señal: ${errorText(error)}`, {
        estado: 502,
        encabezados: hlsHeaders(),
      });
    }
  },
};
