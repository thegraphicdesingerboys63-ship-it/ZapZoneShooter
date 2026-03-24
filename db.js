require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      username         TEXT PRIMARY KEY,
      total_kills      INTEGER     NOT NULL DEFAULT 0,
      total_deaths     INTEGER     NOT NULL DEFAULT 0,
      wins             INTEGER     NOT NULL DEFAULT 0,
      coins            INTEGER     NOT NULL DEFAULT 500,
      unlocked_weapons TEXT[]      NOT NULL DEFAULT ARRAY['pulse_rifle','shock_blaster'],
      unlocked_skins   TEXT[]      NOT NULL DEFAULT ARRAY['default'],
      equipped_skin    TEXT        NOT NULL DEFAULT 'default',
      ability_1        TEXT        NOT NULL DEFAULT 'dash_burst',
      ability_2        TEXT        NOT NULL DEFAULT 'energy_dome',
      spawn_weapon     TEXT        NOT NULL DEFAULT 'pulse_rifle',
      last_seen        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS friends (
      username   TEXT NOT NULL,
      friend     TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (username, friend)
    );
    CREATE TABLE IF NOT EXISTS user_settings (
      username      TEXT PRIMARY KEY,
      sensitivity   FLOAT   NOT NULL DEFAULT 1.0,
      sfx_vol       FLOAT   NOT NULL DEFAULT 0.8,
      crosshair     TEXT    NOT NULL DEFAULT 'dynamic',
      show_fps      BOOLEAN NOT NULL DEFAULT false,
      show_dmg_nums BOOLEAN NOT NULL DEFAULT true
    );
  `);
  console.log('[DB] Tables ready');
}

async function getOrCreatePlayer(username) {
  await pool.query(`INSERT INTO players(username) VALUES($1) ON CONFLICT(username) DO UPDATE SET last_seen=NOW()`, [username]);
  const { rows } = await pool.query('SELECT * FROM players WHERE username=$1', [username]);
  return rows[0];
}

async function saveGameStats(username, kills, deaths, won) {
  const coins = kills*10 + (won?150:20) + (deaths===0&&kills>0?75:0);
  await pool.query(`UPDATE players SET total_kills=total_kills+$2,total_deaths=total_deaths+$3,wins=wins+$4,coins=coins+$5,last_seen=NOW() WHERE username=$1`,
    [username, kills, deaths, won?1:0, coins]);
  return coins;
}

async function purchaseItem(username, itemKey, cost, isWeapon) {
  const { rows } = await pool.query('SELECT coins,unlocked_weapons,unlocked_skins FROM players WHERE username=$1', [username]);
  if (!rows[0]) return { success:false, reason:'Player not found' };
  const p = rows[0];
  if (p.coins < cost) return { success:false, reason:'Not enough coins' };
  const col   = isWeapon ? 'unlocked_weapons' : 'unlocked_skins';
  const owned = isWeapon ? p.unlocked_weapons : p.unlocked_skins;
  if (owned.includes(itemKey)) return { success:false, reason:'Already owned' };
  await pool.query(`UPDATE players SET coins=coins-$2,${col}=array_append(${col},$3) WHERE username=$1`, [username, cost, itemKey]);
  return { success:true, newCoins:p.coins-cost };
}

async function equipSkin(username, skin) {
  const { rows } = await pool.query('SELECT unlocked_skins FROM players WHERE username=$1', [username]);
  if (!rows[0]||!rows[0].unlocked_skins.includes(skin)) return { success:false };
  await pool.query('UPDATE players SET equipped_skin=$2 WHERE username=$1', [username, skin]);
  return { success:true };
}

async function saveLoadout(username, ab1, ab2, spawnWeapon, unlockedWeapons) {
  if (!unlockedWeapons.includes(spawnWeapon)) spawnWeapon='pulse_rifle';
  await pool.query('UPDATE players SET ability_1=$2,ability_2=$3,spawn_weapon=$4 WHERE username=$1', [username, ab1, ab2, spawnWeapon]);
}

// ── Friends ───────────────────────────────────────────────────────────────────
async function getFriends(username) {
  const { rows } = await pool.query(`
    SELECT f.friend AS username, f.status, p.total_kills, p.wins
    FROM friends f LEFT JOIN players p ON p.username=f.friend
    WHERE f.username=$1
    UNION
    SELECT f.username, 'accepted', p.total_kills, p.wins
    FROM friends f LEFT JOIN players p ON p.username=f.username
    WHERE f.friend=$1 AND f.status='accepted'
  `, [username]);
  return rows;
}

async function sendFriendRequest(from, to) {
  if (from === to) return { success:false, reason:"Can't add yourself" };
  const { rows:ex } = await pool.query('SELECT 1 FROM friends WHERE (username=$1 AND friend=$2) OR (username=$2 AND friend=$1)', [from, to]);
  if (ex.length) return { success:false, reason:'Request already exists' };
  const { rows:p } = await pool.query('SELECT 1 FROM players WHERE username=$1', [to]);
  if (!p.length) return { success:false, reason:'Player not found' };
  await pool.query('INSERT INTO friends(username,friend) VALUES($1,$2)', [from, to]);
  return { success:true };
}

async function respondFriendRequest(username, from, accept) {
  if (accept) {
    await pool.query("UPDATE friends SET status='accepted' WHERE username=$1 AND friend=$2", [from, username]);
  } else {
    await pool.query('DELETE FROM friends WHERE username=$1 AND friend=$2', [from, username]);
  }
  return { success:true };
}

async function removeFriend(username, friend) {
  await pool.query('DELETE FROM friends WHERE (username=$1 AND friend=$2) OR (username=$2 AND friend=$1)', [username, friend]);
}

// ── Settings ──────────────────────────────────────────────────────────────────
async function getSettings(username) {
  const { rows } = await pool.query('SELECT * FROM user_settings WHERE username=$1', [username]);
  if (!rows.length) {
    await pool.query('INSERT INTO user_settings(username) VALUES($1) ON CONFLICT DO NOTHING', [username]);
    return { sensitivity:1.0, sfx_vol:0.8, crosshair:'dynamic', show_fps:false, show_dmg_nums:true };
  }
  return rows[0];
}

async function saveSettings(username, s) {
  await pool.query(`
    INSERT INTO user_settings(username,sensitivity,sfx_vol,crosshair,show_fps,show_dmg_nums)
    VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT(username) DO UPDATE SET sensitivity=$2,sfx_vol=$3,crosshair=$4,show_fps=$5,show_dmg_nums=$6
  `, [username, s.sensitivity??1.0, s.sfx_vol??0.8, s.crosshair??'dynamic', s.show_fps??false, s.show_dmg_nums??true]);
}

module.exports = { initDB, getOrCreatePlayer, saveGameStats, purchaseItem, equipSkin, saveLoadout,
  getFriends, sendFriendRequest, respondFriendRequest, removeFriend, getSettings, saveSettings };
