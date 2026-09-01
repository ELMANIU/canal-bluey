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


// Punto cero del canal
const EPOCH = Date.UTC(2026,0,1,0,0,0) / 1000;


// Buffer live
const BACK_BUFFER = 30;
const FORWARD_BUFFER = 10;


// Cache
let scheduleCache = null;
let scheduleCacheTime = 0;



// =============================
// CARGAR EPISODIO HLS
// =============================

async function loadEpisode(ep, episodeIndex){

  const response = await fetch(ep.URL,{
    cf:{
      cacheTtl:3600,
      cacheEverything:true
    }
  });


  if(!response.ok){
    throw new Error(
      "Error cargando "+ep.nombre
    );
  }


  const text = await response.text();

  const base = new URL(".",ep.URL);


  const regex =
    /#EXTINF:([\d.]+),\s*\n([^#\r\n]+)/g;


  let match;

  const segments=[];


  while((match=regex.exec(text))!==null){

    segments.push({

      duration:Number(match[1]),

      uri:new URL(
        match[2].trim(),
        base
      ).href,


      episodeIndex,

      episodeName:ep.nombre,

      localIndex:segments.length

    });

  }


  if(!segments.length){

    throw new Error(
      ep.nombre+" sin segmentos"
    );

  }


  return segments;

}




// =============================
// CREAR HORARIO
// =============================

async function buildSchedule(){


  const lists =
    await Promise.all(

      EPISODIOS.map(
        (e,i)=>loadEpisode(e,i)
      )

    );



  const segments =
    lists.flat();



  const starts=[];

  let total=0;

  let target=1;



  for(const segment of segments){

    starts.push(total);

    total += segment.duration;

    target=Math.max(
      target,
      Math.ceil(segment.duration)
    );

  }



  return {

    segments,

    starts,

    total,

    target

  };

}




// =============================
// CACHE DEL CANAL
// =============================

async function getSchedule(){


  if(
    !scheduleCache ||
    Date.now()-scheduleCacheTime>300000
  ){

    scheduleCache =
      await buildSchedule();


    scheduleCacheTime =
      Date.now();

  }


  return scheduleCache;

}



// =============================
// POSICIÓN ABSOLUTA INFINITA
// =============================

function getLiveState(schedule,now){


  const elapsed =
    now-EPOCH;



  const position =
    ((elapsed % schedule.total)
      + schedule.total)
      %
      schedule.total;



  let index=0;



  for(
    let i=0;
    i<schedule.segments.length;
    i++
  ){

    const start =
      schedule.starts[i];


    const end =
      start+
      schedule.segments[i].duration;



    if(
      position>=start &&
      position<end
    ){

      index=i;

      break;

    }

  }



  const cycle =
    Math.floor(
      elapsed /
      schedule.total
    );



  return {

    index,

    cycle,

    absolute:
      cycle *
      schedule.segments.length
      +
      index,

    position

  };

}




// =============================
// CREAR PLAYLIST LIVE
// =============================

function buildLivePlaylist(schedule,state){


  const segments =
    schedule.segments;


  const count =
    segments.length;



  const first =
    Math.max(
      0,
      state.absolute-BACK_BUFFER
    );



  const last =
    state.absolute+
    FORWARD_BUFFER;



  let playlist =
`#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:${schedule.target}
#EXT-X-MEDIA-SEQUENCE:${first}
`;



  let previousEpisode=null;



  for(
    let absolute=first;
    absolute<=last;
    absolute++
  ){



    const index =
      ((absolute % count)+count)
      %
      count;



    const cycle =
      Math.floor(
        absolute/count
      );



    const segment =
      segments[index];



    if(
      previousEpisode!==null &&
      previousEpisode!==segment.episodeIndex
    ){

      playlist +=
      "#EXT-X-DISCONTINUITY\n";

    }



    previousEpisode =
      segment.episodeIndex;



    const programTime =
      EPOCH +
      cycle*schedule.total +
      schedule.starts[index];



    playlist +=
`#EXT-X-PROGRAM-DATE-TIME:${new Date(
programTime*1000
).toISOString()}
#EXTINF:${segment.duration.toFixed(6)},
${segment.uri}
`;

  }



  return playlist;

}




// =============================
// HEADERS HLS
// =============================

function hlsHeaders(){

 return {

  "content-type":
  "application/vnd.apple.mpegurl",

  "cache-control":
  "no-store, no-cache, must-revalidate",

  "access-control-allow-origin":
  "*"

 };

}




// =============================
// WORKER
// =============================

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
Math.floor(Date.now()/1000)
);



if(
url.pathname==="/live.m3u8"
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
url.pathname==="/status"
){


const seg =
schedule.segments[
state.index
];



return Response.json({

canal:
"Bluey 24/7",

episodio:
seg.episodeName,

segmento:
seg.localIndex,

segundo:
state.position.toFixed(2),

ciclo:
state.cycle

},{

headers:{
"cache-control":"no-store",
"access-control-allow-origin":"*"
}

});


}




return new Response(

"Bluey 24/7 LIVE\n\n/live.m3u8"

);



}
catch(error){


return new Response(

"Error canal: "+
error.message,

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
