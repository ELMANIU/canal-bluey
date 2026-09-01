// BLUEY 24/7 ROKU V2 // Trabajador HLS con línea temporal continua //
Corrección para congelamiento al pasar del último episodio al primero

const EPISODIOS = [ { nombre: “Bluey S01E01”, URL:
“https://pub-31c3df763d1f4f2bbd2602595581aa82.r2.dev/Bluey/S01e01/bluey/BlueyS01E01.m3u8”
}, { nombre: “Bluey S01E02”, URL:
“https://pub-31c3df763d1f4f2bbd2602595581aa82.r2.dev/Bluey/S01e01/bluey%20s02/BlueyS01E02.m3u8”
}];

const EPOCH = Date.UTC(2026,0,1,0,0,0)/1000;

const BÚFFER_RETROCESO = 90; const BÚFFER_ADELANTE = 30;

let scheduleCache = null; let scheduleCacheTime = 0;

// Carga segmentos función asíncrona loadEpisode(ep, episodioIndex){

const respuesta = await fetch(ep.URL,{ cf:{ cacheTtl:3600,
cacheEverything:true } });

if(!response.ok) throw new Error("Error cargando" +ep.nombre);

const text = await response.text(); const base = new URL(".", ep.URL);

const regex = /#EXTINF:([]+),([^#\r\n]+)/g;

sea ​​coincidencia; sea segmentos=[];

mientras((coincidencia=regex.exec(texto))!==null){

segmentos.push({ duración:Número(coincidencia[1]), uri:nuevo
URL(match[2].trim(),base).href, episodeIndex, episodeName:ep.nombre,
localIndex:segments.length });

}

devolver segmentos; }

// Construcción de línea temporal async function buildSchedule(){

const lists = await Promise.all( EPISODIOS.map((e,i)=>loadEpisode(e,i))
);

const segmentos = listas.flat();

sea ​​línea de tiempo=[]; sea total=0;

para (constante s de segmentos){

timeline.push({ …s, inicio:total, fin:total+s.duration });

total+=s.duración;

}

devolver { segmentos:línea de tiempo, total }; }

función asíncrona getSchedule(){

if(!scheduleCache || Date.now()-scheduleCacheTime>300000){

scheduleCache=await buildSchedule(); scheduleCacheTime=Date.now();

}

devolver scheduleCache; }

// Estado absoluto continuo function getLiveState(schedule,now){

const transcurrido=ahora-ÉPOCA;

const position=((elapsed%schedule.total)+schedule.total)
%horario.total;

sea ​​índice=0;

para (let i=0;i<schedule.segments.length;i++){

const s=schedule.segments[i];

if(position>=s.start && position<s.end){ index=i; break; }

}

const ciclo = Math.floor(transcurrido / horario.total);

devolver { índice, ciclo, absoluto:(ciclo*schedule.segments.length)+índice
};

}

// Función Roku compatible con listas de reproducción buildLivePlaylist(schedule,state){

const count=schedule.segments.length;

const first=Math.max( 0, state.absolute-BACK_BUFFER );

const last=state.absolute+FORWARD_BUFFER;

lista de reproducción=
#EXTM3U #EXT-X-VERSION:3 #EXT-X-PLAYLIST-TYPE:EVENT #EXT-X-TARGETDURATION:10 #EXT-X-DISCONTINUITY-SEQUENCE:${Math.floor(state.absolute/count)} #EXT-X-MEDIA-SEQUENCE:${first};

sea ​​previousEpisode=null;

para (sea absoluto = primero; absoluto <= último; absoluto++) {

const índice=conteo%absoluto;

const segmento = schedule.segments[index];

if(previousEpisode!==null && previousEpisode!==segment.episodeIndex){

playlist+=“#EXT-X-DISCONTINUITY” ;

}

episodio anterior = segmento.índice del episodio;

const programTime = EPOCH + absolute * 10;

lista de reproducción+=
#EXT-X-PROGRAM-DATE-TIME:${new Date(programTime*1000).toISOString()} #EXTINF:${segment.duration.toFixed(6)}, ${segment.uri};

}

lista de reproducción de regreso;

}

función encabezados(){

return { “content-type” : “application/vnd.apple.mpegurl” ,
“cache-control” : “no-store” , “access-control-allow-origin” : “*” };

}

exportar por defecto {

obtención asíncrona(solicitud){

intentar{

const url = nueva URL(solicitud.url);

const schedule=await getSchedule();

const estado = getLiveState(horario, Math.floor(Fecha.ahora()/1000));

if(url.pathname===“/live.m3u8” ){

    devolver nueva Respuesta(
     construirListaDeReproducciónEnVivo(horario,estado),
     {encabezados:encabezados()}
    );

}

if(url.pathname===“/status” ){

    const seg=schedule.segments[state.index];

    return Response.json({
     canal:"Bluey 24/7",
     episodio:seg.episodeName,
     segmento:seg.localIndex,
     ciclo:estado.ciclo
    });

}

return new Response("Bluey 24/7 EN VIVO");

}catch(e){

return new Response( “Error:” +e.message, {status:500} );

}

}

};
