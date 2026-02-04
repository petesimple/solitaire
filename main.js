/* Air Hockey Solitaire - Klondike (1 draw) */
(() => {
  'use strict';

  // ---------- Config ----------
  const SUITS = ['S','H','D','C'];
  const RANKS = [1,2,3,4,5,6,7,8,9,10,11,12,13]; // 1=A
  const RANK_LABEL = (r) => r===1 ? 'A' : r===11 ? 'J' : r===12 ? 'Q' : r===13 ? 'K' : String(r);
  const COLOR = (s) => (s==='H' || s==='D') ? 'R' : 'B';

  const ASSET = {
    frontsDir: './cards/fronts/',
    back: './cards/backs/back-v1.png'
  };

  // ---------- DOM ----------
  const elStock = document.getElementById('stock');
  const elWaste = document.getElementById('waste');
  const elTableau = document.getElementById('tableau');
  const elTimer = document.getElementById('timer');
  const btnNew = document.getElementById('newGameBtn');
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

  function dealNewGame(){
    resetTimer();
    hideWin();

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
        cardEl.style.left = '0px';
        cardEl.style.top = `${y}px`;
        cardEl.style.width = '100%';
        // Keep consistent height
        cardEl.style.height = 'var(--cardH)';
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
        c.faceUp = true;
        renderAll();
        return;
      }
    }

    if(!c.faceUp) return;

    startTimerIfNeeded();
    // Auto move: foundation first, else tableau
    if(tryAutoMoveToFoundation(id)) { renderAll(); checkWin(); return; }
    if(tryAutoMoveToTableau(id)) { renderAll(); checkWin(); return; }
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
  playAgainBtn.addEventListener('click', dealNewGame);

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

  // ---------- Init ----------
  ensureTableauCols();
  dealNewGame();

})();
