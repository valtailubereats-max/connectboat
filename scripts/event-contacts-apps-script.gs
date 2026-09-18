const SHEET_NAME = 'Event Contacts';
const SUPPRESSION_SHEET_NAME = 'Suppression List';

const SPREADSHEET_ID =
  '1nB6fP6lulZTfmAMkiAg3o9cJyVzvYtv3ZDdIHvQVEA8';

const HEADERS = [
  'Name',
  'Company',
  'WhatsApp',
  'Phone',
  'Email',
  'Website',
  'LinkedIn',
  'Other Contact',
  'Invitation Channel',
  'Invitation Status',
  'Notes',
  'Contact ID',
  'Address',
  'Postcode',
  'City',
  'Country',
  'Latitude',
  'Longitude'
];

const SUPPRESSION_HEADERS = [
  'Email',
  'Status'
];


/* =========================================================
   GET
   ========================================================= */

function doGet(e) {
  try {

    // Unsubscribe clicado pelo destinatário
    if (
      e &&
      e.parameter &&
      e.parameter.action === 'unsubscribe'
    ) {
      const email = normalizeEmail(
        e.parameter.email
      );

      if (!email) {
        return unsubscribePage(
          false,
          'Invalid email address.'
        );
      }

      addToSuppressionList(email);
      markContactAsUnsubscribed(email);

      return unsubscribePage(
        true,
        'You have been successfully unsubscribed from ConnectBoat emails.'
      );
    }

    // Verificação normal do serviço
    return jsonResponse({
      ok: true,
      service: 'ConnectBoat Event Contacts',
      status: 'ready'
    });

  } catch (error) {

    return unsubscribePage(
      false,
      'We could not process your request. Please contact ConnectBoat.'
    );
  }
}


/* =========================================================
   POST
   ========================================================= */

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);


    if (
      !e ||
      !e.postData ||
      !e.postData.contents
    ) {
      return jsonResponse({
        ok: false,
        error: 'No data received'
      });
    }

    const data =
      JSON.parse(e.postData.contents);


    if (data.action !== 'unsubscribe') {
      const secret = PropertiesService.getScriptProperties().getProperty('EVENT_CONTACTS_SYNC_SECRET');
      if (!secret || data.token !== secret) return jsonResponse({ ok: false, error: 'Unauthorized contact sync request.' });
    }
    const sheet = getEventContactsSheet();
    const actualHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
    if (actualHeaders.some(function(header, i) { return header !== HEADERS[i]; })) throw new Error('Event Contacts headers differ from the expected Event Contacts columns.');

    if (data.action === 'readContacts') return jsonResponse(readContacts_(sheet, data));
    if (data.action === 'linkContacts') return jsonResponse(linkContacts_(sheet, data.links));
    if (data.action === 'syncAll' && (!Array.isArray(data.contacts) || data.contacts.length > 25)) throw new Error('Send at most 25 contacts per batch.');
    const context = createContactContext_(sheet);

    /* -----------------------------------------------------
       UPSERT
       ----------------------------------------------------- */

    if (data.action === 'upsert') {

      const result = upsertContact(
        sheet,
        data.contact || {}, context
      );

      return jsonResponse({
        ok: true,
        action: 'upsert',
        result: result
      });
    }


    /* -----------------------------------------------------
       SYNC ALL
       ----------------------------------------------------- */

    if (data.action === 'syncAll') {

      const contacts =
        Array.isArray(data.contacts)
          ? data.contacts
          : [];

      let added = 0;
      let updated = 0;
      const suppressedIds = [];

      contacts.forEach(function(contact) {

        const result = upsertContact(
          sheet,
          contact, context
        );

        if (context.suppressedIds[clean(contact.contactId || contact.id)]) suppressedIds.push(clean(contact.contactId || contact.id));
        if (result === 'added') {
          added++;
        }

        if (result === 'updated') {
          updated++;
        }
      });

      expandContactFilter_(sheet);
      return jsonResponse({
        ok: true,
        action: 'syncAll',
        total: contacts.length,
        added: added,
        updated: updated,
        suppressedIds: suppressedIds
      });
    }


    /* -----------------------------------------------------
       DELETE
       ----------------------------------------------------- */

    if (data.action === 'delete') {

      const contactId =
        clean(data.contactId);

      const deleted =
        deleteContactById(
          sheet,
          contactId
        );

      return jsonResponse({
        ok: true,
        action: 'delete',
        deleted: deleted
      });
    }


    /* -----------------------------------------------------
       UNSUBSCRIBE
       Também pode ser chamado por POST futuramente.
       ----------------------------------------------------- */

    if (data.action === 'unsubscribe') {

      const email =
        normalizeEmail(data.email);

      if (!email) {
        return jsonResponse({
          ok: false,
          action: 'unsubscribe',
          error: 'Invalid email'
        });
      }

      addToSuppressionList(email);
      markContactAsUnsubscribed(email);

      return jsonResponse({
        ok: true,
        action: 'unsubscribe',
        email: email,
        suppressed: true
      });
    }


    /* -----------------------------------------------------
       CHECK SUPPRESSION

       Antes de enviar um email podemos perguntar:
       este endereço está bloqueado?
       ----------------------------------------------------- */

    if (data.action === 'checkSuppression') {

      const email =
        normalizeEmail(data.email);

      const suppressed =
        isEmailSuppressed(email);

      return jsonResponse({
        ok: true,
        action: 'checkSuppression',
        email: email,
        suppressed: suppressed
      });
    }


    return jsonResponse({
      ok: false,
      error: 'Unknown action'
    });

  } catch (error) {

    return jsonResponse({
      ok: false,
      error: error.message
    });
  } finally {
    if (lock.hasLock()) {
      try { SpreadsheetApp.flush(); }
      finally { lock.releaseLock(); }
    }
  }
}


