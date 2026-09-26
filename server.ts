import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { recoverMessageAddress, type Hex } from 'viem';
import {createRealmService} from './server/realm-service';
import { hasActiveReservation, invalidateTransferredReservation, makeRegistryMessage, matchesChallenge, reservationConflicts } from './src/config/registryModel.js';

const currentDir = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4190;

// Before the legacy JSON/CORS middleware: the simulation uses same-origin requests.
const realmService=createRealmService();
app.use(realmService.handle);

app.use(express.json({ limit: '10kb' }));

// CORS headers for local/staging integration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Provisional visual classes, not traits in Genesis Key NFT metadata.
const TIER_STATS: Record<
  string,
  {
    label: string;
    rarity: string;
    color: string;
    badge: string;
    modelUrl: string;
  }
> = {
  STANDARD: {
    label: 'Standard Core',
    rarity: 'Common',
    color: '#71717a',
    badge: 'PROVISIONAL APP CLASS · STANDARD',
    modelUrl: '/models/01_Quantum_Core_Standard.glb',
  },
  OVERCLOCKED: {
    label: 'Overclocked Core',
    rarity: 'Rare',
    color: '#a855f7',
    badge: 'PROVISIONAL APP CLASS · OVERCLOCKED',
    modelUrl: '/models/02_Quantum_Core_Overclocked.glb',
  },
  QUANTUM: {
    label: 'Quantum Core',
    rarity: 'Epic',
    color: '#06b6d4',
    badge: 'PROVISIONAL APP CLASS · QUANTUM',
    modelUrl: '/models/03_Quantum_Core_Quantum.glb',
  },
  CELESTIAL: {
    label: 'Celestial Core',
    rarity: 'Legendary',
    color: '#bdfe0a',
    badge: 'PROVISIONAL APP CLASS · CELESTIAL',
    modelUrl: '/models/04_Quantum_Core_Celestial.glb',
  },
};

const HIERARCHICAL_FUSION_TABLE: Record<
  string,
  {
    targetTier: string;
    successRate: number;
    failureRate: number;
  } | null
> = {
  STANDARD: {
    targetTier: 'OVERCLOCKED',
    successRate: 70,
    failureRate: 30,
  },
  OVERCLOCKED: {
    targetTier: 'QUANTUM',
    successRate: 45,
    failureRate: 55,
  },
  QUANTUM: {
    targetTier: 'CELESTIAL',
    successRate: 20,
    failureRate: 80,
  },
  CELESTIAL: null,
};

