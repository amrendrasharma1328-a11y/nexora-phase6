import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createWorkspaceStore, isWorkspaceId, StoreError } from '../src/store/workspaceStore.js';

describe('workspace store (file mode)', () => {
  let dir;
  beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), 'nexora-store-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('creates unguessable ids and persists data across store instances', async () => {
    const a = createWorkspaceStore({ dir });
    const w = await a.create({ label: 'Amrendra' });
    expect(isWorkspaceId(w.id)).toBe(true);
    await a.update(w.id, (d) => { d.savedRoutes.push({ id: 'sr_1' }); });

    const b = createWorkspaceStore({ dir }); // simulates a server restart
    const kept = await b.read(w.id, (d) => ({ label: d.label, saved: d.savedRoutes.length }));
    expect(kept).toEqual({ label: 'Amrendra', saved: 1 });
  });

  it('writes atomically: no temp files left behind', async () => {
    const s = createWorkspaceStore({ dir });
    const w = await s.create();
    await Promise.all(Array.from({ length: 20 }, (_, i) => s.update(w.id, (d) => { d.history.push({ i }); })));
    const files = await readdir(dir);
    expect(files).toEqual([`${w.id}.json`]);
    const onDisk = JSON.parse(await readFile(path.join(dir, files[0]), 'utf8'));
    expect(onDisk.history).toHaveLength(20);
  });

  it('serialises concurrent updates (no lost writes, order preserved)', async () => {
    const s = createWorkspaceStore({ dir: null });
    const w = await s.create();
    await Promise.all(Array.from({ length: 50 }, (_, i) => s.update(w.id, (d) => { d.history.push(i); })));
    const h = await s.read(w.id, (d) => d.history);
    expect(h).toEqual(Array.from({ length: 50 }, (_, i) => i));
  });

  it('leaves the workspace untouched when the mutator throws', async () => {
    const s = createWorkspaceStore({ dir });
    const w = await s.create();
    await expect(s.update(w.id, (d) => { d.savedRoutes.push({ id: 'x' }); throw new Error('boom'); })).rejects.toThrow('boom');
    expect(await s.read(w.id, (d) => d.savedRoutes.length)).toBe(0);
    const s2 = createWorkspaceStore({ dir });
    expect(await s2.read(w.id, (d) => d.savedRoutes.length)).toBe(0);
  });

  it('rejects malformed ids, including path traversal attempts', async () => {
    const s = createWorkspaceStore({ dir });
    for (const bad of ['../etc/passwd', 'ws_../../x', 'ws_123', '', null, undefined, 42]) {
      expect(await s.exists(bad)).toBe(false);
      expect(await s.read(bad, () => 1)).toBeNull();
      expect(await s.update(bad, () => 1)).toBeNull();
      expect(await s.remove(bad)).toBe(false);
    }
  });

  it('remove deletes the file and later reads return null', async () => {
    const s = createWorkspaceStore({ dir });
    const w = await s.create();
    expect(await s.remove(w.id)).toBe(true);
    expect(await readdir(dir)).toEqual([]);
    expect(await s.exists(w.id)).toBe(false);
    expect(await s.remove(w.id)).toBe(false);
  });

  it('moves a corrupt file aside instead of crashing or deleting it', async () => {
    const warnings = [];
    const s = createWorkspaceStore({ dir, logger: { warn: (m) => warnings.push(m) } });
    const w = await s.create();
    await writeFile(path.join(dir, `${w.id}.json`), '{not json', 'utf8');
    const fresh = createWorkspaceStore({ dir, logger: { warn: (m) => warnings.push(m) } });
    expect(await fresh.exists(w.id)).toBe(false);
    expect(warnings).toHaveLength(1);
    expect((await readdir(dir)).some((f) => f.includes('.corrupt-'))).toBe(true);
  });

  it('refuses to create workspaces beyond the capacity', async () => {
    const s = createWorkspaceStore({ dir, maxWorkspaces: 2 });
    await s.create(); await s.create();
    await expect(s.create()).rejects.toBeInstanceOf(StoreError);
  });
});
