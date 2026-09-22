const IDENTITY_FIELDS = ['email', 'phone', 'whatsapp', 'website', 'company'];

/** Keep only the fields required by classifyContact() in the persisted sync cache. */
export function compactEventContacts(contacts) {
  return contacts.map(contact => {
    const compact = { id: String(contact?.id || '') };
    for (const field of IDENTITY_FIELDS) compact[field] = String(contact?.[field] || '');
    return compact;
  }).filter(contact => contact.id);
}

function mergeById(cachedContacts, directContacts) {
  const merged = new Map(cachedContacts.map(contact => [contact.id, contact]));
  for (const contact of directContacts) merged.set(contact.id, contact);
  return [...merged.values()];
}

/**
 * Read page IDs first. If one is unknown, reuse the persisted identity cache;
 * only the first unknown page in a sync cycle scans the complete collection.
 */
export async function readEventContacts(tx, collection, ids, cachedContacts = null) {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) {
    return {
      contacts: [],
      identityCache: cachedContacts,
      metrics: { directDocumentReads: 0, fullCollectionRead: false, fullCollectionDocuments: 0, cacheUsed: false },
    };
  }

  const snapshots = await tx.getAll(...uniqueIds.map(id => collection.doc(id)));
  const directContacts = snapshots
    .filter(snapshot => snapshot.exists)
    .map(snapshot => ({ ...snapshot.data(), id: snapshot.id }));

  if (snapshots.every(snapshot => snapshot.exists)) {
    return {
      contacts: directContacts,
      identityCache: cachedContacts,
      metrics: { directDocumentReads: uniqueIds.length, fullCollectionRead: false, fullCollectionDocuments: 0, cacheUsed: false },
    };
  }

  if (Array.isArray(cachedContacts)) {
    return {
      contacts: mergeById(cachedContacts, directContacts),
      identityCache: cachedContacts,
      metrics: { directDocumentReads: uniqueIds.length, fullCollectionRead: false, fullCollectionDocuments: 0, cacheUsed: true },
    };
  }

  const snapshot = await tx.get(collection);
  const contacts = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  return {
    contacts,
    identityCache: compactEventContacts(contacts),
    metrics: {
      directDocumentReads: uniqueIds.length,
      fullCollectionRead: true,
      fullCollectionDocuments: snapshot.size ?? snapshot.docs.length,
      cacheUsed: false,
    },
  };
}
