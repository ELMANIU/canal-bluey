const EPISODES = [
  {
    name: "Bluey S01E01",
    url: "https://pub-31c3df763d1f4f2bbd2602595581aa82.r2.dev/Bluey/S01e01/bluey/BlueyS01E01.m3u8"
  },
  {
    name: "Bluey S01E02",
    url: "https://pub-31c3df763d1f4f2bbd2602595581aa82.r2.dev/Bluey/S01e01/bluey%20s02/BlueyS01E02.m3u8"
  }
];

// Epoch fijo: el canal avanza por reloj aunque nadie esté conectado.
const EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0) / 1000;
const WINDOW_SEGMENTS = 8;

async function loadEpisode(episode, episodeIndex) {
  const response = await fetch(episode.url, {
    cf: { cacheTtl: 60, cacheEverything: true }
  });

  if (!response.ok) {
    throw new Error(`No se pudo cargar ${episode.name} (${response.status})`);
  }

  const text = await response.text();
  const base = new URL(".", episode.url);
  const regex = /#EXTINF:([\d.]+),\s*\n([^#\r\n]+)/g;

  const segments = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    segments.push({
      duration: Number(match[1]),
      uri: new URL(match[2].trim(), base).href,
      episodeIndex,
      episodeName: episode.name
    });
  }

  if (!segments.length) {
    throw new Error(`La playlist de ${episode.name} no contiene segmentos`);
  }

  return segments;
}

async function buildSchedule() {
  const episodeLists = await Promise.all(
    EPISODES.map((episode, index) => loadEpisode(episode, index))
  );

  const segments = episodeLists.flat();
  const starts = [];
  let totalDuration = 0;

  for (const segment of segments) {
    starts.push(totalDuration);
    totalDuration += segment.duration;
  }

  return { segments, starts, totalDuration };
}

function getPosition(schedule, nowSeconds) {
  const { segments, starts, totalDuration } = schedule;
  const elapsed = Math.max(0, nowSeconds - EPOCH);
  const loopNumber = Math.floor(elapsed / totalDuration);
  const position = elapsed % totalDuration;

  let currentIndex = segments.length - 1;

  for (let i = 0; i < segments.length; i++) {
    if (position >= starts[i] && position < starts[i] + segments[i].duration) {
      currentIndex = i;
      break;
    }
  }

  return {
    loopNumber,
    position,
    currentIndex,
    absoluteIndex: loopNumber * segments.length + currentIndex
  };
}

function buildLivePlaylist(schedule, state) {
  const { segments, starts, totalDuration } = schedule;
  const count = segments.length;

  // Solo publicamos segmentos que ya deberían estar disponibles.
  // Así el reproductor no puede adelantarse al reloj del canal.
  const lastAbsolute = state.absoluteIndex - 1;
  const firstAbsolute = Math.max(0, lastAbsolute - (WINDOW_SEGMENTS - 1));

  let playlist =
    "#EXTM3U\n" +
    "#EXT-X-VERSION:3\n" +
    "#EXT-X-TARGETDURATION:8\n" +
    `#EXT-X-MEDIA-SEQUENCE:${firstAbsolute}\n`;

  let previousEpisode = null;

  for (let absolute = firstAbsolute; absolute <= lastAbsolute; absolute++) {
    const index = ((absolute % count) + count) % count;
    const cycle = Math.floor(absolute / count);
    const segment = segments[index];

    if (
      previousEpisode !== null &&
      segment.episodeIndex !== previousEpisode
    ) {
      playlist += "#EXT-X-DISCONTINUITY\n";
    }

    previousEpisode = segment.episodeIndex;

    const programTime = EPOCH + cycle * totalDuration + starts[index];

    playlist +=
      `#EXT-X-PROGRAM-DATE-TIME:${new Date(programTime * 1000).toISOString()}\n` +
      `#EXTINF:${segment.duration.toFixed(6)},\n` +
      `${segment.uri}\n`;
  }

  return playlist;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/") {
        return new Response(
          "Canal Bluey 24/7\n\nHLS: /live.m3u8\nEstado: /status",
          {
            headers: {
              "content-type": "text/plain; charset=utf-8",
              "access-control-allow-origin": "*"
            }
          }
        );
      }

      const schedule = await buildSchedule();
      const state = getPosition(schedule, Date.now() / 1000);

      if (url.pathname === "/status") {
        const segment = schedule.segments[state.currentIndex];
        const episodeStart = schedule.starts[state.currentIndex];
        const secondsIntoSegment = Math.max(0, state.position - episodeStart);

        return Response.json(
          {
            channel: "Bluey 24/7",
            currentEpisode: segment.episodeName,
            currentSegment: state.currentIndex,
            secondsIntoCurrentSegment: Number(secondsIntoSegment.toFixed(2)),
            loopDurationSeconds: Number(schedule.totalDuration.toFixed(3)),
            episodes: EPISODES.map((e) => e.name)
          },
          {
            headers: {
              "cache-control": "no-store",
              "access-control-allow-origin": "*"
            }
          }
        );
      }

      if (url.pathname === "/live.m3u8") {
        return new Response(buildLivePlaylist(schedule, state), {
          headers: {
            "content-type": "application/vnd.apple.mpegurl",
            "cache-control": "no-store, no-cache, must-revalidate",
            "access-control-allow-origin": "*"
          }
        });
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      return new Response(`Error canal: ${error.message}`, {
        status: 500,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "access-control-allow-origin": "*"
        }
      });
    }
  }
};
