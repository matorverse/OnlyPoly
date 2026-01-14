const { BOARD, TOTAL_TILES, TILE_TYPES } = require('./boardData');
const { rollDice, shuffle } = require('./utils');
const { calculateRent } = require('./rentCalculator');
const DB = require('./db');

// Simple Chance/Surprise deck
const BASE_CHANCE_CARDS = [
  { id: 'gain50', type: 'money', amount: 50, text: 'Side hustle paid off. Collect $50.' },
  { id: 'gain150', type: 'money', amount: 150, text: 'Angel investor backs you. Collect $150.' },
  { id: 'lose50', type: 'money', amount: -50, text: 'Unexpected bill. Pay $50.' },
  { id: 'lose150', type: 'money', amount: -150, text: 'Luxury vacation ran long. Pay $150.' },
  { id: 'fwd3', type: 'move', delta: 3, text: 'Fast-track success. Move forward 3 tiles.' },
  { id: 'back3', type: 'move', delta: -3, text: 'Market correction. Move back 3 tiles.' },
  { id: 'gotoJail', type: 'goto', targetType: 'jail', text: 'Audit hits. Go directly to Jail.' },
];

const GLOBAL_ROOM_ID = 'default_room';

class GameState {
  constructor(io, auctionSystem) {
    this.io = io;
    this.auctionSystem = auctionSystem;

    // Initialize default state first
    this.roomId = GLOBAL_ROOM_ID;
    this.players = {};
    this.turnOrder = [];
    this.currentTurnIndex = 0;
    this.started = false;
    this.hostId = null;
    this.readyPlayers = new Set();
    this.chanceDeck = shuffle(BASE_CHANCE_CARDS);
    this.currentChanceIndex = 0;
    this.lastDice = null;
    this.hasRolledThisTurn = false;
    this.hasBoughtThisTurn = false;
    this.hasStartedAuctionThisTurn = false;
    this.paidJailThisTurn = false;
    this._lastRollTime = 0;

    // Try to load state from DB on boot
    DB.getRoom(this.roomId).then(savedState => {
      if (savedState) {
        console.log('Restoring game state from DB...');
        this.restoreState(savedState);
        this.io.emit('state_update', this.serialize());
      } else {
        // New room implicitly
      }
    }).catch(err => {
      console.error('Failed to load room:', err);
    });
  }

  reset() {
    this.players = {};
    this.turnOrder = [];
    this.currentTurnIndex = 0;
    this.started = false;
    this.hostId = null;
    this.readyPlayers = new Set();
    this.chanceDeck = shuffle(BASE_CHANCE_CARDS);
    this.currentChanceIndex = 0;
    this.lastDice = null;
    this.hasRolledThisTurn = false;
    this.hasBoughtThisTurn = false;
    this.hasStartedAuctionThisTurn = false;
    this.paidJailThisTurn = false;
    this._lastRollTime = 0;

    // Clear DB room
    DB.closeRoom(this.roomId).catch(err => console.error('DB clear error:', err));
  }

  async persist() {
    const state = this.serialize();
    try {
      await DB.saveRoom(this.roomId, state);
    } catch (err) {
      console.error('State persistence failed:', err);
    }
  }

  restoreState(state) {
    if (!state) return;
    this.players = state.players || {};
    this.turnOrder = state.turnOrder || [];
    this.currentTurnIndex = state.currentTurnIndex || 0;
    this.started = state.started || false;
    this.hostId = state.hostId || null;
    this.readyPlayers = new Set(state.readyPlayers || []);
    this.lastDice = state.lastDice;
    this.hasRolledThisTurn = state.hasRolledThisTurn || false;
    this.hasBoughtThisTurn = state.hasBoughtThisTurn || false;
    this.hasStartedAuctionThisTurn = state.hasStartedAuctionThisTurn || false;
    this.paidJailThisTurn = state.paidJailThisTurn || false;
  }

  reconnectPlayer(id, newSocketId) {
    const player = this.players[id];
    if (player) {
      player.socketId = newSocketId;
      DB.updatePlayerSocket(id, newSocketId);
      return true;
    }
    return false;
  }

