import { applyCommand } from '../domain/commands';
import type { CommandEnvelope, CommandResult } from '../domain/commands/types';
import { DomainError } from '../domain/errors';
import type { DomainState, Id, IsoInstant, RoleId } from '../domain/types';
import { createSeedState } from '../seed/seed';

const DB_NAME = 'domaine-erp-demo';
const DB_VERSION = 1;
const STORE_STATE = 'state';
const STORE_JOURNAL = 'journal';

export interface JournalEntry {
  id: Id;
  idempotencyKey: string;
  occurredAt: IsoInstant;
  actor: RoleId;
  command: CommandEnvelope['command'];
  result: CommandResult;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_STATE)) {
        db.createObjectStore(STORE_STATE);
      }
      if (!db.objectStoreNames.contains(STORE_JOURNAL)) {
        const jStore = db.createObjectStore(STORE_JOURNAL, { keyPath: 'id' });
        jStore.createIndex('by_idempotency', 'idempotencyKey', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class DomaineDbAdapter {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDb();
    }
    return this.dbPromise;
  }

  async loadOrCreateState(): Promise<DomainState> {
    const db = await this.getDb();
    const tx = db.transaction([STORE_STATE], 'readonly');
    const store = tx.objectStore(STORE_STATE);
    const existing = await reqToPromise<DomainState | undefined>(store.get('current'));
    if (existing) {
      return existing;
    }

    // Seed state if not exists
    const seed = createSeedState();
    await this.saveInitialState(seed);
    return seed;
  }

  private async saveInitialState(state: DomainState): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction([STORE_STATE], 'readwrite');
    const store = tx.objectStore(STORE_STATE);
    store.put(state, 'current');
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async executeCommand(
    envelope: CommandEnvelope,
    clockIso: IsoInstant
  ): Promise<{ state: DomainState; result: CommandResult; duplicate: boolean }> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_STATE, STORE_JOURNAL], 'readwrite');
      const stateStore = tx.objectStore(STORE_STATE);
      const journalStore = tx.objectStore(STORE_JOURNAL);
      const idempotencyIndex = journalStore.index('by_idempotency');

      // Check idempotency first
      const idempReq = idempotencyIndex.getAll(envelope.idempotencyKey);
      idempReq.onsuccess = () => {
        const matches: JournalEntry[] = idempReq.result || [];
        const stateReq = stateStore.get('current');

        stateReq.onsuccess = () => {
          const currentState: DomainState = stateReq.result || createSeedState();

          if (matches.length > 0) {
            const previous = matches[0]!;
            // Check if exact same payload
            if (JSON.stringify(previous.command) === JSON.stringify(envelope.command)) {
              // Idempotent duplicate: return saved result without executing again
              resolve({
                state: currentState,
                result: previous.result,
                duplicate: true,
              });
              return;
            } else {
              reject(
                new DomainError(
                  'idempotency_conflict',
                  `Clé d'idempotence '${envelope.idempotencyKey}' déjà utilisée pour une commande différente.`
                )
              );
              return;
            }
          }

          // Apply pure domain command
          try {
            const { state: newState, result } = applyCommand(
              currentState,
              envelope.command,
              { now: clockIso, actor: envelope.actor }
            );

            // Record journal entry
            const journalEntry: JournalEntry = {
              id: `jnl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              idempotencyKey: envelope.idempotencyKey,
              occurredAt: clockIso,
              actor: envelope.actor,
              command: envelope.command,
              result,
            };

            stateStore.put(newState, 'current');
            journalStore.add(journalEntry);

            tx.oncomplete = () => {
              resolve({ state: newState, result, duplicate: false });
            };
            tx.onerror = () => {
              reject(tx.error);
            };
          } catch (err) {
            // Abort transaction, leaving state untouched
            tx.abort();
            reject(err);
          }
        };
        stateReq.onerror = () => reject(stateReq.error);
      };
      idempReq.onerror = () => reject(idempReq.error);
    });
  }

  async getJournal(): Promise<JournalEntry[]> {
    const db = await this.getDb();
    const tx = db.transaction([STORE_JOURNAL], 'readonly');
    const store = tx.objectStore(STORE_JOURNAL);
    const req = store.getAll();
    return reqToPromise(req);
  }

  async resetToSeed(): Promise<DomainState> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_STATE, STORE_JOURNAL], 'readwrite');
      const stateStore = tx.objectStore(STORE_STATE);
      const journalStore = tx.objectStore(STORE_JOURNAL);

      stateStore.clear();
      journalStore.clear();

      const seed = createSeedState();
      stateStore.put(seed, 'current');

      tx.oncomplete = () => resolve(seed);
      tx.onerror = () => reject(tx.error);
    });
  }

  async replay(seedState: DomainState): Promise<DomainState> {
    const journal = await this.getJournal();
    // Sort by chronological order
    journal.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

    let state = structuredClone(seedState);
    for (const entry of journal) {
      const { state: next } = applyCommand(state, entry.command, {
        now: entry.occurredAt,
        actor: entry.actor,
      });
      state = next;
    }
    return state;
  }
}

export const localDb = new DomaineDbAdapter();
