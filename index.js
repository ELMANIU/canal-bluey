const EPISODIOS = [
  {
    nombre: "Bluey S01E01",
    URL: "https://pub-31c3df763d1f4f2bbd2602595581aa82.r2.dev/Bluey/S01e01/bluey/BlueyS01E01.m3u8"
  },
  {
    nombre: "Bluey S01E02",
    URL: "https://pub-31c3df763d1f4f2bbd2602595581aa82.r2.dev/Bluey/S01e01/bluey%20s02/BlueyS01E02.m3u8"
  }
];

// Punto fijo del canal real. El canal avanza por reloj aunque nadie está conectado.
const EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0) / 1000;

// Ventana normal del canal y ventana corta para la prueba de transición.
const WINDOW_SEGMENTS = 8;
const TEST_WINDOW_SEGMENTS = 4;
const PRUEBA_ANTES_DEL_FIN_SEGUNDOS = 20;

función asíncrona loadEpisode(episode, episodeIndex) {
  const respuesta = esperar a obtener (episodio.url, {
    cf: { cacheTtl: 60, cacheEverything: true }
  });

  si (!respuesta.ok) {
    throw new Error(`No se pudo cargar ${episode.name} (${response.status})`);
  }

  const texto = esperar respuesta.texto();
  const base = new URL(".", episode.url);
  const regex = /#EXTINF:([\d.]+),\s*\n([^#\r\n]+)/g;

  const segmentos = [];
  dejar coincidencia;

  mientras ((match = regex.exec(text)) !== null) {
    segmentos.push({
      duración: Número(coincidencia[1]),
      uri: nueva URL(match[2].trim(), base).href,
      índice de episodios,
      Nombre del episodio: episode.name
    });
  }

  si (!longitud de segmentos) {
    throw new Error(`La lista de reproducción de ${episode.name} no contiene segmentos`);
  }

  segmentos de retorno;
}

función asíncrona buildSchedule() {
  const episodeLists = await Promise.all(
    EPISODIOS.map((episodio, índice) => cargarEpisodio(episodio, índice))
  );

  const segmentos = episodeLists.flat();
  const inicios = [];
  const episodeDurations = episodeLists.map((list) =>
    lista.reduce((suma, segmento) => suma + segmento.duración, 0)
  );

  sea ​​totalDuration = 0;
  sea ​​targetDuration = 1;

  para (const segmento de segmentos) {
    comienza.push(duración total);
    duraciónTotal += duraciónSegmento;
    targetDuration = Math.max(targetDuration, Math.ceil(segment.duration));
  }

  devolver {
    segmentos,
    comienza,
    duración total,
    Duración de los episodios,
    duración objetivo
  };
}

función obtenerPosiciónDesdeTranscurrido(horario, segundosTranscurridos) {
  const { segmentos, inicios, duración total } = programación;
  const elapsed = Math.max(0, elapsedSeconds);

  const loopNumber = Math.floor(elapsed / totalDuration);
  const posición = transcurrido % duración total;

  sea ​​currentIndex = segmentos.length - 1;

  para (sea i = 0; i < segments.length; i++) {
    si (
      posición >= comienza[i] &&
      posición < inicios[i] + segmentos[i].duración
    ) {
      índiceactual = i;
      romper;
    }
  }

  devolver {
    número de bucle,
    posición,
    índice actual,
    índice absoluto: número de bucle * longitud de segmentos + índice actual
  };
}

función obtenerPosiciónViva(horario, ahoraSegundos) {
  devolver getPositionFromElapsed(
    cronograma,
    Math.max(0, nowSeconds - EPOCH)
  );
}

función transicionesPorCiclo(segmentos) {
  sea ​​transiciones = 0;

  para (sea i = 1; i < segments.length; i++) {
    Si (segmentos[i].episodioIndex !== segmentos[i - 1].episodioIndex) {
      transiciones++;
    }
  }

  si (
    segmentos.longitud > 1 &&
    segmentos[0].episodeIndex !== segmentos[segmentos.longitud - 1].episodeIndex
  ) {
    transiciones++;
  }

  transiciones de retorno;
}

función discontinuidadesAntesDeAbsoluto(segmentos, índiceAbsoluto) {
  si (absoluteIndex <= 0 || segments.length < 2) {
    devolver 0;
  }

  const count = segmentos.length;
  const perCycle = transitionsPerCycle(segments);
  const fullCycles = Math.floor(absoluteIndex / count);
  const resto = índice absoluto % recuento;

  sea ​​total = fullCycles * perCycle;

  para (sea i = 1; i <= resto; i++) {
    Si (segmentos[i].episodioIndex !== segmentos[i - 1].episodioIndex) {
      total++;
    }
  }

  devolver total;
}

