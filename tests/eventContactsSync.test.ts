import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { handleEventContacts } from '../src/server/eventContactsSync.js';
import { classifyContact, contactData, locationData } from '../src/utils/eventContactsSync.js';

type Stored = Record<string, any>;

class FakeDocumentRef {
  constructor(public db: FakeDb, public collectionName: string, public id: string) {}
}

class FakeCollectionRef {
  constructor(public db: FakeDb, public id: string) {}
  doc(id: string) { return new FakeDocumentRef(this.db, this.id, id); }
}

class FakeDocumentSnapshot {
  exists: boolean;
  createTime = { toDate: () => new Date('2026-09-22T12:00:00.000Z') };
  updateTime = { isEqual: () => true };
  constructor(public ref: FakeDocumentRef, private value?: Stored) { this.exists = value !== undefined; }
  get id() { return this.ref.id; }
  data() { return this.value === undefined ? undefined : structuredClone(this.value); }
}

class FakeQuerySnapshot {
  constructor(public docs: FakeDocumentSnapshot[]) {}
  get size() { return this.docs.length; }
}

type Write = { kind: 'create' | 'update' | 'set'; ref: FakeDocumentRef; data: Stored; merge?: boolean };

class FakeTransaction {
  private writes: Write[] = [];
  constructor(private db: FakeDb) {}

  async get(target: FakeDocumentRef | FakeCollectionRef) {
    if (target instanceof FakeCollectionRef) {
      const docs = this.db.collectionDocuments(target.id);
      this.db.fullCollectionQueries++;
      this.db.fullCollectionDocumentReads += docs.length;
      return new FakeQuerySnapshot(docs);
    }
    this.db.documentReads++;
    return this.db.snapshot(target);
  }

  async getAll(...refs: FakeDocumentRef[]) {
    this.db.documentReads += refs.length;
    return refs.map(ref => this.db.snapshot(ref));
  }

  create(ref: FakeDocumentRef, data: Stored) {
    if (this.db.has(ref)) throw new Error(`Document already exists: ${ref.collectionName}/${ref.id}`);
    this.writes.push({ kind: 'create', ref, data: structuredClone(data) });
  }

  update(ref: FakeDocumentRef, data: Stored) {
    this.writes.push({ kind: 'update', ref, data: structuredClone(data) });
  }

  set(ref: FakeDocumentRef, data: Stored, options?: { merge?: boolean }) {
    this.writes.push({ kind: 'set', ref, data: structuredClone(data), merge: options?.merge });
  }

  commit() {
    for (const write of this.writes) this.db.apply(write);
  }
}

class FakeDb {
  store = new Map<string, Map<string, Stored>>();
  documentReads = 0;
  fullCollectionQueries = 0;
  fullCollectionDocumentReads = 0;
  private transactionQueue: Promise<void> = Promise.resolve();

  constructor(contacts: Array<{ id: string; data: Stored }> = []) {
    for (const contact of contacts) this.put('eventContacts', contact.id, contact.data);
  }

  collection(name: string) { return new FakeCollectionRef(this, name); }
  put(collection: string, id: string, data: Stored) {
    if (!this.store.has(collection)) this.store.set(collection, new Map());
    this.store.get(collection)!.set(id, structuredClone(data));
  }
  has(ref: FakeDocumentRef) { return this.store.get(ref.collectionName)?.has(ref.id) ?? false; }
  snapshot(ref: FakeDocumentRef) { return new FakeDocumentSnapshot(ref, this.store.get(ref.collectionName)?.get(ref.id)); }
  collectionDocuments(name: string) {
    return [...(this.store.get(name)?.entries() || [])].map(([id, data]) => this.snapshot(new FakeDocumentRef(this, name, id)));
  }
  contacts() { return this.store.get('eventContacts') || new Map<string, Stored>(); }

  apply(write: Write) {
    const current = this.store.get(write.ref.collectionName)?.get(write.ref.id);
    if (write.kind === 'create' && current !== undefined) throw new Error('Document already exists.');
    const next = write.kind === 'update' || write.merge ? { ...(current || {}), ...write.data } : write.data;
    this.put(write.ref.collectionName, write.ref.id, next);
  }

  async runTransaction<T>(callback: (tx: FakeTransaction) => Promise<T>) {
    let resolveTurn!: () => void;
    const previous = this.transactionQueue;
    this.transactionQueue = new Promise<void>(resolve => { resolveTurn = resolve; });
    await previous;
    try {
      const tx = new FakeTransaction(this);
      const result = await callback(tx);
      tx.commit();
      return result;
    } finally {
      resolveTurn();
    }
  }

  async getAll(...refs: FakeDocumentRef[]) {
    this.documentReads += refs.length;
    return refs.map(ref => this.snapshot(ref));
  }
}

