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

  console.log('Database initialized');
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
