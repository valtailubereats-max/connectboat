import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import {
  Camera,
  Clipboard,
  ExternalLink,
  FileDown,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  QrCode,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';

type ContactCategory = 'Broker' | 'Dealer' | 'Marina' | 'Charter' | 'Services' | 'Other';
type ContactPriority = 'High' | 'Medium' | 'Low';
type FollowUpStatus = 'New' | 'Contacted' | 'Interested' | 'Follow-up' | 'Partner';

interface EventContact {
  id: string;
  photoUrl: string;
  photoPath: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  category: ContactCategory;
  notes: string;
  priority: ContactPriority;
  followUpStatus: FollowUpStatus;
  createdBy: string;
}

type ContactDraft = Omit<EventContact, 'id' | 'photoUrl' | 'photoPath' | 'createdBy'>;

const EMPTY_DRAFT: ContactDraft = {
  name: '',
  company: '',
  phone: '',
  email: '',
  website: '',
  category: 'Other',
  notes: '',
  priority: 'Medium',
  followUpStatus: 'New',
};

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1nB6fP6lulZTfmAMkiAg3o9cJyVzvYtv3ZDdIHvQVEA8/edit';

function normaliseWebsite(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function decodeQrContact(raw: string): Partial<ContactDraft> {
  const value = raw.trim();
  const result: Partial<ContactDraft> = {};

  if (/^BEGIN:VCARD/i.test(value)) {
    const lines = value.split(/\r?\n/);
    for (const line of lines) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const key = line.slice(0, colon).toUpperCase();
      const field = line.slice(colon + 1).trim();
      if (!field) continue;

      if (key.startsWith('FN')) result.name = field;
      else if (key.startsWith('ORG')) result.company = field.replace(/;/g, ' ').trim();
      else if (key.startsWith('TEL') && !result.phone) result.phone = field;
      else if (key.startsWith('EMAIL') && !result.email) result.email = field;
      else if (key.startsWith('URL') && !result.website) result.website = normaliseWebsite(field);
      else if (key.startsWith('NOTE') && !result.notes) result.notes = field;
    }
    return result;
  }

  if (/^MECARD:/i.test(value)) {
    const body = value.replace(/^MECARD:/i, '');
    const parts = body.split(';');
    for (const part of parts) {
      const colon = part.indexOf(':');
      if (colon < 0) continue;
      const key = part.slice(0, colon).toUpperCase();
      const field = part.slice(colon + 1).trim();
      if (key === 'N') result.name = field.replace(/,/g, ' ').trim();
      else if (key === 'ORG') result.company = field;
      else if (key === 'TEL') result.phone = field;
      else if (key === 'EMAIL') result.email = field;
      else if (key === 'URL') result.website = normaliseWebsite(field);
    }
    return result;
  }

  if (/^mailto:/i.test(value)) {
    result.email = value.replace(/^mailto:/i, '').split('?')[0];
    return result;
  }

  if (/^tel:/i.test(value)) {
    result.phone = value.replace(/^tel:/i, '');
    return result;
  }

  if (/^https?:\/\//i.test(value) || /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(value)) {
    result.website = normaliseWebsite(value);
    return result;
  }

  result.notes = value;
  return result;
}

function safePdfText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '?');
}