/* =========================================================
   EVENT CONTACTS SHEET
   ========================================================= */

function getEventContactsSheet() {

  const spreadsheet =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );

  let sheet =
    spreadsheet.getSheetByName(
      SHEET_NAME
    );

  if (!sheet) {

    sheet =
      spreadsheet.insertSheet(
        SHEET_NAME
      );
  }

  const currentHeaders =
    sheet
      .getRange(
        1,
        1,
        1,
        HEADERS.length
      )
      .getValues()[0];

  const headerMissing =
    currentHeaders
      .join('')
      .trim() === '';

  if (headerMissing) {

    sheet
      .getRange(
        1,
        1,
        1,
        HEADERS.length
      )
      .setValues([
        HEADERS
      ]);

    sheet.setFrozenRows(1);
  }
  // Existing sheets used A:L. Add map columns without changing those contact
  // columns or any formulas that may sit to their right.
  if (!headerMissing) {
    const legacyHeaders = currentHeaders.slice(0, 12);
    const legacyMatches = legacyHeaders.every(function(header, i) { return header === HEADERS[i]; });
    if (!legacyMatches) throw new Error('Event Contacts headers differ from the expected A:L contact columns.');
    const locationHeaders = sheet.getRange(1, 13, 1, HEADERS.length - 12).getValues()[0];
    if (locationHeaders.some(function(header, i) { return header !== HEADERS[i + 12]; })) {
      const hasAuxiliaryColumn = locationHeaders.some(function(header) { return clean(header) !== ''; });
      if (hasAuxiliaryColumn) sheet.insertColumnsBefore(13, HEADERS.length - 12);
      sheet.getRange(1, 13, 1, HEADERS.length - 12).setValues([HEADERS.slice(12)]);
    }
  }

  return sheet;
}


/* =========================================================
   SUPPRESSION SHEET
   ========================================================= */

function getSuppressionSheet() {

  const spreadsheet =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );

  let sheet =
    spreadsheet.getSheetByName(
      SUPPRESSION_SHEET_NAME
    );

  if (!sheet) {

    sheet =
      spreadsheet.insertSheet(
        SUPPRESSION_SHEET_NAME
      );

    sheet
      .getRange(
        1,
        1,
        1,
        SUPPRESSION_HEADERS.length
      )
      .setValues([
        SUPPRESSION_HEADERS
      ]);

    sheet.setFrozenRows(1);
  }

  return sheet;
}


/* =========================================================
   UPSERT CONTACT
   ========================================================= */

