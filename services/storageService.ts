
import { HistoryItem, PendingFile, UserProfile, MentorshipRelation, InviteCode, SystemSettings, GlobalStats } from "../types";

const DB_NAME = 'HunterMatchPRO_v2'; // Bump version for safety
const DB_VERSION = 8; 
const STORES = {
  HISTORY: 'history',
  PROFILE: 'profile',
  FILES: 'pendingFiles',
  USERS: 'users',
  RELATIONS: 'mentorship_relations',
  INVITES: 'invite_codes',
  SETTINGS: 'system_settings',
  AUDIT_LOGS: 'audit_logs'
};

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  uid: string;
  action: string;
  tokensUsed: number;
  costEstimate: number;
  status: 'SUCCESS' | 'ERROR';
  details?: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
  geminiBaseRate: 0.15,
  infrastructureMonthly: 15.00,
  targetProfitMargin: 0.50,
  supportBufferRate: 10.00
};

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      Object.values(STORES).forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          let options: IDBObjectStoreParameters | undefined;
          if (storeName === STORES.USERS) options = { keyPath: 'uid' };
          else if ([STORES.HISTORY, STORES.AUDIT_LOGS, STORES.RELATIONS, STORES.INVITES].includes(storeName)) {
            options = { keyPath: 'id' };
          }
          db.createObjectStore(storeName, options);
        }
      });

      if (db.objectStoreNames.contains(STORES.HISTORY)) {
        const hStore = request.transaction!.objectStore(STORES.HISTORY);
        if (!hStore.indexNames.contains('by_client')) {
          hStore.createIndex('by_client', 'clientId');
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const storage = {
  // Tenant Isolation Logic: Ensure cross-user data is only accessed via relations
  async validateAccess(uid: string, targetClientId: string): Promise<boolean> {
    if (uid === targetClientId) return true;
    const relations = await this.getAllRelations(uid);
    return relations.some(r => r.clientId === targetClientId);
  },

  async syncToCloud(): Promise<boolean> {
    return new Promise(resolve => setTimeout(() => resolve(true), 500));
  },

  async migrateLegacyData(): Promise<void> {
    return Promise.resolve();
  },

  async putHistoryItem(item: HistoryItem): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORES.HISTORY, 'readwrite');
    tx.objectStore(STORES.HISTORY).put(item);
    return new Promise((resolve) => tx.oncomplete = () => resolve());
  },

  async getHistoryByClient(clientId: string): Promise<HistoryItem[]> {
    const db = await openDB();
    const tx = db.transaction(STORES.HISTORY, 'readonly');
    const store = tx.objectStore(STORES.HISTORY);
    const index = store.index('by_client');
    const request = index.getAll(clientId);
    return new Promise((resolve) => request.onsuccess = () => resolve(request.result || []));
  },

  async getAllHistory(): Promise<HistoryItem[]> {
    const db = await openDB();
    const tx = db.transaction(STORES.HISTORY, 'readonly');
    const request = tx.objectStore(STORES.HISTORY).getAll();
    return new Promise((resolve) => request.onsuccess = () => resolve(request.result || []));
  },

  async saveCurrentUser(user: UserProfile): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORES.USERS, 'readwrite');
    tx.objectStore(STORES.USERS).put(user);
    localStorage.setItem('hunter_match_role', user.role); 
    return new Promise((resolve) => tx.oncomplete = () => resolve());
  },

  async addAuditLog(log: AuditLogEntry): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORES.AUDIT_LOGS, 'readwrite');
    tx.objectStore(STORES.AUDIT_LOGS).put(log);
    return new Promise((resolve) => tx.oncomplete = () => resolve());
  },

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    const db = await openDB();
    const tx = db.transaction(STORES.AUDIT_LOGS, 'readonly');
    const request = tx.objectStore(STORES.AUDIT_LOGS).getAll();
    return new Promise((resolve) => request.onsuccess = () => resolve(request.result || []));
  },

  async getUser(uid: string): Promise<UserProfile | null> {
    const db = await openDB();
    const tx = db.transaction(STORES.USERS, 'readonly');
    const request = tx.objectStore(STORES.USERS).get(uid);
    return new Promise((resolve) => request.onsuccess = () => resolve(request.result || null));
  },

  async getGlobalStats(): Promise<GlobalStats> {
    const db = await openDB();
    const [h, u, r] = await Promise.all([
      this.getAllHistory(),
      new Promise<UserProfile[]>(res => {
        const tx = db.transaction(STORES.USERS, 'readonly');
        const req = tx.objectStore(STORES.USERS).getAll();
        req.onsuccess = () => res(req.result || []);
      }),
      new Promise<MentorshipRelation[]>(res => {
        const tx = db.transaction(STORES.RELATIONS, 'readonly');
        const req = tx.objectStore(STORES.RELATIONS).getAll();
        req.onsuccess = () => res(req.result || []);
      })
    ]);

    return {
      totalUsers: u.length,
      totalHunters: u.filter(x => x.role === 'HUNTER').length,
      totalClients: u.filter(x => x.role === 'CLIENT').length,
      totalAudits: h.length,
      totalMentorships: r.length
    };
  },

  async saveSettings(settings: SystemSettings): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORES.SETTINGS, 'readwrite');
    tx.objectStore(STORES.SETTINGS).put(settings, 'config');
    return new Promise((resolve) => tx.oncomplete = () => resolve());
  },

  async getSettings(): Promise<SystemSettings> {
    const db = await openDB();
    const tx = db.transaction(STORES.SETTINGS, 'readonly');
    const request = tx.objectStore(STORES.SETTINGS).get('config');
    return new Promise((resolve) => request.onsuccess = () => resolve(request.result || DEFAULT_SETTINGS));
  },

  async saveProfile(content: string, uid: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORES.PROFILE, 'readwrite');
    tx.objectStore(STORES.PROFILE).put(content, `profile_${uid}`);
    return new Promise((resolve) => tx.oncomplete = () => resolve());
  },

  async getProfile(uid: string): Promise<string | null> {
    const db = await openDB();
    const tx = db.transaction(STORES.PROFILE, 'readonly');
    const request = tx.objectStore(STORES.PROFILE).get(`profile_${uid}`);
    return new Promise((resolve) => request.onsuccess = () => resolve(request.result || null));
  },

  async savePendingFiles(files: PendingFile[], uid: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORES.FILES, 'readwrite');
    tx.objectStore(STORES.FILES).put(files, `files_${uid}`);
    return new Promise((resolve) => tx.oncomplete = () => resolve());
  },

  async getPendingFiles(uid: string): Promise<PendingFile[]> {
    const db = await openDB();
    const tx = db.transaction(STORES.FILES, 'readonly');
    const request = tx.objectStore(STORES.FILES).get(`files_${uid}`);
    return new Promise((resolve) => request.onsuccess = () => resolve(request.result || []));
  },

  async getAllRelations(mentorId: string): Promise<MentorshipRelation[]> {
    const db = await openDB();
    const tx = db.transaction(STORES.RELATIONS, 'readonly');
    const request = tx.objectStore(STORES.RELATIONS).getAll();
    return new Promise((resolve) => request.onsuccess = () => {
      const all = request.result || [];
      resolve(all.filter((r: MentorshipRelation) => r.mentorId === mentorId));
    });
  },

  async saveRelation(relation: MentorshipRelation): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORES.RELATIONS, 'readwrite');
    tx.objectStore(STORES.RELATIONS).put(relation);
    return new Promise((resolve) => tx.oncomplete = () => resolve());
  }
};
