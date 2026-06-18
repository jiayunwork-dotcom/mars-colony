import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'mars',
  password: process.env.DB_PASSWORD || 'mars_password',
  database: process.env.DB_NAME || 'mars_colony',
});

export async function initDatabase(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      state JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      state JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      room_id TEXT REFERENCES rooms(id),
      socket_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS trade_history (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      buyer_player_id TEXT NOT NULL,
      buyer_player_name TEXT NOT NULL,
      seller_player_id TEXT NOT NULL,
      seller_player_name TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price_resource TEXT NOT NULL,
      price_per_unit NUMERIC NOT NULL,
      total_price INTEGER NOT NULL,
      order_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_trade_history_game_id ON trade_history(game_id);
    CREATE INDEX IF NOT EXISTS idx_trade_history_buyer ON trade_history(buyer_player_id);
    CREATE INDEX IF NOT EXISTS idx_trade_history_seller ON trade_history(seller_player_id);
    CREATE INDEX IF NOT EXISTS idx_trade_history_created_at ON trade_history(created_at DESC);
  `);

  console.log('Database initialized');
}

export async function saveTradeRecord(gameId: string, trade: any): Promise<void> {
  await pool.query(
    `INSERT INTO trade_history (
      id, game_id, buyer_player_id, buyer_player_name,
      seller_player_id, seller_player_name, resource_type,
      quantity, price_resource, price_per_unit, total_price, order_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      trade.id,
      gameId,
      trade.buyerPlayerId,
      trade.buyerPlayerName,
      trade.sellerPlayerId,
      trade.sellerPlayerName,
      trade.resourceType,
      trade.quantity,
      trade.priceResource,
      trade.pricePerUnit,
      trade.totalPrice,
      trade.orderId || null,
    ]
  );
}

export async function getTradeHistory(gameId: string, limit: number = 50): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM trade_history WHERE game_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [gameId, limit]
  );
  return result.rows;
}

export async function getPlayerTradeHistory(gameId: string, playerId: string, limit: number = 50): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM trade_history 
     WHERE game_id = $1 AND (buyer_player_id = $2 OR seller_player_id = $2)
     ORDER BY created_at DESC LIMIT $3`,
    [gameId, playerId, limit]
  );
  return result.rows;
}

export async function saveGame(gameId: string, state: any): Promise<void> {
  await pool.query(
    `INSERT INTO games (id, state, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET state = $2, updated_at = CURRENT_TIMESTAMP`,
    [gameId, JSON.stringify(state)]
  );
}

export async function loadGame(gameId: string): Promise<any | null> {
  const result = await pool.query('SELECT state FROM games WHERE id = $1', [gameId]);
  return result.rows[0]?.state || null;
}

export async function saveRoom(roomId: string, state: any): Promise<void> {
  await pool.query(
    `INSERT INTO rooms (id, state, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET state = $2, updated_at = CURRENT_TIMESTAMP`,
    [roomId, JSON.stringify(state)]
  );
}

export async function loadRoom(roomId: string): Promise<any | null> {
  const result = await pool.query('SELECT state FROM rooms WHERE id = $1', [roomId]);
  return result.rows[0]?.state || null;
}

export { pool };