function createContactContext_(sheet) {
  const last = sheet.getLastRow();
  const rows = last > 1 ? sheet.getRange(2, 1, last - 1, HEADERS.length).getValues() : [];
  const ids = {}, emailRows = {};
  let nextRow = 2;
  rows.forEach(function(row, i) {
    if (row.some(function(value) { return clean(value) !== ''; })) nextRow = i + 3;
    const id = clean(row[11]);
    if (id && !ids[id]) ids[id] = i + 2;
    const email = normalizeEmail(row[4]);
    if (email) { if (!emailRows[email]) emailRows[email] = []; emailRows[email].push({ row: i + 2, id: id }); }
  });
  const suppression = getSuppressionSheet(), suppressed = {};
  if (suppression.getLastRow() > 1) suppression.getRange(2, 1, suppression.getLastRow() - 1, 1).getValues().forEach(function(row) { suppressed[normalizeEmail(row[0])] = true; });
  return { ids: ids, emailRows: emailRows, suppressed: suppressed, suppressedIds: {}, nextRow: nextRow };
}

function upsertContact(sheet, contact, context) {
  context = context || createContactContext_(sheet);
  const id = clean(contact.contactId || contact.id);
  if (!id) throw new Error('Contact ID is required.');
  const email = normalizeEmail(contact.email);
  const previous = context.emailRows[email] || [];
  let target = context.ids[id];
  // A sheet-only UUID can be linked safely to a single matching email.
  if (!target && previous.length === 1 && (!previous[0].id || previous[0].id.indexOf('sheet-') === 0)) target = previous[0].row;
  const added = !target;
  if (added) {
    target = context.nextRow++;
    if (target > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
  }
  const oldStatus = added ? '' : clean(sheet.getRange(target, 10).getValue());
  const status = context.suppressed[email] || oldStatus === 'Unsubscribed' ? 'Unsubscribed' : clean(contact.invitationStatus || contact.status || 'Pending');
  if (status === 'Unsubscribed') context.suppressedIds[id] = true;
  const row = [clean(contact.name), clean(contact.company), clean(contact.whatsapp), clean(contact.phone), email, clean(contact.website), clean(contact.linkedin), clean(contact.otherContact), clean(contact.invitationChannel || contact.channel), status, clean(contact.notes), id, clean(contact.address), clean(contact.postcode), clean(contact.city), clean(contact.country), clean(contact.latitude), clean(contact.longitude)];
  sheet.getRange(target, 3, 1, 2).setNumberFormat('@');
  // Leading '=' is escaped so contact text is never interpreted as a formula.
  sheet.getRange(target, 1, 1, row.length).setValues([row.map(function(value) { return value.indexOf('=') === 0 ? "'" + value : value; })]);
  context.ids[id] = target;
  if (sheet.getRange(1, HEADERS.length + 1).getValue() === 'Contact Count') sheet.getRange(target, HEADERS.length + 1).setFormula('=COUNTA(C' + target + ':H' + target + ')');
  return added ? 'added' : 'updated';
}

function readContacts_(sheet, data) {
  const offset = Number(data.offset || 0), limit = Math.min(25, Number(data.limit || 25));
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1) throw new Error('Invalid page.');
  const total = Math.max(0, sheet.getLastRow() - 1);
  const count = Math.min(limit, Math.max(0, total - offset));
  const context = createContactContext_(sheet);
  const rows = count ? sheet.getRange(offset + 2, 1, count, HEADERS.length).getDisplayValues() : [];
  const keys = ['name','company','whatsapp','phone','email','website','linkedin','otherContact','invitationChannel','invitationStatus','notes','contactId','address','postcode','city','country','latitude','longitude'];
  const contacts = [];
  rows.forEach(function(row, i) {
    if (!row.slice(0, 8).some(function(value) { return clean(value) !== ''; })) return;
    if (!clean(row[11])) {
      row[11] = 'sheet-' + Utilities.getUuid();
      sheet.getRange(offset + i + 2, 12).setValue(row[11]);
    }
    const contact = {};
    keys.forEach(function(key, j) { contact[key] = clean(row[j]); });
    contact.suppressed = !!context.suppressed[normalizeEmail(contact.email)] || contact.invitationStatus === 'Unsubscribed';
    contacts.push(contact);
  });
  return { ok: true, contacts: contacts, nextOffset: offset + count < total ? offset + count : null };
}

