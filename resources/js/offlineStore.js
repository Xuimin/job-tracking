const DB_NAME = 'job-tracker-v1';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('applications')) {
        db.createObjectStore('applications', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'queueId', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class OfflineError extends Error {
  constructor(message = 'You are offline') {
    super(message);
    this.name = 'OfflineError';
  }
}

export async function withDb(fn) {
  const db = await openDb();
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

export async function getApplications() {
  return withDb(async (db) => {
    const tx = db.transaction('applications', 'readonly');
    return getAll(tx.objectStore('applications'));
  });
}

export async function replaceApplications(items) {
  return withDb(async (db) => {
    const tx = db.transaction('applications', 'readwrite');
    const store = tx.objectStore('applications');
    store.clear();
    for (const item of items) store.put(item);
    await txDone(tx);
  });
}

export async function upsertApplication(item) {
  return withDb(async (db) => {
    const tx = db.transaction('applications', 'readwrite');
    tx.objectStore('applications').put(item);
    await txDone(tx);
  });
}

export async function removeApplication(id) {
  return withDb(async (db) => {
    const tx = db.transaction('applications', 'readwrite');
    tx.objectStore('applications').delete(id);
    await txDone(tx);
  });
}

export async function getApplication(id) {
  return withDb(async (db) => {
    const tx = db.transaction('applications', 'readonly');
    return new Promise((resolve, reject) => {
      const req = tx.objectStore('applications').get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

async function getMeta(db, key) {
  const tx = db.transaction('meta', 'readonly');
  const val = await new Promise((resolve, reject) => {
    const req = tx.objectStore('meta').get(key);
    req.onsuccess = () => resolve(req.result?.value);
    req.onerror = () => reject(req.error);
  });
  return val;
}

async function setMeta(db, key, value) {
  const tx = db.transaction('meta', 'readwrite');
  tx.objectStore('meta').put({ key, value });
  await txDone(tx);
}

export async function getNextLocalId() {
  return withDb(async (db) => {
    const current = (await getMeta(db, 'nextLocalId')) ?? 0;
    const next = current - 1;
    await setMeta(db, 'nextLocalId', next);
    return next;
  });
}

export async function cacheUser(user) {
  return withDb(async (db) => setMeta(db, 'cachedUser', user));
}

export async function getCachedUser() {
  return withDb(async (db) => getMeta(db, 'cachedUser'));
}

export async function clearOfflineData() {
  return withDb(async (db) => {
    for (const name of ['applications', 'queue', 'meta']) {
      const tx = db.transaction(name, 'readwrite');
      tx.objectStore(name).clear();
      await txDone(tx);
    }
  });
}

export async function enqueue(entry) {
  return withDb(async (db) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').add({ ...entry, createdAt: Date.now() });
    await txDone(tx);
  });
}

export async function getQueue() {
  return withDb(async (db) => {
    const tx = db.transaction('queue', 'readonly');
    const items = await getAll(tx.objectStore('queue'));
    return items.sort((a, b) => a.createdAt - b.createdAt);
  });
}

export async function getPendingCount() {
  const q = await getQueue();
  return q.length;
}

async function deleteQueueItem(db, queueId) {
  const tx = db.transaction('queue', 'readwrite');
  tx.objectStore('queue').delete(queueId);
  await txDone(tx);
}

export async function purgeQueueForLocalId(localId) {
  return withDb(async (db) => {
    const tx = db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    const items = await getAll(store);
    for (const item of items) {
      if (item.localId === localId || item.id === localId) {
        store.delete(item.queueId);
      }
    }
    await txDone(tx);
  });
}

/** Replay queued mutations when back online (FIFO). */
export async function flushSyncQueue(apiCall) {
  if (!navigator.onLine) return 0;

  let synced = 0;
  const idMap = new Map();

  await withDb(async (db) => {
    const txRead = db.transaction('queue', 'readonly');
    const queue = (await getAll(txRead.objectStore('queue'))).sort((a, b) => a.createdAt - b.createdAt);

    for (const job of queue) {
      if (job.op === 'create') {
        const created = await apiCall('POST', '', job.body);
        idMap.set(job.localId, created.id);
        const appTx = db.transaction('applications', 'readwrite');
        appTx.objectStore('applications').delete(job.localId);
        appTx.objectStore('applications').put(created);
        await txDone(appTx);
      } else if (job.op === 'update') {
        const serverId = job.id < 0 ? idMap.get(job.id) : job.id;
        if (!serverId || serverId < 0) continue;
        const updated = await apiCall('PUT', `/${serverId}`, job.body);
        const appTx = db.transaction('applications', 'readwrite');
        appTx.objectStore('applications').put(updated);
        await txDone(appTx);
      } else if (job.op === 'delete') {
        const serverId = job.id < 0 ? idMap.get(job.id) : job.id;
        if (serverId && serverId > 0) await apiCall('DELETE', `/${serverId}`);
        const appTx = db.transaction('applications', 'readwrite');
        appTx.objectStore('applications').delete(job.id);
        await txDone(appTx);
      }
      await deleteQueueItem(db, job.queueId);
      synced += 1;
    }
  });

  return synced;
}

export function filterApplications(items, q) {
  const s = q.trim().toLowerCase();
  if (!s) return items;
  return items.filter(
    (i) => i.company.toLowerCase().includes(s) || i.position.toLowerCase().includes(s)
  );
}
