/**
 * IndexedDB utility for persisting uploaded files across browser refreshes.
 * Stores file name, type, size, and ArrayBuffer data.
 */

const DB_NAME = 'stuffing-processor';
const DB_VERSION = 1;
const STORE_NAME = 'uploads';
const FILE_KEYS = ['blc', 'stuffing', 'inspection'];

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Read a File to ArrayBuffer (must complete BEFORE opening IDB transaction)
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Save a File object to IndexedDB
 * Fix: read file to ArrayBuffer first, then open transaction
 */
export async function saveFile(key, file) {
  // Step 1: Read file to ArrayBuffer (async, outside of IDB transaction)
  const arrayBuffer = await readFileAsArrayBuffer(file);

  // Step 2: Open DB, create transaction, and put (all synchronous within transaction)
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    store.put({
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      arrayBuffer,
    }, key);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Remove a file from IndexedDB
 */
export async function removeFile(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Restore a File from IndexedDB (returns null if not found)
 */
export async function restoreFile(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        const data = request.result;
        if (!data) return resolve(null);
        const file = new File([data.arrayBuffer], data.name, {
          type: data.type,
          lastModified: data.lastModified,
        });
        resolve(file);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

/**
 * Restore all saved files at once
 */
export async function restoreAllFiles() {
  const results = {};
  for (const key of FILE_KEYS) {
    results[key] = await restoreFile(key);
  }
  return results;
}

/**
 * Clear all saved files from IndexedDB
 */
export async function clearAllFiles() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
