const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const GameState = require('./gameState');
const AuctionSystem = require('./auctionSystem');
const TradeSystem = require('./tradeSystem');
const { generateToken } = require('./utils');
const DB = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const CLIENT_DIR = path.join(__dirname, '..', 'client');
app.use(express.static(CLIENT_DIR));

const gameStatePlaceholder = {};
const auctionSystem = new AuctionSystem(io, gameStatePlaceholder);

// Lazy initialization of GameState after DB is ready
let gameState = null;
let tradeSystem = null;

// Start init
DB.initialize().then(() => {
  console.log('DB Initialized.');
  gameState = new GameState(io, auctionSystem);
  auctionSystem.gameState = gameState;
  tradeSystem = new TradeSystem(io, gameState);
}).catch(err => {
  console.error('Fatal DB Error:', err);
  process.exit(1);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(CLIENT_DIR, 'index.html'));
});

// Helper to ensure GameState is ready before processing events (rare edge case during boot)
function ensureReady(socket) {
  if (!gameState) {
    socket.emit('server_error', { reason: 'booting' });
    return false;
  }
  return true;
}

io.on('connection', async (socket) => {
  // Wait slightly or check if gameState exists
  if (!gameState) {
    // If client connects immediately before DB resolves, try to wait or drop.
    // Usually fast enough.
    // We can retry via setImmediate or just fail.
    console.warn('Socket attached before GameState ready.');
    // Simple loop to wait?
    // Better: check inside handlers.
  }

  let playerId = null;

  // 1. Session Recovery Logic
  const sessionId = socket.handshake.auth.sessionId;
  if (sessionId && gameState) {
    try {
      const playerRecord = await DB.getPlayer(sessionId);
      if (playerRecord) {
        const restored = gameState.reconnectPlayer(sessionId, socket.id);
        if (restored) {
          playerId = sessionId;
          console.log(`[Session] Restored player ${playerRecord.name} (${playerId})`);
          socket.emit('session_restored', {
            playerId,
            name: playerRecord.name,
            token: playerRecord.token,
            hostId: gameState.hostId
          });
          socket.emit('state_update', gameState.serialize());
        } else {
          socket.emit('session_invalid');
        }
      } else {
        socket.emit('session_invalid');
      }
    } catch (err) {
      console.error('Session check error:', err);
    }
  }

  socket.on('join_lobby', ({ name, existingId }) => {
    if (!ensureReady(socket)) return;
    if (!name || typeof name !== 'string') return;

    // Check if recovery is trying to happen via existingId argument from client
    // (fallback for clients that don't support auth handshake yet?)
    const id = existingId || socket.id;

    // logic...
    const token = generateToken();
    const player = gameState.addPlayer(id, name.slice(0, 16), socket.id, token);

    if (!player) {
      if (gameState.players[id]) {
        playerId = id;
        gameState.reconnectPlayer(id, socket.id);
        socket.emit('joined', { playerId: id, token, hostId: gameState.hostId });
        io.emit('state_update', gameState.serialize());
        return;
      }
      socket.emit('join_error', { reason: 'Game started or full' });
      return;
    }

    playerId = id;
    socket.emit('joined', { playerId: id, token, hostId: gameState.hostId });
    io.emit('state_update', gameState.serialize());
  });

  socket.on('set_player_color', ({ color }) => {
    if (!ensureReady(socket)) return;
    if (!playerId || gameState.started) return;
    const ok = gameState.setPlayerColor(playerId, color);
    if (ok) {
      io.emit('state_update', gameState.serialize());
    } else {
      socket.emit('color_rejected', { reason: 'color_taken' });
    }
  });

  socket.on('set_ready', ({ ready }) => {
    if (!ensureReady(socket)) return;
    if (!playerId) return;
    gameState.markReady(playerId, !!ready);
    io.emit('state_update', gameState.serialize());
  });

  socket.on('start_game', () => {
    if (!ensureReady(socket)) return;
    if (!playerId) return;
    const ok = gameState.startGame(playerId);
    if (!ok) return;
    io.emit('state_update', gameState.serialize());
  });

  socket.on('roll_dice', () => {
    if (!ensureReady(socket)) return;
    if (!playerId || !gameState.assertTurn(playerId)) return;
    if (gameState.hasRolledThisTurn) {
      socket.emit('action_rejected', { reason: 'already_rolled' });
      return;
    }
    if (gameState._lastRollTime && (Date.now() - gameState._lastRollTime) < 1000) {
      socket.emit('action_rejected', { reason: 'too_fast' });
      return;
    }
    const result = gameState.rollAndMove(playerId);
    if (!result) {
      socket.emit('action_rejected', { reason: 'invalid_roll' });
      return;
    }
    gameState._lastRollTime = Date.now();
    io.emit('dice_rolled', { playerId, ...result });
    io.emit('state_update', gameState.serialize());
  });

  socket.on('buy_property', ({ propertyId }) => {
    if (!ensureReady(socket)) return;
    if (!playerId || !gameState.assertTurn(playerId)) {
      socket.emit('action_rejected', { reason: 'not_your_turn' });
      return;
    }
    const propId = Number(propertyId);
    if (!isFinite(propId)) {
      socket.emit('action_rejected', { reason: 'invalid_property' });
      return;
    }
    if (gameState.hasBoughtThisTurn) {
      socket.emit('action_rejected', { reason: 'already_bought' });
      return;
    }
    if (gameState.hasStartedAuctionThisTurn) {
      socket.emit('action_rejected', { reason: 'auction_started' });
      return;
    }
    const tile = gameState.getTile(propId);
    const player = gameState.players[playerId];
    if (!tile || !player) {
      socket.emit('action_rejected', { reason: 'invalid_tile_or_player' });
      return;
    }
    const currentOwner = gameState.findOwnerOfProperty(propId);
    if (currentOwner) {
      socket.emit('action_rejected', { reason: 'property_already_owned', owner: currentOwner });
      return;
    }
    const price = Number(tile.price);
    if (!isFinite(price) || price <= 0 || player.money < price) {
      socket.emit('action_rejected', { reason: 'insufficient_funds' });
      return;
    }

    gameState.hasBoughtThisTurn = true;
    const success = gameState.transferMoney(playerId, null, price, 'purchase');
    if (success) {
      gameState.assignProperty(propId, playerId);
      io.emit('state_update', gameState.serialize());
    } else {
      gameState.hasBoughtThisTurn = false;
      socket.emit('action_rejected', { reason: 'purchase_failed' });
    }
  });

  socket.on('start_auction', ({ propertyId }) => {
    if (!ensureReady(socket)) return;
    if (!playerId || !gameState.assertTurn(playerId)) return;
    if (gameState.hasBoughtThisTurn) {
      socket.emit('action_rejected', { reason: 'already_bought' });
      return;
    }
    if (gameState.hasStartedAuctionThisTurn) {
      socket.emit('action_rejected', { reason: 'auction_already_started' });
      return;
    }
    const propId = Number(propertyId);
    if (!isFinite(propId) || gameState.findOwnerOfProperty(propId)) {
      socket.emit('action_rejected', { reason: 'property_already_owned' });
      return;
    }
    gameState.hasStartedAuctionThisTurn = true;
    const auction = auctionSystem.startAuction(propId, playerId);
    if (!auction) {
      gameState.hasStartedAuctionThisTurn = false;
      socket.emit('action_rejected', { reason: 'cannot_start_auction' });
    }
  });

  socket.on('auction_bid', ({ step }) => {
    if (!ensureReady(socket)) return;
    if (!playerId) return;
    const s = Number(step);
    const amount = s === 2 || s === 10 || s === 100 ? s : null;
    if (!amount) {
      socket.emit('action_rejected', { reason: 'invalid_bid_step' });
      return;
    }
    const ok = auctionSystem.placeBid(playerId, amount);
    if (!ok) {
      socket.emit('action_rejected', { reason: 'bid_rejected' });
    }
  });

  socket.on('end_turn', () => {
    if (!ensureReady(socket)) return;
    if (!playerId || !gameState.assertTurn(playerId)) return;
    const player = gameState.players[playerId];
    if (!player.inJail && !gameState.hasRolledThisTurn) {
      socket.emit('action_rejected', { reason: 'must_roll_first' });
      return;
    }
    const ok = gameState.endTurn(playerId);
    if (!ok) return;
    io.emit('state_update', gameState.serialize());
  });

  socket.on('pay_jail_fine', () => {
    if (!ensureReady(socket)) return;
    if (!playerId || !gameState.assertTurn(playerId)) {
      socket.emit('action_rejected', { reason: 'not_your_turn' });
      return;
    }
    const success = gameState.payJailFine(playerId);
    if (success) {
      io.emit('state_update', gameState.serialize());
    } else {
      socket.emit('action_rejected', { reason: 'cannot_pay_fine' });
    }
  });

  socket.on('build_house', ({ propertyId }) => {
    if (!ensureReady(socket)) return;
    if (!playerId) return;
    if (!gameState.assertTurn(playerId)) {
      socket.emit('action_rejected', { reason: 'not_your_turn' });
      return;
    }
    if (!gameState.doesPlayerOwnProperty(playerId, propertyId)) {
      socket.emit('action_rejected', { reason: 'not_owner' });
      return;
    }
    const propId = Number(propertyId);
    const success = gameState.buildHouse(playerId, propId);
    if (success) {
      io.emit('state_update', gameState.serialize());
    } else {
      socket.emit('action_rejected', { reason: 'cannot_build' });
    }
  });

  socket.on('build_hotel', ({ propertyId }) => {
    if (!ensureReady(socket)) return;
    if (!playerId) return;
    if (!gameState.assertTurn(playerId)) {
      socket.emit('action_rejected', { reason: 'not_your_turn' });
      return;
    }
    if (!gameState.doesPlayerOwnProperty(playerId, propertyId)) {
      socket.emit('action_rejected', { reason: 'not_owner' });
      return;
    }
    const propId = Number(propertyId);
    const success = gameState.buildHotel(playerId, propId);
    if (success) {
      io.emit('state_update', gameState.serialize());
    } else {
      socket.emit('action_rejected', { reason: 'cannot_build' });
    }
  });

  socket.on('propose_trade', (payload) => {
    if (!ensureReady(socket)) return;
    if (!playerId) return;
    tradeSystem.createTrade(playerId, payload.toPlayerId, payload);
  });

  socket.on('accept_trade', ({ tradeId }) => {
    if (!ensureReady(socket)) return;
    if (!playerId) return;
    tradeSystem.acceptTrade(tradeId, playerId);
    io.emit('state_update', gameState.serialize());
  });

  socket.on('reject_trade', ({ tradeId }) => {
    if (!ensureReady(socket)) return;
    if (!playerId) return;
    tradeSystem.rejectTrade(tradeId, playerId);
  });

  socket.on('disconnect', () => {
    if (!playerId || !gameState) return;
    gameState.removePlayer(playerId);
    io.emit('state_update', gameState.serialize());
  });
});

function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const PORT = process.env.PORT || 3000;
const localIP = getLocalIP();

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '='.repeat(60));
  console.log('🎮 ONLYPOLY SERVER IS RUNNING!');
  console.log('='.repeat(60));
  console.log(`\n📍 Local URL:    http://localhost:${PORT}`);
  console.log(`🌐 Network URL:  http://${localIP}:${PORT}`);
  console.log('='.repeat(60) + '\n');
});
