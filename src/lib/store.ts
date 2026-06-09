// 변환 결과를 브라우저에 영구 저장한다. Blob(이진)을 그대로 담아야 하므로
// localStorage(문자열·5MB 한계) 대신 IndexedDB 를 쓴다.
// 포맷별로 구분해 저장하므로 /to-webp 와 /to-avif 의 히스토리는 서로 섞이지 않는다.

const DB_NAME = 'webtools';
const STORE = 'images';
const VERSION = 1;

export interface StoredImage {
  id?: number; // autoIncrement — add 후 채워진다
  format: string; // 'webp' | 'avif'
  name: string;
  blob: Blob;
  width: number;
  height: number;
  origSize: number;
  saved: number;
  quality: number;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        os.createIndex('format', 'format', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function store(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

/** 이미지 한 장을 저장하고 부여된 id 를 돌려준다. */
export async function addImage(rec: StoredImage): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = store(db, 'readwrite').add(rec);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

/** 해당 포맷의 저장 이미지를 모두 가져온다. */
export async function getImages(format: string): Promise<StoredImage[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = store(db, 'readonly').index('format').getAll(format);
    req.onsuccess = () => resolve(req.result as StoredImage[]);
    req.onerror = () => reject(req.error);
  });
}

/** id 로 한 장 삭제. */
export async function deleteImage(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = store(db, 'readwrite').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** 해당 포맷의 저장 이미지를 모두 삭제. */
export async function clearImages(format: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const os = store(db, 'readwrite');
    const req = os.index('format').openKeyCursor(IDBKeyRange.only(format));
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) {
        os.delete(cur.primaryKey);
        cur.continue();
      } else {
        resolve();
      }
    };
    req.onerror = () => reject(req.error);
  });
}
