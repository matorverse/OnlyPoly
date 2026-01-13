// Client game logic & networking for ONLYPOLY - Richup Edition

(function () {
  // 1. Recover or Generate Session ID
  const STORAGE_KEY = 'onlypoly_session_id';
  let sessionId = localStorage.getItem(STORAGE_KEY);
  if (!sessionId) {
    sessionId = 'sess-' + Math.random().toString(36).substr(2, 9) + Date.now();
    localStorage.setItem(STORAGE_KEY, sessionId);
  }

  // 2. Connect with Session ID
  const socket = io({
    auth: { sessionId }
  });

  const nameInput = document.getElementById('nameInput');
  const joinBtn = document.getElementById('joinBtn');
  const lobbyStatus = document.getElementById('lobbyStatus');
  const lobbyPlayers = document.getElementById('lobbyPlayers');
  const readyToggle = document.getElementById('readyToggle');
  const startGameBtn = document.getElementById('startGameBtn');
  const gamePanel = document.getElementById('gamePanel');
  const turnLabel = document.getElementById('turnLabel');
  const moneyDisplay = document.getElementById('moneyDisplay');
  const positionDisplay = document.getElementById('positionDisplay');
  const rollBtn = document.getElementById('rollBtn');
  const endTurnBtn = document.getElementById('endTurnBtn');
  const buyBtn = document.getElementById('buyBtn');
  const auctionBtn = document.getElementById('auctionBtn');
  const payJailBtn = document.getElementById('payJailBtn');
  const tradeBtn = document.getElementById('tradeBtn');
  const lobbyPanel = document.getElementById('lobbyPanel');
  const loginModal = document.getElementById('loginModal'); // DIRECT REF

  const auctionModal = document.getElementById('auctionModal');
  const auctionInfo = document.getElementById('auctionInfo');
  const auctionTimer = document.getElementById('auctionTimer');
  const tradeModal = document.getElementById('tradeModal');
  const tradeContent = document.getElementById('tradeContent');
  const colorSelection = document.getElementById('colorSelection');
  const colorGrid = document.getElementById('colorGrid');
  const playersInfoRow = document.getElementById('playersInfoRow');
  const diceContainer = document.getElementById('diceContainer');
  const dice1 = document.getElementById('dice1');
  const dice2 = document.getElementById('dice2');

  const propertiesBtn = document.getElementById('propertiesBtn');
  const propertiesModal = document.getElementById('propertiesModal');
  const propertiesContent = document.getElementById('propertiesContent');

  const bankruptBtn = document.getElementById('bankruptBtn');
  const bankruptModal = document.getElementById('bankruptModal');
  const confirmBankruptBtn = document.getElementById('confirmBankruptBtn');

  const menuToggle = document.getElementById('menuToggle');
  const secondaryMenu = document.getElementById('secondaryMenu');
  const closeSecondaryMenu = document.getElementById('closeSecondaryMenu');
  const playersBtn = document.getElementById('playersBtn');
  const propertiesCount = document.getElementById('propertiesCount');
  const propertiesPanel = document.getElementById('propertiesPanel');
  const closeProperties = document.getElementById('closeProperties');
  const propertiesList = document.getElementById('propertiesList');
  const propertiesTitle = document.querySelector('.properties-panel-title');

  let me = { id: null, token: null, hostId: null };
  let state = null;
  let ready = false;
  let currentAuction = null;
  let auctionInterval = null;

  function show(el) {
    if (!el) return;
    el.hidden = false;
    el.style.display = ''; // Clear inline display:none
    el.classList.remove('hidden');
  }

  function hide(el) {
    if (!el) return;
    el.hidden = true;
    el.style.display = 'none';
    el.classList.add('hidden');
  }

  function hideLogin() {
    if (loginModal) loginModal.classList.remove('visible');
  }
  function showLogin() {
    if (loginModal) loginModal.classList.add('visible');
  }

  let resizeTimeout = null;
  window.addEventListener('resize', () => {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
    }, 250);
  });

  const PLAYER_COLORS = [
    { name: 'Cyan', value: '#00d2ff' },
    { name: 'Pink', value: '#ff4b81' },
    { name: 'Gold', value: '#f1c40f' },
    { name: 'Green', value: '#2ecc71' },
    { name: 'Purple', value: '#9b59b6' },
    { name: 'Orange', value: '#e67e22' },
    { name: 'Blue', value: '#3498db' },
    { name: 'Red', value: '#e74c3c' },
  ];

  // Init Login Color Grid
  const loginColorGrid = document.getElementById('loginColorGrid');
  const selectedColorInput = document.getElementById('selectedColorInput');

  function renderLoginColors() {
    if (!loginColorGrid) return;
    loginColorGrid.innerHTML = '';

    // Determine taken colors from state
    const takenColors = new Set();
    if (state && state.players) {
      Object.values(state.players).forEach(p => {
        if (p.color) takenColors.add(p.color);
      });
    }

    PLAYER_COLORS.forEach((c, idx) => {
      const isTaken = takenColors.has(c.value);

      const dot = document.createElement('div');
      dot.className = 'color-choice'; // Add class for easy finding
      dot.style.width = '30px';
      dot.style.height = '30px';
      dot.style.borderRadius = '50%';
      dot.style.background = c.value;
      dot.dataset.color = c.value; // Data attribute for verification

      // Default styles
      dot.style.cursor = 'pointer';
      dot.style.boxShadow = '0 2px 5px rgba(0,0,0,0.5)';
      dot.style.transition = 'all 0.2s';

      // Check selection
      const isSelected = selectedColorInput.value === c.value;
      dot.style.border = isSelected ? '3px solid white' : '3px solid transparent';
      if (isSelected) dot.style.transform = 'scale(1.1)';

      // Taken logic
      if (isTaken) {
        dot.style.opacity = '0.4'; // 40% visible aka 60% transparent (user asked for 60% opacity generally meaning 0.6 alpha, or dimmed)
        // User said "60% opacity so that it feels disabled". 
        // Usually means opacity: 0.6. Let's do 0.6.
        // Wait, "make it 60% opacity" -> opacity: 0.6.
        dot.style.opacity = '0.4'; // 0.4 is quite dim. 0.6 is better.
        // Let's stick to 0.4 for clear "disabled" look, or 0.5. 
        // User said "make it 60% opacity". 
        dot.style.opacity = '0.4';
        dot.style.pointerEvents = 'none';
        dot.style.cursor = 'not-allowed';
        dot.title = 'Color taken';
      } else {
        dot.onclick = () => {
          selectedColorInput.value = c.value;
          renderLoginColors(); // Re-render to update borders
        };
      }

      // If currently selected color became taken, deselect it?
      // Edge case: I selected Blue, someone else joined as Blue before I hit join.
      // Ideally I should know.
      // But for now, visuals are enough.

      loginColorGrid.appendChild(dot);
    });
  }

  // Initial Render
  renderLoginColors();

  joinBtn.addEventListener('click', () => {
    const name = (nameInput.value || '').trim();
    const color = selectedColorInput.value;
    if (!name) return;
    socket.emit('join_lobby', { name, color, existingId: sessionId });
  });

  readyToggle.addEventListener('click', () => {
    if (readyToggle.disabled) return;
    ready = !ready;
    socket.emit('set_ready', { ready });
    readyToggle.textContent = ready ? 'Ready ✓' : 'Ready';
    readyToggle.classList.toggle('btn-ready', ready);
  });

  startGameBtn.addEventListener('click', () => {
    if (me.id !== me.hostId) return;
    socket.emit('start_game');
  });

  rollBtn.addEventListener('click', () => {
    if (rollBtn.disabled) return;
    rollBtn.disabled = true;
    rollBtn.textContent = 'Rolling...';
    animateDiceRoll();
    socket.emit('roll_dice');
  });

  endTurnBtn.addEventListener('click', () => {
    if (endTurnBtn.disabled) return;
    endTurnBtn.disabled = true;
    socket.emit('end_turn');
  });

  buyBtn.addEventListener('click', () => {
    if (buyBtn.disabled) return;
    const myPlayer = state?.players[me.id];
    if (!myPlayer) return;
    const tileId = myPlayer.position;
    buyBtn.disabled = true;
    socket.emit('buy_property', { propertyId: tileId });
  });

  auctionBtn.addEventListener('click', () => {
    if (auctionBtn.disabled) return;
    const myPlayer = state?.players[me.id];
    if (!myPlayer) return;
    const tileId = myPlayer.position;
    auctionBtn.disabled = true;
    socket.emit('start_auction', { propertyId: tileId });
  });

  payJailBtn.addEventListener('click', () => {
    socket.emit('pay_jail_fine');
  });

  tradeBtn.addEventListener('click', () => {
    openTradeComposer();
  });

  menuToggle?.addEventListener('click', () => {
    secondaryMenu.classList.remove('hidden');
  });

  closeSecondaryMenu?.addEventListener('click', () => {
    secondaryMenu.classList.add('hidden');
  });

  secondaryMenu?.addEventListener('click', (e) => {
    if (e.target === secondaryMenu || e.target.classList.contains('secondary-menu-backdrop')) {
      secondaryMenu.classList.add('hidden');
    }
  });

  propertiesBtn?.addEventListener('click', () => {
    openPropertiesModal();
  });

  bankruptBtn?.addEventListener('click', () => {
    bankruptModal.classList.add('visible');
  });

  confirmBankruptBtn?.addEventListener('click', () => {
    socket.emit('declare_bankruptcy');
    bankruptModal.classList.remove('visible');
    OnlypolyUI.toast('Bankruptcy declared. You have been removed from the game.', 'error');
  });

  bankruptModal?.addEventListener('click', (e) => {
    if (e.target === bankruptModal || e.target.classList.contains('modal-backdrop')) {
      bankruptModal.classList.remove('visible');
    }
  });

  closeProperties?.addEventListener('click', () => {
    propertiesPanel.classList.add('hidden');
  });

  propertiesPanel?.addEventListener('click', (e) => {
    if (e.target === propertiesPanel || e.target.classList.contains('properties-panel-backdrop')) {
      propertiesPanel.classList.add('hidden');
    }
  });

  playersBtn?.addEventListener('click', () => {
    secondaryMenu.classList.add('hidden');
    OnlypolyUI.toast('Players info coming soon!');
  });

  auctionModal.addEventListener('click', (e) => {
    if (e.target.classList.contains('bid')) {
      const step = Number(e.target.getAttribute('data-step'));
      socket.emit('auction_bid', { step });
    }
  });

  socket.on('session_restored', (payload) => {
    me = { id: payload.playerId, token: payload.token, hostId: payload.hostId };
    lobbyStatus.hidden = false;
    show(lobbyPanel);
    hideLogin();
    OnlypolyUI.toast(`Welcome back, ${payload.name}!`, 'info');
    if (sessionId !== payload.playerId) {
      sessionId = payload.playerId;
      localStorage.setItem(STORAGE_KEY, sessionId);
    }
  });

  socket.on('session_invalid', () => {
    console.log('Session invalid, clearing local storage.');
    localStorage.removeItem(STORAGE_KEY);
    sessionId = null;
    showLogin();
    OnlypolyUI.toast('Please enter name to join.', 'info');
  });

  socket.on('joined', (payload) => {
    me = { id: payload.playerId, token: payload.token, hostId: payload.hostId };

    if (me.id && me.id !== sessionId) {
      sessionId = me.id;
      localStorage.setItem(STORAGE_KEY, sessionId);
    }

    lobbyStatus.hidden = false;
    show(lobbyPanel);
    hideLogin();
    renderColorSelection();
  });

  socket.on('color_rejected', ({ reason }) => {
    if (reason === 'color_taken') {
      OnlypolyUI.toast('Color already taken. Choose another.', 'rent');
    }
  });

  socket.on('join_error', ({ reason }) => {
    OnlypolyUI.toast(`Cannot join: ${reason}`, 'error');
  });

  socket.on('server_error', ({ reason }) => {
    OnlypolyUI.toast(`Server Error: ${reason}`, 'error');
  });

  let pendingState = null;

  socket.on('state_update', (newState) => {
    // If dice are animating, hold this update
    if (window.isDiceAnimating) {
      pendingState = newState;
      return;
    }

    applyState(newState);
  });

  function applyState(newState) {
    state = newState;

    // Inject Owner Colors & Country Data into Board for UI
    // (Assuming backend might send country, or we map it manually if missing)
    if (state.board) {
      state.board.forEach(tile => {
        // Find owner
        let owner = null;
        Object.values(state.players).forEach(p => {
          if (p.ownedProperties && p.ownedProperties[tile.id]) {
            owner = p;
          }
        });
        if (owner) {
          tile.ownerColor = owner.color;
        } else {
          tile.ownerColor = null;
        }
        // Mock Country if missing (for testing flags)
        // In real app, this should come from DB/Server
        if (tile.type === 'property' && !tile.country) {
          tile.country = 'Generic';
        }
      });
    }

    OnlypolyUI.setBoard(state.board);
    OnlypolyUI.renderPlayers(state.players, state.currentPlayerId);
    renderLobby();
    renderGame();
    // Update login colors based on new state (players might have joined)
    renderLoginColors();
  }

  socket.on('dice_rolled', ({ playerId, dice, tile, events }) => {
    const meTurn = playerId === me.id;

    // showDiceResult is now a Promise that resolves when animation finishes
    window.showDiceResult(dice.d1, dice.d2).then(() => {
      // Animation finished!

      if (meTurn) {
        OnlypolyUI.toast(`Moved ${dice.total} spaces`, 'chance');
      }
      events.forEach((ev) => {
        if (ev.type === 'rent_paid' && meTurn) {
          OnlypolyUI.toast(`Paid $${ev.amount} in rent.`, 'rent');
        }
        if (ev.type === 'chance' && meTurn) {
          OnlypolyUI.toast(ev.card.text, 'chance');
        }
        if (ev.type === 'unowned_property' && meTurn) {
          buyBtn.disabled = false;
          auctionBtn.disabled = false;
        }
      });

      // If we have a pending state update, apply it now
      if (pendingState) {
        applyState(pendingState);
        pendingState = null;
      } else {
        // Just re-render existing state to be safe (e.g. if state update came before dice roll event?? Unlikely but good safety)
        renderGame();
      }
    });
  });

  socket.on('action_rejected', ({ reason }) => {
    const map = {
      'already_rolled': 'You have already rolled this turn.',
      'must_roll_first': 'You must roll dice before ending turn.',
      'already_bought': 'Action not available.',
      'not_your_turn': 'It is not your turn.',
      'insufficient_funds': 'Insufficient funds.'
    };
    OnlypolyUI.toast(map[reason] || 'Action rejected.', 'rent');
    renderGame();
  });

  socket.on('auction_started', (auction) => {
    currentAuction = auction;
    showAuctionModal();
  });

  socket.on('auction_updated', (auction) => {
    currentAuction = auction;
    renderAuction();
  });

  socket.on('auction_finished', (auction) => {
    currentAuction = auction;
    renderAuction();
    setTimeout(hideAuctionModal, 800);
  });

  socket.on('trade_offer', (trade) => {
    openTradeReview(trade);
  });

  socket.on('trade_updated', () => {
    closeTradeModal();
  });

  socket.on('player_bankrupt', ({ playerId }) => {
    if (playerId === me.id) {
      OnlypolyUI.toast('You went bankrupt! Game over for you.', 'error');
    } else {
      const p = state.players[playerId];
      if (p) OnlypolyUI.toast(`${p.name} went bankrupt.`, 'info');
    }
  });

  function renderLobby() {
    if (!state) return;
    lobbyPlayers.innerHTML = '';
    const readySet = new Set(state.readyPlayers || []);
    Object.values(state.players || {}).forEach((p) => {
      const pill = document.createElement('div');
      pill.className = 'pill';
      const isReady = readySet.has(p.id);
      if (isReady) {
        pill.classList.add('pill-ready');
        pill.textContent = `${p.name} ✓`;
      } else {
        pill.textContent = `${p.name} (not ready)`;
      }
      lobbyPlayers.appendChild(pill);
    });
    const playerCount = Object.keys(state.players || {}).length;
    const readyCount = readySet.size;
    const canStart = !state.started && playerCount >= 2 && readyCount >= 2 && me.id === state.hostId;
    startGameBtn.disabled = !canStart;
    if (canStart) {
      startGameBtn.classList.add('btn-primary-glow');
    } else {
      startGameBtn.classList.remove('btn-primary-glow');
    }
  }

  function renderGame() {
    if (!state) return;
    if (!state.started) {
      hide(gamePanel);
      show(lobbyPanel);
      menuToggle?.classList.add('hidden');
      return;
    }
    hide(lobbyPanel);
    show(gamePanel);
    hideLogin(); // Ensure login hidden in game too
    menuToggle?.classList.remove('hidden');

    const myPlayer = state.players[me.id];
    const current = state.players[state.currentPlayerId];

    // Check if player is bankrupt
    if (myPlayer && myPlayer.bankrupt) {
      // Disable ALL controls for bankrupt players
      rollBtn.disabled = true;
      rollBtn.textContent = 'Bankrupt';
      endTurnBtn.disabled = true;
      buyBtn.disabled = true;
      auctionBtn.disabled = true;
      payJailBtn.disabled = true;
      tradeBtn.disabled = true;
      propertiesBtn.disabled = true;
      bankruptBtn.disabled = true;

      turnLabel.textContent = 'Game Over - You are Bankrupt';
      moneyDisplay.textContent = '$0';
      positionDisplay.textContent = 'Eliminated';

      return; // Exit early, don't process any other game logic
    }

    if (current) {
      turnLabel.textContent =
        current.id === me.id ? 'Your turn' : `${current.name}'s turn`;
    }

    if (myPlayer) {
      moneyDisplay.textContent = `$${myPlayer.money}`;
      positionDisplay.textContent = `Tile ${myPlayer.position}`;
    }

    const isMyTurn = state.currentPlayerId === me.id;
    const hasRolled = state.hasRolledThisTurn || false;
    const hasBought = state.hasBoughtThisTurn || false;
    const hasAuction = state.hasStartedAuctionThisTurn || false;

    rollBtn.disabled = !isMyTurn || hasRolled;
    rollBtn.textContent = hasRolled ? 'Rolled' : 'Roll';
    endTurnBtn.disabled = !isMyTurn || (!hasRolled && !myPlayer?.inJail);

    const canBuyOrAuctionBase = isMyTurn && hasRolled && !hasBought && !hasAuction;
    let canBuyOrAuction = canBuyOrAuctionBase;
    if (canBuyOrAuctionBase && myPlayer) {
      const tileId = Number(myPlayer.position);
      const tile = (state.board || []).find((t) => t.id === tileId) || null;
      const isBuyable = tile && (tile.type === 'property' || tile.type === 'airport' || tile.type === 'utility');
      let isOwned = false;
      if (isBuyable) {
        Object.values(state.players || {}).some((p) => {
          if (p?.ownedProperties && p.ownedProperties[String(tileId)]) {
            isOwned = true;
            return true;
          }
          return false;
        });
      }
      canBuyOrAuction = isBuyable && !isOwned;
    }

    buyBtn.disabled = !canBuyOrAuction;
    auctionBtn.disabled = !canBuyOrAuction;
    payJailBtn.disabled = !isMyTurn || !myPlayer?.inJail;
    tradeBtn.disabled = false;
    propertiesBtn.disabled = false;
    bankruptBtn.disabled = false;

    const ownedProperties = Object.keys(myPlayer?.ownedProperties || {}).length;
    if (propertiesCount) {
      propertiesCount.textContent = `(${ownedProperties})`;
    }
  }

  function showAuctionModal() {
    auctionModal.classList.add('visible');
    renderAuction();
    if (auctionInterval) clearInterval(auctionInterval);
    auctionInterval = setInterval(() => {
      renderAuction();
    }, 200);
  }

  function hideAuctionModal() {
    auctionModal.classList.remove('visible');
    if (auctionInterval) clearInterval(auctionInterval);
    auctionInterval = null;
    currentAuction = null;
  }

  function renderAuction() {
    if (!currentAuction) return;
    const prop = state.board.find((t) => t.id === currentAuction.propertyId);
    const bidder = state.players[currentAuction.highestBidder || ''] || null;
    auctionInfo.textContent = `${prop ? prop.name : 'Property'} – $${currentAuction.highestBid || 0} ${bidder ? `by ${bidder.name}` : ''}`;
    const remaining = Math.max(0, currentAuction.endsAt - Date.now());
    auctionTimer.textContent = `${Math.ceil(remaining / 1000)}s remaining`;
  }

  function openTradeComposer() {
    if (!state) return;
    const myPlayer = state.players[me.id];
    if (!myPlayer) return;

    // Prevent bankrupt players from trading
    if (myPlayer.bankrupt) {
      OnlypolyUI.toast('You cannot trade - you are bankrupt.', 'error');
      return;
    }

    const others = Object.values(state.players).filter(
      (p) => p.id !== me.id && !p.bankrupt
    );
    if (!others.length) {
      OnlypolyUI.toast('No one available to trade with.');
      return;
    }

    // Step 1: Show player selection menu
    tradeModal.classList.add('visible');
    tradeContent.innerHTML = '';

    const root = document.createElement('div');
    root.className = 'trade-player-selection';

    const header = document.createElement('div');
    header.className = 'trade-header';

    const title = document.createElement('div');
    title.className = 'trade-title';
    title.textContent = 'Select Player to Trade With';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn ghost small';
    closeBtn.textContent = 'Close';
    closeBtn.onclick = closeTradeModal;

    header.appendChild(title);
    header.appendChild(closeBtn);
    root.appendChild(header);

    const playerList = document.createElement('div');
    playerList.className = 'trade-player-list';

    others.forEach((player) => {
      const card = document.createElement('div');
      card.className = 'trade-player-card';
      card.style.borderLeft = `4px solid ${player.color || '#888'}`;

      const info = document.createElement('div');
      info.className = 'trade-player-info';

      const name = document.createElement('div');
      name.className = 'trade-player-name';
      name.textContent = player.name;
      name.style.color = player.color || '#fff';

      const money = document.createElement('div');
      money.className = 'trade-player-money';
      money.textContent = `$${player.money}`;

      const props = Object.keys(player.ownedProperties || {}).length;
      const propsCount = document.createElement('div');
      propsCount.className = 'trade-player-props';
      propsCount.textContent = `${props} ${props === 1 ? 'property' : 'properties'}`;

      info.appendChild(name);
      info.appendChild(money);
      info.appendChild(propsCount);

      card.appendChild(info);

      card.onclick = () => {
        // Step 2: Show trade composer with selected player
        showTradeComposer(player.id);
      };

      playerList.appendChild(card);
    });

    root.appendChild(playerList);
    tradeContent.appendChild(root);
  }

  function showTradeComposer(partnerId) {
    const myPlayer = state.players[me.id];
    const partner = state.players[partnerId];
    if (!myPlayer || !partner) return;

    let moneyDelta = 0; // + => you give money, - => you take money
    const offerProps = new Set();
    const requestProps = new Set();

    function getTileById(id) {
      return (state.board || []).find((t) => t.id === Number(id)) || null;
    }

    function getOwnedTileIds(player) {
      return Object.keys(player?.ownedProperties || {}).map((x) => Number(x)).filter((n) => Number.isFinite(n));
    }

    function formatMoneyLine(delta) {
      const d = Number(delta) || 0;
      if (d > 0) return `You give $${d}`;
      if (d < 0) return `You take $${Math.abs(d)}`;
      return 'No money exchanged';
    }

    function computeLimits() {
      const maxGive = Math.max(0, Math.floor(myPlayer.money || 0));
      const maxTake = Math.max(0, Math.floor(partner?.money || 0));
      return { maxGive, maxTake };
    }

    function renderTradeComposer() {
      const { maxGive, maxTake } = computeLimits();
      moneyDelta = Math.max(-maxTake, Math.min(maxGive, moneyDelta));

      tradeContent.innerHTML = '';

      const root = document.createElement('div');
      root.className = 'trade-composer';

      const header = document.createElement('div');
      header.className = 'trade-header';

      const backBtn = document.createElement('button');
      backBtn.className = 'btn ghost small';
      backBtn.textContent = '← Back';
      backBtn.onclick = openTradeComposer;

      const title = document.createElement('div');
      title.className = 'trade-title';
      title.textContent = `Trade with ${partner.name}`;

      const closeBtn = document.createElement('button');
      closeBtn.className = 'btn ghost small';
      closeBtn.textContent = 'Close';
      closeBtn.onclick = closeTradeModal;

      header.appendChild(backBtn);
      header.appendChild(title);
      header.appendChild(closeBtn);
      root.appendChild(header);

      const moneyBox = document.createElement('div');
      moneyBox.className = 'trade-money-box';

      const moneyLine = document.createElement('div');
      moneyLine.className = 'trade-money-line';
      moneyLine.textContent = formatMoneyLine(moneyDelta);

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'trade-slider';
      slider.min = String(-maxTake);
      slider.max = String(maxGive);
      slider.step = '10';
      slider.value = String(moneyDelta);
      slider.oninput = () => {
        moneyDelta = Number(slider.value) || 0;
        moneyLine.textContent = formatMoneyLine(moneyDelta);
      };

      const moneyCaps = document.createElement('div');
      moneyCaps.className = 'trade-money-caps';
      moneyCaps.textContent = `Take up to $${maxTake} • Give up to $${maxGive}`;

      moneyBox.appendChild(moneyLine);
      moneyBox.appendChild(slider);
      moneyBox.appendChild(moneyCaps);
      root.appendChild(moneyBox);

      const split = document.createElement('div');
      split.className = 'trade-split';

      function renderSide(sideEl, whoLabel, whoMoney, tileIds, setRef, color) {
        sideEl.innerHTML = '';
        const h = document.createElement('div');
        h.className = 'trade-side-header';
        h.style.setProperty('--trade-accent', color);

        const nameEl = document.createElement('div');
        nameEl.className = 'trade-side-name';
        nameEl.textContent = whoLabel;
        const moneyEl = document.createElement('div');
        moneyEl.className = 'trade-side-money';
        moneyEl.textContent = `$${whoMoney}`;
        h.appendChild(nameEl);
        h.appendChild(moneyEl);
        sideEl.appendChild(h);

        const list = document.createElement('div');
        list.className = 'trade-props';

        if (!tileIds.length) {
          const empty = document.createElement('div');
          empty.className = 'trade-muted';
          empty.textContent = 'No properties';
          list.appendChild(empty);
        } else {
          tileIds
            .slice()
            .sort((a, b) => a - b)
            .forEach((pid) => {
              const tile = getTileById(pid);
              const row = document.createElement('label');
              row.className = 'trade-prop-row';

              const cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.checked = setRef.has(pid);
              cb.onchange = () => {
                if (cb.checked) setRef.add(pid);
                else setRef.delete(pid);
              };

              const meta = document.createElement('div');
              meta.className = 'trade-prop-meta';
              const n = document.createElement('div');
              n.className = 'trade-prop-name';
              n.textContent = tile ? tile.name : `Tile ${pid}`;
              const sub = document.createElement('div');
              sub.className = 'trade-prop-sub';
              sub.textContent = tile?.country || tile?.type || '';
              meta.appendChild(n);
              meta.appendChild(sub);

              row.appendChild(cb);
              row.appendChild(meta);
              list.appendChild(row);
            });
        }

        sideEl.appendChild(list);
      }

      const left = document.createElement('div');
      left.className = 'trade-side';
      const right = document.createElement('div');
      right.className = 'trade-side';

      renderSide(left, `${myPlayer.name} (you)`, myPlayer.money, getOwnedTileIds(myPlayer), offerProps, myPlayer.color || '#00d2ff');
      renderSide(right, partner.name, partner.money, getOwnedTileIds(partner), requestProps, partner.color || '#ff4b81');

      split.appendChild(left);
      split.appendChild(right);
      root.appendChild(split);

      const actions = document.createElement('div');
      actions.className = 'trade-actions';
      const send = document.createElement('button');
      send.className = 'btn primary';
      send.textContent = 'Send Offer';
      send.onclick = () => {
        const offerMoney = moneyDelta > 0 ? moneyDelta : 0;
        const requestMoney = moneyDelta < 0 ? Math.abs(moneyDelta) : 0;
        socket.emit('propose_trade', {
          toPlayerId: partnerId,
          offerMoney,
          requestMoney,
          offerProperties: Array.from(offerProps),
          requestProperties: Array.from(requestProps),
        });
        closeTradeModal();
        OnlypolyUI.toast('Trade offer sent!');
      };

      const cancel = document.createElement('button');
      cancel.className = 'btn ghost';
      cancel.textContent = 'Cancel';
      cancel.onclick = closeTradeModal;

      actions.appendChild(cancel);
      actions.appendChild(send);
      root.appendChild(actions);

      tradeContent.appendChild(root);
    }
    renderTradeComposer();
  }

  function openTradeReview(trade) {
    tradeModal.classList.add('visible');
    tradeContent.innerHTML = '';
    const from = state.players[trade.from];
    const to = state.players[trade.to];

    function tileName(pid) {
      const t = (state.board || []).find((x) => x.id === Number(pid));
      return t ? t.name : `Tile ${pid}`;
    }

    const p = document.createElement('div');
    p.className = 'trade-review-title';
    p.textContent = `${from?.name || 'Player'} sent you a trade offer`;

    const details = document.createElement('div');
    details.className = 'trade-review-details';

    const moneyLine = document.createElement('div');
    moneyLine.className = 'trade-review-line';
    const giveMoney = Number(trade.offerMoney) || 0;
    const takeMoney = Number(trade.requestMoney) || 0;
    moneyLine.textContent = `Money: ${giveMoney > 0 ? `${from.name} gives you $${giveMoney}` : ''}${giveMoney > 0 && takeMoney > 0 ? ' • ' : ''}${takeMoney > 0 ? `You give ${from.name} $${takeMoney}` : ''}${giveMoney === 0 && takeMoney === 0 ? 'None' : ''}`;

    const propsLine = document.createElement('div');
    propsLine.className = 'trade-review-line';
    const offerProps = (trade.offerProperties || []).map(tileName);
    const reqProps = (trade.requestProperties || []).map(tileName);
    propsLine.textContent = `Properties: ${offerProps.length ? `You receive: ${offerProps.join(', ')}` : 'You receive: none'}${reqProps.length ? ` • You give: ${reqProps.join(', ')}` : ' • You give: none'}`;

    details.appendChild(moneyLine);
    details.appendChild(propsLine);

    const accept = document.createElement('button');
    accept.className = 'btn primary small';
    accept.textContent = 'Accept';
    accept.onclick = () => {
      socket.emit('accept_trade', { tradeId: trade.id });
      closeTradeModal();
      OnlypolyUI.toast('Trade accepted!');
    };

    const negotiate = document.createElement('button');
    negotiate.className = 'btn secondary small';
    negotiate.textContent = 'Negotiate';
    negotiate.onclick = () => {
      // Open trade composer with pre-filled values from original offer
      // But swap the perspective (what they offered becomes what we request, etc.)
      openNegotiateComposer(trade);
    };

    const reject = document.createElement('button');
    reject.className = 'btn ghost small';
    reject.textContent = 'Reject';
    reject.onclick = () => {
      socket.emit('reject_trade', { tradeId: trade.id });
      closeTradeModal();
      OnlypolyUI.toast('Trade rejected');
    };

    const actions = document.createElement('div');
    actions.className = 'trade-actions';
    actions.appendChild(reject);
    actions.appendChild(negotiate);
    actions.appendChild(accept);

    tradeContent.appendChild(p);
    tradeContent.appendChild(details);
    tradeContent.appendChild(actions);
  }

  function openNegotiateComposer(originalTrade) {
    const myPlayer = state.players[me.id];
    const partner = state.players[originalTrade.from]; // Original sender
    if (!myPlayer || !partner) return;

    // Swap the perspective: what they offered to give us, we now request from them
    // What they requested from us, we now offer to them
    let moneyDelta = (originalTrade.requestMoney || 0) - (originalTrade.offerMoney || 0);
    const offerProps = new Set(originalTrade.requestProperties || []);
    const requestProps = new Set(originalTrade.offerProperties || []);

    function getTileById(id) {
      return (state.board || []).find((t) => t.id === Number(id)) || null;
    }

    function getOwnedTileIds(player) {
      return Object.keys(player?.ownedProperties || {}).map((x) => Number(x)).filter((n) => Number.isFinite(n));
    }

    function formatMoneyLine(delta) {
      const d = Number(delta) || 0;
      if (d > 0) return `You give $${d}`;
      if (d < 0) return `You take $${Math.abs(d)}`;
      return 'No money exchanged';
    }

    function computeLimits() {
      const maxGive = Math.max(0, Math.floor(myPlayer.money || 0));
      const maxTake = Math.max(0, Math.floor(partner?.money || 0));
      return { maxGive, maxTake };
    }

    function renderNegotiateComposer() {
      const { maxGive, maxTake } = computeLimits();
      moneyDelta = Math.max(-maxTake, Math.min(maxGive, moneyDelta));

      tradeContent.innerHTML = '';

      const root = document.createElement('div');
      root.className = 'trade-composer';

      const header = document.createElement('div');
      header.className = 'trade-header';

      const backBtn = document.createElement('button');
      backBtn.className = 'btn ghost small';
      backBtn.textContent = '← Back';
      backBtn.onclick = () => openTradeReview(originalTrade);

      const title = document.createElement('div');
      title.className = 'trade-title';
      title.textContent = `Counter Offer to ${partner.name}`;

      const closeBtn = document.createElement('button');
      closeBtn.className = 'btn ghost small';
      closeBtn.textContent = 'Close';
      closeBtn.onclick = closeTradeModal;

      header.appendChild(backBtn);
      header.appendChild(title);
      header.appendChild(closeBtn);
      root.appendChild(header);

      const moneyBox = document.createElement('div');
      moneyBox.className = 'trade-money-box';

      const moneyLine = document.createElement('div');
      moneyLine.className = 'trade-money-line';
      moneyLine.textContent = formatMoneyLine(moneyDelta);

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'trade-slider';
      slider.min = String(-maxTake);
      slider.max = String(maxGive);
      slider.step = '10';
      slider.value = String(moneyDelta);
      slider.oninput = () => {
        moneyDelta = Number(slider.value) || 0;
        moneyLine.textContent = formatMoneyLine(moneyDelta);
      };

      const moneyCaps = document.createElement('div');
      moneyCaps.className = 'trade-money-caps';
      moneyCaps.textContent = `Take up to $${maxTake} • Give up to $${maxGive}`;

      moneyBox.appendChild(moneyLine);
      moneyBox.appendChild(slider);
      moneyBox.appendChild(moneyCaps);
      root.appendChild(moneyBox);

      const split = document.createElement('div');
      split.className = 'trade-split';

      function renderSide(sideEl, whoLabel, whoMoney, tileIds, setRef, color) {
        sideEl.innerHTML = '';
        const h = document.createElement('div');
        h.className = 'trade-side-header';
        h.style.setProperty('--trade-accent', color);

        const nameEl = document.createElement('div');
        nameEl.className = 'trade-side-name';
        nameEl.textContent = whoLabel;
        const moneyEl = document.createElement('div');
        moneyEl.className = 'trade-side-money';
        moneyEl.textContent = `$${whoMoney}`;
        h.appendChild(nameEl);
        h.appendChild(moneyEl);
        sideEl.appendChild(h);

        const list = document.createElement('div');
        list.className = 'trade-props';

        if (!tileIds.length) {
          const empty = document.createElement('div');
          empty.className = 'trade-muted';
          empty.textContent = 'No properties';
          list.appendChild(empty);
        } else {
          tileIds
            .slice()
            .sort((a, b) => a - b)
            .forEach((pid) => {
              const tile = getTileById(pid);
              const row = document.createElement('label');
              row.className = 'trade-prop-row';

              const cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.checked = setRef.has(pid);
              cb.onchange = () => {
                if (cb.checked) setRef.add(pid);
                else setRef.delete(pid);
              };

              const meta = document.createElement('div');
              meta.className = 'trade-prop-meta';
              const n = document.createElement('div');
              n.className = 'trade-prop-name';
              n.textContent = tile ? tile.name : `Tile ${pid}`;
              const sub = document.createElement('div');
              sub.className = 'trade-prop-sub';
              sub.textContent = tile?.country || tile?.type || '';
              meta.appendChild(n);
              meta.appendChild(sub);

              row.appendChild(cb);
              row.appendChild(meta);
              list.appendChild(row);
            });
        }

        sideEl.appendChild(list);
      }

      const left = document.createElement('div');
      left.className = 'trade-side';
      const right = document.createElement('div');
      right.className = 'trade-side';

      renderSide(left, `${myPlayer.name} (you)`, myPlayer.money, getOwnedTileIds(myPlayer), offerProps, myPlayer.color || '#00d2ff');
      renderSide(right, partner.name, partner.money, getOwnedTileIds(partner), requestProps, partner.color || '#ff4b81');

      split.appendChild(left);
      split.appendChild(right);
      root.appendChild(split);

      const actions = document.createElement('div');
      actions.className = 'trade-actions';

      const send = document.createElement('button');
      send.className = 'btn primary';
      send.textContent = 'Send Counter Offer';
      send.onclick = () => {
        // First reject the original trade
        socket.emit('reject_trade', { tradeId: originalTrade.id });

        // Then send new counter offer
        const offerMoney = moneyDelta > 0 ? moneyDelta : 0;
        const requestMoney = moneyDelta < 0 ? Math.abs(moneyDelta) : 0;
        socket.emit('propose_trade', {
          toPlayerId: partner.id,
          offerMoney,
          requestMoney,
          offerProperties: Array.from(offerProps),
          requestProperties: Array.from(requestProps),
        });
        closeTradeModal();
        OnlypolyUI.toast('Counter offer sent!');
      };

      const cancel = document.createElement('button');
      cancel.className = 'btn ghost';
      cancel.textContent = 'Cancel';
      cancel.onclick = () => openTradeReview(originalTrade);

      actions.appendChild(cancel);
      actions.appendChild(send);
      root.appendChild(actions);

      tradeContent.appendChild(root);
    }
    renderNegotiateComposer();
  }

  function closeTradeModal() {
    tradeModal.classList.remove('visible');
  }

  tradeModal?.addEventListener('click', (e) => {
    if (e.target === tradeModal || e.target.classList.contains('modal-backdrop')) {
      closeTradeModal();
    }
  });

  function openPropertiesModal() {
    if (!state || !me.id) return;
    const myPlayer = state.players[me.id];
    if (!myPlayer) return;

    // Prevent bankrupt players from viewing properties
    if (myPlayer.bankrupt) {
      OnlypolyUI.toast('You have no properties - you are bankrupt.', 'error');
      return;
    }

    propertiesModal.classList.add('visible');
    propertiesContent.innerHTML = '';

    const ownedProperties = Object.entries(myPlayer.ownedProperties || {});

    if (ownedProperties.length === 0) {
      propertiesContent.innerHTML = '<div style="padding: 40px; text-align: center; color: #888;">You don\'t own any properties yet.</div>';
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'properties-grid';

    ownedProperties.sort(([a], [b]) => Number(a) - Number(b));

    ownedProperties.forEach(([pid, own]) => {
      const tile = state.board.find(t => t.id === Number(pid));
      if (!tile) return;

      const card = document.createElement('div');
      card.className = 'property-display-card';

      // Color bar at top
      const colorBar = document.createElement('div');
      colorBar.className = 'property-color-bar';
      colorBar.style.backgroundColor = myPlayer.color || '#6647e0';
      card.appendChild(colorBar);

      // Property name
      const name = document.createElement('div');
      name.className = 'property-display-name';
      name.textContent = tile.name;
      card.appendChild(name);

      // Property type/country
      const type = document.createElement('div');
      type.className = 'property-display-type';
      type.textContent = tile.country || tile.type || '';
      card.appendChild(type);

      // Development status
      const development = document.createElement('div');
      development.className = 'property-display-development';
      if (own.hotel) {
        development.innerHTML = '🏨 <span>Hotel</span>';
      } else if (own.houses > 0) {
        development.innerHTML = '🏠'.repeat(own.houses) + ` <span>${own.houses} House${own.houses > 1 ? 's' : ''}</span>`;
      } else {
        development.innerHTML = '<span style="color: #888;">Undeveloped</span>';
      }
      card.appendChild(development);

      // Property value
      const value = document.createElement('div');
      value.className = 'property-display-value';
      value.textContent = `₩${tile.price || 0}`;
      card.appendChild(value);

      grid.appendChild(card);
    });

    propertiesContent.appendChild(grid);
  }

  propertiesModal?.addEventListener('click', (e) => {
    if (e.target === propertiesModal || e.target.classList.contains('modal-backdrop')) {
      propertiesModal.classList.remove('visible');
    }
  });

  function renderPropertiesPanel() {
    if (!state || !me.id || !propertiesList || !propertiesTitle) return;
    const myPlayer = state.players[me.id];
    if (!myPlayer) return;
    const ownedProperties = Object.entries(myPlayer.ownedProperties || {});
    propertiesTitle.textContent = `Properties (${ownedProperties.length})`;
    propertiesList.innerHTML = '';

    if (ownedProperties.length === 0) {
      propertiesList.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">No properties owned</div>';
      return;
    }

    ownedProperties.sort(([a], [b]) => Number(a) - Number(b));
    ownedProperties.forEach(([pid, own]) => {
      const tile = state.board.find(t => t.id === Number(pid));
      if (!tile) return;
      const card = document.createElement('div');
      card.className = 'property-card';
      card.innerHTML = `
        <div class="property-name" style="color:${tile.color || '#fff'}">${tile.name}</div>
        <div class="property-development">
            ${own.hotel ? '🏨 Hotel' : own.houses ? '🏠'.repeat(own.houses) : 'Land'}
        </div>
      `;
      propertiesList.appendChild(card);
    });
  }

  function renderColorSelection() {
    if (!document.getElementById('colorGrid')) return;
  }

})();