class FakeResponse {
  statusCode = 200;
  body: any;
  status(code: number) { this.statusCode = code; return this; }
  json(body: any) { this.body = body; return this; }
}

const originalFetch = globalThis.fetch;
let sheetRows: Stored[] = [];
let links: Stored[] = [];

function row(contactId: string, overrides: Stored = {}) {
  return {
    contactId,
    name: '', company: '', whatsapp: '', phone: '', email: '', website: '', linkedin: '', otherContact: '',
    invitationChannel: '', invitationStatus: 'Pending', notes: '', suppressed: false,
    ...overrides,
  };
}

function contact(overrides: Stored = {}) {
  return {
    name: '', company: '', whatsapp: '', phone: '', email: '', website: '', linkedin: '', otherContact: '',
    invitationChannel: '', invitationStatus: 'Pending', notes: '',
    ...overrides,
  };
}

async function pull(db: FakeDb, syncId: string, offset = 0, uid = 'admin-1') {
  const response = new FakeResponse();
  await handleEventContacts({ body: { operation: 'pull', syncId, offset } }, response, db, uid);
  return response.body;
}

before(() => {
  process.env.EVENT_CONTACTS_SYNC_SECRET = 'test-secret';
  process.env.EVENT_CONTACTS_SHEETS_URL = 'https://sheets.invalid/test';
  process.env.NODE_ENV = 'test';
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body || '{}'));
    if (request.action === 'readContacts') {
      const offset = Number(request.offset || 0);
      const limit = Number(request.limit || 25);
      const contacts = sheetRows.slice(offset, offset + limit);
      const nextOffset = offset + contacts.length < sheetRows.length ? offset + contacts.length : null;
      return new Response(JSON.stringify({ ok: true, contacts, nextOffset }), { status: 200 });
    }
    if (request.action === 'linkContacts') {
      links.push(...request.links);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    throw new Error(`Unexpected Sheets action: ${request.action}`);
  }) as typeof fetch;
});

after(() => { globalThis.fetch = originalFetch; });
beforeEach(() => { sheetRows = []; links = []; });

test('existing comparison and mapping utility contract remains unchanged', () => {
  assert.equal(classifyContact({ contactId: 'existing' }, [{ id: 'existing', notes: 'preserve' }]).kind, 'existing');
  assert.equal(classifyContact({ email: ' TEST@BOAT.COM ' }, [{ id: 'a', email: 'test@boat.com' }]).kind, 'existing');
  assert.equal(classifyContact({ whatsapp: '+44 7700 123456' }, [{ id: 'a', phone: '00447700123456' }]).kind, 'existing');
  assert.equal(classifyContact({ website: 'https://www.boat.com/a' }, [{ id: 'a', website: 'boat.com' }]).kind, 'ambiguous');
  assert.equal(classifyContact({ email: 'shared@boat.com' }, [{ id: 'a', email: 'shared@boat.com' }, { id: 'b', email: 'shared@boat.com' }]).kind, 'ambiguous');
  assert.equal(classifyContact({ email: 'new@boat.com' }, []).kind, 'missing');
  assert.equal(contactData({ invitationStatus: 'Unsubscribed' }).invitationStatus, 'Unsubscribed');
  assert.deepEqual(locationData({ address: 'Hamble Point', postcode: 'SO31 4NB', latitude: 50.86, longitude: -1.31 }), {
    address: 'Hamble Point', postcode: 'SO31 4NB', city: '', country: '', latitude: '50.86', longitude: '-1.31',
  });
});

test('A) 25 existing IDs do not read the complete collection', async () => {
  const existing = Array.from({ length: 25 }, (_, index) => ({ id: `id-${index}`, data: contact({ company: `Company ${index}` }) }));
  const db = new FakeDb(existing);
  sheetRows = existing.map(item => row(item.id, item.data));
  const result = await pull(db, 'sync_case_a');
  assert.equal(result.existing, 25);
  assert.equal(result.metrics.fullCollectionRead, false);
  assert.equal(db.fullCollectionQueries, 0);
});

test('B) unknown IDs trigger at most one complete collection read per sync', async () => {
  const db = new FakeDb([{ id: 'existing', data: contact({ email: 'known@example.com' }) }]);
  sheetRows = Array.from({ length: 51 }, (_, index) => row(`new-${index}`, { email: `new-${index}@example.com` }));
  const first = await pull(db, 'sync_case_b', 0);
  const second = await pull(db, 'sync_case_b', 25);
  const third = await pull(db, 'sync_case_b', 50);
  assert.equal(first.metrics.fullCollectionRead, true);
  assert.equal(second.metrics.fullCollectionRead, false);
  assert.equal(second.metrics.cacheUsed, true);
  assert.equal(third.metrics.fullCollectionRead, false);
  assert.equal(db.fullCollectionQueries, 1);
});

