const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
    try {
        fs.mkdirSync(dbDir, { recursive: true });
    } catch (err) {
        console.error('Failed to create data directory:', err);
    }
}

const dbPath = path.join(dbDir, 'onlypoly.db');
let dbInstance = null;

const DB = {
    initialize: () => {
        return new Promise((resolve, reject) => {
            dbInstance = new sqlite3.Database(dbPath, (err) => {
                if (err) return reject(err);
                console.log('Connected to SQLite database at ' + dbPath);

                dbInstance.serialize(() => {
                    // CLEAR DB ON STARTUP (Fresh Start)
                    console.log('Clearing database for fresh start...');
                    dbInstance.run("DROP TABLE IF EXISTS players");
                    dbInstance.run("DROP TABLE IF EXISTS rooms");

                    dbInstance.run(`CREATE TABLE IF NOT EXISTS rooms (
            id TEXT PRIMARY KEY,
            created_at INTEGER,
            state TEXT,
            closed INTEGER DEFAULT 0
          )`);

                    dbInstance.run(`CREATE TABLE IF NOT EXISTS players (
            id TEXT PRIMARY KEY,
            room_id TEXT,
            name TEXT,
            socket_id TEXT,
            token TEXT,
            last_active INTEGER,
            FOREIGN KEY(room_id) REFERENCES rooms(id)
          )`, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            });
        });
    },

    // --- ROOMS ---
    saveRoom: (roomId, state) => {
        return new Promise((resolve, reject) => {
            if (!dbInstance) return reject(new Error('DB not initialised'));
            const json = JSON.stringify(state);
            dbInstance.run(
                `INSERT OR REPLACE INTO rooms (id, created_at, state, closed) VALUES (?, ?, ?, 0)`,
                [roomId, Date.now(), json],
                function (err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    },

    getRoom: (roomId) => {
        return new Promise((resolve, reject) => {
            if (!dbInstance) return resolve(null); // Return null if not ready instead of crashing
            dbInstance.get(`SELECT * FROM rooms WHERE id = ? AND closed = 0`, [roomId], (err, row) => {
                if (err) reject(err);
                else resolve(row ? JSON.parse(row.state) : null);
            });
        });
    },

    closeRoom: (roomId) => {
        return new Promise((resolve, reject) => {
            if (!dbInstance) return resolve();
            dbInstance.serialize(() => {
                dbInstance.run(`DELETE FROM players WHERE room_id = ?`, [roomId]);
                dbInstance.run(`DELETE FROM rooms WHERE id = ?`, [roomId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    },

    // --- PLAYERS ---
    createPlayer: (id, roomId, name, socketId, token) => {
        return new Promise((resolve, reject) => {
            if (!dbInstance) return reject(new Error('DB not ready'));
            dbInstance.run(
                `INSERT INTO players (id, room_id, name, socket_id, token, last_active) VALUES (?, ?, ?, ?, ?, ?)`,
                [id, roomId, name, socketId, token, Date.now()],
                function (err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    },

    getPlayer: (id) => {
        return new Promise((resolve, reject) => {
            // If DB not ready, surely fail
            if (!dbInstance) return reject(new Error('DB not ready'));
            dbInstance.get(`SELECT * FROM players WHERE id = ?`, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    updatePlayerSocket: (id, socketId) => {
        return new Promise((resolve, reject) => {
            if (!dbInstance) return resolve();
            dbInstance.run(`UPDATE players SET socket_id = ?, last_active = ? WHERE id = ?`, [socketId, Date.now(), id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },

    cleanupJunk: () => {
        if (!dbInstance) return;
        const expiry = Date.now() - (24 * 60 * 60 * 1000);
        dbInstance.run(`DELETE FROM players WHERE last_active < ?`, [expiry], (err) => {
            if (err) console.error('Cleanup error:', err);
            else console.log('Cleaned up stale sessions');
        });
    }
};

// Periodic cleanup (every 1 hour)
setInterval(DB.cleanupJunk, 60 * 60 * 1000);

module.exports = DB;
