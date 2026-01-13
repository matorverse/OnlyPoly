// UI helpers for ONLYPOLY - Richup Edition

window.OnlypolyUI = (function () {
  const toastContainer = document.getElementById('toastContainer');
  const boardEl = document.getElementById('board');
  const playersListEl = document.getElementById('playersList');
  const propertiesPanelEl = document.getElementById('propertiesPanel');

  let boardData = [];
  // Store player tokens to manage transitions
  const tokenElements = new Map();

  function setBoard(board) {
    boardData = board || [];
    renderBoard();
  }

  // --- FLAGS & ASSETS ---
  // --- FLAGS & ASSETS ---
  // FLAGS_DB is loaded from flags.js into window.FLAGS_DB

  function getFlagSVG(country) {
    if (!country) return '';
    const db = window.FLAGS_DB || {};
    let svg = db[country] || db['Generic'] || '<svg viewBox="0 0 100 100"><text y="80" font-size="80">🏳️</text></svg>';

    // Strip hardcoded width and height to allow CSS to control size
    // Matches width="..." or height="..." and removes them
    // Also ensures preserveAspectRatio is set if needed, but usually default is fine
    svg = svg.replace(/\s(width|height)="[^"]*"/g, '');

    return svg;
  }



  function renderBoard() {
    // CRITICAL FIX: Don't use innerHTML = '' as it destroys player tokens
    // Instead, selectively remove only tiles and board-center
    const tilesToRemove = boardEl.querySelectorAll('.tile, .board-center');
    tilesToRemove.forEach(tile => tile.remove());

    // Add Center Logo
    const center = document.createElement('div');
    center.className = 'board-center';
    center.innerHTML = '<div class="board-brand">ONLYPOLY</div>';
    boardEl.appendChild(center);

    if (!boardData.length) return;

    boardData.forEach((tile, index) => {
      const div = document.createElement('div');
      div.className = 'tile BoardTile'; // Base class
      div.dataset.tileId = tile.id;
      div.dataset.type = tile.type;

      // Determine Side for Badge Positioning
      if (index >= 0 && index <= 10) div.classList.add('side-bottom');
      else if (index > 10 && index <= 20) div.classList.add('side-left');
      else if (index > 20 && index <= 30) div.classList.add('side-top');
      else if (index > 30) div.classList.add('side-right');

      const pos = getPerimeterGridPos(index);
      if (!pos) return;

      div.style.gridRow = String(pos.row);
      div.style.gridColumn = String(pos.col);

      // --- TILE HEADER (Owner Color) ---
      const header = document.createElement('div');
      header.className = 'tile-header';
      if (tile.ownerColor) {
        header.style.backgroundColor = tile.ownerColor;
        header.classList.add('owned');
      }
      div.appendChild(header);

      // --- FLAG BADGE (Floating) ---
      // Remains absolute, existing logic holds.
      if (tile.country) {
        const flagBadge = document.createElement('div');
        flagBadge.className = 'flag-badge';
        flagBadge.innerHTML = getFlagSVG(tile.country);
        div.appendChild(flagBadge);
      }

      // --- CONTENT CONTAINER ---
      // Flex column to distribute Name (top/mid) and Price (bottom)
      const content = document.createElement('div');
      content.className = 'tile-content';

      // 1. Name
      const name = document.createElement('div');
      name.className = 'tile-name';
      name.textContent = tile.name.replace('Place', 'Pl').replace('Avenue', 'Ave');
      content.appendChild(name);

      // 2. Body/Icon (Special tiles)
      if (['chance', 'community_chest', 'tax', 'airport', 'utility'].includes(tile.type)) {
        const icon = document.createElement('div');
        icon.className = 'tile-icon';
        if (tile.type === 'chance') icon.textContent = '?';
        if (tile.type === 'community_chest') icon.textContent = '📦';
        if (tile.type === 'airport') icon.textContent = '✈️';
        if (tile.type === 'utility') icon.textContent = '💡';
        if (tile.type === 'tax') icon.textContent = '💰';
        content.appendChild(icon);
      }

      // 3. Price
      if (tile.price || tile.amount) {
        const price = document.createElement('div');
        price.className = 'tile-price';
        // Use 'M' or 'K' suffix logic if needed, or simple number
        price.textContent = `₩${tile.price || tile.amount}`;
        content.appendChild(price);
      } else if (tile.type === 'start') {
        // Special label
        // content.appendChild(...)
      }

      div.appendChild(content);

      // --- CORNER HANDLING ---
      if (index % 10 === 0) {
        div.classList.add('corner-tile');
        div.innerHTML = ''; // Clear structure for corners, render custom
        const label = document.createElement('div');
        label.className = 'corner-label';
        if (tile.type === 'start') label.textContent = 'GO';
        else if (tile.type === 'jail') label.textContent = 'JAIL';
        else if (tile.type === 'parking') label.textContent = 'FREE PARKING';
        else if (tile.type === 'goto_jail') label.textContent = 'GO TO JAIL';
        div.appendChild(label);
      }

      boardEl.appendChild(div);
    });
  }

  // 11x11 Grid Map (Anti-clockwise from Bottom Right 11,11)
  function getPerimeterGridPos(index) {
    const i = Number(index);
    const n = 11;
    // 0..10: Bottom Row (Right -> Left) -> (11, 11) to (11, 1)
    if (i <= 10) return { row: n, col: n - i };
    // 11..20: Left Col (Bottom -> Top) -> (10, 1) to (1, 1)
    if (i <= 20) return { row: n - (i - 10), col: 1 };
    // 21..30: Top Row (Left -> Right) -> (1, 2) to (1, 11)
    if (i <= 30) return { row: 1, col: (i - 20) + 1 };
    // 31..39: Right Col (Top -> Bottom) -> (2, 11) to (10, 11)
    return { row: (i - 30) + 1, col: n };
  }

  // Calculate geometric center of a tile for token placement (in %)
  function getTileCenter(index) {
    const pos = getPerimeterGridPos(index);
    if (!pos) return { x: 50, y: 50 };
    const cellSize = 100 / 11;
    return {
      x: (pos.col - 1) * cellSize + cellSize / 2,
      y: (pos.row - 1) * cellSize + cellSize / 2
    };
  }

  function renderPlayers(players, currentPlayerId) {
    if (!playersListEl) return;

    // 1. Update Sidebar List
    playersListEl.innerHTML = '';
    const sortedPlayers = Object.values(players).sort((a, b) => a.turnOrder - b.turnOrder);

    sortedPlayers.forEach(p => {
      const card = document.createElement('div');
      card.className = 'player-card';
      if (p.id === currentPlayerId) card.classList.add('active-turn');

      card.innerHTML = `
            <div style="display:flex; flex-direction:column;">
                <span class="player-name" style="color: ${p.color}">${p.name} ${currentPlayerId === p.id ? '🎲' : ''}</span>
                <span style="font-size: 0.8em; color: #888;">${p.position === 10 ? 'Visiting Jail' : 'Active'}</span>
            </div>
            <span class="player-money">$${p.money}</span>
        `;
      playersListEl.appendChild(card);
    });

    // 2. Update Board Tokens
    const currentIds = new Set();
    // Group for stacking
    const posGroups = {};
    sortedPlayers.forEach(p => {
      if (!posGroups[p.position]) posGroups[p.position] = [];
      posGroups[p.position].push(p.id);
    });

    sortedPlayers.forEach(p => {
      currentIds.add(p.id);
      let token = tokenElements.get(p.id);

      if (!token) {
        token = document.createElement('div');
        token.className = 'player-token';
        // Simple circle: Solid color
        token.style.backgroundColor = p.color;
        // Lighter border: we can simulate this with a white semi-transparent border 
        // that overlays the dark background or just stands out.
        // User requested "lighter shade". 
        // A simple way is a border that is same hue but lighter. 
        // Since we don't have color manipulation libs easily, 
        // we'll use a white border with opacity which blends to look lighter 
        // or just a solid white border which is the ultimate "lighter shade".
        // Let's try 3px solid rgba(255,255,255,0.5) for a "lighter" look.
        token.style.border = `3px solid rgba(255,255,255,0.5)`;

        token.title = p.name;
        boardEl.appendChild(token);
        tokenElements.set(p.id, token);

        // Allow immediate placement
        const xy = getTileCenter(p.position);
        token.style.left = xy.x + '%';
        token.style.top = xy.y + '%';
      }

      // Calculate stacked position
      const group = posGroups[p.position];
      const idx = group.indexOf(p.id);
      const xy = getTileCenter(p.position);

      // Simple offset logic
      const offset = 1.5; // %
      let ox = 0, oy = 0;
      if (group.length > 1) {
        if (idx === 1) ox = offset;
        if (idx === 2) ox = -offset;
        if (idx === 3) oy = offset;
        if (idx === 4) oy = -offset;
      }

      token.style.left = `calc(${xy.x}% + ${ox}%)`;
      token.style.top = `calc(${xy.y}% + ${oy}%)`;

      if (p.id === currentPlayerId) {
        token.style.zIndex = 150;  // Active player above all tiles
        token.style.transform = 'scale(1.2)'; // Just scale up, no pop/bounce/glow
      } else {
        token.style.zIndex = 120;
        token.style.transform = 'scale(1)';
      }
    });

    // Cleanup
    for (const [pid, el] of tokenElements) {
      if (!currentIds.has(pid)) {
        el.remove();
        tokenElements.delete(pid);
      }
    }
  }

  function toast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span style="margin-right:8px;">${type === 'error' ? '⚠️' : 'ℹ️'}</span> ${msg}`;
    if (type === 'error') t.style.borderLeftColor = '#ff4b4b';
    toastContainer.appendChild(t);
    setTimeout(() => {
      t.style.opacity = 0;
      t.style.transform = 'translateX(50px)';
      setTimeout(() => t.remove(), 300);
    }, 3000);
  }

  return {
    setBoard,
    renderPlayers,
    toast,
    // Expose for debugging
    getTileCenter
  };
})();