function linkContacts_(sheet, links) {
  if (!Array.isArray(links) || links.length > 25) throw new Error('Invalid link batch.');
  const last = sheet.getLastRow();
  const ids = last > 1 ? sheet.getRange(2, 12, last - 1, 1).getDisplayValues() : [];
  let linked = 0;
  links.forEach(function(link) {
    ids.forEach(function(row, i) {
      if (clean(row[0]) === clean(link.oldId) && clean(link.contactId)) {
        sheet.getRange(i + 2, 12).setValue(clean(link.contactId)); row[0] = clean(link.contactId); linked++;
      }
    });
  });
  return { ok: true, linked: linked };
}

/* =========================================================
   DELETE CONTACT
   ========================================================= */

function deleteContactById(
  sheet,
  contactId
) {

  if (!contactId) {
    return false;
  }

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {
    return false;
  }

  const ids =
    sheet
      .getRange(
        2,
        12,
        lastRow - 1,
        1
      )
      .getValues();


  // Bottom to top for safety.
  for (
    let i = ids.length - 1;
    i >= 0;
    i--
  ) {

    const existingId =
      String(
        ids[i][0] || ''
      ).trim();

    if (
      existingId === contactId
    ) {

      sheet.deleteRow(
        i + 2
      );

      return true;
    }
  }

  return false;
}


/* =========================================================
   ADD TO SUPPRESSION LIST
   ========================================================= */

function addToSuppressionList(email) {

  email =
    normalizeEmail(email);

  if (!email) {
    return false;
  }

  const sheet =
    getSuppressionSheet();

  const lastRow =
    sheet.getLastRow();


  // Check if already suppressed.
  if (lastRow >= 2) {

    const emails =
      sheet
        .getRange(
          2,
          1,
          lastRow - 1,
          1
        )
        .getValues();

    for (
      let i = 0;
      i < emails.length;
      i++
    ) {

      const existingEmail =
        normalizeEmail(
          emails[i][0]
        );

      if (
        existingEmail === email
      ) {

        // Make sure status remains active.
        sheet
          .getRange(
            i + 2,
            2
          )
          .setValue(
            'Do Not Email'
          );

        return false;
      }
    }
  }


  // Add new suppression.
  const newRow =
    sheet.getLastRow() + 1;

  sheet
    .getRange(
      newRow,
      1,
      1,
      2
    )
    .setValues([
      [
        email,
        'Do Not Email'
      ]
    ]);

  return true;
}


/* =========================================================
   CHECK SUPPRESSION
   ========================================================= */

function isEmailSuppressed(email) {

  email =
    normalizeEmail(email);

  if (!email) {
    return false;
  }

  const sheet =
    getSuppressionSheet();

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {
    return false;
  }

  const emails =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        1
      )
      .getValues();


  for (
    let i = 0;
    i < emails.length;
    i++
  ) {

    const existingEmail =
      normalizeEmail(
        emails[i][0]
      );

    if (
      existingEmail === email
    ) {
      return true;
    }
  }

  return false;
}


/* =========================================================
   MARK CONTACT AS UNSUBSCRIBED
   ========================================================= */

function markContactAsUnsubscribed(email) {

  email =
    normalizeEmail(email);

  if (!email) {
    return false;
  }

  const sheet =
    getEventContactsSheet();

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {
    return false;
  }


  // Email = column 5
  const emails =
    sheet
      .getRange(
        2,
        5,
        lastRow - 1,
        1
      )
      .getValues();

  let updated = false;


  for (
    let i = 0;
    i < emails.length;
    i++
  ) {

    const existingEmail =
      normalizeEmail(
        emails[i][0]
      );

    if (
      existingEmail === email
    ) {

      // Invitation Status = column 10
      sheet
        .getRange(
          i + 2,
          10
        )
        .setValue(
          'Unsubscribed'
        );

      updated = true;
    }
  }

  return updated;
}


/* =========================================================
   UNSUBSCRIBE CONFIRMATION PAGE
   ========================================================= */

