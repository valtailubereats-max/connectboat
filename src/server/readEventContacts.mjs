/** Read only the sheet IDs first. A full comparison is needed only for unknown IDs. */
export async function readEventContacts(tx, collection, ids) {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return [];
  const snapshots = await tx.getAll(...uniqueIds.map(id => collection.doc(id)));
  if (snapshots.every(snapshot => snapshot.exists)) {
    return snapshots.map(snapshot => ({ ...snapshot.data(), id: snapshot.id }));
  }
  // Preserve email/phone/domain comparison for sheet-only or unlinked contacts.
  // The caller's transaction guard serializes imports of those unknown contacts.
  const snapshot = await tx.get(collection);
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}
