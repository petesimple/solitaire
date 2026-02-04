/* Air Hockey Solitaire - Klondike (1 draw) */
(() => {
  'use strict';

  window.AH_SOLITAIRE_BACKS = window.AH_SOLITAIRE_BACKS || ['brunswick.png'];

  // ---------- Config ----------
  const SUITS = ['S','H','D','C'];
  const RANKS = [1,2,3,4,5,6,7,8,9,10,11,12,13]; // 1=A
  const RANK_LABEL = (r) => r===1 ? 'A' : r===11 ? 'J' : r===12 ? 'Q' : r===13 ? 'K' : String(r);
  const COLOR = (s) => (s==='H' || s==='D') ? 'R' : 'B';

  const ASSET = {
    frontsDir: './cards/fronts/',
    back: 'brunswick.png'
  };

  // ---------- DOM ----------
  const elStock = document.getElementById('stock');
  const elWaste = document.getElementById('waste');
  const elTableau = document.getElementById('tableau');
  const elTimer = document.getElementById('timer');
  const btnNew = document.getElementById('newGameBtn');
  const btnSettings = document.getElementById('settingsBtn');
  const settingsOverlay = document.getElementById('settings');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const backSelect = document.getElementById('backSelect');
  const chkMaster = document.getElementById('soundMaster');
  const chkShuffle = document.getElementById('soundShuffle');
  const chkPlace = document.getElementById('soundPlace');
  const chkWin = document.getElementById('soundWin');
  const btnUndo = document.getElementById('undoBtn');
  const btnAuto = document.getElementById('autoBtn');
  const elMoves = document.getElementById('moves');
  const winOverlay = document.getElementById('winOverlay');
  const playAgainBtn = document.getElementById('playAgainBtn');
  const confettiCanvas = document.getElementById('confettiCanvas');

  const elFoundation = {
    S: document.getElementById('foundation-S'),
    H: document.getElementById('foundation-H'),
    D: document.getElementById('foundation-D'),
    C: document.getElementById('foundation-C')
  };

  // ---------- State ----------
  /** @type {{id:string, suit:string, rank:number, color:'R'|'B', faceUp:boolean, frontSrc:string}[]} */
  let cards = [];
  /** @type {string[]} */ let stock = [];
  /** @type {string[]} */ let waste = [];
  /** @type {{S:string[],H:string[],D:string[],C:string[]}} */ let foundations = {S:[],H:[],D:[],C:[]};
  /** @type {string[][]} */ let tableau = [[],[],[],[],[],[],[]];

  // Timer
  let startTs = null;
  let timerRAF = null;
  let hasStarted = false;


  // Settings
  const SETTINGS_KEY = 'ah-solitaire-settings-v1';
  let settings = {
    back: 'brunswick.png',
    soundMaster: true,
    soundShuffle: true,
    soundPlace: true,
    soundWin: true
  };

  let audioCtx = null;


  function loadSettings(){
    try{
      const raw = localStorage.getItem(SETTINGS_KEY);
      if(raw){
        settings = Object.assign(settings, JSON.parse(raw));
      } else {
        // First run default
        settings.back = 'brunswick.png';
        saveSettings();
      }
    }catch(e){}
    applyBack();
  }
  function saveSettings(){
    try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }catch(e){}
  }
  function applyBack(){
    ASSET.back = './cards/backs/' + (settings.back || 'brunswick.png');
  }

  function openSettings(){
  if(!settingsOverlay) return;
  settingsOverlay.classList.remove('hidden');
  settingsOverlay.style.display = 'grid';
}
  function closeSettings(){
  if(!settingsOverlay) return;
  settingsOverlay.classList.add('hidden');
  settingsOverlay.style.display = 'none';
}

  // Moves + undo
  let moveCount = 0;
  const undoStack = [];
  const UNDO_LIMIT = 200;

  // Drag
  let drag = null; // {cardIds, from:{type, idx, suit?}, originRect, pointerId, dx, dy, stackEl}
  let dragLayer = null;

  // ---------- Helpers ----------
  const qs = (sel, root=document) => root.querySelector(sel);

  function fmtTime(ms){
    const s = Math.floor(ms/1000);
    const mm = String(Math.floor(s/60)).padStart(2,'0');
    const ss = String(s%60).padStart(2,'0');
    return `${mm}:${ss}`;
  }

  function startTimerIfNeeded(){
    if(hasStarted) return;
    hasStarted = true;
    startTs = performance.now();
    const tick = () => {
      if(!hasStarted) return;
      elTimer.textContent = fmtTime(performance.now() - startTs);
      timerRAF = requestAnimationFrame(tick);
    };
    timerRAF = requestAnimationFrame(tick);
  }

  function resetTimer(){
    hasStarted = false;
    startTs = null;
    if(timerRAF) cancelAnimationFrame(timerRAF);
    timerRAF = null;
    elTimer.textContent = '00:00';
  }

  function setMoves(n){
    moveCount = n;
    if(elMoves) elMoves.textContent = `Moves: ${moveCount}`;
  }
  function bumpMove(){
    setMoves(moveCount + 1);
  }

  function snapshotState(){
    const faceUp = {};
    for(const c of cards) faceUp[c.id] = !!c.faceUp;
    const elapsed = (hasStarted && startTs) ? (performance.now() - startTs) : 0;

    return {
      stock: stock.slice(),
      waste: waste.slice(),
      foundations: {S: foundations.S.slice(), H: foundations.H.slice(), D: foundations.D.slice(), C: foundations.C.slice()},
      tableau: tableau.map(col => col.slice()),
      faceUp,
      moveCount,
      hasStarted,
      elapsed
    };
  }

  function pushUndo(){
    undoStack.push(snapshotState());
    if(undoStack.length > UNDO_LIMIT) undoStack.shift();
    if(btnUndo) btnUndo.disabled = undoStack.length === 0;
  }

  function restoreState(s){
    stock = s.stock.slice();
    waste = s.waste.slice();
    foundations = {S: s.foundations.S.slice(), H: s.foundations.H.slice(), D: s.foundations.D.slice(), C: s.foundations.C.slice()};
    tableau = s.tableau.map(col => col.slice());
    for(const c of cards) c.faceUp = !!s.faceUp[c.id];

    setMoves(s.moveCount || 0);

    // restore timer
    if(timerRAF) cancelAnimationFrame(timerRAF);
    timerRAF = null;

    hasStarted = !!s.hasStarted;
    if(hasStarted){
      startTs = performance.now() - (s.elapsed || 0);
      const tick = () => {
        if(!hasStarted) return;
        elTimer.textContent = fmtTime(performance.now() - startTs);
        timerRAF = requestAnimationFrame(tick);
      };
      timerRAF = requestAnimationFrame(tick);
    } else {
      startTs = null;
      elTimer.textContent = '00:00';
    }

    playSound('shuffle');
    renderAll();
  }

  function undo(){
    const s = undoStack.pop();
    if(!s) return;
    restoreState(s);
    if(btnUndo) btnUndo.disabled = undoStack.length === 0;
  }

  function topRank(suit){
    const p = foundations[suit];
    if(!p.length) return 0;
    return getCard(top(p)).rank;
  }

  function safeToFoundation(card){
    // Conservative "won't trap you" rule:
    // You can safely move a red card if it is <= min(black foundations)+1
    // You can safely move a black card if it is <= min(red foundations)+1
    // This prevents auto-moving low cards too aggressively.
    const minBlack = Math.min(topRank('S'), topRank('C'));
    const minRed = Math.min(topRank('H'), topRank('D'));

    if(card.color === 'R') return card.rank <= (minBlack + 1);
    return card.rank <= (minRed + 1);
  }

  function autoFinish(){
    startTimerIfNeeded();

    let movedAny = false;
    pushUndo(); // one snapshot for the whole auto sequence

    // Keep making safe moves until no more exist.
    for(let guard=0; guard<600; guard++){
      let movedThisPass = false;

      // Waste top first
      const w = top(waste);
      if(w){
        const c = getCard(w);
        if(canMoveToFoundation(c, c.suit) && safeToFoundation(c)){
          waste.pop();
          foundations[c.suit].push(w);
          bumpMove();
      playSound('place');
          movedAny = true;
          movedThisPass = true;
          continue;
        }
      }

      // Tableau tops
      for(let col=0; col<7; col++){
        const id = top(tableau[col]);
        if(!id) continue;
        const c = getCard(id);
        if(!c.faceUp) continue;

        if(canMoveToFoundation(c, c.suit) && safeToFoundation(c)){
          tableau[col].pop();
          foundations[c.suit].push(id);
          flipTableauIfNeeded(col);
          bumpMove();
          movedAny = true;
          movedThisPass = true;
          break;
        }
      }

      if(!movedThisPass) break;
    }

    if(!movedAny){
      // No-op: remove undo snapshot
      undoStack.pop();
      if(btnUndo) btnUndo.disabled = undoStack.length === 0;
      return;
    }

    renderAll();
    checkWin();
  }

  function cardId(suit, rank){
    return `${RANK_LABEL(rank)}${suit}`;
  }

  function buildDeck(){
    cards = [];
    for(const s of SUITS){
      for(const r of RANKS){
        const id = cardId(s,r);
        cards.push({
          id, suit:s, rank:r, color: COLOR(s),
          faceUp: false,
          frontSrc: `${ASSET.frontsDir}${id}.svg`
        });
      }
    }
  }

  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  function getCard(id){
    return cards.find(c=>c.id===id);
  }

  function top(arr){ return arr.length ? arr[arr.length-1] : null; }

function bindAutoGesture(){
  const elTable = document.getElementById('table');
  if(!elTable) return;

  // Desktop: dblclick anywhere on the play area
  elTable.addEventListener('dblclick', (e) => {
    if (e.target.closest('button, a, input, select, textarea, .settings-card, .win-card, .share-card')) return;
    autoFinish();
  });

  // Mobile: double-tap detector
  let lastTapTime = 0;
  let lastTapX = 0;
  let lastTapY = 0;

  elTable.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse') return;
    if (drag && drag.moved) return;

    if (e.target.closest('button, a, input, select, textarea, .settings-card, .win-card, .share-card')) return;

    const now = performance.now();
    const dt = now - lastTapTime;

    const dx = e.clientX - lastTapX;
    const dy = e.clientY - lastTapY;
    const dist = Math.hypot(dx, dy);

    if (dt > 0 && dt < 300 && dist < 35) {
      autoFinish();
      lastTapTime = 0; // reset
      return;
    }

    lastTapTime = now;
    lastTapX = e.clientX;
    lastTapY = e.clientY;
  });
}
  
  function dealNewGame(){
    resetTimer();
    hideWin();
    undoStack.length = 0;
    if(btnUndo) btnUndo.disabled = true;
    setMoves(0);

    buildDeck();
    const deckIds = shuffle(cards.map(c=>c.id));
    stock = deckIds.slice();
    waste = [];
    foundations = {S:[],H:[],D:[],C:[]};
    tableau = [[],[],[],[],[],[],[]];

    // Deal tableau: col i gets i+1 cards; last one faceUp
    for(let col=0; col<7; col++){
      for(let k=0; k<=col; k++){
        const id = stock.pop();
        tableau[col].push(id);
      }
      // flip top
      const idTop = top(tableau[col]);
      if(idTop) getCard(idTop).faceUp = true;
    }
    // remaining stock faceDown
    for(const id of stock) getCard(id).faceUp = false;

    renderAll();
  }

  // ---------- Rules ----------
  function canMoveToFoundation(card, suit){
    if(card.suit !== suit) return false;
    const pile = foundations[suit];
    if(pile.length === 0) return card.rank === 1; // Ace
    const topCard = getCard(top(pile));
    return card.rank === topCard.rank + 1;
  }

  function canMoveToTableau(card, col){
    const pile = tableau[col];
    if(pile.length === 0) return card.rank === 13; // King
    const t = getCard(top(pile));
    if(!t.faceUp) return false;
    return (t.color !== card.color) && (t.rank === card.rank + 1);
  }

  function isValidRun(ids){
    // ids are in order from topmost? We'll store run from selected downwards.
    // Validate descending rank and alternating color, all faceUp.
    for(let i=0;i<ids.length;i++){
      const c = getCard(ids[i]);
      if(!c.faceUp) return false;
      if(i < ids.length-1){
        const below = getCard(ids[i+1]);
        if(c.rank !== below.rank + 1) return false;
        if(c.color === below.color) return false;
      }
    }
    return true;
  }

  function flipTableauIfNeeded(col){
    const pile = tableau[col];
    if(!pile.length) return;
    const id = top(pile);
    const c = getCard(id);
    if(!c.faceUp){
      c.faceUp = true;
    }
  }

  // ---------- Rendering ----------
  function ensureTableauCols(){
    if(elTableau.children.length) return;
    for(let i=0;i<7;i++){
      const wrap = document.createElement('div');
      wrap.className = 'tableau-col';
      const pile = document.createElement('div');
      pile.className = 'pile tableauPile';
      pile.dataset.pile = 'tableau';
      pile.dataset.col = String(i);
      pile.setAttribute('aria-label', `Tableau column ${i+1}`);
      wrap.appendChild(pile);
      elTableau.appendChild(wrap);
    }
  }

  function clearPile(el){
    while(el.firstChild) el.removeChild(el.firstChild);
  }

  function makeCardEl(id){
    const c = getCard(id);
    const el = document.createElement('div');
    el.className = 'card' + (c.faceUp ? '' : ' faceDown');
    el.dataset.cardId = id;

    const img = document.createElement('img');
    img.draggable = false;
    img.alt = id;
    img.src = c.faceUp ? c.frontSrc : ASSET.back;
    el.appendChild(img);

    return el;
  }

  function renderStock(){
    clearPile(elStock);
    const id = top(stock);
    if(!id) return;
    const c = getCard(id);
    c.faceUp = false;
    const cardEl = makeCardEl(id);
    cardEl.style.left = '0px';
    cardEl.style.top = '0px';
    elStock.appendChild(cardEl);
  }

  function renderWaste(){
    clearPile(elWaste);
    const id = top(waste);
    if(!id) return;
    getCard(id).faceUp = true;
    const cardEl = makeCardEl(id);
    cardEl.style.left = '0px';
    cardEl.style.top = '0px';
    elWaste.appendChild(cardEl);
  }

  function renderFoundations(){
    for(const s of SUITS){
      const el = elFoundation[s];
      clearPile(el);
      const id = top(foundations[s]);
      if(!id) continue;
      const c = getCard(id); c.faceUp = true;
      const cardEl = makeCardEl(id);
      cardEl.style.left = '0px';
      cardEl.style.top = '0px';
      el.appendChild(cardEl);
    }
  }

  function renderTableau(){
    ensureTableauCols();
    const piles = elTableau.querySelectorAll('.tableauPile');
    piles.forEach(p => clearPile(p));

    piles.forEach((p) => {
      const col = Number(p.dataset.col);
      const ids = tableau[col];
      ids.forEach((id, idx) => {
        const c = getCard(id);
        const cardEl = makeCardEl(id);
        // stack offset
        const y = idx * getStackOffset(c.faceUp);
        cardEl.style.left = '50%';
        cardEl.style.top = `${y}px`;
        cardEl.style.transform = 'translateX(-50%)';
        p.appendChild(cardEl);
      });
    });
  }

  function getStackOffset(faceUp){
    return faceUp ? cssNum('--stackOffset') : Math.max(14, cssNum('--stackOffset') - 6);
  }

  function cssNum(varName){
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return Number(v.replace('px','')) || 0;
  }

  function renderAll(){
    renderStock();
    renderWaste();
    renderFoundations();
    renderTableau();
    bindCardEvents();
    bindPileEvents();
  }

  // ---------- Interaction ----------
  function bindPileEvents(){
    // Stock click to draw
    elStock.onclick = () => {
      startTimerIfNeeded();
      pushUndo();
      bumpMove();
      if(stock.length){
        const id = stock.pop();
        getCard(id).faceUp = true;
        waste.push(id);
      } else if(waste.length){
        // recycle
        while(waste.length){
          const id = waste.pop();
          getCard(id).faceUp = false;
          stock.push(id);
        }
      }
      renderAll();
    };

    // Prevent click on empty waste/piles doing anything weird
    elWaste.onclick = () => {};
    for(const s of SUITS){
      elFoundation[s].onclick = () => {};
    }

    // Tableau pile click on empty does nothing
    elTableau.querySelectorAll('.tableauPile').forEach(p => p.onclick = () => {});
  }

  function bindCardEvents(){
    // Delegate pointerdown for draggable cards
    document.querySelectorAll('.card').forEach(cardEl => {
      cardEl.onpointerdown = (e) => onPointerDownCard(e, cardEl);
      cardEl.onclick = (e) => onClickCard(e, cardEl);
    });
  }

  function onClickCard(e, cardEl){
    // Avoid click after drag
    if(drag && drag.moved) return;

    const id = cardEl.dataset.cardId;
    const c = getCard(id);

    // If facedown tableau top card, flip it
    const loc = locateCard(id);
    if(loc.type === 'tableau'){
      const pile = tableau[loc.col];
      if(top(pile) === id && !c.faceUp){
        startTimerIfNeeded();
        pushUndo();
        bumpMove();
        c.faceUp = true;
        renderAll();
        return;
      }
    }

    if(!c.faceUp) return;

    startTimerIfNeeded();
    // Auto move: foundation first, else tableau
    if(tryAutoMoveToFoundation(id)) { pushUndo(); bumpMove(); renderAll(); checkWin(); return; }
    if(tryAutoMoveToTableau(id)) { pushUndo(); bumpMove(); renderAll(); checkWin(); return; }
  }

  function locateCard(id){
    if(stock.includes(id)) return {type:'stock'};
    if(waste.includes(id)) return {type:'waste'};
    for(const s of SUITS){
      if(foundations[s].includes(id)) return {type:'foundation', suit:s};
    }
    for(let col=0; col<7; col++){
      const idx = tableau[col].indexOf(id);
      if(idx !== -1) return {type:'tableau', col, idx};
    }
    return {type:'unknown'};
  }

  function tryAutoMoveToFoundation(id){
    const c = getCard(id);
    // Only top cards can go from piles
    const loc = locateCard(id);
    if(loc.type === 'tableau' && top(tableau[loc.col]) !== id) return false;
    if(loc.type === 'waste' && top(waste) !== id) return false;
    if(loc.type === 'foundation') return false;

    if(canMoveToFoundation(c, c.suit)){
      removeFromLoc(id, loc);
      foundations[c.suit].push(id);
      if(loc.type === 'tableau') flipTableauIfNeeded(loc.col);
      return true;
    }
    return false;
  }

  function tryAutoMoveToTableau(id){
    const c = getCard(id);
    const loc = locateCard(id);
    if(loc.type === 'tableau' && top(tableau[loc.col]) !== id) return false;
    if(loc.type === 'waste' && top(waste) !== id) return false;
    if(loc.type === 'foundation') {
      // allow pulling back (optional) only if top
      if(top(foundations[loc.suit]) !== id) return false;
    }
    if(loc.type === 'stock') return false;

    for(let col=0; col<7; col++){
      if(canMoveToTableau(c, col)){
        removeFromLoc(id, loc);
        tableau[col].push(id);
        if(loc.type === 'tableau') flipTableauIfNeeded(loc.col);
        return true;
      }
    }
    return false;
  }

  function removeFromLoc(id, loc){
    if(loc.type === 'waste'){
      waste.pop();
      return;
    }
    if(loc.type === 'stock'){
      stock.pop();
      return;
    }
    if(loc.type === 'foundation'){
      foundations[loc.suit].pop();
      return;
    }
    if(loc.type === 'tableau'){
      tableau[loc.col].splice(loc.idx);
      return;
    }
  }

  // ---------- Drag and Drop ----------
  function onPointerDownCard(e, cardEl){
    const id = cardEl.dataset.cardId;
    const c = getCard(id);
    if(!c.faceUp) return;

    const loc = locateCard(id);

    // Only allow dragging if it's top (waste/foundation) or a valid run in tableau
    let dragIds = [];
    if(loc.type === 'waste'){
      if(top(waste) !== id) return;
      dragIds = [id];
    } else if(loc.type === 'foundation'){
      if(top(foundations[loc.suit]) !== id) return;
      dragIds = [id];
    } else if(loc.type === 'tableau'){
      const pile = tableau[loc.col];
      dragIds = pile.slice(loc.idx);
      if(!isValidRun(dragIds)) return;
    } else {
      return;
    }

    // Start drag
    startTimerIfNeeded();
    pushUndo();

    dragLayer = dragLayer || createDragLayer();
    const stackEl = document.createElement('div');
    stackEl.className = 'drag-stack';
    stackEl.dataset.from = JSON.stringify(loc);

    // Build visual stack
    const stackOffset = cssNum('--stackOffset');
    dragIds.forEach((cid, i) => {
      const clone = makeCardEl(cid);
      clone.classList.add('ghost');
      clone.style.left = '0px';
      clone.style.top = `${i * stackOffset}px`;
      clone.style.width = getComputedStyle(cardEl).width;
      clone.style.height = 'var(--cardH)';
      stackEl.appendChild(clone);
    });

    dragLayer.appendChild(stackEl);

    const rect = cardEl.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;

    drag = {
      cardIds: dragIds,
      from: loc,
      pointerId: e.pointerId,
      dx, dy,
      originRect: rect,
      stackEl,
      moved: false
    };

    // Hide originals during drag
    hideOriginalsDuringDrag(dragIds);

    // Position initial
    moveDragStack(e.clientX, e.clientY);

    cardEl.setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', onPointerMove, {passive:false});
    window.addEventListener('pointerup', onPointerUp, {passive:false});
    window.addEventListener('pointercancel', onPointerUp, {passive:false});
  }

  function createDragLayer(){
    const dl = document.createElement('div');
    dl.className = 'drag-layer';
    document.body.appendChild(dl);
    return dl;
  }

  function hideOriginalsDuringDrag(ids){
    ids.forEach(id => {
      const el = document.querySelector(`.card[data-card-id="${id}"]`);
      if(el) el.style.visibility = 'hidden';
    });
  }

  function unhideOriginalsDuringDrag(ids){
    ids.forEach(id => {
      const el = document.querySelector(`.card[data-card-id="${id}"]`);
      if(el) el.style.visibility = '';
    });
  }

  function moveDragStack(x,y){
    if(!drag) return;
    const left = x - drag.dx;
    const top = y - drag.dy;
    drag.stackEl.style.transform = `translate(${left}px, ${top}px)`;
  }

  function onPointerMove(e){
    if(!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    drag.moved = true;
    moveDragStack(e.clientX, e.clientY);
    clearHints();
    showDropHint(e.clientX, e.clientY, drag.cardIds[0]);
  }

  function onPointerUp(e){
    if(!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();

    clearHints();

    const drop = findDropTarget(e.clientX, e.clientY);
    const moved = attemptDrop(drop);
    if(!moved){
      undoStack.pop();
      if(btnUndo) btnUndo.disabled = undoStack.length === 0;
    } else {
      bumpMove();
    }

    // Cleanup drag visuals
    if(dragLayer && drag.stackEl){
      drag.stackEl.remove();
    }
    unhideOriginalsDuringDrag(drag.cardIds);

    drag = null;

    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);

    renderAll();
    if(moved) checkWin();
  }

  function clearHints(){
    document.querySelectorAll('.hint').forEach(el => el.classList.remove('hint'));
  }

  function showDropHint(x,y, leadCardId){
    const target = findDropTarget(x,y, true);
    if(!target) return;
    const lead = getCard(leadCardId);

    if(target.type === 'foundation'){
      const ok = drag.cardIds.length === 1 && canMoveToFoundation(lead, target.suit);
      if(ok) target.el.classList.add('hint');
    } else if(target.type === 'tableau'){
      const ok = canMoveToTableau(lead, target.col);
      if(ok) target.el.classList.add('hint');
    }
  }

  function findDropTarget(x,y, includeEl=false){
    // Foundations
    for(const s of SUITS){
      const el = elFoundation[s];
      const r = el.getBoundingClientRect();
      if(x>=r.left && x<=r.right && y>=r.top && y<=r.bottom){
        return includeEl ? {type:'foundation', suit:s, el} : {type:'foundation', suit:s};
      }
    }
    // Waste/Stock are not valid drop targets typically
    // Tableau columns
    const cols = elTableau.querySelectorAll('.tableauPile');
    for(const colEl of cols){
      const r = colEl.getBoundingClientRect();
      if(x>=r.left && x<=r.right && y>=r.top && y<=r.bottom){
        const col = Number(colEl.dataset.col);
        return includeEl ? {type:'tableau', col, el:colEl} : {type:'tableau', col};
      }
    }
    return null;
  }

  function attemptDrop(target){
    if(!target) return false;

    const leadId = drag.cardIds[0];
    const lead = getCard(leadId);

    // Disallow dropping multiple to foundation
    if(target.type === 'foundation'){
      if(drag.cardIds.length !== 1) return false;
      if(!canMoveToFoundation(lead, target.suit)) return false;

      // Move
      const from = drag.from;
      removeDraggedFromSource(from, drag.cardIds);
      foundations[target.suit].push(leadId);
      if(from.type === 'tableau') flipTableauIfNeeded(from.col);
      return true;
    }

    if(target.type === 'tableau'){
      if(!canMoveToTableau(lead, target.col)) return false;

      const from = drag.from;
      removeDraggedFromSource(from, drag.cardIds);
      tableau[target.col].push(...drag.cardIds);
      if(from.type === 'tableau') flipTableauIfNeeded(from.col);
      return true;
    }

    return false;
  }

  function removeDraggedFromSource(from, ids){
    if(from.type === 'waste'){
      waste.pop();
      return;
    }
    if(from.type === 'foundation'){
      foundations[from.suit].pop();
      return;
    }
    if(from.type === 'tableau'){
      tableau[from.col].splice(from.idx);
      return;
    }
  }

  // ---------- Win ----------
  function checkWin(){
    const won = SUITS.every(s => foundations[s].length === 13);
    if(won){
      playSound('win');
    showWin();
    }
  }

  function showWin(){
    // stop timer
    hasStarted = false;
    if(timerRAF) cancelAnimationFrame(timerRAF);

    winOverlay.classList.remove('hidden');
    startCardFireworks();
  }

  function hideWin(){
    winOverlay.classList.add('hidden');
    stopCardFireworks();
  }

  btnNew.addEventListener('click', dealNewGame);

  // Settings open/close
  if(btnSettings){
    btnSettings.addEventListener('click', () => openSettings());
  }
  if(closeSettingsBtn){
    closeSettingsBtn.addEventListener('click', () => closeSettings());
  }
  if(settingsOverlay){
    settingsOverlay.addEventListener('click', (e) => {
      if(e.target === settingsOverlay) closeSettings();
    });
  }
  window.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') closeSettings();
  });

  playAgainBtn.addEventListener('click', dealNewGame);

  if(btnUndo){
    btnUndo.addEventListener('click', () => undo());
    btnUndo.disabled = true;
  }

  if(btnAuto){
    btnAuto.addEventListener('click', () => autoFinish());
  }

  if(btnSettings){
    btnSettings.addEventListener('click', ()=> settingsOverlay.classList.remove('hidden'));
  }
  if(closeSettingsBtn){
    closeSettingsBtn.addEventListener('click', ()=> settingsOverlay.classList.add('hidden'));
  }
  if(backSelect){
    backSelect.addEventListener('change', ()=>{
      settings.back = backSelect.value;
      saveSettings();
      applyBack();
      renderAll();
    });
  }

  // ---------- Fireworks of cards ----------
  let fx = null;

  function startCardFireworks(){
    const ctx = confettiCanvas.getContext('2d');
    const DPR = Math.max(1, window.devicePixelRatio || 1);
    function resize(){
      confettiCanvas.width = Math.floor(window.innerWidth * DPR);
      confettiCanvas.height = Math.floor(window.innerHeight * DPR);
    }
    resize();
    window.addEventListener('resize', resize);

    // Preload a handful of card images (fronts + back) for the fireworks.
    const pick = [];
    const allIds = cards.map(c=>c.id);
    for(let i=0;i<12;i++){
      pick.push(allIds[Math.floor(Math.random()*allIds.length)]);
    }

    const images = [];
    function loadImg(src){
      return new Promise(res=>{
        const im = new Image();
        im.onload = () => res(im);
        im.src = src;
      });
    }

    Promise.all([
      loadImg(ASSET.back),
      ...pick.map(id => loadImg(getCard(id).frontSrc))
    ]).then((imgs) => {
      const backImg = imgs[0];
      const frontImgs = imgs.slice(1);
      const W = confettiCanvas.width;
      const H = confettiCanvas.height;

      const particles = [];
      const count = 90;
      for(let i=0;i<count;i++){
        const img = Math.random() < 0.35 ? backImg : frontImgs[Math.floor(Math.random()*frontImgs.length)];
        particles.push({
          img,
          x: W/2 + rand(-60,60),
          y: H/2 + rand(-20,20),
          vx: rand(-6,6),
          vy: rand(-14,-4),
          rot: rand(0, Math.PI*2),
          vr: rand(-0.12, 0.12),
          w: rand(34, 54) * DPR,
          h: rand(48, 76) * DPR,
          g: rand(0.25, 0.5) * DPR,
          life: rand(220, 420)
        });
      }

      fx = {ctx, DPR, particles, resize, onResize: resize, running:true};
      const loop = () => {
        if(!fx || !fx.running) return;
        const {ctx, particles} = fx;
        ctx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);

        for(const p of particles){
          p.life -= 1;
          p.vy += p.g;
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.vr;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life/260));
          ctx.drawImage(p.img, -p.w/2, -p.h/2, p.w, p.h);
          ctx.restore();

          // bounce floor
          if(p.y > confettiCanvas.height - 40*DPR){
            p.y = confettiCanvas.height - 40*DPR;
            p.vy *= -0.45;
            p.vx *= 0.92;
          }

          // respawn lightly
          if(p.life <= 0){
            p.x = confettiCanvas.width/2 + rand(-80,80);
            p.y = confettiCanvas.height/2 + rand(-30,30);
            p.vx = rand(-6,6);
            p.vy = rand(-14,-4);
            p.rot = rand(0, Math.PI*2);
            p.vr = rand(-0.12,0.12);
            p.life = rand(240, 520);
          }
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });

    function rand(a,b){ return a + Math.random()*(b-a); }
  }

  function stopCardFireworks(){
    if(fx){
      fx.running = false;
      window.removeEventListener('resize', fx.onResize || fx.resize);
      fx = null;
    }
    const ctx = confettiCanvas.getContext('2d');
    ctx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
  }

  
  function populateBacks(){
    const list = window.AH_SOLITAIRE_BACKS || ['brunswick.png'];
    backSelect.innerHTML = '';
    list.forEach(fn=>{
      const o = document.createElement('option');
      o.value = fn;
      o.textContent = fn.replace(/[-_]/g,' ').replace(/\.png$/,'');
      backSelect.appendChild(o);
    });
    backSelect.value = settings.back || 'brunswick.png';
  }

    // ---------- Init ----------
  loadSettings();

  populateBacks();
  chkMaster.checked = settings.soundMaster;
  chkShuffle.checked = settings.soundShuffle;
  chkPlace.checked = settings.soundPlace;
  chkWin.checked = settings.soundWin;

  chkMaster.onchange = ()=>{ settings.soundMaster = chkMaster.checked; saveSettings(); };
  chkShuffle.onchange = ()=>{ settings.soundShuffle = chkShuffle.checked; saveSettings(); };
  chkPlace.onchange = ()=>{ settings.soundPlace = chkPlace.checked; saveSettings(); };
  chkWin.onchange = ()=>{ settings.soundWin = chkWin.checked; saveSettings(); };

  ensureTableauCols();
  bindAutoGesture();
  dealNewGame();

  // ---------- Share overlay ----------
  const logoBtn = document.getElementById('logoBtn');
  const shareOverlay = document.getElementById('shareOverlay');
  const closeShareBtn = document.getElementById('closeShareBtn');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const nativeShareBtn = document.getElementById('nativeShareBtn');

  const SHARE_URL = 'https://petesimple.github.io/solitaire/';

  function openShare(){
    if(!shareOverlay) return;
    shareOverlay.classList.remove('hidden');
  }

  function closeShare(){
    if(!shareOverlay) return;
    shareOverlay.classList.add('hidden');
  }

  if(logoBtn) logoBtn.addEventListener('click', openShare);
  if(closeShareBtn) closeShareBtn.addEventListener('click', closeShare);

  if(shareOverlay){
    shareOverlay.addEventListener('click', e=>{
      if(e.target === shareOverlay) closeShare();
    });
  }

  if(copyLinkBtn){
    copyLinkBtn.addEventListener('click', async ()=>{
      try{
        await navigator.clipboard.writeText(SHARE_URL);
        copyLinkBtn.textContent = 'Copied!';
        setTimeout(()=> copyLinkBtn.textContent = 'Copy Link', 1200);
      }catch(e){}
    });
  }

  if(nativeShareBtn){
    if(navigator.share){
      nativeShareBtn.addEventListener('click', ()=>{
        navigator.share({
          title:'Air Hockey Solitaire',
          text:'Play Air Hockey Solitaire',
          url: SHARE_URL
        });
      });
    } else {
      nativeShareBtn.style.display = 'none';
    }
  }

  window.addEventListener('keydown', e=>{
    if(e.key === 'Escape') closeShare();
  });

  // ---------- Audio ----------
  function ensureAudio(){
    if(!audioCtx){
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playSound(type){
    if(!settings.soundMaster) return;
    if(type==='shuffle' && !settings.soundShuffle) return;
    if(type==='place' && !settings.soundPlace) return;
    if(type==='win' && !settings.soundWin) return;

    ensureAudio();
    const t = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    let freq = 440, dur = 0.06;

    if(type==='shuffle'){ freq = 260; dur = 0.05; }
    if(type==='place'){ freq = 520; dur = 0.04; }
    if(type==='win'){ freq = 660; dur = 0.12; }

    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

})();
