<div align="center">

# 🎲 OnlyPoly

### *A Premium Multiplayer Monopoly Experience*

**Real-time LAN multiplayer board game built with modern web technologies**

[![Node.js](https://img.shields.io/badge/Node.js-v14+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-v4.8-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)
[![Express](https://img.shields.io/badge/Express-v5.2-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)

[Features](#-features) • [Quick Start](#-quick-start) • [How to Play](#-how-to-play) • [Tech Stack](#-tech-stack) • [Architecture](#-architecture)

</div>

---

## 🌟 Features

### 🎮 Gameplay
- **Real-time Multiplayer**: 2-8 players over LAN with seamless synchronization
- **Server-Authoritative Architecture**: All game logic validated server-side for fairness
- **Global Property Board**: Travel the world with properties from 9 countries
  - 🇵🇰 Pakistan • 🇲🇽 Mexico • 🇵🇱 Poland • 🇮🇳 India • 🇷🇺 Russia
  - 🇨🇳 China • 🇶🇦 Qatar • 🇯🇵 Japan • 🇺🇸 USA
- **Complete Monopoly Mechanics**:
  - Property ownership & rent collection
  - Houses & hotels with progressive rent multipliers
  - Trading system for properties and cash
  - Auction system for unowned properties
  - Chance cards with random events
  - Taxes, utilities, and airports

### 🎨 User Experience
- **Premium Glassmorphism UI**: Modern, sleek interface with smooth animations
- **3D Animated Dice**: Realistic physics-based dice rolling
- **Mobile-First Design**: Optimized for touch devices with responsive layouts
- **Country Flag Backgrounds**: Subtle, graphically viable flag SVGs on tiles
- **Real-time Player Tracking**: Live updates of money, properties, and positions
- **Intelligent Player Positioning**: Smart piece placement to prevent overlap

### 🔧 Technical
- **WebSocket Communication**: Low-latency real-time updates via Socket.io
- **SQLite Persistence**: Optional game state saving
- **Zero Configuration**: Automatic LAN discovery and connection
- **Cross-Platform**: Works on Windows, macOS, Linux, iOS, Android

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v14 or higher
- npm (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/OnlyPoly.git

# Navigate to project directory
cd OnlyPoly

# Install dependencies
npm install
```

### Running the Server

```bash
# Start the game server
npm start
```

The server will start on `http://localhost:3000` and display your local IP address in the terminal.

### Connecting Players

**On the host device:**
1. Open browser to `http://localhost:3000`

**On other devices (phones/tablets):**
1. Ensure all devices are on the **same Wi-Fi network**
2. Find the host's IP address (displayed in terminal)
3. Open browser to `http://[HOST_IP]:3000`
   - Example: `http://192.168.1.105:3000`

> 💡 **Need help connecting?** See the detailed [CONNECTION_GUIDE.md](CONNECTION_GUIDE.md) for troubleshooting.

---

## 🎯 How to Play

### Game Setup
1. **Join Lobby**: Each player enters their display name and joins
2. **Ready Up**: Toggle the "Ready" button when prepared
3. **Start Game**: Host clicks "Start Game" when ≥2 players are ready

### Gameplay Flow
1. **Roll Dice**: Click the dice button on your turn
2. **Move**: Your piece automatically moves to the new position
3. **Property Actions**:
   - **Unowned**: Buy it or trigger an auction
   - **Owned by Others**: Pay rent
   - **Owned by You**: Build houses/hotels if you own the monopoly
4. **Special Tiles**:
   - **GO**: Collect $200 salary
   - **Chance**: Draw a random event card
   - **Jail**: Visit or get sent there
   - **Free Parking**: Safe space, no action
   - **Taxes**: Pay the specified amount
5. **Trading**: Negotiate property and cash trades with other players
6. **Win Condition**: Last player standing with money wins!

### Game Board Layout

```
┌─────────────────────────────────────────────┐
│  20: Free Parking                           │
│  21-24: China (Yellow)                      │
│  25: Airport                                │
│  26-27: Qatar (Green)                       │
│  28: Utility                                │
│  29: Japan (Blue)                           │
├─────────────────────────────────────────────┤
│                                             │
│  10: Jail                    30: Go To Jail │
│  11: Poland (Pink)                          │
│  12: Utility                 31-32: Japan   │
│  13-16: India (Orange)       33: Chance     │
│  17: Chance                  34,37: USA     │
│  18-19: Russia (Red)         35: Airport    │
│                              36: Chance     │
│                              38: Luxury Tax │
│                              39: Chance     │
├─────────────────────────────────────────────┤
│  0: GO (Start)                              │
│  1,3: Pakistan (Brown)                      │
│  2: Chance                                  │
│  4: Income Tax                              │
│  5: Airport                                 │
│  6,8: Mexico (Light Blue)                   │
│  7: Chance                                  │
│  9: Poland (Pink)                           │
└─────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Backend
- **Node.js**: JavaScript runtime
- **Express.js**: Web server framework
- **Socket.io**: Real-time bidirectional communication
- **SQLite3**: Lightweight database for game state persistence

### Frontend
- **Vanilla JavaScript**: No framework dependencies
- **CSS3**: Modern styling with glassmorphism effects
- **WebSockets**: Real-time game updates
- **Canvas API**: 3D dice animations

### Architecture Pattern
- **Server-Authoritative**: All game logic runs on server
- **Client-Side Rendering**: Clients display server-confirmed state
- **Event-Driven**: Socket.io events for all player actions

---

## 🏗️ Architecture

### Server Authority Principle
OnlyPoly follows a **strict server-authoritative architecture**:

```
Client                          Server
  │                               │
  ├─ User Action (Intent) ────────▶ Validate Action
  │                               │
  │                               ├─ Update Game State
  │                               │
  │◀──── State Update ────────────┤ Broadcast to All
  │                               │
  └─ Render UI                    │
```

**Key Principles:**
- ✅ Server validates all actions (dice rolls, purchases, trades)
- ✅ Clients only send **intent**, never modify state directly
- ✅ Server broadcasts **confirmed state** to all clients
- ✅ Prevents cheating and ensures synchronization

### Project Structure

```
OnlyPoly/
├── server/
│   ├── server.js           # Main server & Socket.io handlers
│   ├── gameState.js        # Core game logic & state management
│   ├── boardData.js        # Board layout & property definitions
│   ├── tradeSystem.js      # Player-to-player trading logic
│   ├── auctionSystem.js    # Property auction mechanics
│   ├── rentCalculator.js   # Rent calculation with multipliers
│   ├── db.js               # SQLite database operations
│   └── utils.js            # Helper functions
├── client/
│   ├── index.html          # Main game interface
│   ├── game.js             # Client-side game logic
│   ├── ui.js               # UI components & modals
│   ├── dice.js             # 3D dice animation
│   ├── animations.js       # Player movement animations
│   ├── flags.js            # Country flag SVG data
│   └── style.css           # Glassmorphism styling
├── package.json
└── README.md
```

---

## 🎨 UI/UX Highlights

### Mobile-First Design
- **Touch-Optimized**: Large tap targets, swipe gestures
- **Responsive Layout**: Adapts to all screen sizes
- **Players Modal**: Dedicated view for player info on mobile
- **Properties Modal**: Easy property management interface

### Visual Design
- **Glassmorphism**: Frosted glass effect with backdrop blur
- **Smooth Animations**: CSS transitions for all interactions
- **Color-Coded Properties**: Each country group has distinct colors
- **Flag Backgrounds**: Subtle country flags on property tiles
- **3D Dice**: Realistic rolling animation with physics

### Accessibility
- **High Contrast**: Readable text on all backgrounds
- **Clear Feedback**: Visual indicators for all actions
- **Responsive Controls**: Works with mouse, touch, and keyboard

---

## 🔌 Network & Connection

### LAN Setup
1. **Same Network**: All devices must be on the same Wi-Fi
2. **Firewall**: May need to allow port 3000 through firewall
3. **IP Address**: Server displays connection URL in terminal

### Troubleshooting

**Can't connect from other devices?**
- ✅ Verify all devices on same Wi-Fi network
- ✅ Check Windows Firewall settings (allow port 3000)
- ✅ Confirm correct IP address (use `ipconfig` on Windows)
- ✅ Try `http://` not `https://`

**Game not starting?**
- ✅ Ensure ≥2 players are marked "Ready"
- ✅ Check server console for errors
- ✅ Refresh browser page

See [CONNECTION_GUIDE.md](CONNECTION_GUIDE.md) for detailed instructions.

---

## 🎲 Game Mechanics

### Property Groups & Pricing

| Country | Properties | Color | Price Range |
|---------|-----------|-------|-------------|
| 🇵🇰 Pakistan | 2 | Brown | $60 |
| 🇲🇽 Mexico | 2 | Light Blue | $100 |
| 🇵🇱 Poland | 2 | Pink | $120 |
| 🇮🇳 India | 3 | Orange | $140-160 |
| 🇷🇺 Russia | 2 | Red | $180 |
| 🇨🇳 China | 3 | Yellow | $220-240 |
| 🇶🇦 Qatar | 2 | Green | $260 |
| 🇯🇵 Japan | 3 | Blue | $280-300 |
| 🇺🇸 USA | 2 | Purple | $350-400 |

### Rent Calculation
- **Base Rent**: Defined per property
- **Monopoly Bonus**: 2x rent when owning all properties in a group
- **Houses**: 5x, 15x, 45x, 65x multipliers (1-4 houses)
- **Hotel**: 80x multiplier

### Special Tiles
- **Airports** (4): Rent based on number owned (1-4)
- **Utilities** (2): Rent based on dice roll × multiplier
- **Chance** (8): Random events (gain/lose money, move, etc.)
- **Taxes** (2): Income Tax ($200), Luxury Tax ($100)

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

### Development Guidelines
- Follow server-authoritative architecture
- Maintain mobile-first responsive design
- Add comments for complex game logic
- Test on multiple devices before submitting

---

## 📝 License

This project is licensed under the ISC License.

---

## 🙏 Acknowledgments

- Inspired by classic Monopoly gameplay
- Built with modern web technologies
- Designed for seamless LAN multiplayer experiences

---

<div align="center">

**Made with ❤️ for board game enthusiasts**

[Report Bug](https://github.com/yourusername/OnlyPoly/issues) • [Request Feature](https://github.com/yourusername/OnlyPoly/issues)

</div>