  addPlayer(id, name, socketId, token, color = null) {
    if (this.players[id]) {
      this.reconnectPlayer(id, socketId);
      return this.players[id];
    }

    if (this.started) {
      // Auto-reset if abandoned
      const activeCount = Object.values(this.players).filter(p => this.io.sockets.sockets.has(p.socketId)).length;
      if (activeCount === 0) {
        console.log('Game started but no players connected. Auto-resetting abandonware.');
        this.reset();
      } else {
        return null;
      }
    }

    if (Object.keys(this.players).length >= 8) return null;

    const player = {
      id,
      name,
      money: 1500,
      position: 0,
      socketId,
      token,
      color: color || null,
      inJail: false,
      jailTurns: 0,
      ownedProperties: {},
      bankrupt: false,
    };

    if (typeof player.money !== 'number' || !isFinite(player.money)) {
      player.money = 1500;
    }

    this.players[id] = player;
    if (!this.hostId) this.hostId = id;
    this.turnOrder = Object.keys(this.players);

    // Save player to DB for session recovery
    DB.createPlayer(id, this.roomId, name, socketId, token).catch(e => console.error('DB Player create fail:', e));
    this.persist();

    return player;
  }

  setPlayerColor(playerId, color) {
    if (!playerId || !color || typeof color !== 'string') return false;
    const player = this.players[playerId];
    if (!player) return false;
    if (this.started) return false;

    const colorTaken = Object.values(this.players).some(
      (p) => p.id !== playerId && p.color === color
    );
    if (colorTaken) return false;

    player.color = color;
    this.persist();
    return true;
  }

  removePlayer(id) {
    if (this.started) {
      return;
    }

    const p = this.players[id];
    if (!p) return;
    Object.keys(p.ownedProperties).forEach((pid) => { delete p.ownedProperties[pid]; });
    p.bankrupt = true;
    delete this.players[id];
    this.turnOrder = this.turnOrder.filter((pid) => pid !== id);
    if (this.turnOrder.length === 0) {
      this.reset();
    } else if (this.currentTurnIndex >= this.turnOrder.length) {
      this.currentTurnIndex = 0;
    }
    this.persist();
  }

  markReady(id, ready) {
    if (!this.players[id] || this.started) return;
    if (ready) this.readyPlayers.add(id);
    else this.readyPlayers.delete(id);
    this.persist();
  }

