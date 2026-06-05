/**
 * Persistência de arquivos via IndexedDB.
 * Permite salvar File/Blob entre reloads da página.
 */

const DB_NAME    = 'uniko_files';
const STORE_NAME = 'files';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

export async function saveFile(key, file) {
  const buf = await file.arrayBuffer();
  const db  = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ name: file.name, type: file.type, buf }, key);
    tx.oncomplete = () => resolve();
    tx.onerror    = (e) => reject(e.target.error);
  });
}

export async function loadFile(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = (e) => {
      const d = e.target.result;
      if (!d) { resolve(null); return; }
      resolve(new File([d.buf], d.name, { type: d.type }));
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function deleteFile(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror    = (e) => reject(e.target.error);
  });
}
