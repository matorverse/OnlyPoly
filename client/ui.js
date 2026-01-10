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

  function renderBoard() {
    boardEl.innerHTML = '';

    // Add Center Logo
    const center = document.createElement('div');
    center.className = 'board-center';
    center.textContent = 'ONLYPOLY';
    boardEl.appendChild(center);

    if (!boardData.length) return;

    boardData.forEach((tile, index) => {
      const div = document.createElement('div');
      div.className = 'tile';
      div.dataset.tileId = tile.id;

      const pos = getPerimeterGridPos(index);
      if (!pos) return;

      div.style.gridRow = String(pos.row);
      div.style.gridColumn = String(pos.col);

      // Semantic Classes for styling hooks if needed
      if (tile.type === 'property') div.classList.add('property');
      if (tile.type === 'chance') div.classList.add('chance');
      if (tile.type === 'jail' || tile.type === 'goto_jail') div.classList.add('jail');
      if (index % 10 === 0) div.classList.add('corner');

      // Content Construction
      if (tile.color) {
        const bar = document.createElement('div');
        bar.className = 'tile-color-bar';
        bar.style.background = tile.color;
        div.appendChild(bar);
      }

      // Name
      const name = document.createElement('div');
      name.className = 'tile-name';
      // Shorten standard names for cleaner look
      name.textContent = tile.name.replace('Place', 'Pl').replace('Avenue', 'Ave');
      div.appendChild(name);

      // Icons
      if (['chance', 'community_chest', 'electric_company', 'water_works', 'railroad', 'tax', 'luxury_tax'].includes(tile.type) || tile.group === 'Special') {
        const icon = document.createElement('div');
        icon.style.fontSize = '1.5em';
        if (tile.type === 'chance') icon.innerHTML = '<span style="color: #ff6b35;">?</span>';
        else if (tile.name.includes('Chest')) icon.innerHTML = '📦';
        else if (tile.type === 'tax') icon.innerHTML = '💎';
        else if (tile.type === 'railroad') icon.innerHTML = '🚂';
        else if (tile.type === 'utility') icon.innerHTML = '⚡';
        else if (tile.type === 'jail') icon.innerHTML = '⛓️';
        else if (tile.type === 'goto_jail') icon.innerHTML = '👮';
        else if (tile.type === 'vacation') icon.innerHTML = '🚗';
        div.appendChild(icon);
      }

      // Price
      if (tile.price) {
        const price = document.createElement('div');
        price.className = 'tile-price';
        price.textContent = `$${tile.price}`;
        div.appendChild(price);
      }

      // Development container
      const devContainer = document.createElement('div');
      devContainer.className = 'tile-development-container';
      devContainer.style.position = 'absolute';
      devContainer.style.top = '2px';
      devContainer.style.right = '2px';
      devContainer.style.display = 'flex';
      devContainer.style.gap = '1px';
      div.appendChild(devContainer);

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
        token.style.background = `radial-gradient(circle at 30% 30%, ${p.color}, #000)`;
        // Add initial letter?
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
        token.style.boxShadow = `0 0 10px 2px ${p.color}, 0 0 20px ${p.color}`;
        token.style.zIndex = 20;
        token.style.transform = 'scale(1.3)';
      } else {
        token.style.boxShadow = `0 2px 5px rgba(0,0,0,0.5)`;
        token.style.zIndex = 10;
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