function unsubscribePage(
  success,
  message
) {

  const title =
    success
      ? 'Unsubscribed'
      : 'Unable to unsubscribe';

  const safeMessage =
    escapeHtml(message);

  const html =
    '<!DOCTYPE html>' +
    '<html>' +

    '<head>' +

    '<meta charset="UTF-8">' +

    '<meta name="viewport" ' +
    'content="width=device-width, initial-scale=1.0">' +

    '<title>' +
    title +
    '</title>' +

    '<style>' +

    'body{' +
    'margin:0;' +
    'padding:30px 18px;' +
    'background:#f5f7fa;' +
    'font-family:Arial,sans-serif;' +
    'color:#0C223F;' +
    '}' +

    '.card{' +
    'max-width:600px;' +
    'margin:60px auto;' +
    'background:#ffffff;' +
    'border-radius:16px;' +
    'padding:40px 30px;' +
    'box-shadow:0 8px 30px rgba(0,0,0,.08);' +
    'text-align:center;' +
    '}' +

    'h1{' +
    'margin:0 0 18px;' +
    'font-size:30px;' +
    'color:#0C223F;' +
    '}' +

    'p{' +
    'font-size:17px;' +
    'line-height:1.6;' +
    'margin:0 0 24px;' +
    'color:#44546a;' +
    '}' +

    'a{' +
    'display:inline-block;' +
    'background:#0C223F;' +
    'color:#ffffff;' +
    'text-decoration:none;' +
    'padding:13px 24px;' +
    'border-radius:8px;' +
    'font-weight:bold;' +
    '}' +

    '.brand{' +
    'margin-top:28px;' +
    'font-size:14px;' +
    'color:#718096;' +
    '}' +

    '</style>' +

    '</head>' +

    '<body>' +

    '<div class="card">' +

    '<h1>' +
    title +
    '</h1>' +

    '<p>' +
    safeMessage +
    '</p>' +

    '<a href="https://connectboat.co.uk">' +
    'Visit ConnectBoat' +
    '</a>' +

    '<div class="brand">' +
    'ConnectBoat – The UK Boating Marketplace' +
    '</div>' +

    '</div>' +

    '</body>' +

    '</html>';


  return HtmlService
    .createHtmlOutput(html)
    .setTitle(title);
}


/* =========================================================
   NORMALIZE EMAIL
   ========================================================= */

function normalizeEmail(value) {

  return clean(value)
    .toLowerCase();
}


/* =========================================================
   CLEAN
   ========================================================= */

function clean(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value).trim();
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(value) {

  return clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


/* =========================================================
   JSON RESPONSE
   ========================================================= */

function jsonResponse(data) {

  return ContentService
    .createTextOutput(
      JSON.stringify(data)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}

function prepareNewContactRow_(sheet) {
  // Only A:L contain contact data. Ignore auxiliary formulas and counters.
  const lastUsedRow = sheet.getLastRow();
  const rows = lastUsedRow > 1
    ? sheet.getRange(2, 1, lastUsedRow - 1, HEADERS.length).getValues()
    : [];
  let newRow = 2;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].some(function(value) { return clean(value) !== ''; })) {
      newRow = i + 3;
      break;
    }
  }

  const maxRows = sheet.getMaxRows();
  if (newRow > maxRows) {
    sheet.insertRowsAfter(maxRows, Math.max(100, newRow - maxRows));
  }

  if (sheet.getRange(1, 13).getValue() === 'Contact Count') {
    sheet.getRange(newRow, 13).setFormula('=COUNTA(C' + newRow + ':H' + newRow + ')');
  }

  const filter = sheet.getFilter();
  if (filter && filter.getRange().getLastRow() < newRow) {
    const range = filter.getRange();
    const criteria = [];
    for (let col = range.getColumn(); col <= range.getLastColumn(); col++) {
      criteria.push([col, filter.getColumnFilterCriteria(col)]);
    }
    filter.remove();
    const expanded = sheet.getRange(range.getRow(), range.getColumn(),
      sheet.getMaxRows() - range.getRow() + 1, range.getNumColumns()).createFilter();
    criteria.forEach(function(entry) {
      if (entry[1]) expanded.setColumnFilterCriteria(entry[0], entry[1]);
    });
  }

  return newRow;
}

function expandContactFilter_(sheet) {
  const filter = sheet.getFilter();
  if (!filter || filter.getRange().getLastRow() >= sheet.getLastRow()) return;
  const range = filter.getRange(), criteria = [];
  for (let col = range.getColumn(); col <= range.getLastColumn(); col++) criteria.push([col, filter.getColumnFilterCriteria(col)]);
  filter.remove();
  const expanded = sheet.getRange(range.getRow(), range.getColumn(), sheet.getMaxRows() - range.getRow() + 1, range.getNumColumns()).createFilter();
  criteria.forEach(function(entry) { if (entry[1]) expanded.setColumnFilterCriteria(entry[0], entry[1]); });
}