función buildLivePlaylist(schedule, state, windowSegments = WINDOW_SEGMENTS) {
  const { segmentos, inicios, duración total, duración objetivo } = programación;
  const count = segmentos.length;

  // Solo publicamos segmentos ya completados. El reproductor no puede adelantarse
  // al reloj del canal, pero seguirá refrescando esta lista de reproducción como un canal en vivo.
  const lastAbsolute = Math.max(0, state.absoluteIndex - 1);
  const firstAbsolute = Math.max(
    0,
    últimoAbsoluto - (segmentosDeVentana - 1)
  );

  const discontinuitySequence = discontinuitiesBeforeAbsolute(
    segmentos,
    primerAbsoluto
  );

  lista de reproducción =
    "#EXTM3U\n" +
    "#EXT-X-VERSION:3\n" +
    `#EXT-X-TARGETDURATION:${targetDuration}\n` +
    `#EXT-X-MEDIA-SEQUENCE:${firstAbsolute}\n` +
    `#EXT-X-DISCONTINUITY-SEQUENCE:${discontinuitySequence}\n`;

  sea ​​previousEpisode = null;

  para (sea absoluto = primerAbsoluto; absoluto <= últimoAbsoluto; absoluto++) {
    const índice = ((conteo absoluto) + conteo) % conteo;
    const ciclo = Math.floor(absoluto / conteo);
    const segmento = segmentos[índice];

    si (
      previousEpisode !== null &&
      segmento.episodioIndex !== episodioAnterior
    ) {
      lista de reproducción += "#EXT-X-DISCONTINUITY\n";
    }

    episodio anterior = segmento.índiceepisodio;

    const programTime = EPOCH + cycle * totalDuration + starts[index];

    lista de reproducción +=
      `#EXT-X-PROGRAM-DATE-TIME:${new Date(programTime * 1000).toISOString()}\n` +
      `#EXTINF:${segment.duration.toFixed(6)},\n` +
      `${segment.uri}\n`;
  }

  lista de reproducción de regreso;
}

función hlsHeaders() {
  devolver {
    "content-type": "application/vnd.apple.mpegurl",
    "control-caché": "sin-almacenamiento, sin-caché, debe-revalidarse",
    "access-control-allow-origin": "*"
  };
}

exportar por defecto {
  obtención asíncrona(solicitud) {
    const url = nueva URL(solicitud.url);

    intentar {
      si (url.pathname === "/") {
        devolver nueva Respuesta(
          "Canal Bluey 24/7\n\n" +
          "HLS: /live.m3u8\n" +
          "Estado: /status\n" +
          "Prueba E01 -> E02: /test-transition.m3u8",
          {
            encabezados: {
              "content-type": "text/plain; charset=utf-8",
              "access-control-allow-origin": "*"
            }
          }
        );
      }

      const schedule = await buildSchedule();
      const nowSeconds = Date.now() / 1000;
      const liveState = getLivePosition(schedule, nowSeconds);

      if (url.pathname === "/status") {
        const segmento = schedule.segments[liveState.currentIndex];
        const segmentStart = schedule.starts[liveState.currentIndex];
        const segundosEnSegmento = Math.max(
          0,
          liveState.position - segmentStart
        );

        devolver Response.json(
          {
            canal: "Bluey 24/7",
            episodioactual: segmento.nombreDelEpisodio,
            segmentoactual: estadovivo.índiceactual,
            segundosEnSegmentoActual: Número(
              segundosEnSegmento.toFijo(2)
            ),
            loopDurationSeconds: Número(
              programación.duraciónTotal.aFijo(3)
            ),
            episodios: EPISODIOS.map((e) => e.name)
          },
          {
            encabezados: {
              "control-caché": "sin-almacenar",
              "access-control-allow-origin": "*"
            }
          }
        );
      }

      si (url.pathname === "/live.m3u8") {
        devolver nueva Respuesta(
          construirListaDeReproducciónEnVivo(horario, estadoEnVivo),
          { encabezados: hlsHeaders() }
        );
      }

      // Entrada de prueba. Devuelve una playlist maestra que crea una sesión
      // con su propia hora de inicio. Así VLC conserva el avance durante los
      // refrescos y podemos cruzar de E01 a E02 sin esperar todo el episodio.
      si (url.pathname === "/test-transition.m3u8") {
        const mediaUrl = nueva URL(
          "/test-transition-media.m3u8",
          url.origen
        );
        mediaUrl.searchParams.set(
          "comenzar",
          Cadena(Matemáticas.floor(ahoraSegundos))
        );

        const maestro =
          "#EXTM3U\n" +
          "#EXT-X-VERSION:3\n" +
          "#EXT-X-STREAM-INF:BANDWIDTH=4000000\n" +
          `${mediaUrl.href}\n`;

        devolver nueva Respuesta(master, {
          encabezados: hlsHeaders()
        });
      }

      si (url.pathname === "/test-transition-media.m3u8") {
        const start = Number(url.searchParams.get("start"));

        Si (!Number.isFinite(start) || start <= 0) {
          return new Response("Falta el parámetro start", {
            estado: 400,
            encabezados: {
              "content-type": "text/plain; charset=utf-8",
              "control-caché": "sin-almacenar"
            }
          });
        }

        const firstEpisodeDuration = schedule.episodeDurations[0];
        const sessionElapsed = Math.max(0, nowSeconds - start);

        // La sesión comienza 20 s antes de terminar E01 y desde ahí avanza
        // normalmente: E01 -> E02 -> ... sin reiniciar en cada actualización.
        const virtualElapsed =
          Matemáticas.máx(
            0,
            firstEpisodeDuration - PRUEBA_ANTES_DE_FIN_DE_SEGUNDOS
          ) + sesiónTranscurrida;

        const testState = getPositionFromElapsed(
          cronograma,
          virtualTranscurrido
        );

        devolver nueva Respuesta(
          crearListaDeReproducciónEnVivo(
            cronograma,
            estado de prueba,
            SEGMENTOS DE VENTANA DE PRUEBA
          ),
          { encabezados: hlsHeaders() }
        );
      }

      return new Response("No encontrado", { status: 404 });
    } catch (error) {
      return new Response(`Error canal: ${error.message}`, {
        estado: 500,
        encabezados: {
          "content-type": "text/plain; charset=utf-8",
          "control-caché": "sin-almacenar",
          "access-control-allow-origin": "*"
        }
      });
    }
  }
};
