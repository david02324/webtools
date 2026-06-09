// 페이지 사이로 이미지 한 장을 넘기는 일회용 보관소.
// 분석기(홈)에서 "WebP로 변환"을 누르면, 그 파일을 여기에 담고 변환기 페이지로
// 이동한다. 변환기 페이지는 진입 시 한 번 꺼내 자동 변환하고 즉시 비운다.
//
// Blob 을 그대로 넘겨야 하므로 sessionStorage(문자열) 대신 IndexedDB 를 쓴다.
// 변환 히스토리(store.ts)와 섞이지 않도록 별도 DB 를 둔다.

const DB_NAME = 'webtools-handoff';
const STORE = 'pending';
const KEY = 'image';
const VERSION = 1;

// 너무 오래된(다른 세션에서 남은) 인계분은 자동 변환하지 않는다.
const MAX_AGE_MS = 2 * 60 * 1000;

interface HandoffRecord {
  key: string;
  name: string;
  type: string;
  blob: Blob;
  createdAt: number;
}

export interface PendingImage {
  name: string;
  type: string;
  blob: Blob;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** 변환할 이미지를 인계 보관소에 담는다(이전 것은 덮어쓴다). */
export async function setPending(file: File, createdAt: number): Promise<void> {
  const db = await openDB();
  const rec: HandoffRecord = {
    key: KEY,
    name: file.name,
    type: file.type,
    blob: file,
    createdAt,
  };
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(rec);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * 인계분을 꺼내 즉시 비운다(일회용). 없거나 너무 오래됐으면 null.
 * @param now 현재 시각(ms). 만료 판정에 쓴다.
 */
export async function takePending(now: number): Promise<PendingImage | null> {
  const db = await openDB();
  const rec = await new Promise<HandoffRecord | undefined>((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result as HandoffRecord | undefined);
    req.onerror = () => reject(req.error);
  });

  // 읽었으면 일단 비운다(성공/만료 무관하게 일회용).
  if (rec) {
    await new Promise<void>((resolve) => {
      const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  }

  if (!rec || now - rec.createdAt > MAX_AGE_MS) return null;
  return { name: rec.name, type: rec.type, blob: rec.blob };
}
