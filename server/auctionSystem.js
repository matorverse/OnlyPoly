// Auction system for ONLYPOLY

const AUCTION_DURATION_MS = 30000;

class AuctionSystem {
  constructor(io, gameState) {
    this.io = io;
    this.gameState = gameState;
    this.currentAuction = null;
  }

  startAuction(propertyId, starterPlayerId) {
    if (this.currentAuction) return null;
    const prop = this.gameState.getTile(propertyId);
    if (!prop || prop.type !== 'property') return null;

    const auction = {
      propertyId,
      startedBy: starterPlayerId,
      highestBid: 0,
      highestBidder: null,
      endsAt: Date.now() + AUCTION_DURATION_MS,
      active: true,
    };
    this.currentAuction = auction;

    this.io.emit('auction_started', auction);

    setTimeout(() => this.finishAuction(), AUCTION_DURATION_MS + 50);

    return auction;
  }

  placeBid(playerId, amount) {
    const auction = this.currentAuction;
    if (!auction || !auction.active) return false;
    if (Date.now() > auction.endsAt) {
      this.finishAuction();
      return false;
    }

    const player = this.gameState.players[playerId];
    if (!player || player.bankrupt) return false;

    const step = Number(amount);
    if (!isFinite(step) || step <= 0) return false;

    const newBid = auction.highestBid + step;
    if (newBid > player.money) {
      // Not enough money, reject silently
      return false;
    }

    // Prevent bidding same amount (spam protection)
    if (newBid === auction.highestBid && auction.highestBidder === playerId) {
      return false;
    }

    auction.highestBid = newBid;
    auction.highestBidder = playerId;

    this.io.emit('auction_updated', auction);
    return true;
  }

  finishAuction() {
    const auction = this.currentAuction;
    if (!auction || !auction.active) return;

    auction.active = false;
    if (auction.highestBidder) {
      const winner = this.gameState.players[auction.highestBidder];
      if (winner && winner.money >= auction.highestBid) {
        this.gameState.transferMoney(
          auction.highestBidder,
          null,
          auction.highestBid,
          'auction'
        );
        this.gameState.assignProperty(
          auction.propertyId,
          auction.highestBidder
        );
      }
    }

    this.io.emit('auction_finished', auction);
    this.currentAuction = null;

    // Persist state and notify all clients of property ownership change
    this.gameState.persist();
    this.io.emit('state_update', this.gameState.serialize());
  }
}

module.exports = AuctionSystem;