test('C) a different Contact ID with the same email is existing and linked', async () => {
  const db = new FakeDb([{ id: 'firestore-id', data: contact({ email: 'TEAM@Example.com', invitationStatus: 'SMS – Delivered', city: 'Old city' }) }]);
  sheetRows = [row('sheet-id', { email: 'team@example.com', city: 'Southampton', postcode: 'SO14' })];
  const result = await pull(db, 'sync_case_c');
  assert.equal(result.existing, 1);
  assert.equal(result.added, 0);
  assert.deepEqual(links, [{ oldId: 'sheet-id', contactId: 'firestore-id' }]);
  assert.equal(db.contacts().get('firestore-id')?.city, 'Southampton');
  assert.equal(db.contacts().get('firestore-id')?.postcode, 'SO14');
  assert.equal(db.contacts().get('firestore-id')?.invitationStatus, 'SMS – Delivered');
});

test('D) phone and WhatsApp matches preserve the current strong-match rule', async () => {
  const db = new FakeDb([{ id: 'known', data: contact({ phone: '+44 7700 900123' }) }]);
  sheetRows = [row('sheet-phone', { whatsapp: '0044 7700 900123' })];
  const result = await pull(db, 'sync_case_d');
  assert.equal(result.existing, 1);
  assert.equal(result.added, 0);
});

test('E) a matching website domain remains ambiguous under classifyContact()', async () => {
  const db = new FakeDb([{ id: 'known', data: contact({ website: 'https://www.example.com/about' }) }]);
  sheetRows = [row('sheet-domain', { website: 'example.com/contact' })];
  const result = await pull(db, 'sync_case_e');
  assert.equal(result.added, 0);
  assert.equal(result.ambiguous.length, 1);
});

test('F) multiple strong matches remain ambiguous and do not create a contact', async () => {
  const db = new FakeDb([
    { id: 'one', data: contact({ email: 'duplicate@example.com' }) },
    { id: 'two', data: contact({ email: 'duplicate@example.com' }) },
  ]);
  sheetRows = [row('sheet-ambiguous', { email: 'duplicate@example.com' })];
  const result = await pull(db, 'sync_case_f');
  assert.equal(result.added, 0);
  assert.equal(result.ambiguous.length, 1);
  assert.equal(db.contacts().size, 2);
});

test('G) a genuinely new contact is created only once', async () => {
  const db = new FakeDb();
  sheetRows = [row('brand-new', { company: 'Brand New Marine' })];
  const first = await pull(db, 'sync_case_g1');
  const second = await pull(db, 'sync_case_g2');
  assert.equal(first.added, 1);
  assert.equal(second.existing, 1);
  assert.equal(db.contacts().size, 1);
});

test('H) suppressed contacts remain Unsubscribed', async () => {
  const db = new FakeDb([{ id: 'already-unsubscribed', data: contact({ email: 'old@example.com', invitationStatus: 'Unsubscribed' }) }]);
  sheetRows = [
    row('already-unsubscribed', { email: 'old@example.com', invitationStatus: 'Pending' }),
    row('suppressed', { email: 'private@example.com', suppressed: true }),
  ];
  const result = await pull(db, 'sync_case_h');
  assert.equal(result.added, 1);
  assert.equal(db.contacts().get('already-unsubscribed')?.invitationStatus, 'Unsubscribed');
  assert.equal(db.contacts().get('suppressed')?.invitationStatus, 'Unsubscribed');
});

test('I) an interrupted page can be replayed and resumed without duplicates', async () => {
  const db = new FakeDb();
  sheetRows = Array.from({ length: 26 }, (_, index) => row(`resume-${index}`, { email: `resume-${index}@example.com` }));
  const first = await pull(db, 'sync_case_i', 0);
  const replay = await pull(db, 'sync_case_i', 0);
  const final = await pull(db, 'sync_case_i', replay.nextOffset);
  assert.equal(first.nextOffset, 25);
  assert.equal(replay.replayed, true);
  assert.equal(replay.added, 0);
  assert.equal(final.nextOffset, null);
  assert.equal(db.contacts().size, 26);
});

test('J) two concurrent sync IDs cannot create duplicate contacts', async () => {
  const db = new FakeDb();
  sheetRows = Array.from({ length: 26 }, (_, index) => row(`parallel-${index}`, { email: `parallel-${index}@example.com` }));
  const results = await Promise.allSettled([
    pull(db, 'sync_case_j_one', 0),
    pull(db, 'sync_case_j_two', 0),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.equal(db.contacts().size, 25);
});
