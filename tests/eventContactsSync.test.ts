import assert from 'node:assert/strict';
import { classifyContact, contactData } from '../src/utils/eventContactsSync';

assert.equal(classifyContact({ contactId: 'existing' }, [{ id: 'existing', notes: 'preserve' }]).kind, 'existing');
assert.equal(classifyContact({ email: ' TEST@BOAT.COM ' }, [{ id: 'a', email: 'test@boat.com' }]).kind, 'existing');
assert.equal(classifyContact({ whatsapp: '+44 7700 123456' }, [{ id: 'a', phone: '00447700123456' }]).kind, 'existing');
assert.equal(classifyContact({ website: 'https://www.boat.com/a' }, [{ id: 'a', website: 'boat.com' }]).kind, 'ambiguous');
assert.equal(classifyContact({ email: 'shared@boat.com' }, [{ id: 'a', email: 'shared@boat.com' }, { id: 'b', email: 'shared@boat.com' }]).kind, 'ambiguous');
assert.equal(classifyContact({ email: 'new@boat.com' }, []).kind, 'missing');
assert.equal(contactData({ invitationStatus: 'Unsubscribed' }).invitationStatus, 'Unsubscribed');
console.log('Event Contacts comparison tests passed.');
