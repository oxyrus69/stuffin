/**
 * Offline queue for error archives — IndexedDB based.
 * When offline, archive files are stored locally and synced when back online.
 */
const DB_NAME = 'hope-offline';
const DB_VERSION = 1;
const STORE = 'pending_archives';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function fileToBase64(file) {
  const buf = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function queuePendingArchive(files, page, errorMessage, errorStack) {
  try {
    const db = await openDB();
    const archiveGroup = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const entry = {
      archiveGroup,
      page,
      errorMessage: errorMessage || '',
      errorStack: errorStack || '',
      createdAt: new Date().toISOString(),
      files: await Promise.all(files.filter(Boolean).map(async (f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
        base64: await fileToBase64(f),
      }))),
    };
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).add(entry);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    return { queued: true, archiveGroup };
  } catch (e) {
    console.error('[offlineQueue] queue failed', e);
    return { queued: false };
  }
}

export async function getPendingCount() {
  try {
    const db = await openDB();
    return await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).count();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  } catch { return 0; }
}

export async function syncPendingArchives() {
  if (!navigator.onLine) return { synced: 0 };
  try {
    const db = await openDB();
    const all = await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    if (!all.length) return { synced: 0 };
    let synced = 0;
    for (const entry of all) {
      try {
        const fd = new FormData();
        fd.append('archive_group', entry.archiveGroup);
        fd.append('page', entry.page);
        fd.append('error_message', entry.errorMessage);
        fd.append('error_stack', entry.errorStack);
        for (const f of entry.files) {
          const binary = atob(f.base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: f.type || 'application/octet-stream' });
          const file = new File([blob], f.name, { type: f.type });
          fd.append('files', file);
        }
        const res = await fetch('/api/error-archive', { method: 'POST', body: fd });
        if (res.ok) {
          await new Promise((res2, rej2) => {
            const tx2 = db.transaction(STORE, 'readwrite');
            tx2.objectStore(STORE).delete(entry.id);
            tx2.oncomplete = res2;
            tx2.onerror = () => rej2(tx2.error);
          });
          synced++;
        }
      } catch (e) {
        console.warn('[offlineQueue] sync one failed', e);
      }
    }
    return { synced, total: all.length };
  } catch (e) {
    console.error('[offlineQueue] sync failed', e);
    return { synced: 0 };
  }
}

export async function clearPendingArchives() {
  const db = await openDB();
  await new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}