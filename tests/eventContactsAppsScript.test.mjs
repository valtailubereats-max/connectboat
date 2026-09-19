const vm = await import('node:vm');
const fs = await import('node:fs/promises');
const assert = (await import('node:assert/strict')).default;
class Sheet {
  constructor(rows) { this.rows = rows; this.max = 100; this.reads = 0; }
  getLastRow() { return this.rows.length; }
  getMaxRows() { return this.max; }
  insertRowsAfter(_, n) { this.max += n; }
  getRange(r,c,n=1,m=1) {
    const sheet=this;
    return { getValues(){ sheet.reads++; return Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>sheet.rows[r+i-1]?.[c+j-1] ?? '')); }, getDisplayValues(){ return this.getValues().map(row=>row.map(String)); }, getValue(){return this.getValues()[0][0];}, setValues(values){values.forEach((row,i)=>{sheet.rows[r+i-1] ||= [];row.forEach((v,j)=>sheet.rows[r+i-1][c+j-1]=v);});return this;},setValue(v){return this.setValues([[v]]);},setNumberFormat(){return this;},setFormula(v){return this.setValue(v);} };
  }
}
const source = await fs.readFile(new URL('../scripts/event-contacts-apps-script.gs', import.meta.url),'utf8');
let generatedId = 0;
const context = vm.createContext({ URL, Utilities:{getUuid:()=> 'test-uuid-' + (++generatedId)}, PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'secret'})} });
new vm.Script(source).runInContext(context);
const sheet = new Sheet([['Name','Company','WhatsApp','Phone','Email','Website','LinkedIn','Other Contact','Invitation Channel','Invitation Status','Notes','Contact ID','Address','Postcode','City','Country','Latitude','Longitude'],['Old','Boat','','','blocked@boat.com','','','','','Pending','Keep me','existing','','','','','','']]);
const suppression = new Sheet([['Email','Status'],['blocked@boat.com','Do Not Email']]);
context.getSuppressionSheet=()=>suppression;
const cache=context.createContactContext_(sheet);
assert.equal(context.upsertContact(sheet,{contactId:'existing',name:'Old',email:'blocked@boat.com',invitationStatus:'Pending'},cache),'updated');
assert.equal(sheet.rows[1][9],'Unsubscribed');
context.upsertContact(sheet,{contactId:'new',email:'new@boat.com',phone:'+447700123456',address:'Hamble Point',postcode:'SO31 4NB',city:'Hamble',country:'United Kingdom',latitude:'50.861',longitude:'-1.307'},cache);
context.upsertContact(sheet,{contactId:'new',email:'new@boat.com',phone:'+447700123456',address:'Hamble Point',postcode:'SO31 4NB',city:'Hamble',country:'United Kingdom',latitude:'50.861',longitude:'-1.307'},cache);
assert.equal(sheet.rows.length,3);
assert.equal(sheet.rows[2][3],'+447700123456');
assert.equal(sheet.rows[2][12],'Hamble Point');
assert.equal(sheet.rows[2][17],'-1.307');
assert.equal(suppression.reads,1);
sheet.rows.push(['Sheet only','Other','','','sheet@boat.com','','','','','Pending','','']);
sheet.rows.push(['Bad ID','Other','','','bad-id@boat.com','','','','','Pending','','','bad/id']);
const page=context.readContacts_(sheet,{offset:0,limit:25});
assert.equal(page.contacts[2].contactId,'sheet-test-uuid-1');
assert.equal(sheet.rows[3][11],'sheet-test-uuid-1');
assert.equal(page.contacts[3].contactId,'sheet-test-uuid-2');
assert.equal(sheet.rows[4][11],'sheet-test-uuid-2');
assert.equal(page.contacts[0].suppressed,true);
assert.equal(page.contacts[1].postcode,'SO31 4NB');
assert.equal(page.contacts[1].latitude,'50.861');
assert.equal(page.nextOffset,null);
context.linkContacts_(sheet,[{oldId:'sheet-test-uuid-1',contactId:'linked'}]);
assert.equal(sheet.rows[3][11],'linked');
assert.equal(sheet.rows[3][0],'Sheet only');
const beforeStatus = [...sheet.rows[2]];
assert.equal(context.updateSmsStatus_(sheet,{contactId:'new',status:'SMS – Delivered'}).updated,true);
assert.equal(sheet.rows[2][8],'SMS');
assert.equal(sheet.rows[2][9],'SMS – Delivered');
assert.deepEqual(sheet.rows[2].filter((_,i)=>i!==8 && i!==9),beforeStatus.filter((_,i)=>i!==8 && i!==9));
assert.equal(context.updateSmsStatus_(sheet,{contactId:'new',status:'SMS – Delivered'}).updated,false);
assert.equal(context.updateSmsStatus_(sheet,{contactId:'missing',status:'SMS – Failed'}).ok,false);
sheet.rows.push([...sheet.rows[2]]);
assert.equal(context.updateSmsStatus_(sheet,{contactId:'new',status:'SMS – Failed'}).ok,false);
assert.equal(sheet.rows[2][9],'SMS – Delivered');
console.log('Apps Script: status-only SMS update, unique ID, idempotency, and existing contact sync passed.');