const CONTRACT_ADDRESS = '0xBCf2cD12D1D37578fA7C69805fE77788e866BE1a'.toLowerCase();
const SALT = 'kryvora_genesis_core_salt_2026';
const ARBITRUM_RPC = process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc';
const REGISTRY_PATH = process.env.NODE_REGISTRY_FILE || path.join(currentDir, 'data', 'node-registry.json');
const RESERVE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
type Reservation = { tokenId: string; owner: string; createdAt: string; expiresAt: string; status: 'reserved' | 'invalidated'; invalidatedAt?: string };
type Registry = { reservations: Record<string, Reservation>; usedNonces: Record<string, number> };
const challenges = new Map<string, { wallet: string; tokenId: string; nonce: string; expiresAt: number; action: 'reserve' | 'release' }>();
const challengeRate = new Map<string, { count: number; resetAt: number }>();
let registry: Registry = { reservations: {}, usedNonces: {} };
try { registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
function saveRegistry(candidate: Registry) {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  const temp = `${REGISTRY_PATH}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temp, JSON.stringify(candidate, null, 2), { mode: 0o600 });
    fs.renameSync(temp, REGISTRY_PATH);
    registry = candidate;
  } catch (error) {
    try { fs.unlinkSync(temp); } catch { /* temp file may not have been created */ }
    throw error;
  }
}

async function rpc(method: string, params: unknown[]) {
  const response = await fetch(ARBITRUM_RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(8000) });
  const body = await response.json() as { result?: any; error?: { message: string } };
  if (!response.ok || body.error) throw new Error(body.error?.message || `Arbitrum RPC ${response.status}`);
  return body.result;
}
async function ownerOf(tokenId: string): Promise<string> {
  const data = `0x6352211e${BigInt(tokenId).toString(16).padStart(64, '0')}`;
  const result = await rpc('eth_call', [{ to: CONTRACT_ADDRESS, data }, 'latest']) as string;
  if (!result || result === '0x' || /^0x0+$/.test(result)) throw new Error(`Token ${tokenId} does not exist`);
  return `0x${result.slice(-40)}`.toLowerCase();
}
async function discoverTokenIds(wallet: string): Promise<string[]> {
  const normalized = wallet.toLowerCase();
  // Blockscout indexes NFT instances by current holder. Pagination is bounded;
  // every returned candidate is separately verified with ownerOf(latest).
  const indexer = (process.env.GENESIS_INDEXER_URL || 'https://arbitrum.blockscout.com/api/v2/tokens').replace(/\/$/, '');
  let url: string | null = `${indexer}/${CONTRACT_ADDRESS}/instances?holder_address_hash=${normalized}`;
  const ids = new Set<string>();
  for (let page = 0; url && page < 20; page++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Genesis Key indexer failed (${response.status})`);
    const body = await response.json() as { items?: Array<{ id?: string; token_id?: string }>; next_page_params?: Record<string, string> | null };
    for (const item of body.items || []) {
      const raw = item.token_id || item.id?.split('_').pop();
      if (raw && /^\d+$/.test(raw)) ids.add(BigInt(raw).toString());
    }
    const params = body.next_page_params;
    if (!params) { url = null; continue; }
    if (ids.size >= 1000) throw new Error('Genesis Key holder page exceeded the 1,000-token safety bound');
    const query = new URLSearchParams({ holder_address_hash: normalized });
    Object.entries(params).forEach(([key, value]) => query.set(key, value));
    url = `${indexer}/${CONTRACT_ADDRESS}/instances?${query}`;
  }
  if (url) throw new Error('Genesis Key holder page exceeded the 20-page safety bound');
  return [...ids];
}
// Provisional display grouping only. Genesis NFT metadata does not expose these tiers.
function calculateDeterministicTrait(tokenId: number) {
  const hash = crypto.createHash('sha256').update(String(tokenId) + ':' + CONTRACT_ADDRESS + ':' + SALT).digest('hex');
  const roll = (parseInt(hash.substring(0, 8), 16) % 100) + 1;

  let tier = 'STANDARD';
  if (roll > 97) {
    tier = 'CELESTIAL';
  } else if (roll > 85) {
    tier = 'QUANTUM';
  } else if (roll > 60) {
    tier = 'OVERCLOCKED';
  } else {
    tier = 'STANDARD';
  }

  const stats = TIER_STATS[tier];
  return {
    tier,
    roll,
    label: stats.label,
    rarity: stats.rarity,
    color: stats.color,
    badge: stats.badge,
    modelUrl: stats.modelUrl,
  };
}

// 1. Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    service: 'kryvora-verifier-collider-engine',
    version: '2.1.0',
    network: 'Arbitrum One (Chain ID 42161)',
    genesisContract: CONTRACT_ADDRESS,
    timestamp: new Date().toISOString(),
  });
});

// 2. Fetch tier specs
app.get('/api/fusion/tiers', (req: Request, res: Response) => {
  res.json({
    tiers: TIER_STATS,
    hierarchy: HIERARCHICAL_FUSION_TABLE,
    mode: 'illustrative-only',
    executionEnabled: false,
    tierSource: 'Provisional app class; Genesis Key NFT metadata tier is Genesis.',
  });
});

// 3. Fusion estimate / preview endpoint
app.post('/api/fusion/estimate', (req: Request, res: Response) => {
  const { tierA = 'STANDARD', tierB = 'STANDARD' } = req.body;

  const cleanTierA = (tierA as string).toUpperCase();
  const cleanTierB = (tierB as string).toUpperCase();

  if (!TIER_STATS[cleanTierA] || !TIER_STATS[cleanTierB]) {
    return res.status(400).json({
      canPreview: false,
      executionEnabled: false,
      error: 'Invalid core tier specified.',
    });
  }

  if (cleanTierA === 'CELESTIAL' || cleanTierB === 'CELESTIAL') {
    return res.json({
      canPreview: false,
      executionEnabled: false,
      reason: 'The illustrative class has no next preview tier.',
      targetTier: 'CELESTIAL',
      successRate: 0,
      failureRate: 100,
    });
  }

  if (cleanTierA !== cleanTierB) {
    return res.json({
      canPreview: false,
      executionEnabled: false,
      reason: `Pairing preview requires matching provisional classes.`,
      targetTier: cleanTierA,
      successRate: 0,
      failureRate: 100,
    });
  }

  const rule = HIERARCHICAL_FUSION_TABLE[cleanTierA];
  if (!rule) {
    return res.json({
      canPreview: false,
      executionEnabled: false,
      reason: 'The illustrative class has no next preview tier.',
    });
  }

  res.json({
    canPreview: true,
    executionEnabled: false,
    mode: 'illustrative-only',
    sourceTier: cleanTierA,
    targetTier: rule.targetTier,
    successRate: rule.successRate,
    failureRate: rule.failureRate,
  });
});

