import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * Persistent storage for "control sessions" (anonymous workspaces).
 *
 * NEXORA has no user accounts. A workspace is an anonymous container for one browser's saved routes
 * and route history. Its id is an unguessable random token (128 bits) acting as a bearer key.
 * This is NOT authentication: anyone holding the id can read and change that workspace.
 *
 * Storage: one JSON file per workspace (`<dir>/<id>.json`), written atomically (temp file + rename),
 * with a per-workspace queue so concurrent requests never interleave. Pure Node, no native modules.
 * With `dir: null` everything lives in memory (default for tests).
 */

export const WORKSPACE_ID_PATTERN = /^ws_[0-9a-f]{32}$/;
export const isWorkspaceId = (v) => typeof v === 'string' && WORKSPACE_ID_PATTERN.test(v);
export const newWorkspaceId = () => `ws_${randomBytes(16).toString('hex')}`;

export const STORE_VERSION = 1;

export class StoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'StoreError';
    this.code = code;
  }
}

/**
 * @param {{dir?: string|null, maxWorkspaces?: number, logger?: {warn: Function}}} [options]
 */
export function createWorkspaceStore({ dir = null, maxWorkspaces = 5000, logger = console } = {}) {
  const cache = new Map();   // id -> data
  const queues = new Map();  // id -> tail promise (serialises work per workspace)
  let dirReady = null;

  const fileFor = (id) => path.join(dir, `${id}.json`);
  const ensureDir = () => (dirReady ??= fs.mkdir(dir, { recursive: true }));

  function enqueue(id, task) {
    const tail = queues.get(id) ?? Promise.resolve();
    const run = tail.then(task, task);
    const stored = run.catch(() => {});
    queues.set(id, stored);
    stored.then(() => { if (queues.get(id) === stored) queues.delete(id); });
    return run;
  }

  async function load(id) {
    if (!isWorkspaceId(id)) return null;
    if (cache.has(id)) return cache.get(id);
    if (!dir) return null;
    await ensureDir();
    let text;
    try {
      text = await fs.readFile(fileFor(id), 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
    try {
      const data = JSON.parse(text);
      if (data?.id !== id || !Array.isArray(data.savedRoutes) || !Array.isArray(data.history)) throw new Error('unexpected shape');
      cache.set(id, data);
      return data;
    } catch {
      // Keep the unreadable file for inspection instead of silently destroying it.
      logger.warn(`[nexora] workspace file ${id}.json is corrupt; moved aside`);
      await fs.rename(fileFor(id), `${fileFor(id)}.corrupt-${Date.now()}`).catch(() => {});
      return null;
    }
  }

  async function persist(id, data) {
    if (!dir) return;
    await ensureDir();
    const tmp = `${fileFor(id)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
    try {
      await fs.writeFile(tmp, JSON.stringify(data), 'utf8');
      await fs.rename(tmp, fileFor(id));
    } catch (err) {
      await fs.rm(tmp, { force: true }).catch(() => {});
      throw err;
    }
  }

  async function countWorkspaces() {
    if (!dir) return cache.size;
    await ensureDir();
    return (await fs.readdir(dir)).filter((f) => /^ws_[0-9a-f]{32}\.json$/.test(f)).length;
  }

  return {
    /** Create a workspace. Rejects with StoreError CAPACITY when the store is full. */
    async create({ label = '' } = {}) {
      if ((await countWorkspaces()) >= maxWorkspaces) throw new StoreError('CAPACITY', 'The workspace store is full');
      const now = new Date().toISOString();
      const data = { version: STORE_VERSION, id: newWorkspaceId(), label, createdAt: now, lastSeenAt: now, savedRoutes: [], history: [] };
      await enqueue(data.id, async () => { await persist(data.id, data); cache.set(data.id, data); });
      return structuredClone(data);
    },

    async exists(id) {
      if (!isWorkspaceId(id)) return false;
      return enqueue(id, async () => (await load(id)) !== null);
    },

    /**
     * Read-only access. `selector` receives the live object and must not mutate it.
     * @returns {Promise<any|null>} null when the workspace does not exist
     */
    async read(id, selector) {
      if (!isWorkspaceId(id)) return null;
      return enqueue(id, async () => {
        const data = await load(id);
        return data ? selector(data) : null;
      });
    },

    /**
     * Atomic read-modify-write. `mutator` gets a private draft; the change is committed (disk, then cache)
     * only if it returns normally, so a thrown validation error leaves the workspace untouched.
     * @returns {Promise<any|null>} mutator's result (true if it returned nothing), or null when the workspace does not exist
     */
    async update(id, mutator) {
      if (!isWorkspaceId(id)) return null;
      return enqueue(id, async () => {
        const current = await load(id);
        if (!current) return null;
        const draft = structuredClone(current);
        const result = await mutator(draft);
        await persist(id, draft);
        cache.set(id, draft);
        return result === undefined ? true : result;
      });
    },

    /** Delete a workspace and all its data. @returns {Promise<boolean>} true if it existed */
    async remove(id) {
      if (!isWorkspaceId(id)) return false;
      return enqueue(id, async () => {
        const existed = (await load(id)) !== null;
        cache.delete(id);
        if (dir) await fs.rm(fileFor(id), { force: true });
        return existed;
      });
    },
  };
}