function escapePdfText(value: string) {
  return safePdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function splitPdfLine(text: string, maxChars = 92) {
  const words = safePdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function buildContactsPdf(contacts: EventContact[]) {
  const pages: string[][] = [];
  let page: string[] = ['ConnectBoat - Event Contacts', ''];

  const pushLine = (line: string) => {
    if (page.length >= 48) {
      pages.push(page);
      page = ['ConnectBoat - Event Contacts (continued)', ''];
    }
    page.push(line);
  };

  contacts.forEach((contact, index) => {
    pushLine(`${index + 1}. ${contact.name || 'Unnamed contact'}${contact.company ? ` - ${contact.company}` : ''}`);
    if (contact.category) pushLine(`Category: ${contact.category} | Priority: ${contact.priority} | Status: ${contact.followUpStatus}`);
    if (contact.phone) pushLine(`Phone: ${contact.phone}`);
    if (contact.email) pushLine(`Email: ${contact.email}`);
    if (contact.website) pushLine(`Website: ${contact.website}`);
    if (contact.notes) {
      splitPdfLine(`Notes: ${contact.notes}`).forEach(pushLine);
    }
    pushLine('');
  });

  if (page.length > 2 || pages.length === 0) pages.push(page);

  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  let nextId = 4;

  for (let i = 0; i < pages.length; i += 1) {
    pageObjectIds.push(nextId++);
    contentObjectIds.push(nextId++);
  }

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  pages.forEach((lines, index) => {
    const pageId = pageObjectIds[index];
    const contentId = contentObjectIds[index];
    const streamLines = lines.map((line, lineIndex) => {
      const y = 806 - lineIndex * 16;
      const size = lineIndex === 0 ? 15 : 10;
      return `BT /F1 ${size} Tf 42 ${y} Td (${escapePdfText(line)}) Tj ET`;
    });
    const stream = streamLines.join('\n');
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

const AdminEventContacts: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [contacts, setContacts] = useState<EventContact[]>([]);
  const [draft, setDraft] = useState<ContactDraft>({ ...EMPTY_DRAFT });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState('');
  const [existingPhotoPath, setExistingPhotoPath] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...contacts]
      .filter(contact => {
        if (!term) return true;
        return [contact.name, contact.company, contact.phone, contact.email, contact.website, contact.category, contact.notes]
          .some(value => value?.toLowerCase().includes(term));
      })
      .sort((a, b) => (a.company || a.name).localeCompare(b.company || b.name));
  }, [contacts, search]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'eventContacts'));
      const rows = snapshot.docs.map(item => ({ id: item.id, ...item.data() } as EventContact));
      setContacts(rows);
    } catch (error) {
      console.error(error);
      setMessage('Could not load event contacts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadContacts();
  }, [isAdmin]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      stopScanner();
    };
  }, []);

  const resetForm = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setDraft({ ...EMPTY_DRAFT });
    setEditingId(null);
    setExistingPhotoUrl('');
    setExistingPhotoPath('');
    setPhotoFile(null);
    setPhotoPreview('');
    setMessage('');
  };

  const updateDraft = (key: keyof ContactDraft, value: string) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const handlePhoto = (file?: File) => {
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const stopScanner = () => {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    scanStreamRef.current?.getTracks().forEach(track => track.stop());
    scanStreamRef.current = null;
    setScannerOpen(false);
  };

  const applyQrValue = (raw: string) => {
    const parsed = decodeQrContact(raw);
    setDraft(prev => ({ ...prev, ...parsed }));
    setMessage('QR code read. Complete any missing details and save.');
    stopScanner();
  };

  const startScanner = async () => {
    setScannerError('');
    setMessage('');

    const Detector = (window as any).BarcodeDetector;
    if (!Detector) {
      setScannerError('This browser does not support live QR scanning. You can still enter the contact manually.');
      setScannerOpen(true);
      return;
    }

    try {
      setScannerOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      scanStreamRef.current = stream;

      requestAnimationFrame(async () => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const detector = new Detector({ formats: ['qr_code'] });
        let busy = false;
        scanTimerRef.current = window.setInterval(async () => {
          if (busy || !video || video.readyState < 2) return;
          busy = true;
          try {
            const codes = await detector.detect(video);
            const raw = codes?.[0]?.rawValue;
            if (raw) applyQrValue(raw);
          } catch (error) {
            console.warn('QR scan frame skipped:', error);
          } finally {
            busy = false;
          }
        }, 450);
      });
    } catch (error) {
      console.error(error);
      setScannerError('Camera access was not available. Check the browser camera permission.');
      stopScanner();
      setScannerOpen(true);
    }
  };

  const uploadPhoto = async () => {
    if (!photoFile || !user) return { photoUrl: existingPhotoUrl, photoPath: existingPhotoPath };

    const compressed = await imageCompression(photoFile, {
      maxSizeMB: 0.35,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
      fileType: 'image/jpeg',
    });

    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const path = `event-contacts/${user.uid}/${unique}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' });
    const photoUrl = await getDownloadURL(storageRef);
    return { photoUrl, photoPath: path };
  };

  const handleSave = async () => {
    if (!isAdmin || !user) return;
    if (!draft.name.trim() && !draft.company.trim()) {
      setMessage('Add at least a name or company.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const previousPath = existingPhotoPath;
      const uploaded = await uploadPhoto();
      const payload = {
        ...draft,
        website: normaliseWebsite(draft.website),
        photoUrl: uploaded.photoUrl || '',
        photoPath: uploaded.photoPath || '',
        createdBy: user.uid,
      };

      const successMessage = editingId ? 'Contact updated.' : 'Contact saved.';
      if (editingId) {
        await updateDoc(doc(db, 'eventContacts', editingId), payload);
        if (photoFile && previousPath && previousPath !== uploaded.photoPath) {
          deleteObject(ref(storage, previousPath)).catch(() => undefined);
        }
      } else {
        await addDoc(collection(db, 'eventContacts'), payload);
      }

      await loadContacts();
      resetForm();
      setMessage(successMessage);
    } catch (error) {
      console.error(error);
      setMessage('Could not save this contact.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (contact: EventContact) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setEditingId(contact.id);
    setExistingPhotoUrl(contact.photoUrl || '');
    setExistingPhotoPath(contact.photoPath || '');
    setPhotoFile(null);
    setPhotoPreview('');
    setDraft({
      name: contact.name || '',
      company: contact.company || '',
      phone: contact.phone || '',
      email: contact.email || '',
      website: contact.website || '',
      category: contact.category || 'Other',
      notes: contact.notes || '',
      priority: contact.priority || 'Medium',
      followUpStatus: contact.followUpStatus || 'New',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (contact: EventContact) => {
    const label = contact.company || contact.name || 'this contact';
    if (!window.confirm(`Delete ${label}?`)) return;
    try {
      await deleteDoc(doc(db, 'eventContacts', contact.id));
      if (contact.photoPath) deleteObject(ref(storage, contact.photoPath)).catch(() => undefined);
      setContacts(prev => prev.filter(item => item.id !== contact.id));
      if (editingId === contact.id) resetForm();
    } catch (error) {
      console.error(error);
      setMessage('Could not delete this contact.');
    }
  };

  const downloadPdf = () => {
    const blob = buildContactsPdf(filteredContacts);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ConnectBoat-Event-Contacts.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copyForSheets = async () => {
    const headers = ['Name', 'Company', 'Category', 'Phone', 'Email', 'Website', 'Notes', 'Priority', 'Follow-up', 'Photo'];
    const rows = filteredContacts.map(contact => [
      contact.name,
      contact.company,
      contact.category,
      contact.phone,
      contact.email,
      contact.website,
      contact.notes.replace(/\r?\n/g, ' '),
      contact.priority,
      contact.followUpStatus,
      contact.photoUrl,
    ]);
    const tsv = [headers, ...rows]
      .map(row => row.map(cell => String(cell || '').replace(/\t/g, ' ')).join('\t'))
      .join('\n');

    try {
      await navigator.clipboard.writeText(tsv);
      setMessage('Contacts copied. Open the Google Sheet and paste into the Event Contacts tab.');
      window.open(SHEET_URL, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error(error);
      setMessage('Could not copy the contacts to the clipboard.');
    }
  };

  if (!isAdmin) return null;

  const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
  const labelClass = 'mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500';

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-3 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Event Contacts</h1>
          <p className="text-sm text-slate-500">Fast contact capture for shows and marine events.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={downloadPdf}
            disabled={!filteredContacts.length}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-40"
          >
            <FileDown size={17} /> PDF
          </button>
          <button
            onClick={copyForSheets}
            disabled={!filteredContacts.length}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            <Clipboard size={17} /> Google Sheets
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800">
          {message}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-black text-slate-900">{editingId ? 'Edit contact' : 'Capture contact'}</h2>
            <p className="text-xs text-slate-500">Scan the QR first, then complete only what is missing.</p>
          </div>
          {editingId && (
            <button onClick={resetForm} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Cancel edit">
              <X size={19} />
            </button>
          )}
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={startScanner}
            className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-indigo-600 px-3 py-3 font-black text-white shadow-sm"
          >
            <QrCode size={25} />
            Scan QR
          </button>
          <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-3 font-black text-slate-700">
            <Camera size={25} />
            Take Photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={event => handlePhoto(event.target.files?.[0])}
            />
          </label>
        </div>

        {(photoPreview || existingPhotoUrl) && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <img src={photoPreview || existingPhotoUrl} alt="Contact" className="h-20 w-24 rounded-lg object-cover" />
            <div className="text-xs text-slate-500">
              <div className="font-bold text-slate-700">Photo ready</div>
              <div>Compressed automatically when saved.</div>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Name</span>
            <input className={fieldClass} value={draft.name} onChange={e => updateDraft('name', e.target.value)} placeholder="Contact name" />
          </label>
          <label>
            <span className={labelClass}>Company</span>
            <input className={fieldClass} value={draft.company} onChange={e => updateDraft('company', e.target.value)} placeholder="Company / stand" />
          </label>
          <label>
            <span className={labelClass}>Phone</span>
            <input className={fieldClass} value={draft.phone} onChange={e => updateDraft('phone', e.target.value)} inputMode="tel" placeholder="Phone" />
          </label>
          <label>
            <span className={labelClass}>Email</span>
            <input className={fieldClass} value={draft.email} onChange={e => updateDraft('email', e.target.value)} inputMode="email" placeholder="Email" />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Website</span>
            <input className={fieldClass} value={draft.website} onChange={e => updateDraft('website', e.target.value)} inputMode="url" placeholder="Website" />
          </label>
          <label>
            <span className={labelClass}>Category</span>
            <select className={fieldClass} value={draft.category} onChange={e => updateDraft('category', e.target.value)}>
              {(['Broker', 'Dealer', 'Marina', 'Charter', 'Services', 'Other'] as ContactCategory[]).map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span className={labelClass}>Priority</span>
            <select className={fieldClass} value={draft.priority} onChange={e => updateDraft('priority', e.target.value)}>
              {(['High', 'Medium', 'Low'] as ContactPriority[]).map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span className={labelClass}>Follow-up</span>
            <select className={fieldClass} value={draft.followUpStatus} onChange={e => updateDraft('followUpStatus', e.target.value)}>
              {(['New', 'Contacted', 'Interested', 'Follow-up', 'Partner'] as FollowUpStatus[]).map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Notes</span>
            <textarea className={`${fieldClass} min-h-24 resize-y`} value={draft.notes} onChange={e => updateDraft('notes', e.target.value)} placeholder="Short note" />
          </label>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-black text-white disabled:opacity-60"
        >
          {saving ? <Loader2 size={19} className="animate-spin" /> : editingId ? <Save size={19} /> : <Plus size={19} />}
          {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Save Contact'}
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-black text-slate-900">Contacts</h2>
            <p className="text-xs text-slate-500">{contacts.length} saved</p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts"
              className={`${fieldClass} pl-9`}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-indigo-600" /></div>
        ) : filteredContacts.length === 0 ? (
          <div className="rounded-xl bg-slate-50 py-10 text-center text-sm text-slate-500">No contacts yet.</div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filteredContacts.map(contact => (
              <article key={contact.id} className="flex gap-3 rounded-2xl border border-slate-200 p-3">
                {contact.photoUrl ? (
                  <img src={contact.photoUrl} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><Camera /></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-black text-slate-900">{contact.company || contact.name || 'Unnamed contact'}</h3>
                      {contact.company && contact.name && <p className="truncate text-sm text-slate-600">{contact.name}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => handleEdit(contact)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Edit"><Pencil size={16} /></button>
                      <button onClick={() => handleDelete(contact)} className="rounded-lg p-2 text-red-500 hover:bg-red-50" aria-label="Delete"><Trash2 size={16} /></button>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{contact.category}</span>
                    <span className={`rounded-full px-2 py-1 ${contact.priority === 'High' ? 'bg-red-50 text-red-700' : contact.priority === 'Low' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}>{contact.priority}</span>
                    <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700">{contact.followUpStatus}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    {contact.phone && <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1 hover:text-indigo-600"><Phone size={13} />{contact.phone}</a>}
                    {contact.email && <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 hover:text-indigo-600"><Mail size={13} />{contact.email}</a>}
                    {contact.website && <a href={normaliseWebsite(contact.website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-indigo-600"><ExternalLink size={13} />Website</a>}
                  </div>
                  {contact.notes && <p className="mt-2 line-clamp-2 text-xs text-slate-500">{contact.notes}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {scannerOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="font-black text-slate-900">Scan QR Code</div>
              <button onClick={stopScanner} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
            </div>
            {scannerError ? (
              <div className="p-6 text-center text-sm text-slate-600">{scannerError}</div>
            ) : (
              <div className="bg-black p-3">
                <video ref={videoRef} playsInline muted className="aspect-square w-full rounded-xl object-cover" />
                <div className="mt-3 flex items-center justify-center gap-2 text-sm font-bold text-white"><QrCode size={18} />Point the camera at the QR code</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEventContacts;