// 4. Fusion execution endpoint (Atomic Collider Resolution)
app.post('/api/fusion/execute', (req: Request, res: Response) => {
  return res.status(410).json({ error: 'Fusion execution is not active. The on-chain Fusion Vault is pending audit and deployment; no keys can be consumed here.' });
});

// 5. Registry challenge and wallet-signed per-token reserve
app.get('/api/registry/challenge', (req: Request, res: Response) => {
  const wallet = String(req.query.wallet || '').toLowerCase();
  const tokenId = String(req.query.tokenId || '');
  const action = req.query.action === 'release' ? 'release' : 'reserve';
  if (!/^0x[a-f0-9]{40}$/.test(wallet) || !/^\d+$/.test(tokenId)) return res.status(400).json({ error: 'Valid wallet and tokenId are required' });
  const now = Date.now();
  for (const [key, value] of challenges) if (value.expiresAt <= now) challenges.delete(key);
  for (const [key, value] of challengeRate) if (value.resetAt <= now) challengeRate.delete(key);
  if (challenges.size >= 10000) return res.status(429).json({ error: 'Challenge capacity reached; retry shortly' });
  const caller = req.socket.remoteAddress || 'unknown';
  const rate = challengeRate.get(caller);
  if (rate && rate.resetAt > now && rate.count >= 30) return res.status(429).json({ error: 'Too many signature challenges; retry in one minute' });
  if (!rate || rate.resetAt <= now) challengeRate.set(caller, { count: 1, resetAt: now + 60_000 });
  else rate.count += 1;
  const nonce = crypto.randomBytes(24).toString('hex');
  const expiresAt = now + 5 * 60_000;
  challenges.set(nonce, { wallet, tokenId: BigInt(tokenId).toString(), nonce, expiresAt, action });
  res.json({ nonce, expiresAt, message: makeRegistryMessage({ wallet, tokenId, nonce, expiresAt, contract: CONTRACT_ADDRESS, action }) });
});

app.post('/api/registry/reserve', async (req: Request, res: Response) => {
  const { wallet, tokenId, nonce, expiresAt, signature } = req.body || {};
  if (typeof wallet !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(wallet) || !/^\d+$/.test(String(tokenId)) || typeof nonce !== 'string' || typeof signature !== 'string' || !Number.isSafeInteger(expiresAt)) return res.status(400).json({ error: 'Invalid reserve request' });
  const normalizedWallet = wallet.toLowerCase();
  const challenge = challenges.get(nonce);
  if (!matchesChallenge(challenge, { wallet: normalizedWallet, tokenId, expiresAt }, Date.now(), Boolean(registry.usedNonces[nonce]))) return res.status(401).json({ error: 'Reserve signature expired or already used. Request a new signature.' });
  const message = makeRegistryMessage({ wallet: normalizedWallet, tokenId: challenge.tokenId, nonce, expiresAt, contract: CONTRACT_ADDRESS, action: challenge.action });
  let signer: string;
  try { signer = (await recoverMessageAddress({ message, signature: signature as Hex })).toLowerCase(); }
  catch { return res.status(401).json({ error: 'Invalid wallet signature' }); }
  if (signer !== normalizedWallet) return res.status(401).json({ error: 'Signature wallet does not match request' });
  let currentOwner: string;
  try { currentOwner = await ownerOf(challenge.tokenId); }
  catch (error) { return res.status(503).json({ error: `Could not verify current Arbitrum ownership: ${(error as Error).message}` }); }
  if (currentOwner !== normalizedWallet) return res.status(403).json({ error: 'Wallet is not the current on-chain owner of this Genesis Key' });
  try {
    const candidate: Registry = {
      reservations: Object.fromEntries(Object.entries(registry.reservations).map(([id, reservation]) => [id, { ...reservation }])),
      usedNonces: { ...registry.usedNonces },
    };
    const existing = candidate.reservations[challenge.tokenId];
    if (challenge.action === 'release') {
      if (!existing || existing.owner !== normalizedWallet || existing.status !== 'reserved') return res.status(409).json({ error: 'No active reservation owned by this wallet' });
      existing.status = 'invalidated'; existing.invalidatedAt = new Date().toISOString();
    } else {
      if (hasActiveReservation(existing)) {
        if (reservationConflicts(existing, normalizedWallet)) return res.status(409).json({ error: 'This Genesis Key already has an active Node Unit reservation' });
        existing.status = 'invalidated'; existing.invalidatedAt = new Date().toISOString();
      }
      const createdAt = new Date().toISOString();
      const expires = new Date(Date.now() + RESERVE_TTL_MS).toISOString();
      candidate.reservations[challenge.tokenId] = { tokenId: challenge.tokenId, owner: normalizedWallet, createdAt, expiresAt: expires, status: 'reserved' };
    }
    candidate.usedNonces[nonce] = Date.now();
    saveRegistry(candidate);
    challenges.delete(nonce);
    res.status(challenge.action === 'reserve' ? 201 : 200).json({ reservation: registry.reservations[challenge.tokenId], nodeUnits: 1, quotaPreviewKrv: 60000, message: challenge.action === 'reserve' ? 'Reserved in registry only; no NFT transfer or fusion occurred.' : 'Reservation released; the Key remains in your wallet.' });
  } catch (error) {
    res.status(500).json({ error: `Could not save registry update: ${(error as Error).message}` });
  }
});

