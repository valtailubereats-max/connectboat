import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  QrCode,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';

type InvitationStatus = 'Pending' | 'Sent – WhatsApp' | 'Sent – Email' | 'Sent – Other';

type EventContact = {
  id: string;
  name: string;
  company: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  linkedin: string;
  otherContact: string;
  notes: string;
  rawSource: string;
  invitationChannel: string;
  invitationStatus: InvitationStatus;
  photoUrl: string;
  photoPath: string;
  createdBy: string;
};

type ContactDraft = Omit<EventContact, 'id' | 'photoUrl' | 'photoPath' | 'createdBy'>;

const EMPTY_DRAFT: ContactDraft = {
  name: '',
  company: '',
  phone: '',
  whatsapp: '',
  email: '',
  website: '',
  linkedin: '',
  otherContact: '',
  notes: '',
  rawSource: '',
  invitationChannel: '',
  invitationStatus: 'Pending',
};

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1nB6fP6lulZTfmAMkiAg3o9cJyVzvYtv3ZDdIHvQVEA8/edit';

function normaliseWebsite(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function normaliseWhatsapp(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `44${digits.slice(1)}`;
  return digits;
}

function decodeQrContact(raw: string): Partial<ContactDraft> {
  const value = raw.trim();
  const result: Partial<ContactDraft> = { rawSource: value };

  if (/^BEGIN:VCARD/i.test(value)) {
    for (const line of value.split(/\r?\n/)) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const key = line.slice(0, colon).toUpperCase();
      const field = line.slice(colon + 1).trim();
      if (!field) continue;
      if (key.startsWith('FN')) result.name = field;
      else if (key.startsWith('ORG')) result.company = field.replace(/;/g, ' ').trim();
      else if (key.includes('WHATSAPP')) result.whatsapp = field;
      else if (key.startsWith('TEL') && !result.phone) result.phone = field;
      else if (key.startsWith('EMAIL') && !result.email) result.email = field;
      else if (key.startsWith('URL') && !result.website) result.website = normaliseWebsite(field);
      else if (key.startsWith('NOTE') && !result.notes) result.notes = field;
    }
    return result;
  }

  if (/^MECARD:/i.test(value)) {
    for (const part of value.replace(/^MECARD:/i, '').split(';')) {
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

  if (/^mailto:/i.test(value)) result.email = value.replace(/^mailto:/i, '').split('?')[0];
  else if (/^tel:/i.test(value)) result.phone = value.replace(/^tel:/i, '');
  else if (/^https?:\/\//i.test(value) || /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(value)) result.website = normaliseWebsite(value);
  else result.otherContact = value;

  return result;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function invitationText(draft: ContactDraft) {
  const greeting = draft.name ? `Hi ${draft.name},` : draft.company ? `Hi ${draft.company} team,` : 'Hello,';
  return `${greeting}\n\nIt was great meeting you at the show. I’d like to invite you to discover ConnectBoat, a UK boating marketplace for boats, charters and marine businesses.\n\nWe’d be delighted to have you on board:\nhttps://connectboat.co.uk\n\nValter\nConnectBoat`;
}

function emailSubject() {
  return 'Invitation to ConnectBoat.co.uk';
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [message, setMessage] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contacts.filter(contact => {
      if (!term) return true;
      return [contact.name, contact.company, contact.phone, contact.whatsapp, contact.email, contact.website, contact.linkedin, contact.invitationStatus]
        .some(value => String(value || '').toLowerCase().includes(term));
    });
  }, [contacts, search]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'eventContacts'));
      setContacts(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as EventContact)));
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

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
    scanStreamRef.current?.getTracks().forEach(track => track.stop());
  }, [photoPreview]);

  const updateDraft = (key: keyof ContactDraft, value: string) => setDraft(prev => ({ ...prev, [key]: value }));

  const resetForm = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setDraft({ ...EMPTY_DRAFT });
    setEditingId(null);
    setExistingPhotoUrl('');
    setExistingPhotoPath('');
    setPhotoFile(null);
    setPhotoPreview('');
    setMoreOpen(false);
    setMessage('');
  };

  const stopScanner = () => {
    if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
    scanTimerRef.current = null;
    scanStreamRef.current?.getTracks().forEach(track => track.stop());
    scanStreamRef.current = null;
    setScannerOpen(false);
  };

  const applyQrValue = (raw: string) => {
    const parsed = decodeQrContact(raw);
    setDraft(prev => ({ ...prev, ...parsed }));
    setMessage('QR read. I used every contact detail available in it.');
    stopScanner();
  };

  const startScanner = async () => {
    setScannerError('');
    setMessage('');
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) {
      setScannerError('Live QR scanning is not supported by this browser. Use Scan Business Card instead.');
      setScannerOpen(true);
      return;
    }

    try {
      setScannerOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      scanStreamRef.current = stream;
      requestAnimationFrame(async () => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const detector = new Detector({ formats: ['qr_code'] });
        let busy = false;
        scanTimerRef.current = window.setInterval(async () => {
          if (busy || video.readyState < 2) return;
          busy = true;
          try {
            const codes = await detector.detect(video);
            if (codes?.[0]?.rawValue) applyQrValue(codes[0].rawValue);
          } catch {
            // Ignore a single failed camera frame.
          } finally {
            busy = false;
          }
        }, 450);
      });
    } catch (error) {
      console.error(error);
      stopScanner();
      setScannerOpen(true);
      setScannerError('Camera access was not available. Check the browser camera permission.');
    }
  };

  const analyseBusinessCard = async (file: File) => {
    if (!user) return;
    setAnalysing(true);
    setMessage('Reading business card…');
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.45,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: 'image/jpeg',
      });
      const image = await fileToDataUrl(compressed as File);
      const token = await user.getIdToken();
      const response = await fetch('/api/gemini/business-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image }),
      });
      const result = await response.json();
      if (!result?.success) throw new Error(result?.error || 'Card reading failed.');
      const data = result.data || {};
      setDraft(prev => ({
        ...prev,
        name: data.name || prev.name,
        company: data.company || prev.company,
        phone: data.phone || prev.phone,
        whatsapp: data.whatsapp || prev.whatsapp,
        email: data.email || prev.email,
        website: normaliseWebsite(data.website || prev.website),
        linkedin: data.linkedin || prev.linkedin,
        otherContact: data.otherContact || prev.otherContact,
        rawSource: data.rawText || prev.rawSource,
      }));
      setMessage('Business card read. Check the details found, then send or save for later.');
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || 'Could not read this business card. The photo is still available to save.');
    } finally {
      setAnalysing(false);
    }
  };

  const handleBusinessCard = async (file?: File) => {
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    await analyseBusinessCard(file);
  };

  const uploadPhoto = async () => {
    if (!photoFile || !user) return { photoUrl: existingPhotoUrl, photoPath: existingPhotoPath };
    const compressed = await imageCompression(photoFile, {
      maxSizeMB: 0.35,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
      fileType: 'image/jpeg',
    });
    const path = `event-contacts/${user.uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' });
    return { photoUrl: await getDownloadURL(storageRef), photoPath: path };
  };

  const saveCurrent = async (patch: Partial<ContactDraft> = {}) => {
    if (!isAdmin || !user) return null;
    setSaving(true);
    try {
      const uploaded = await uploadPhoto();
      const merged = { ...draft, ...patch };
      const payload = {
        ...merged,
        website: normaliseWebsite(merged.website),
        photoUrl: uploaded.photoUrl || '',
        photoPath: uploaded.photoPath || '',
        createdBy: user.uid,
      };

      if (editingId) {
        const previousPath = existingPhotoPath;
        await updateDoc(doc(db, 'eventContacts', editingId), payload);
        if (photoFile && previousPath && previousPath !== uploaded.photoPath) deleteObject(ref(storage, previousPath)).catch(() => undefined);
        setDraft(merged);
        setExistingPhotoUrl(uploaded.photoUrl || '');
        setExistingPhotoPath(uploaded.photoPath || '');
        setPhotoFile(null);
        return editingId;
      }

      const created = await addDoc(collection(db, 'eventContacts'), payload);
      setEditingId(created.id);
      setDraft(merged);
      setExistingPhotoUrl(uploaded.photoUrl || '');
      setExistingPhotoPath(uploaded.photoPath || '');
      setPhotoFile(null);
      return created.id;
    } finally {
      setSaving(false);
    }
  };

  const saveForLater = async () => {
    try {
      await saveCurrent({ invitationStatus: 'Pending', invitationChannel: '' });
      await loadContacts();
      setMessage('Saved for later. You can move straight to the next stand.');
      resetForm();
    } catch (error) {
      console.error(error);
      setMessage('Could not save this contact.');
    }
  };

  const sendWhatsApp = async () => {
    const number = normaliseWhatsapp(draft.whatsapp || draft.phone);
    if (!number) return;
    try {
      await saveCurrent({ invitationStatus: 'Sent – WhatsApp', invitationChannel: 'WhatsApp' });
      const url = `https://wa.me/${number}?text=${encodeURIComponent(invitationText(draft))}`;
      window.location.href = url;
    } catch (error) {
      console.error(error);
      setMessage('Could not save the contact before opening WhatsApp.');
    }
  };

  const sendEmail = async () => {
    if (!draft.email.trim()) return;
    try {
      await saveCurrent({ invitationStatus: 'Sent – Email', invitationChannel: 'Email' });
      window.location.href = `mailto:${draft.email.trim()}?subject=${encodeURIComponent(emailSubject())}&body=${encodeURIComponent(invitationText(draft))}`;
    } catch (error) {
      console.error(error);
      setMessage('Could not save the contact before opening email.');
    }
  };

  const openWebsite = async () => {
    const url = normaliseWebsite(draft.website);
    if (!url) return;
    try {
      await saveCurrent({ invitationStatus: 'Pending', invitationChannel: 'Website' });
      window.location.href = url;
    } catch (error) {
      console.error(error);
      setMessage('Could not save the contact before opening the website.');
    }
  };

  const handleEdit = (contact: EventContact) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setEditingId(contact.id);
    setExistingPhotoUrl(contact.photoUrl || '');
    setExistingPhotoPath(contact.photoPath || '');
    setPhotoFile(null);
    setPhotoPreview('');
    setMoreOpen(true);
    setDraft({
      name: contact.name || '', company: contact.company || '', phone: contact.phone || '', whatsapp: contact.whatsapp || '',
      email: contact.email || '', website: contact.website || '', linkedin: contact.linkedin || '', otherContact: contact.otherContact || '',
      notes: contact.notes || '', rawSource: contact.rawSource || '', invitationChannel: contact.invitationChannel || '',
      invitationStatus: contact.invitationStatus || 'Pending',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (contact: EventContact) => {
    if (!window.confirm(`Delete ${contact.company || contact.name || 'this contact'}?`)) return;
    try {
      await deleteDoc(doc(db, 'eventContacts', contact.id));
      if (contact.photoPath) deleteObject(ref(storage, contact.photoPath)).catch(() => undefined);
      setContacts(prev => prev.filter(item => item.id !== contact.id));
    } catch (error) {
      console.error(error);
      setMessage('Could not delete this contact.');
    }
  };

  const copyForSheets = async () => {
    const headers = ['Name', 'Company', 'Phone', 'WhatsApp', 'Email', 'Website', 'LinkedIn', 'Other Contact', 'Invitation Channel', 'Invitation Status', 'Notes', 'Photo'];
    const rows = filteredContacts.map(contact => [
      contact.name, contact.company, contact.phone, contact.whatsapp, contact.email, contact.website, contact.linkedin,
      contact.otherContact, contact.invitationChannel, contact.invitationStatus, contact.notes.replace(/\r?\n/g, ' '), contact.photoUrl,
    ]);
    const tsv = [headers, ...rows].map(row => row.map(cell => String(cell || '').replace(/\t/g, ' ')).join('\t')).join('\n');
    try {
      await navigator.clipboard.writeText(tsv);
      setMessage('All contacts copied. Paste them into the Event Contacts tab in Google Sheets.');
      window.open(SHEET_URL, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error(error);
      setMessage('Could not copy the contacts.');
    }
  };

  if (!isAdmin) return null;

  const foundSomething = Boolean(draft.name || draft.company || draft.phone || draft.whatsapp || draft.email || draft.website || draft.linkedin || draft.otherContact || draft.rawSource || photoFile || existingPhotoUrl);
  const whatsappAvailable = Boolean((draft.whatsapp || draft.phone).trim());
  const emailAvailable = Boolean(draft.email.trim());
  const websiteAvailable = Boolean(draft.website.trim());
  const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
  const labelClass = 'mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500';

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-3 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Event Contacts</h1>
          <p className="text-sm text-slate-500">Scan. Check. Invite. Move to the next stand.</p>
        </div>
        <button onClick={copyForSheets} disabled={!contacts.length} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">Google Sheets</button>
      </div>

      {message && <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800">{message}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={startScanner} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-3 py-3 font-black text-white shadow-sm">
            <QrCode size={28} /> Scan QR
          </button>
          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-center font-black text-slate-800">
            {analysing ? <Loader2 size={28} className="animate-spin" /> : <Camera size={28} />}
            {analysing ? 'Reading Card…' : 'Scan Business Card'}
            <input type="file" accept="image/*" capture="environment" className="hidden" disabled={analysing} onChange={e => handleBusinessCard(e.target.files?.[0])} />
          </label>
        </div>

        {(photoPreview || existingPhotoUrl) && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <img src={photoPreview || existingPhotoUrl} alt="Business card" className="h-20 w-28 rounded-lg object-cover" />
            <div className="text-xs text-slate-500"><div className="font-bold text-slate-700">Card photo saved</div><div>It can be checked later on desktop.</div></div>
          </div>
        )}

        {foundSomething && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3">
              <div className="text-lg font-black text-slate-900">{draft.company || draft.name || 'Contact captured'}</div>
              {draft.company && draft.name && <div className="text-sm text-slate-600">{draft.name}</div>}
            </div>
            <div className="space-y-1 text-sm text-slate-700">
              {draft.whatsapp && <div>WhatsApp: {draft.whatsapp}</div>}
              {draft.phone && <div>Phone: {draft.phone}</div>}
              {draft.email && <div>Email: {draft.email}</div>}
              {draft.website && <div className="truncate">Website: {draft.website}</div>}
              {draft.linkedin && <div className="truncate">LinkedIn: {draft.linkedin}</div>}
            </div>

            <div className="mt-4 space-y-2">
              {whatsappAvailable && (
                <button onClick={sendWhatsApp} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 font-black text-white disabled:opacity-60"><MessageCircle size={20} /> Send Invitation via WhatsApp</button>
              )}
              {!whatsappAvailable && emailAvailable && (
                <button onClick={sendEmail} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 font-black text-white disabled:opacity-60"><Mail size={20} /> Send Invitation via Email</button>
              )}
              {!whatsappAvailable && !emailAvailable && websiteAvailable && (
                <button onClick={openWebsite} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3.5 font-black text-white disabled:opacity-60"><ExternalLink size={20} /> Save & Open Website</button>
              )}
              <button onClick={saveForLater} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 disabled:opacity-60">
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save for later
              </button>
            </div>
          </div>
        )}

        <button type="button" onClick={() => setMoreOpen(value => !value)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
          {moreOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />} More details
        </button>

        {moreOpen && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label><span className={labelClass}>Name</span><input className={fieldClass} value={draft.name} onChange={e => updateDraft('name', e.target.value)} /></label>
            <label><span className={labelClass}>Company</span><input className={fieldClass} value={draft.company} onChange={e => updateDraft('company', e.target.value)} /></label>
            <label><span className={labelClass}>WhatsApp</span><input className={fieldClass} value={draft.whatsapp} onChange={e => updateDraft('whatsapp', e.target.value)} inputMode="tel" /></label>
            <label><span className={labelClass}>Phone</span><input className={fieldClass} value={draft.phone} onChange={e => updateDraft('phone', e.target.value)} inputMode="tel" /></label>
            <label><span className={labelClass}>Email</span><input className={fieldClass} value={draft.email} onChange={e => updateDraft('email', e.target.value)} inputMode="email" /></label>
            <label><span className={labelClass}>Website</span><input className={fieldClass} value={draft.website} onChange={e => updateDraft('website', e.target.value)} inputMode="url" /></label>
            <label><span className={labelClass}>LinkedIn</span><input className={fieldClass} value={draft.linkedin} onChange={e => updateDraft('linkedin', e.target.value)} /></label>
            <label><span className={labelClass}>Other contact</span><input className={fieldClass} value={draft.otherContact} onChange={e => updateDraft('otherContact', e.target.value)} /></label>
            <label className="sm:col-span-2"><span className={labelClass}>Notes</span><textarea className={`${fieldClass} min-h-20`} value={draft.notes} onChange={e => updateDraft('notes', e.target.value)} /></label>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="font-black text-slate-900">Saved contacts</h2><p className="text-xs text-slate-500">{contacts.length} captured</p></div>
          <div className="relative w-52"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" className={`${fieldClass} pl-9`} /></div>
        </div>
        {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-600" /></div> : filteredContacts.length === 0 ? <div className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500">No contacts yet.</div> : (
          <div className="space-y-2">
            {filteredContacts.map(contact => (
              <article key={contact.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                {contact.photoUrl ? <img src={contact.photoUrl} alt="" className="h-14 w-14 rounded-lg object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100 text-slate-400"><Camera size={20} /></div>}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-black text-slate-900">{contact.company || contact.name || contact.website || 'Captured contact'}</div>
                  <div className="truncate text-xs text-slate-500">{contact.email || contact.whatsapp || contact.phone || contact.website || 'Photo / QR saved'}</div>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${String(contact.invitationStatus).startsWith('Sent') ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{contact.invitationStatus || 'Pending'}</span>
                </div>
                <button onClick={() => handleEdit(contact)} className="rounded-lg p-2 text-slate-500"><Pencil size={16} /></button>
                <button onClick={() => handleDelete(contact)} className="rounded-lg p-2 text-red-500"><Trash2 size={16} /></button>
              </article>
            ))}
          </div>
        )}
      </section>

      {scannerOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div className="font-black">Scan QR Code</div><button onClick={stopScanner} className="p-2 text-slate-500"><X size={20} /></button></div>
            {scannerError ? <div className="p-6 text-center text-sm text-slate-600">{scannerError}</div> : <div className="bg-black p-3"><video ref={videoRef} playsInline muted className="aspect-square w-full rounded-xl object-cover" /><div className="mt-3 text-center text-sm font-bold text-white">Point the camera at the company QR code</div></div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEventContacts;
