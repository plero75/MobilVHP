/* === Fallbacks et debug horaires === */
function renderVerticalFallback(trips){
  const rows = (trips||[]).slice(0,3).map(t=>{
    const aimedStr=t.aimed? new Date(t.aimed).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '';
    const expectedStr=t.timeStr||aimedStr;
    const delay=t.delayMin>0? `<div class="status retard">Retard +${t.delayMin}</div>`:'';
    return `<div class="row"><div class="wait"><div class="minutes">${t.waitMin??''}</div><div class="label">min</div></div><div class="info"><div class="dest">${t.dest||''}</div></div><div class="meta"><div class="clock">${t.delayMin>0? `<span class='aimed'>${aimedStr}</span><span class='expected'>${expectedStr}</span>`: `<span class='expected'>${expectedStr}</span>`}</div>${delay}</div></div>`;
  }).join('');
  return rows || `<div class='row'><div class='info'><div class='dest'>Pas de passage prévu</div></div></div>`;
}

window.__renderBoardWithFallback = function(container, groups){
  container.innerHTML='';
  groups.forEach(g=>{
    const group=document.createElement('div'); group.className='group';
    const head=document.createElement('div'); head.className='group-head';
    const pill=document.createElement('div'); pill.className=`pill ${g.mode==='rer-a'?'rer-a':'bus'}`; pill.textContent=(g.mode==='rer-a'?'A':g.lineId);
    const dir=document.createElement('div'); dir.className='dir'; dir.textContent=g.direction||'';
    head.append(pill,dir); group.appendChild(head);

    const trips=(g.trips&&g.trips.length? g.trips: (window.generateTheoretical? window.generateTheoretical(g.lineId): [])).slice(0,3);

    let html='';
    if(window.renderHorizontalTimes){
      html = renderHorizontalTimes(trips);
    } else {
      html = renderVerticalFallback(trips);
    }
    const block=document.createElement('div'); block.className='row'; block.innerHTML=html; group.appendChild(block);
    container.appendChild(group);
  });
}