app.get('/api/registry/:wallet', async (req: Request, res: Response) => {
  const wallet = String(req.params.wallet).toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(wallet)) return res.status(400).json({ error: 'Invalid Ethereum address' });
  const persistedReservations = Object.values(registry.reservations).filter((r) => r.owner === wallet && hasActiveReservation(r));
  const reservations = persistedReservations.map((reservation) => ({ ...reservation }));
  const validated = [];
  for (const reservation of reservations) {
    try {
      const currentOwner = await ownerOf(reservation.tokenId);
      if (currentOwner === wallet) validated.push(reservation);
      else invalidateTransferredReservation(reservation, currentOwner);
    } catch (error) {
      if ((error as Error).message.includes('execution reverted')) { reservation.status = 'invalidated'; reservation.invalidatedAt = new Date().toISOString(); }
      else return res.status(503).json({ error: 'Ownership validation is temporarily unavailable; registry status is not confirmed.' });
    }
  }
  if (reservations.some((reservation, index) => reservation.status !== persistedReservations[index]?.status)) {
    const nextReservations = { ...registry.reservations };
    reservations.forEach((reservation) => { nextReservations[reservation.tokenId] = reservation; });
    try { saveRegistry({ ...registry, reservations: nextReservations }); }
    catch { return res.status(503).json({ error: 'Ownership changed, but the invalidation could not be saved. Registry status is not confirmed.' }); }
  }
  res.json({ wallet, reservations: validated, reservedNodeUnits: validated.length, quotaPreviewKrv: validated.length * 60000, quotaLabel: 'preview only; governed by Node Pool policy' });
});

// 6. Query indexed transfer history then confirm every candidate via ownerOf(latest).
app.get('/api/wallet/:address/keys', async (req: Request, res: Response) => {
  const { address } = req.params;
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid Ethereum address' });
  }

  try {
    const tokenIds = await discoverTokenIds(address);
    const owned: string[] = [];
    for (const tokenId of tokenIds) {
      try { if (await ownerOf(tokenId) === address.toLowerCase()) owned.push(tokenId); }
      catch (error) { if (!(error as Error).message.includes('execution reverted')) throw error; }
    }
    const keys = owned.map((tokenId) => {
      const numericId = Number(tokenId);
      const trait = calculateDeterministicTrait(numericId);
      return {
        id: `onchain-key-${tokenId}`,
        tokenId,
        serialNumber: `Key #${tokenId}`,
        tier: trait.tier,
        badge: `PROVISIONAL APP CLASS · ${trait.tier}`,
        isTest: false,
      };
    });

    res.json({
      address: address.toLowerCase(),
      count: keys.length,
      keys,
    });
  } catch (err: unknown) {
    const errorMsg = (err as Error)?.message || 'Failed to index and verify current Genesis Key ownership';
    res.status(500).json({ error: errorMsg, keys: [] });
  }
});

// Serve frontend build artifacts
const distPath = fs.existsSync(path.join(currentDir, 'dist'))
  ? path.join(currentDir, 'dist')
  : currentDir;
app.use(express.static(distPath));

// Fallback to SPA index.html
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Kryvora Genesis Fusion] Verifier Collider API & WebApp running at http://0.0.0.0:${PORT}`);
});
