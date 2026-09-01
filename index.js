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


const EPOCH = Date.UTC(2026,0,1,0,0,0)/1000;


// Buffer
const BACK_BUFFER = 30;
const FORWARD_BUFFER = 6;


let CACHE = null;
let CACHE_TIME = 0;



async function loadEpisode(ep,index){

const res = await fetch(ep.URL,{
cf:{
cacheTtl:3600,
cacheEverything:true
}
});


if(!res.ok)
throw new Error(ep.nombre);


const text = await res.text();

const base=new URL(".",ep.URL);


const regex=/#EXTINF:([\d.]+),\s*\n([^#\r\n]+)/g;


let match;

let segments=[];


while((match=regex.exec(text))!==null){

segments.push({

duration:Number(match[1]),

uri:new URL(
match[2].trim(),
base
).href,

episodeIndex:index,

episodeName:ep.nombre,

localIndex:segments.length

});

}


return segments;

}



async function buildSchedule(){


const lists =
await Promise.all(
EPISODIOS.map(loadEpisode)
);


const segments =
lists.flat();


let starts=[];

let total=0;

let target=1;



for(const s of segments){

starts.push(total);

total+=s.duration;

target=Math.max(
target,
Math.ceil(s.duration)
);

}



return {

segments,

starts,

total,

target

};

}



async function getSchedule(){


if(
!CACHE ||
Date.now()-CACHE_TIME>300000
){

CACHE=await buildSchedule();

CACHE_TIME=Date.now();

}


return CACHE;

}




function liveState(schedule){


const elapsed =
(Math.floor(Date.now()/1000)-EPOCH);


const position =
elapsed %
schedule.total;



let index=0;


for(
let i=0;
i<schedule.segments.length;
i++
){

let start=schedule.starts[i];

let end=start+
schedule.segments[i].duration;


if(
position>=start &&
position<end
){

index=i;
break;

}

}


return {

index,

position

};

}




function buildPlaylist(schedule,state){


const segs=schedule.segments;

const count=segs.length;


let current=state.index;



let first=Math.max(
0,
current-BACK_BUFFER
);


let last=Math.min(
count-1,
current+FORWARD_BUFFER
);



let out=
`#EXTM3U
#EXT-X-VERSION:3
#EXT-X-PLAYLIST-TYPE:EVENT
#EXT-X-ALLOW-CACHE:NO
#EXT-X-TARGETDURATION:${schedule.target}
#EXT-X-MEDIA-SEQUENCE:${first}
`;



let previous=null;



for(
let i=first;
i<=last;
i++
){

let s=segs[i];


if(
previous!==null &&
previous!==s.episodeIndex
){

out+="#EXT-X-DISCONTINUITY\n";

}



previous=s.episodeIndex;



out+=
`#EXT-X-PROGRAM-DATE-TIME:${new Date(
(EPOCH+schedule.starts[i])*1000
).toISOString()}
#EXTINF:${s.duration},
${s.uri}
`;

}



return out;

}



function headers(){

return {

"content-type":
"application/vnd.apple.mpegurl",

"cache-control":
"no-store, no-cache, must-revalidate",

"access-control-allow-origin":"*"

};

}




export default {


async fetch(request){


try{


const url=new URL(request.url);


const schedule=
await getSchedule();


const state=
liveState(schedule);



if(
url.pathname==="/live.m3u8"
){

return new Response(
buildPlaylist(
schedule,
state
),
{
headers:headers()
}
);

}



if(
url.pathname==="/status"
){

const s=
schedule.segments[state.index];


return Response.json({

canal:"Bluey 24/7",

episodio:s.episodeName,

segmento:s.localIndex,

posicion:
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
"Bluey 24/7\n/live.m3u8"
);



}catch(e){

return new Response(
e.message,
{
status:500
}
);

}


}

};
