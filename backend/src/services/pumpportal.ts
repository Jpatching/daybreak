import WebSocket from 'ws';
import type { PumpPortalNewToken, PumpPortalMigration } from '../types';

const PUMPPORTAL_WS_URL = 'wss://pumpportal.fun/api/data';
const MAX_EVENTS = 100; // ring buffer size

// In-memory ring buffers for recent events
let newTokens: PumpPortalNewToken[] = [];
let migrations: PumpPortalMigration[] = [];

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isConnected = false;

function pushEvent<T>(buffer: T[], event: T, max: number): T[] {
  buffer.push(event);
  if (buffer.length > max) buffer.shift();
  return buffer;
}

function connect(): void {
  if (ws) {
    try { ws.close(); } catch { /* ignore */ }
  }

  try {
    ws = new WebSocket(PUMPPORTAL_WS_URL);
  } catch (err) {
    console.error('[pumpportal] WebSocket creation failed:', err);
    scheduleReconnect();
    return;
  }

  ws.on('open', () => {
    isConnected = true;
    console.log('[pumpportal] Connected to PumpPortal WebSocket');

    // Subscribe to new token creations and migrations
    ws!.send(JSON.stringify({ method: 'subscribeNewToken' }));
    ws!.send(JSON.stringify({ method: 'subscribeMigration' }));
  });

  ws.on('message', (raw: Buffer) => {
    try {
      const data = JSON.parse(raw.toString());

      // New token creation event
      if (data.txType === 'create' && data.mint) {
        const event: PumpPortalNewToken = {
          mint: data.mint,
          name: data.name || '',
          symbol: data.symbol || '',
          uri: data.uri || '',
          traderPublicKey: data.traderPublicKey || '',
          initialBuy: data.initialBuy || 0,
          bondingCurveKey: data.bondingCurveKey || '',
          vTokensInBondingCurve: data.vTokensInBondingCurve || 0,
          vSolInBondingCurve: data.vSolInBondingCurve || 0,
          marketCapSol: data.marketCapSol || 0,
          timestamp: Date.now(),
        };
        newTokens = pushEvent(newTokens, event, MAX_EVENTS);
      }

      // Migration (graduation from bonding curve to Raydium)
      if (data.txType === 'migration' && data.mint) {
        const event: PumpPortalMigration = {
          mint: data.mint,
          pool: data.pool || '',
          timestamp: Date.now(),
        };
        migrations = pushEvent(migrations, event, MAX_EVENTS);
      }
    } catch {
      // Ignore parse errors
    }
  });

  ws.on('close', () => {
    isConnected = false;
    console.log('[pumpportal] WebSocket closed, reconnecting...');
    scheduleReconnect();
  });

  ws.on('error', (err: Error) => {
    console.error('[pumpportal] WebSocket error:', err.message);
    // on('close') will fire next and trigger reconnect
  });
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 5000); // reconnect after 5 seconds
}

/** Start the PumpPortal WebSocket connection */
export function startPumpPortal(): void {
  connect();
}

/** Stop the PumpPortal WebSocket connection */
export function stopPumpPortal(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    try { ws.close(); } catch { /* ignore */ }
    ws = null;
  }
  isConnected = false;
}

/** Get recent new token events */
export function getRecentNewTokens(limit: number = 50): PumpPortalNewToken[] {
  return newTokens.slice(-limit).reverse();
}

/** Get recent migration events */
export function getRecentMigrations(limit: number = 50): PumpPortalMigration[] {
  return migrations.slice(-limit).reverse();
}

/** Get connection status */
export function getPumpPortalStatus(): { connected: boolean; newTokenCount: number; migrationCount: number } {
  return {
    connected: isConnected,
    newTokenCount: newTokens.length,
    migrationCount: migrations.length,
  };
}
