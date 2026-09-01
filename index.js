const EPISODIOS = [ { nombre: “Bluey S01E01”, URL:
“https://pub-31c3df763d1f4f2bbd2602595581aa82.r2.dev/Bluey/S01e01/bluey/BlueyS01E01.m3u8”
}, { nombre: “Bluey S01E02”, URL:
“https://pub-31c3df763d1f4f2bbd2602595581aa82.r2.dev/Bluey/S01e01/bluey%20s02/BlueyS01E02.m3u8”
}];

const EPOCH = Date.UTC(2026,0,1,0,0,0) / 1000;

const BÚFFER_RETROCESO = 90; const BÚFFER_ADELANTE = 30;

let scheduleCache = null; let scheduleCacheTime = 0;

// ============================= // CARGAR EPISODIO HLS //
=============================

función asíncrona loadEpisode(ep, episodeIndex){

const respuesta = await fetch(ep.URL,{ cf:{ cacheTtl:3600,
cacheEverything:true } });

if(!response.ok){ throw new Error("Error cargando" +ep.nombre); }

const text = await response.text(); const base = new URL(".", ep.URL);

const regex = /#EXTINF:([]+),([^#\r\n]+)/g;

let match; const segmentos=[];

mientras((coincidencia=regex.exec(texto))!==null){

    segmentos.push({
      duración:Número(coincidencia[1]),
      uri:new URL(match[2].trim(),base).href,
      índice de episodios,
      Nombre del episodio:ep.nombre,
      localIndex:segmentos.longitud
    });

}

if(!segments.length){ throw new Error(ep.nombre+â€ sin segmentosâ€ ); }

devolver segmentos; }

// ============================== // CREAR HORARIO //
=============================

función asíncrona buildSchedule(){

const lists = await Promise.all( EPISODIOS.map((e,i)=>loadEpisode(e,i))
);

const segmentos = listas.flat();

const inicios=[]; let total=0; let objetivo=1;

para (constante segmento de segmentos){

    comienza.push(total);

    total += duración del segmento;

    objetivo=Math.max(
      objetivo,
      Matemáticas.ceil(segmento.duración)
    );

}

devolver { segmentos, inicios, total, objetivo };

}

// ============================= // CACHÉ //
=============================

función asíncrona getSchedule(){

if( !scheduleCache || Date.now()-scheduleCacheTime>300000 ){

    scheduleCache=esperar a construir el cronograma();
    scheduleCacheTime=Date.now();

}

devolver scheduleCache;

}

// ============================= // ESTADO LIVE INFINITO //
=============================

función obtenerEstadoEnVivo(horario,ahora){

const transcurrido = ahora-ÉPOCA;

const posición = ((transcurrido % schedule.total)+schedule.total) %
horario.total;

sea ​​índice=0;

para (let i=0;i<schedule.segments.length;i++){

    const start=schedule.starts[i];
    const fin = inicio + programación.segmentos[i].duración;

    si(posición>=inicio && posición<fin){

      índice=i;
      romper;

    }

}

const ciclo = Math.floor(transcurrido / horario.total);

devolver { índice, ciclo, absoluto: ciclo*schedule.segments.length+índice,
posición };

}

// ============================= // LISTA DE REPRODUCCIÓN EN DIRECTO //
=============================

función construirListaDeReproducciónEnVivo(horario,estado){

const segmentos = programación.segmentos; const recuento = segmentos.longitud;

const first=Math.max( 0, state.absolute-BACK_BUFFER );

const last = estado.absoluto + BÚFER_ADELANTE;

lista de reproducción=
#EXTM3U #EXT-X-VERSION:3 #EXT-X-TARGETDURATION:${schedule.target} #EXT-X-DISCONTINUITY-SEQUENCE:${Math.floor(state.absolute/count)} #EXT-X-MEDIA-SEQUENCE:${first};

sea ​​previousEpisode=null;

para( let absolute=first; absolute<=last; absolute++ ){

    const índice =
      ((porcentaje absoluto)+conteo)%conteo;


    const segmento = segmentos[índice];


    si(
      episodio anterior!==null &&
      episodio anterior!==segmento.episodioIndex
    ){

      lista de reproducción += "#EXT-X-DISCONTINUITY\n";

    }


    episodio anterior = segmento.índice del episodio;


    const línea de tiempo =
      ÉPOCA +
      absoluto *
      segmento.duración;


    lista de reproducción +=

#EXT-X-PROGRAM-DATE-TIME:${new Date( timeline*1000 ).toISOString()} #EXTINF:${segment.duration.toFixed(6)}, ${segment.uri};

}

lista de reproducción de regreso;

}

// ============================= // ENCABEZADOS //
=============================

función hlsHeaders(){

return { “content-type” : “application/vnd.apple.mpegurl” ,

“control de caché”: “sin almacenamiento, sin caché, debe revalidarse”,

“access-control-allow-origin” : “*” };

}

// ============================= // TRABAJADOR //
=============================

exportar por defecto {

obtención asíncrona(solicitud){

intentar{

const url = nueva URL(solicitud.url);

const schedule=await getSchedule();

const estado = getLiveState(horario, Math.floor(Fecha.ahora()/1000));

if(url.pathname===“/live.m3u8” ){

devolver nueva Respuesta(buildLivePlaylist(schedule,state), {
encabezados:hlsHeaders() } );

}

if(url.pathname===“/status” ){

const seg=schedule.segments[state.index];

return Response.json({

canal:“Bluey 24/7” ,

episodio:seg.episodeName,

segmento:seg.localIndex,

segundo:estado.posición.aFijo(2),

ciclo:estado.ciclo

}, { encabezados:{ “cache-control” : “no-store” ,
“access-control-allow-origin” : “*” } });

}

return new Response( “Bluey 24/7 EN VIVO/live.m3u8” );

}catch(error){

return new Response( “Error canal:” +error.message, { status:500,
encabezados:{ “content-type” :“text/plain” } } );

}

}

};
