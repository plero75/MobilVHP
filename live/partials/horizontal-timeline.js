// === Rendu horizontal 3 horaires avec statut ===
function renderHorizontalTimes(trips){
  const cols = trips.slice(0,3).map(t => {
    const aimedStr = t.aimed? new Date(t.aimed).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '';
    const expectedStr = t.timeStr || aimedStr;
    const status = (t.cancelled? 'supprime' : t.atStop? 'quai' : t.waitMin<=1? 'imminent' : t.delayMin>0? 'retard' : '')
    const statusLabel = status==='supprime'? 'SUPPRIMÉ' : status==='quai'? 'À QUAI' : status==='imminent'? 'IMMINENT' : status==='retard'? `RETARD +${t.delayMin||0}` : '';

    const clockHTML = t.delayMin>0
      ? `<div class="clock-delayed"><span class="aimed-time">${aimedStr}</span><span class="expected-time">${expectedStr}</span></div>`
      : `<div class="clock">${expectedStr}</div>`;

    return `
      <div class="time-col">
        <div class="minutes">${t.waitMin!=null? String(t.waitMin):''}</div>
        ${clockHTML}
        ${statusLabel? `<div class="badge ${status}">${statusLabel}</div>`:''}
      </div>
    `;
  }).join('');
  return `<div class="time-line">${cols}</div>`;
}
