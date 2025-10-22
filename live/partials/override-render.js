/* switch to fallback renderer to guarantee display */
function renderBoard(container, groups){
  if (!container) return;
  if (window.__renderBoardWithFallback) {
    window.__renderBoardWithFallback(container, groups);
    return;
  }
  // legacy no-op if fallback missing
  container.innerHTML = '<div class="group"><div class="row"><div class="info"><div class="dest">Initialisation de l\'affichage...</div></div></div></div>';
}
