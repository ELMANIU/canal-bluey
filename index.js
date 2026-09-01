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

const LIVE_WINDOW = 45;


// Cache global Worker
let scheduleCache = null;
let scheduleCacheTime = 0;


// ===============================
// CARGAR SEGMENTOS HLS
// ===============================

async function loadEpisode(ep, episodeIndex) {

  const response = await fetch(ep.URL, {
    cf: {
      cacheTtl: 300,
      cacheEverything: true
    }
  });


  if (!response.ok) {
    throw new Error(
      `No se pudo cargar ${ep.nombre}`
    );
  }


  const text = await response.text();

  const base = new URL(".", ep.URL);


  const regex =
    /#EXTINF:([\d.]+),\s*\n([^#\r\n]+)/g;


  const segments = [];

  let match;


  while ((match = regex.exec(text)) !== null) {

    segments.push({

      duration: Number(match[1]),

      uri:
        new URL(
          match[2].trim(),
          base
        ).href,

      episodeIndex,

      episodeName: ep.nombre,

      localIndex: segments.length

    });

  }


  if (!segments.length) {

    throw new Error(
      `${ep.nombre} no tiene segmentos`
    );

  }


  return segments;

}



// ===============================
// CREAR CANAL
// ===============================

async function buildSchedule(){


  const episodeLists =
    await Promise.all(
      EPISODIOS.map(
        (e,i)=>loadEpisode(e,i)
      )
    );


  const segments =
    episodeLists.flat();


  const starts=[];

  const episodeDurations=[];


  let totalDuration=0;

  let targetDuration=1;



  for(const list of episodeLists){

    const duration =
      list.reduce(
        (a,b)=>a+b.duration,
        0
      );


    episodeDurations.push(duration);

  }



  for(const seg of segments){

    starts.push(totalDuration);

    totalDuration += seg.duration;


    targetDuration =
      Math.max(
        targetDuration,
        Math.ceil(seg.duration)
      );

  }



  return {

    episodeLists,

    segments,

    starts,

    totalDuration,

    targetDuration,

    episodeDurations

  };

}



// ===============================
// CACHE
// ===============================

async function getSchedule(){


  const now = Date.now();


  if(
    !scheduleCache ||
    now - scheduleCacheTime > 300000
  ){

    scheduleCache =
      await buildSchedule();


    scheduleCacheTime = now;

  }


  return scheduleCache;

}



// ===============================
// POSICIÓN ACTUAL DEL CANAL
// ===============================

function getLiveState(schedule, now){


  const elapsed =
    Math.max(
      0,
      now - EPOCH
    );


  const position =
    elapsed %
    schedule.totalDuration;



  let index =
    schedule.segments.length-1;



  for(
    let i=0;
    i<schedule.segments.length;
    i++
  ){

    const start =
      schedule.starts[i];


    const end =
      start +
      schedule.segments[i].duration;



    if(
      position >= start &&
      position < end
    ){

      index=i;

      break;

    }

  }



  return {

    position,

    currentIndex:index

  };

}



// ===============================
// DISCONTINUIDADES
// ===============================

function countDiscontinuities(
  segments,
  absoluteIndex
){

  let total=0;


  const count =
    segments.length;


  const cycles =
    Math.floor(
      absoluteIndex/count
    );


  for(
    let c=0;
    c<cycles;
    c++
  ){

    for(
      let i=1;
      i<count;
      i++
    ){

      if(
        segments[i].episodeIndex !==
        segments[i-1].episodeIndex
      ){

        total++;

      }

    }

  }


  const rest =
    absoluteIndex % count;



  for(
    let i=1;
    i<=rest;
    i++
  ){

    if(
      segments[i].episodeIndex !==
      segments[i-1].episodeIndex
    ){

      total++;

    }

  }


  return total;

}



// ===============================
// LIVE PLAYLIST
// ===============================

function buildLivePlaylist(
  schedule,
  state
){


  const {

    segments,
    starts,
    totalDuration,
    targetDuration

  } = schedule;



  const count =
    segments.length;



  const last =
    Math.max(
      0,
      state.currentIndex
    );


  const first =
    Math.max(
      0,
      last - LIVE_WINDOW + 1
    );



  let playlist =
`#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:${targetDuration}
#EXT-X-MEDIA-SEQUENCE:${first}
#EXT-X-DISCONTINUITY-SEQUENCE:${countDiscontinuities(
segments,
first
)}
`;



  let previousEpisode=null;



  for(
    let absolute=first;
    absolute<=last;
    absolute++
  ){


    const index =
      ((absolute % count)+count)%count;



    const segment =
      segments[index];



    if(
      previousEpisode !== null &&
      previousEpisode !== segment.episodeIndex
    ){

      playlist +=
      "#EXT-X-DISCONTINUITY\n";

    }



    previousEpisode =
      segment.episodeIndex;



    playlist +=
`#EXT-X-PROGRAM-DATE-TIME:${new Date(
(
EPOCH +
(
Math.floor(absolute/count)
*
totalDuration
+
starts[index]
)
)
*1000
).toISOString()}
#EXTINF:${segment.duration.toFixed(6)},
${segment.uri}
`;

  }



  return playlist;

}



// ===============================
// HEADERS
// ===============================

function hlsHeaders(){

return {

"content-type":
"application/vnd.apple.mpegurl",

"cache-control":
"no-store",

"access-control-allow-origin":
"*"

};

}



// ===============================
// WORKER
// ===============================


export default {


async fetch(request){


try{


const url =
new URL(request.url);



const schedule =
await getSchedule();



const state =
getLiveState(
schedule,
Date.now()/1000
);



if(
url.pathname === "/live.m3u8"
){

return new Response(

buildLivePlaylist(
schedule,
state
),

{
headers:hlsHeaders()
}

);

}



if(
url.pathname === "/status"
){

const seg =
schedule.segments[
state.currentIndex
];


return Response.json({

channel:
"Bluey 24/7",

current:
seg.episodeName,

segment:
seg.localIndex,

position:
state.position.toFixed(2)

},

{

headers:{
"cache-control":"no-store",
"access-control-allow-origin":"*"
}

});

}



return new Response(

"Bluey 24/7 LIVE\n/live.m3u8"

);




}catch(err){


return new Response(

"ERROR: "+err.message,

{
status:500,
headers:{
"content-type":"text/plain"
}
}

);


}


}

};
