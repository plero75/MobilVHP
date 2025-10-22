// PRIM query helpers with LineRef filtering
export function primStopUrl(stopId, lineCode){
  const base = `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${encodeURIComponent(stopId)}`;
  return lineCode ? `${base}&LineRef=STIF:Line::${lineCode}:` : base;
}

export function mergeRealtimeOrTheory(staticLines, realTimeData, theoreticalFn){
  return staticLines.map(st => {
    const liveTrips = realTimeData.filter(v => v.lineId === st.cCode);
    if (liveTrips.length){
      return { ...st, trips: liveTrips.slice(0,3) };
    }
    const th = theoreticalFn(st.lineId).slice(0,3).map(t=>({
      waitMin: t.waitMin, timeStr:t.aimedTime, aimed:t.aimed, dest:t.dest, delayMin:0, cancelled:false, atStop:false
    }));
    return { ...st, trips: th, hasRealTimeData:false };
  });
}