  startGame(requestingPlayerId) {
    if (this.started) return false;
    if (requestingPlayerId !== this.hostId) return false;
    if (!this.canStart()) return false;

    const playersWithoutColors = Object.values(this.players).filter(p => !p.color);
    if (playersWithoutColors.length > 0) {
      const defaultColors = ['#00d2ff', '#ff4b81', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#3498db', '#e74c3c'];
      const usedColors = new Set(Object.values(this.players).map(p => p.color).filter(Boolean));
      let colorIndex = 0;
      playersWithoutColors.forEach(p => {
        while (usedColors.has(defaultColors[colorIndex % defaultColors.length])) {
          colorIndex++;
        }
        p.color = defaultColors[colorIndex % defaultColors.length];
        usedColors.add(p.color);
        colorIndex++;
      });
    }

    Object.values(this.players).forEach(p => {
      if (typeof p.money !== 'number' || !isFinite(p.money)) {
        p.money = 1500;
      }
    });

    this.started = true;
    this.turnOrder = Object.keys(this.players);
    this.currentTurnIndex = 0;
    this.persist();
    return true;
  }

  canStart() {
    const count = Object.keys(this.players).length;
    if (count < 2) return false;
    return this.readyPlayers.size >= 2;
  }

  get currentPlayerId() { return this.turnOrder[this.currentTurnIndex] || null; }
  get currentPlayer() { return this.players[this.currentPlayerId] || null; }
  assertTurn(playerId) { return this.currentPlayerId === playerId; }
  getTile(id) { return BOARD.find((t) => t.id === id); }
  hasMonopoly(playerId, country) {
    if (!country || !playerId) return false;
    const player = this.players[playerId];
    if (!player) return false;

    // Get all properties in this country
    const countryProps = BOARD.filter(t => t.country === country && t.type === TILE_TYPES.PROPERTY);
    if (countryProps.length === 0) return false;

    // Check if player owns ALL properties in this country
    return countryProps.every(prop => player.ownedProperties[prop.id]);
  }

  doesPlayerOwnProperty(playerId, propertyId) {
    const p = this.players[playerId];
    return p ? !!p.ownedProperties[propertyId] : false;
  }

  assignProperty(propertyId, playerId) {
    Object.values(this.players).forEach((p) => {
      if (p.ownedProperties[propertyId]) delete p.ownedProperties[propertyId];
    });
    if (!playerId) return;
    const tile = this.getTile(propertyId);
    if (!tile || (tile.type !== TILE_TYPES.PROPERTY && tile.type !== TILE_TYPES.AIRPORT && tile.type !== TILE_TYPES.UTILITY)) return;
    const owner = this.players[playerId];
    if (owner) {
      owner.ownedProperties[propertyId] = { type: tile.type, houses: 0, hotel: false };
      this.persist();
    }
  }

  buildHouse(playerId, propertyId) {
    const player = this.players[playerId];
    const tile = this.getTile(propertyId);
    if (!player || !tile || tile.type !== TILE_TYPES.PROPERTY) return false;

    // Check if player has monopoly on this country
    if (!this.hasMonopoly(playerId, tile.country)) return false;

    const own = player.ownedProperties[propertyId];
    if (!own || own.hotel || own.houses >= 4) return false;
    const cost = Number(tile.housePrice);
    if (!isFinite(cost) || player.money < cost) return false;

    if (this.transferMoney(playerId, null, cost, 'build_house')) {
      own.houses += 1;
      this.checkBankruptcy(playerId);
      this.persist();
      return true;
    }
    return false;
  }

  buildHotel(playerId, propertyId) {
    const player = this.players[playerId];
    const tile = this.getTile(propertyId);
    if (!player || !tile || tile.type !== TILE_TYPES.PROPERTY) return false;

    // Check if player has monopoly on this country
    if (!this.hasMonopoly(playerId, tile.country)) return false;

    const own = player.ownedProperties[propertyId];
    if (!own || own.hotel || own.houses < 4) return false;
    const cost = Number(tile.hotelPrice);
    if (!isFinite(cost) || player.money < cost) return false;

    if (this.transferMoney(playerId, null, cost, 'build_hotel')) {
      own.hotel = true;
      own.houses = 0; // Remove houses when hotel is built
      this.checkBankruptcy(playerId);
      this.persist();
      return true;
    }
    return false;
  }

  sellHouse(playerId, propertyId) {
    const player = this.players[playerId];
    const tile = this.getTile(propertyId);
    if (!player || !tile || tile.type !== TILE_TYPES.PROPERTY) return false;
    const own = player.ownedProperties[propertyId];

    // Can't sell if no houses or has hotel
    if (!own || own.houses <= 0 || own.hotel) return false;

    // Refund 50% of house price
    const refund = Math.floor(Number(tile.housePrice) * 0.5);
    player.money += refund;
    own.houses -= 1;

    this.persist();
    return true;
  }

  sellHotel(playerId, propertyId) {
    const player = this.players[playerId];
    const tile = this.getTile(propertyId);
    if (!player || !tile || tile.type !== TILE_TYPES.PROPERTY) return false;
    const own = player.ownedProperties[propertyId];

    // Can't sell if no hotel
    if (!own || !own.hotel) return false;

    // Refund 50% of hotel price, revert to 4 houses
    const refund = Math.floor(Number(tile.hotelPrice) * 0.5);
    player.money += refund;
    own.hotel = false;
    own.houses = 4;

    this.persist();
    return true;
  }

  payJailFine(playerId) {
    const player = this.players[playerId];
    if (!player || !player.inJail) return false;
    if (this.settlePayment(playerId, null, 100, 'jail_fine')) {
      player.inJail = false;
      player.jailTurns = 0;
      this.paidJailThisTurn = true; // Prevent rolling this turn
      this.checkBankruptcy(playerId);
      this.persist();
      return true;
    }
    return false;
  }

  endTurn(playerId) {
    if (!this.assertTurn(playerId)) return false;
    const player = this.players[playerId];

    // Handle jail turn skipping
    if (player && player.inJail) {
      player.jailTurns -= 1;
      if (player.jailTurns <= 0) {
        player.inJail = false;
        player.jailTurns = 0;
      }
    }

    if (this.turnOrder.length === 0) return false;

    // Reset turn flags
    this.hasRolledThisTurn = false;
    this.hasBoughtThisTurn = false;
    this.hasStartedAuctionThisTurn = false;
    this.paidJailThisTurn = false;

    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;
    this.persist();
    return true;
  }

  rollAndMove(playerId) {
    if (!this.assertTurn(playerId)) return null;
    if (this.hasRolledThisTurn) return null;
    const player = this.players[playerId];

    // Block rolling if in jail OR just paid jail fine this turn
    if (!player || player.inJail || this.paidJailThisTurn) return null;

    const dice = rollDice();
    this.lastDice = dice;
    this.hasRolledThisTurn = true;
    const tile = this.movePlayer(playerId, dice.total);
    const events = this.resolveTile(playerId, tile, dice.total);
    this.persist();
    return { dice, tile, events };
  }

  movePlayer(playerId, delta) {
    const player = this.players[playerId];
    if (!player) return null;
    let newPos = player.position + delta;
    while (newPos >= TOTAL_TILES) {
      newPos -= TOTAL_TILES;
      const salary = Number(this.getTile(0).salary || 200);
      this.transferMoney(null, playerId, salary, 'salary');
    }
    while (newPos < 0) newPos += TOTAL_TILES;
    player.position = newPos;
    return this.getTile(player.position);
  }

  resolveTile(playerId, tile, diceTotal) {
    const events = [];
    if (!tile) return events;
    switch (tile.type) {
      case TILE_TYPES.TAX:
        this.settlePayment(playerId, null, tile.amount || 100, 'tax');
        events.push({ type: 'tax', amount: tile.amount || 100 });
        break;
      case TILE_TYPES.GOTO_JAIL:
        this.sendToJail(playerId);
        events.push({ type: 'goto_jail' });
        break;
      case TILE_TYPES.CHANCE:
        const card = this.drawChanceCard();
        events.push({ type: 'chance', card });
        this.applyChanceCard(playerId, card);
        break;
      case TILE_TYPES.PROPERTY:
      case TILE_TYPES.AIRPORT:
      case TILE_TYPES.UTILITY:
        const ownerId = this.findOwnerOfProperty(tile.id);
        if (!ownerId) events.push({ type: 'unowned_property', propertyId: tile.id });
        else if (ownerId !== playerId) {
          const owner = this.players[ownerId];
          let rent = calculateRent(tile.id, owner, this, diceTotal);
          const totalAssets = this.calculateTotalAssetValue(this.players[playerId]);
          const maxRent = Math.floor(totalAssets * 0.85);
          if (rent > maxRent) {
            this.forceLiquidateAssets(playerId, rent - maxRent);
            rent = maxRent;
          }
          this.settlePayment(playerId, ownerId, rent, 'rent');
          events.push({ type: 'rent_paid', to: ownerId, amount: rent, propertyId: tile.id });
        }
        break;
    }
    return events;
  }

  sendToJail(playerId) {
    const p = this.players[playerId];
    if (p) {
      p.inJail = true;
      p.jailTurns = 2;
      p.position = BOARD.find(t => t.type === TILE_TYPES.JAIL)?.id || 10;
      this.persist();
    }
  }

  applyChanceCard(playerId, card) {
    if (card.type === 'money') {
      const amt = Number(card.amount);
      if (amt > 0) this.transferMoney(null, playerId, amt, 'chance');
      else this.settlePayment(playerId, null, -amt, 'chance');
    } else if (card.type === 'move') {
      const tile = this.movePlayer(playerId, Number(card.delta));
      this.resolveTile(playerId, tile, null);
    } else if (card.type === 'goto' && card.targetType === 'jail') {
      this.sendToJail(playerId);
    }
    this.persist();
  }

  transferMoney(fromId, toId, amount, reason) {
    amount = Number(amount);
    if (amount <= 0) return false;
    const from = fromId ? this.players[fromId] : null;
    const to = toId ? this.players[toId] : null;
    if (from) {
      if (from.money < amount) return false;
      from.money = Number((from.money - amount).toFixed(2));
      this.checkBankruptcy(fromId);
    }
    if (to) {
      to.money = Number(((to.money || 0) + amount).toFixed(2));
    }
    return true;
  }

  settlePayment(fromId, toId, amount, reason) {
    if (this.transferMoney(fromId, toId, amount, reason)) return true;
    const from = this.players[fromId];
    if (from) {
      const shortfall = amount - from.money;
      this.forceLiquidateAssets(fromId, shortfall);
      if (this.transferMoney(fromId, toId, amount, reason)) return true;
      from.money -= amount;
      if (toId && this.players[toId]) this.players[toId].money += amount;
      this.checkBankruptcy(fromId);
      return true;
    }
    return false;
  }

  calculateTotalAssetValue(player) {
    if (!player) return 0;
    let total = player.money || 0;
    Object.entries(player.ownedProperties).forEach(([pid, own]) => {
      const tile = this.getTile(Number(pid));
      if (tile) total += (tile.mortgageValue || tile.price / 2);
    });
    return total;
  }

  forceLiquidateAssets(pid, target) {
    const p = this.players[pid];
    if (!p) return;
    let liquid = 0;
    const props = Object.keys(p.ownedProperties);
    props.forEach(pid => {
      if (liquid >= target) return;
      const tile = this.getTile(Number(pid));
      liquid += (tile.mortgageValue || tile.price / 2);
      delete p.ownedProperties[pid];
    });
    p.money += liquid;
    this.persist();
  }

  checkBankruptcy(playerId) {
    const p = this.players[playerId];
    if (p && p.money < 0) {
      this.forceLiquidateAssets(playerId, -p.money);
      if (p.money < 0) {
        p.bankrupt = true;
        Object.keys(p.ownedProperties).forEach(k => delete p.ownedProperties[k]);
        this.turnOrder = this.turnOrder.filter(id => id !== playerId);
        this.io.emit('player_bankrupt', { playerId });
        this.persist();
      }
    }
  }

  drawChanceCard() {
    if (this.currentChanceIndex >= this.chanceDeck.length) {
      this.chanceDeck = shuffle(BASE_CHANCE_CARDS);
      this.currentChanceIndex = 0;
    }
    return this.chanceDeck[this.currentChanceIndex++];
  }
  _ensureValidMoney(p, fb) { if (typeof p.money !== 'number') p.money = fb; }

  findOwnerOfProperty(propertyId) {
    for (const p of Object.values(this.players)) {
      if (p.ownedProperties[propertyId]) return p.id;
    }
    return null;
  }

  serialize() {
    return {
      players: this.players,
      turnOrder: this.turnOrder,
      currentTurnIndex: this.currentTurnIndex,
      currentPlayerId: this.currentPlayerId,
      started: this.started,
      hostId: this.hostId,
      board: BOARD,
      lastDice: this.lastDice,
      hasRolledThisTurn: this.hasRolledThisTurn,
      hasBoughtThisTurn: this.hasBoughtThisTurn,
      hasStartedAuctionThisTurn: this.hasStartedAuctionThisTurn,
      paidJailThisTurn: this.paidJailThisTurn,
      readyPlayers: Array.from(this.readyPlayers),
    };
  }
}

module.exports = GameState;
