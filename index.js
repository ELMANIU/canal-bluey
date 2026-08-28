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

const EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0) / 1000;
const LIVE_WINDOW = 8;

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
      Nombre del episodio: episode.name,
      localIndex: segmentos.longitud
    });
  }

  si (!longitud de segmentos) {
    throw new Error(`${episode.name} no contiene segmentos HLS`);
  }

  segmentos de retorno;
}

función asíncrona buildSchedule() {
  const episodeLists = await Promise.all(
    EPISODIOS.map((episodio, índice) => cargarEpisodio(episodio, índice))
  );

  const segmentos = episodeLists.flat();
  const inicios = [];
  const episodeDurations = [];

  sea ​​totalDuration = 0;
  sea ​​targetDuration = 1;

  para (lista constante de episodeLists) {
    Duración de episodios.push(
      lista.reduce((suma, segmento) => suma + segmento.duración, 0)
    );
  }

  para (const segmento de segmentos) {
    comienza.push(duración total);
    duraciónTotal += duraciónSegmento;
    targetDuration = Math.max(targetDuration, Math.ceil(segment.duration));
  }

  devolver {
    Listas de episodios,
    segmentos,
    comienza,
    Duración de los episodios,
    duración total,
    duración objetivo
  };
}

función obtenerEstadoEnVivo(horario, ahoraSegundos) {
  const transcurrido = Math.max(0, nowSeconds - EPOCH);
  const loop = Math.floor(elapsed / schedule.totalDuration);
  const posición = transcurrido % schedule.totalDuration;

  sea ​​currentIndex = schedule.segments.length - 1;

  para (sea i = 0; i < schedule.segments.length; i++) {
    const inicio = programa.inicios[i];
    const fin = inicio + schedule.segments[i].duration;

    si (posición >= inicio && posición < fin) {
      índiceactual = i;
      romper;
    }
  }

  devolver {
    posición,
    índice actual,
    índice absoluto: bucle * longitud de segmentos programados + índice actual
  };
}

función transicionesPorCiclo(segmentos) {
  sea ​​contador = 0;

  para (sea i = 1; i < segments.length; i++) {
    Si (segmentos[i].episodioIndex !== segmentos[i - 1].episodioIndex) {
      recuento++;
    }
  }

  si (
    segmentos.longitud > 1 &&
    segmentos[0].episodeIndex !== segmentos[segmentos.longitud - 1].episodeIndex
  ) {
    recuento++;
  }

  devolver recuento;
}

función discontinuidadesAntes(segmentos, índiceAbsoluto) {
  Si (absoluteIndex <= 0 || segments.length < 2) devuelve 0;

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

función construirListaDeReproducciónEnVivo(horario, estado) {
  const { segmentos, inicios, duración total, duración objetivo } = programación;
  const count = segmentos.length;

  // Solo segmentos ya terminados. El manifiesto se va moviendo con el reloj.
  const lastAbsolute = Math.max(0, state.absoluteIndex - 1);
  const firstAbsolute = Math.max(0, lastAbsolute - (LIVE_WINDOW - 1));

  lista de reproducción =
    "#EXTM3U\n" +
    "#EXT-X-VERSION:3\n" +
    `#EXT-X-TARGETDURATION:${targetDuration}\n` +
    `#EXT-X-MEDIA-SEQUENCE:${firstAbsolute}\n` +
    `#EXT-X-DISCONTINUITY-SEQUENCE:${discontinuitiesBefore(segments, firstAbsolute)}\n`;

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

// Esta prueba NO es live. Es una lista de reproducción VOD corta que contiene el final
// de E01 y el inicio de E02. Sirve únicamente para comprobar que el cambio
// entre archivos es continuo y que el decodificador acepta #EXT-X-DISCONTINUITY.
función buildTransitionTest(schedule) {
  const e1 = schedule.episodeLists[0];
  const e2 = schedule.episodeLists[1];

  const tail = e1.slice(-4);
  const head = e2.slice(0, 6);
  const todo = [...cola, ...cabeza];

  lista de reproducción =
    "#EXTM3U\n" +
    "#EXT-X-VERSION:3\n" +
    `#EXT-X-TARGETDURATION:${schedule.targetDuration}\n` +
    "#EXT-X-MEDIA-SEQUENCE:0\n" +
    "#EXT-X-PLAYLIST-TYPE:VOD\n";

  sea ​​previousEpisode = null;

  para (segmento constante de todos) {
    si (
      previousEpisode !== null &&
      segmento.episodioIndex !== episodioAnterior
    ) {
      lista de reproducción += "#EXT-X-DISCONTINUITY\n";
    }

    episodio anterior = segmento.índiceepisodio;

    lista de reproducción +=
      `#EXTINF:${segment.duration.toFixed(6)},\n` +
      `${segment.uri}\n`;
  }

  lista de reproducción += "#EXT-X-ENDLIST\n";
  lista de reproducción de regreso;
}

función hlsHeaders() {
  devolver {
    "content-type": "application/vnd.apple.mpegurl",
    "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
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
          "Canal: /live.m3u8\n" +
          "Estado: /status\n" +
          "Prueba E01 -> E02: /test-transition.m3u8",
          {
            encabezados: {
              "content-type": "text/plain; charset=utf-8",
              "control-caché": "sin-almacenar",
              "access-control-allow-origin": "*"
            }
          }
        );
      }

      const schedule = await buildSchedule();
      const ahora = Fecha.ahora() / 1000;
      const estado = obtenerEstadoEnVivo(horario, ahora);

      si (url.pathname === "/live.m3u8") {
        devolver nueva Respuesta(buildLivePlaylist(schedule, state), {
          encabezados: hlsHeaders()
        });
      }

      si (url.pathname === "/test-transition.m3u8") {
        return new Response(buildTransitionTest(schedule), {
          encabezados: hlsHeaders()
        });
      }

      if (url.pathname === "/status") {
        const segmento = schedule.segments[state.currentIndex];
        const episodeStart = schedule.starts[state.currentIndex];

        devolver Response.json(
          {
            canal: "Bluey 24/7",
            episodioactual: segmento.nombreDelEpisodio,
            segmentoactual: segmento.índicelocal,
            segundosEnSegmentoActual: Número(
              Math.max(0, estado.posición - inicioEpisodio).toFixed(2)
            ),
            totalLoopSeconds: Number(schedule.totalDuration.toFixed(3)),
            episodeDurations: schedule.episodeDurations.map((seconds, i) => ({
              episodio: EPISODIOS[i].nombre,
              segundos: Número(segundos.toFixed(3))
            }))
          },
          {
            encabezados: {
              "control-caché": "sin-almacenar",
              "access-control-allow-origin": "*"
            }
          }
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
