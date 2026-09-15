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
  Upload,
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
const SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzSSNVxSMpK49FS-uGfdcIOdW_h9M1CbVbdGu77ZJl9hK1RDh9Ya4MG0Dunran77ShX/exec';

function normaliseWebsite(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}


function comparableText(value: string) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function comparablePhone(value: string) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `44${digits.slice(1)}`;
  return digits;
}

function websiteDomain(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return raw.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
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

function invitationText(_draft: ContactDraft) {
  return `Hi,\n\nWe’d like to introduce you to ConnectBoat, a UK boating marketplace connecting boat owners, buyers, charter customers and marine businesses.\n\nWe’d be delighted to welcome your business to the platform and invite you to discover ConnectBoat:\n\nhttps://connectboat.co.uk\n\nKind regards,\nValter\nConnectBoat`;
}

function emailSubject() {
  return 'Invitation to ConnectBoat.co.uk';
}

async function getRearCameraStream(): Promise<MediaStream> {
  // Prefer the physical rear/environment camera. Some mobile browsers ignore
  // capture="environment", so we request the camera directly instead.
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: 'environment' } },
      audio: false,
    });
  } catch {
    // Continue with device discovery / softer fallback below.
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(device => device.kind === 'videoinput');
    const rear = cameras.find(device => /back|rear|environment|world/i.test(device.label))
      || [...cameras].reverse().find(device => !/front|user|selfie/i.test(device.label));

    if (rear?.deviceId) {
      return await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: rear.deviceId } },
        audio: false,
      });
    }
  } catch {
    // Fall back to an environment preference.
  }

  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  });
}

async function improveCameraImage(stream: MediaStream) {
  const track = stream.getVideoTracks()[0];
  if (!track) return;
  try {
    const capabilities: any = track.getCapabilities?.() || {};
    const advanced: any[] = [];
    if (capabilities.focusMode?.includes?.('continuous')) advanced.push({ focusMode: 'continuous' });
    if (capabilities.exposureMode?.includes?.('continuous')) advanced.push({ exposureMode: 'continuous' });
    if (capabilities.whiteBalanceMode?.includes?.('continuous')) advanced.push({ whiteBalanceMode: 'continuous' });
    if (capabilities.exposureCompensation) {
      const min = Number(capabilities.exposureCompensation.min ?? 0);
      const max = Number(capabilities.exposureCompensation.max ?? 0);
      const step = Number(capabilities.exposureCompensation.step ?? 0.1) || 0.1;
      const target = Math.max(min, Math.min(max, Math.round((Math.min(max, 1) / step)) * step));
      if (target > 0) advanced.push({ exposureCompensation: target });
    }
    if (advanced.length) await track.applyConstraints({ advanced } as any);
  } catch (error) {
    console.warn('Camera enhancement not supported on this device:', error);
  }
}


type ProspectImportRow = {
  name?: unknown;
  company?: unknown;
  whatsapp?: unknown;
  phone?: unknown;
  email?: unknown;
  website?: unknown;
  linkedin?: unknown;
  otherContact?: unknown;
  notes?: unknown;
};

function importString(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function prospectToDraft(row: ProspectImportRow): ContactDraft {
  return {
    name: importString(row.name),
    company: importString(row.company),
    whatsapp: importString(row.whatsapp),
    phone: importString(row.phone),
    email: importString(row.email),
    website: normaliseWebsite(importString(row.website)),
    linkedin: importString(row.linkedin),
    otherContact: importString(row.otherContact),
    notes: importString(row.notes),
    rawSource: '',
    invitationChannel: '',
    invitationStatus: 'Pending',
  };
}

function prospectMatchesExisting(prospect: ContactDraft, contact: EventContact) {
  const email = comparableText(prospect.email);
  const phone = comparablePhone(prospect.phone);
  const whatsapp = comparablePhone(prospect.whatsapp);
  const domain = websiteDomain(prospect.website);
  const company = comparableText(prospect.company);

  const contactEmail = comparableText(contact.email);
  const contactPhone = comparablePhone(contact.phone);
  const contactWhatsapp = comparablePhone(contact.whatsapp);
  const contactDomain = websiteDomain(contact.website);
  const contactCompany = comparableText(contact.company);

  if (email && contactEmail && email === contactEmail) return true;
  if (phone && (phone === contactPhone || phone === contactWhatsapp)) return true;
  if (whatsapp && (whatsapp === contactWhatsapp || whatsapp === contactPhone)) return true;
  if (domain && contactDomain && domain === contactDomain) return true;
  if (company && contactCompany && company.length >= 5 && company === contactCompany) return true;
  return false;
}


type EventContactsErrorBoundaryState = {
  error: Error | null;
  info: React.ErrorInfo | null;
};

class EventContactsErrorBoundary extends React.Component<
  { children: React.ReactNode },
  EventContactsErrorBoundaryState
> {
  state: EventContactsErrorBoundaryState = { error: null, info: null };

  static getDerivedStateFromError(error: Error): EventContactsErrorBoundaryState {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('AdminEventContacts render crash:', error, info);
    this.setState({ error, info });
  }

  render() {
    if (!this.state.error) return this.props.children;

    const error = this.state.error;
    return (
      <div translate="no" className="notranslate mx-auto max-w-4xl p-4 sm:p-6">
        <div className="rounded-2xl border-2 border-red-500 bg-white p-5 shadow-lg">
          <h2 className="text-xl font-black text-red-700">Event Contacts crashed</h2>
          <p className="mt-2 text-sm font-bold text-slate-800">
            Take a screenshot of this red box and send it to me.
          </p>
          <div className="mt-4 rounded-xl bg-red-50 p-3">
            <div className="text-xs font-black uppercase text-red-700">Error</div>
            <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-900">
              {error.name}: {error.message}
            </pre>
          </div>
          {error.stack && (
            <div className="mt-3 rounded-xl bg-slate-100 p-3">
              <div className="text-xs font-black uppercase text-slate-700">JavaScript stack</div>
              <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[11px] text-slate-800">
                {error.stack}
              </pre>
            </div>
          )}
          {this.state.info?.componentStack && (
            <div className="mt-3 rounded-xl bg-slate-100 p-3">
              <div className="text-xs font-black uppercase text-slate-700">React component stack</div>
              <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[11px] text-slate-800">
                {this.state.info.componentStack}
              </pre>
            </div>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-3 font-black text-white"
          >
            Reload Event Contacts
          </button>
        </div>
      </div>
    );
  }
}

const AdminEventContactsContent: React.FC = () => {
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
  const [historyFilter, setHistoryFilter] = useState<'All' | InvitationStatus | 'No contact details'>('All');
  const [historyPage, setHistoryPage] = useState(1);
  const [isolatedContactId, setIsolatedContactId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [message, setMessage] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const [cardCameraOpen, setCardCameraOpen] = useState(false);
  const [cardCameraError, setCardCameraError] = useState('');
  const [capturedCardFile, setCapturedCardFile] = useState<File | null>(null);
  const [capturedCardPreview, setCapturedCardPreview] = useState('');
  const cardVideoRef = useRef<HTMLVideoElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const prospectImportInputRef = useRef<HTMLInputElement | null>(null);
  const cardStreamRef = useRef<MediaStream | null>(null);

  const duplicateMatch = useMemo(() => {
    if (editingId) return null;
    const email = comparableText(draft.email);
    const phone = comparablePhone(draft.phone);
    const whatsapp = comparablePhone(draft.whatsapp);
    const domain = websiteDomain(draft.website);
    const company = comparableText(draft.company);

    return contacts.find(contact => {
      const contactEmail = comparableText(contact.email);
      const contactPhone = comparablePhone(contact.phone);
      const contactWhatsapp = comparablePhone(contact.whatsapp);
      const contactDomain = websiteDomain(contact.website);
      const contactCompany = comparableText(contact.company);

      if (email && contactEmail && email === contactEmail) return true;
      if (phone && (phone === contactPhone || phone === contactWhatsapp)) return true;
      if (whatsapp && (whatsapp === contactWhatsapp || whatsapp === contactPhone)) return true;
      if (domain && contactDomain && domain === contactDomain) return true;
      if (company && contactCompany && company.length >= 5 && company === contactCompany) return true;
      return false;
    }) || null;
  }, [contacts, draft.email, draft.phone, draft.whatsapp, draft.website, draft.company, editingId]);

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contacts.filter(contact => {
      if (isolatedContactId && contact.id !== isolatedContactId) return false;
      const matchesSearch = !term || [
        contact.name, contact.company, contact.phone, contact.whatsapp, contact.email,
        contact.website, contact.linkedin, contact.otherContact, contact.notes,
        contact.invitationChannel, contact.invitationStatus,
      ].some(value => String(value || '').toLowerCase().includes(term));
      if (!matchesSearch) return false;

      if (historyFilter === 'No contact details') {
        return !Boolean(
          contact.phone?.trim() || contact.whatsapp?.trim() || contact.email?.trim() ||
          contact.linkedin?.trim() || contact.otherContact?.trim()
        );
      }
      if (historyFilter !== 'All') return (contact.invitationStatus || 'Pending') === historyFilter;
      return true;
    });
  }, [contacts, search, historyFilter, isolatedContactId]);

  const HISTORY_PAGE_SIZE = 25;
  const historyPageCount = Math.max(1, Math.ceil(filteredContacts.length / HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, historyPageCount);
  const historyStart = (safeHistoryPage - 1) * HISTORY_PAGE_SIZE;
  const paginatedContacts = filteredContacts.slice(historyStart, historyStart + HISTORY_PAGE_SIZE);

  useEffect(() => {
    setHistoryPage(1);
  }, [search, historyFilter]);

  useEffect(() => {
    if (historyPage > historyPageCount) setHistoryPage(historyPageCount);
  }, [historyPage, historyPageCount]);

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
    cardStreamRef.current?.getTracks().forEach(track => track.stop());
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

  const stopCardCamera = () => {
    cardStreamRef.current?.getTracks().forEach(track => track.stop());
    cardStreamRef.current = null;
    if (capturedCardPreview) URL.revokeObjectURL(capturedCardPreview);
    setCapturedCardFile(null);
    setCapturedCardPreview('');
    setCardCameraOpen(false);
  };

  const openNativeCamera = () => {
    setMessage('');
    nativeCameraInputRef.current?.click();
  };

  const handleNativeCameraPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await handleBusinessCard(file);
  };

  const startCardCamera = async () => {
    setCardCameraError('');
    setMessage('');
    if (capturedCardPreview) URL.revokeObjectURL(capturedCardPreview);
    setCapturedCardFile(null);
    setCapturedCardPreview('');
    try {
      setCardCameraOpen(true);
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: 'environment' },
            width: { ideal: 3840 },
            height: { ideal: 2160 },
          },
          audio: false,
        });
      } catch {
        stream = await getRearCameraStream();
      }
      cardStreamRef.current = stream;
      await improveCameraImage(stream);
      window.setTimeout(async () => {
        const video = cardVideoRef.current;
        if (!video) return;
        video.srcObject = stream;
        try {
          await video.play();
        } catch (error) {
          console.error('Camera preview failed:', error);
          setCardCameraError('The rear camera opened, but the preview could not start.');
        }
      }, 50);
    } catch (error) {
      console.error(error);
      stopCardCamera();
      setCardCameraOpen(true);
      setCardCameraError('Rear camera access was not available. Check the browser camera permission.');
    }
  };

  const captureBusinessCard = async () => {
    const stream = cardStreamRef.current;
    const track = stream?.getVideoTracks()[0];
    const video = cardVideoRef.current;
    if (!track || !video) return;

    try {
      let blob: Blob | null = null;
      const ImageCaptureCtor = (window as any).ImageCapture;

      if (ImageCaptureCtor) {
        try {
          const imageCapture = new ImageCaptureCtor(track);
          blob = await imageCapture.takePhoto();
        } catch (error) {
          console.warn('High-resolution ImageCapture failed; using video-frame fallback.', error);
        }
      }

      if (!blob) {
        if (video.videoWidth <= 0 || video.videoHeight <= 0) return;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) return;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.96));
      }

      if (!blob) throw new Error('Could not capture the photo.');
      const type = blob.type || 'image/jpeg';
      const extension = type.includes('png') ? 'png' : 'jpg';
      const file = new File([blob], `business-card-${Date.now()}.${extension}`, { type });

      cardStreamRef.current?.getTracks().forEach(cameraTrack => cameraTrack.stop());
      cardStreamRef.current = null;
      setCapturedCardFile(file);
      if (capturedCardPreview) URL.revokeObjectURL(capturedCardPreview);
      setCapturedCardPreview(URL.createObjectURL(file));
    } catch (error) {
      console.error(error);
      setCardCameraError('Could not capture this photo. Please try again.');
    }
  };

  const retakeBusinessCard = async () => {
    if (capturedCardPreview) URL.revokeObjectURL(capturedCardPreview);
    setCapturedCardFile(null);
    setCapturedCardPreview('');
    setCardCameraOpen(false);
    window.setTimeout(() => startCardCamera(), 50);
  };

  const useCapturedBusinessCard = async () => {
    const file = capturedCardFile;
    if (!file) return;
    if (capturedCardPreview) URL.revokeObjectURL(capturedCardPreview);
    setCapturedCardFile(null);
    setCapturedCardPreview('');
    setCardCameraOpen(false);
    await handleBusinessCard(file);
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
    const qrDraft: ContactDraft = { ...EMPTY_DRAFT, ...parsed };
    const existingMatch = contacts.find(contact => prospectMatchesExisting(qrDraft, contact)) || null;
    stopScanner();

    if (existingMatch) {
      setDraft({ ...EMPTY_DRAFT });
      setEditingId(null);
      setExistingPhotoUrl('');
      setExistingPhotoPath('');
      setPhotoFile(null);
      setPhotoPreview('');
      setMoreOpen(false);
      setHistoryFilter('All');
      setHistoryPage(1);
      setSearch('');
      setIsolatedContactId(existingMatch.id);
      setMessage(`Existing contact found: ${existingMatch.company || existingMatch.name || 'contact'}. Only this contact is shown in Contact history.`);
      return;
    }

    setIsolatedContactId(null);
    setDraft(prev => ({ ...prev, ...parsed }));
    setMessage('QR read. No existing contact was found. I used every contact detail available in it.');
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
      const stream = await getRearCameraStream();
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

  const prepareCardImageSafely = async (file: File): Promise<File> => {
    const MAX_SIDE = 1600;
    try {
      const bitmap = await createImageBitmap(file, {
        resizeWidth: MAX_SIDE,
        resizeHeight: MAX_SIDE,
        resizeQuality: 'high',
      } as ImageBitmapOptions);

      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) {
        bitmap.close();
        return file;
      }
      context.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();

      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/jpeg', 0.88)
      );
      if (!blob) return file;
      return new File([blob], `card-${Date.now()}.jpg`, { type: 'image/jpeg' });
    } catch (error) {
      console.warn('Safe image resize unavailable; using compressed fallback.', error);
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.35,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
        fileType: 'image/jpeg',
      });
      return compressed as File;
    }
  };

  const analyseBusinessCard = async (file: File) => {
    if (!user) return;
    setAnalysing(true);
    setMessage('Reading card / sign…');
    try {
      const image = await fileToDataUrl(file);
      const token = await user.getIdToken();
      const response = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image, mode: 'businessCard' }),
      });
      const result = await response.json();
      if (!result?.success) throw new Error(result?.error || 'Card reading failed.');
      const data = result.data || {};
      const extracted: ContactDraft = {
        ...EMPTY_DRAFT,
        name: data.name || '',
        company: data.company || '',
        phone: data.phone || '',
        whatsapp: data.whatsapp || '',
        email: data.email || '',
        website: normaliseWebsite(data.website || ''),
        linkedin: data.linkedin || '',
        otherContact: data.otherContact || '',
        rawSource: data.rawText || '',
      };
      const existingMatch = contacts.find(contact => prospectMatchesExisting(extracted, contact)) || null;

      if (existingMatch) {
        const matchLabel = existingMatch.company || existingMatch.name || 'existing contact';
        setDraft({ ...EMPTY_DRAFT });
        setEditingId(null);
        setExistingPhotoUrl('');
        setExistingPhotoPath('');
        setPhotoFile(null);
        setPhotoPreview('');
        setMoreOpen(false);
        setHistoryFilter('All');
        setHistoryPage(1);
        setSearch('');
        setIsolatedContactId(existingMatch.id);
        setMessage(`Existing contact found: ${matchLabel}. Only this contact is shown in Contact history. You can edit or review it.`);
        return;
      }

      setIsolatedContactId(null);
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
      setMessage('Card / sign read. Check every extracted detail, then send or save for later.');
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || 'Could not read this card / sign. The photo is still available to save.');
    } finally {
      setAnalysing(false);
    }
  };

  const handleBusinessCard = async (file?: File) => {
    if (!file) return;
    setAnalysing(true);
    setMessage('Preparing photo safely…');
    try {
      const safeFile = await prepareCardImageSafely(file);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoFile(safeFile);
      setPhotoPreview(URL.createObjectURL(safeFile));
      await analyseBusinessCard(safeFile);
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || 'Could not prepare this photo. Please try again.');
      setAnalysing(false);
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
    const path = `event-contacts/${user.uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' });
    return { photoUrl: await getDownloadURL(storageRef), photoPath: path };
  };

  const toSheetContact = (contactId: string, contact: Partial<ContactDraft>) => ({
    contactId,
    name: contact.name || '',
    company: contact.company || '',
    whatsapp: contact.whatsapp || '',
    phone: contact.phone || '',
    email: contact.email || '',
    website: normaliseWebsite(contact.website || ''),
    linkedin: contact.linkedin || '',
    otherContact: contact.otherContact || '',
    invitationChannel: contact.invitationChannel || '',
    invitationStatus: contact.invitationStatus || 'Pending',
    notes: contact.notes || '',
  });

  const postToSheets = async (body: unknown) => {
    await fetch(SHEETS_WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    });
  };

  const syncOneToSheets = async (contactId: string, contact: Partial<ContactDraft>) => {
    try {
      await postToSheets({ action: 'upsert', contact: toSheetContact(contactId, contact) });
    } catch (error) {
      console.error('Google Sheets sync failed:', error);
    }
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
        await syncOneToSheets(editingId, merged);
        return editingId;
      }

      const created = await addDoc(collection(db, 'eventContacts'), payload);
      setEditingId(created.id);
      setDraft(merged);
      setExistingPhotoUrl(uploaded.photoUrl || '');
      setExistingPhotoPath(uploaded.photoPath || '');
      setPhotoFile(null);
      await syncOneToSheets(created.id, merged);
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
    const number = normaliseWhatsapp(draft.whatsapp);
    if (!number) return;
    const url = `https://wa.me/${number}?text=${encodeURIComponent(invitationText(draft))}`;
    try {
      await saveCurrent({ invitationStatus: 'Sent – WhatsApp', invitationChannel: 'WhatsApp' });
      await loadContacts();
      resetForm();
      window.location.href = url;
    } catch (error) {
      console.error(error);
      setMessage('Could not save the contact before opening WhatsApp.');
    }
  };

  const sendEmail = async () => {
    const email = draft.email.trim();
    if (!email) return;
    const url = `mailto:${email}?subject=${encodeURIComponent(emailSubject())}&body=${encodeURIComponent(invitationText(draft))}`;
    try {
      await saveCurrent({ invitationStatus: 'Sent – Email', invitationChannel: 'Email' });
      await loadContacts();
      resetForm();
      window.location.href = url;
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

  const openWebsiteInNewTab = () => {
    const url = normaliseWebsite(draft.website);
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
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
  };

  const openDuplicateContact = () => {
    if (!duplicateMatch) return;
    handleEdit(duplicateMatch);
    setMessage('Existing contact opened. Add or correct the new information here instead of creating a duplicate.');
  };

  const saveDuplicateAnyway = async () => {
    try {
      await saveCurrent({ invitationStatus: 'Pending', invitationChannel: '' });
      await loadContacts();
      resetForm();
      setMessage('Contact saved separately.');
    } catch (error) {
      console.error(error);
      setMessage('Could not save this contact.');
    }
  };

  const handleDelete = async (contact: EventContact) => {
    if (!window.confirm(`Delete ${contact.company || contact.name || 'this contact'}?`)) return;
    try {
      await deleteDoc(doc(db, 'eventContacts', contact.id));
      if (contact.photoPath) deleteObject(ref(storage, contact.photoPath)).catch(() => undefined);

      try {
        await postToSheets({ action: 'delete', contactId: contact.id });
      } catch (sheetError) {
        console.error('Google Sheets delete sync failed:', sheetError);
      }

      setContacts(prev => prev.filter(item => item.id !== contact.id));
      setMessage('Contact deleted from ConnectBoat and Google Sheets.');
    } catch (error) {
      console.error(error);
      setMessage('Could not delete this contact.');
    }
  };

  const deleteNoContactDetails = async () => {
    const noContactDetails = contacts.filter(contact => !Boolean(
      contact.phone?.trim() || contact.whatsapp?.trim() || contact.email?.trim() ||
      contact.linkedin?.trim() || contact.otherContact?.trim()
    ));
    if (!noContactDetails.length) return;

    if (!window.confirm(`Delete all ${noContactDetails.length} contacts with no contact details? Websites alone are not considered contact details.`)) return;

    setSaving(true);
    setMessage(`Deleting ${noContactDetails.length} contacts from ConnectBoat and Google Sheets…`);

    let deleted = 0;
    let failed = 0;

    for (const contact of noContactDetails) {
      try {
        await deleteDoc(doc(db, 'eventContacts', contact.id));
        if (contact.photoPath) deleteObject(ref(storage, contact.photoPath)).catch(() => undefined);
        try {
          await postToSheets({ action: 'delete', contactId: contact.id });
        } catch (sheetError) {
          console.error('Google Sheets delete sync failed:', sheetError);
        }
        deleted += 1;
      } catch (error) {
        console.error(`Could not delete ${contact.company || contact.name || contact.id}:`, error);
        failed += 1;
      }
    }

    await loadContacts();
    setSaving(false);
    setMessage(
      failed
        ? `Bulk delete finished: ${deleted} deleted, ${failed} failed.`
        : `Bulk delete complete: ${deleted} contacts deleted from ConnectBoat and Google Sheets.`
    );
  };

  const importProspects = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user || !isAdmin) return;

    setSaving(true);
    setMessage('Checking prospect file…');
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const rows: ProspectImportRow[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.prospects)
          ? parsed.prospects
          : [];

      if (!rows.length) throw new Error('No prospects were found in this JSON file.');

      const workingContacts = [...contacts];
      let imported = 0;
      let skipped = 0;

      for (const row of rows) {
        const prospect = prospectToDraft(row);
        const hasUsefulData = Boolean(
          prospect.name || prospect.company || prospect.phone || prospect.whatsapp ||
          prospect.email || prospect.website || prospect.linkedin || prospect.otherContact
        );

        if (!hasUsefulData || workingContacts.some(contact => prospectMatchesExisting(prospect, contact))) {
          skipped += 1;
          continue;
        }

        const payload = {
          ...prospect,
          photoUrl: '',
          photoPath: '',
          createdBy: user.uid,
        };
        const created = await addDoc(collection(db, 'eventContacts'), payload);
        await syncOneToSheets(created.id, prospect);
        workingContacts.push({ id: created.id, ...payload } as EventContact);
        imported += 1;
      }

      await loadContacts();
      setMessage(`Import complete: ${imported} prospect${imported === 1 ? '' : 's'} added as Pending. ${skipped} duplicate/empty ${skipped === 1 ? 'record was' : 'records were'} skipped.`);
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || 'Could not import this prospect file.');
    } finally {
      setSaving(false);
    }
  };

 const copyForSheets = async () => {
  if (!contacts.length) return;

  // Open immediately from the user's click so Chrome does not block it.
  window.open(SHEET_URL, '_blank', 'noopener,noreferrer');

  try {
    const sheetContacts = contacts.map(contact =>
      toSheetContact(contact.id, contact)
    );

    await postToSheets({
      action: 'syncAll',
      contacts: sheetContacts
    });

    setMessage(
      `Google Sheets sync sent for ${contacts.length} contact${contacts.length === 1 ? '' : 's'}.`
    );
  } catch (error) {
    console.error(error);
    setMessage('Could not send the contacts to Google Sheets.');
  }
};

  if (!isAdmin) return null;

  const foundSomething = Boolean(draft.name || draft.company || draft.phone || draft.whatsapp || draft.email || draft.website || draft.linkedin || draft.otherContact || draft.rawSource || photoFile || existingPhotoUrl);
  const whatsappAvailable = Boolean(draft.whatsapp.trim());
  const emailAvailable = Boolean(draft.email.trim());
  const websiteAvailable = Boolean(draft.website.trim());
  const isResending = Boolean(editingId && String(draft.invitationStatus || '').startsWith('Sent'));
  const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
  const labelClass = 'mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500';

  return (
    <div translate="no" className="notranslate mx-auto max-w-5xl space-y-5 p-3 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Event Contacts</h1>
          <p className="text-sm text-slate-500">Scan. Check. Invite. Move to the next stand.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={prospectImportInputRef}
            type="file"
            accept="application/json,.json"
            onChange={importProspects}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => prospectImportInputRef.current?.click()}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            <Upload size={16} /> Import Prospects
          </button>
          <button onClick={copyForSheets} disabled={!contacts.length} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">Google Sheets</button>
        </div>
      </div>

      {message && <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800">{message}</div>}

      <section id="event-contact-form" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <input
          ref={nativeCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleNativeCameraPhoto}
          className="hidden"
        />

        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={startScanner} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-3 py-3 font-black text-white shadow-sm">
            <QrCode size={28} /> Scan QR
          </button>
          <button type="button" onClick={startCardCamera} disabled={analysing} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-center font-black text-slate-800 disabled:opacity-60">
            {analysing ? <Loader2 size={28} className="animate-spin" /> : <Camera size={28} />}
            {analysing ? 'Reading Card…' : 'Take Photo'}
          </button>
        </div>

        {(photoPreview || existingPhotoUrl) && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <img src={photoPreview || existingPhotoUrl} alt="Card or business sign" className="h-20 w-28 rounded-lg object-cover" />
            <div className="text-xs text-slate-500"><div className="font-bold text-slate-700">Photo saved</div><div>It can be checked later on desktop.</div></div>
          </div>
        )}

        {duplicateMatch && (
          <div className="mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
            <div className="font-black text-amber-900">⚠️ Possible duplicate</div>
            <div className="mt-1 text-sm text-amber-800">
              <strong>{duplicateMatch.company || duplicateMatch.name || duplicateMatch.website || 'This contact'}</strong> is already in your contact history.
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={openDuplicateContact} className="rounded-xl bg-amber-600 px-4 py-3 font-black text-white">Open existing contact</button>
              <button type="button" onClick={saveDuplicateAnyway} disabled={saving} className="rounded-xl border border-amber-300 bg-white px-4 py-3 font-bold text-amber-900 disabled:opacity-60">Save anyway</button>
            </div>
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

            {!duplicateMatch && <div className="mt-4 space-y-2">
              {whatsappAvailable && (
                <button onClick={sendWhatsApp} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 font-black text-white disabled:opacity-60"><MessageCircle size={20} /> {isResending ? 'Resend via WhatsApp' : 'Send Invitation via WhatsApp'}</button>
              )}
              {emailAvailable && (!whatsappAvailable || isResending) && (
                <button onClick={sendEmail} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 font-black text-white disabled:opacity-60"><Mail size={20} /> {isResending ? 'Resend via Email' : 'Send Invitation via Email'}</button>
              )}
              {!whatsappAvailable && !emailAvailable && websiteAvailable && (
                <button onClick={openWebsite} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3.5 font-black text-white disabled:opacity-60"><ExternalLink size={20} /> Save & Open Website</button>
              )}
              <button onClick={saveForLater} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 disabled:opacity-60">
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save for later
              </button>
            </div>}
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
            <label>
              <span className={labelClass}>Website</span>
              <div className="flex gap-2">
                <input className={fieldClass} value={draft.website} onChange={e => updateDraft('website', e.target.value)} inputMode="url" />
                {websiteAvailable && (
                  <button type="button" onClick={openWebsiteInNewTab} className="flex shrink-0 items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-700" title="Open website in a new tab">
                    <ExternalLink size={17} /> Open
                  </button>
                )}
              </div>
            </label>
            <label><span className={labelClass}>LinkedIn</span><input className={fieldClass} value={draft.linkedin} onChange={e => updateDraft('linkedin', e.target.value)} /></label>
            <label><span className={labelClass}>Other contact</span><input className={fieldClass} value={draft.otherContact} onChange={e => updateDraft('otherContact', e.target.value)} /></label>
            <label className="sm:col-span-2"><span className={labelClass}>Notes</span><textarea className={`${fieldClass} min-h-20`} value={draft.notes} onChange={e => updateDraft('notes', e.target.value)} /></label>
          </div>
        )}
      </section>

      <section id="contact-history" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-black text-slate-900">Contact history</h2>
              <p className="text-xs text-slate-500">{contacts.length} captured{(search || historyFilter !== 'All') && ` • ${filteredContacts.length} matching`}</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <div className="relative min-w-0 sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => { setIsolatedContactId(null); setSearch(e.target.value); }} placeholder="Search name, company, email…" className={`${fieldClass} pl-9`} />
              </div>
              <select
                value={historyFilter}
                onChange={e => { setIsolatedContactId(null); setHistoryFilter(e.target.value as 'All' | InvitationStatus | 'No contact details'); }}
                className={`${fieldClass} sm:w-52`}
              >
                <option value="All">All contacts</option>
                <option value="Pending">Pending</option>
                <option value="Sent – Email">Sent – Email</option>
                <option value="Sent – WhatsApp">Sent – WhatsApp</option>
                <option value="Sent – Other">Sent – Other</option>
                <option value="No contact details">No contact details</option>
              </select>
            </div>
          </div>
        </div>

        {historyFilter === 'No contact details' && filteredContacts.length > 0 && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
            <div className="mb-2 text-xs font-semibold text-red-700">
              Website alone is not considered a contact method. This will delete all {filteredContacts.length} records with no phone, WhatsApp, email, LinkedIn or other contact.
            </div>
            <button
              type="button"
              onClick={deleteNoContactDetails}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {saving ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
              Delete all {filteredContacts.length} without contact details
            </button>
          </div>
        )}

        {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-600" /></div> : filteredContacts.length === 0 ? (
          <div className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-500">No contacts match this search or filter.</div>
        ) : (
          <>
            <div className="space-y-2">
              {paginatedContacts.map(contact => {
                const hasDirectContact = Boolean(
                  contact.email?.trim() || contact.whatsapp?.trim() || contact.phone?.trim() ||
                  contact.linkedin?.trim() || contact.otherContact?.trim()
                );
                return (
                  <article key={contact.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
                    {contact.photoUrl ? <img src={contact.photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" /> : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400"><Camera size={20} /></div>}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-black text-slate-900">{contact.company || contact.name || contact.website || 'Captured contact'}</div>
                      {contact.company && contact.name && <div className="truncate text-xs font-medium text-slate-600">{contact.name}</div>}
                      <div className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-slate-500 sm:grid-cols-2">
                        {contact.email && <div className="truncate"><span className="font-semibold text-slate-600">Email:</span> {contact.email}</div>}
                        {contact.whatsapp && <div className="truncate"><span className="font-semibold text-slate-600">WhatsApp:</span> {contact.whatsapp}</div>}
                        {contact.phone && <div className="truncate"><span className="font-semibold text-slate-600">Phone:</span> {contact.phone}</div>}
                        {contact.website && <div className="truncate"><span className="font-semibold text-slate-600">Website:</span> {contact.website}</div>}
                        {contact.linkedin && <div className="truncate"><span className="font-semibold text-slate-600">LinkedIn:</span> {contact.linkedin}</div>}
                        {contact.otherContact && <div className="truncate"><span className="font-semibold text-slate-600">Other:</span> {contact.otherContact}</div>}
                      </div>
                      {!hasDirectContact && <div className="mt-1 text-xs font-semibold text-slate-400">No contact details saved</div>}
                      <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${String(contact.invitationStatus).startsWith('Sent') ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{contact.invitationStatus || 'Pending'}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => handleEdit(contact)} className="rounded-lg p-2 text-slate-500" title="Edit contact"><Pencil size={16} /></button>
                      <button onClick={() => handleDelete(contact)} className="rounded-lg p-2 text-red-500" title="Delete contact"><Trash2 size={16} /></button>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div className="text-xs font-medium text-slate-500">{historyStart + 1}–{Math.min(historyStart + HISTORY_PAGE_SIZE, filteredContacts.length)} of {filteredContacts.length}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setHistoryPage(page => Math.max(1, page - 1))} disabled={safeHistoryPage <= 1} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                <span className="min-w-20 text-center text-xs font-bold text-slate-600">Page {safeHistoryPage} of {historyPageCount}</span>
                <button type="button" onClick={() => setHistoryPage(page => Math.min(historyPageCount, page + 1))} disabled={safeHistoryPage >= historyPageCount} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
              </div>
            </div>
          </>
        )}
      </section>

      {cardCameraOpen && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/90 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="font-black">Scan Card / Sign</div>
              <button onClick={stopCardCamera} className="p-2 text-slate-500"><X size={20} /></button>
            </div>
            {cardCameraError ? (
              <div className="p-6 text-center text-sm text-slate-600">
                <div>{cardCameraError}</div>
                <button type="button" onClick={startCardCamera} className="mt-4 rounded-xl bg-indigo-600 px-4 py-3 font-black text-white">Try Rear Camera Again</button>
              </div>
            ) : capturedCardPreview ? (
              <div className="bg-black p-3">
                <img src={capturedCardPreview} alt="Captured card preview" className="max-h-[65vh] w-full rounded-xl object-contain" />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={retakeBusinessCard} className="rounded-xl border border-white/30 bg-slate-800 px-4 py-3 font-black text-white">Retake</button>
                  <button type="button" onClick={useCapturedBusinessCard} className="rounded-xl bg-white px-4 py-3 font-black text-slate-900">Use Photo</button>
                </div>
              </div>
            ) : (
              <div className="bg-black p-3">
                <video ref={cardVideoRef} playsInline muted className="max-h-[65vh] w-full rounded-xl object-contain" />
                <div className="mt-3 text-center text-sm font-bold text-white">Rear camera • fit the whole card or business sign inside the frame.</div>
                <button type="button" onClick={captureBusinessCard} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-black text-slate-900">
                  <Camera size={20} /> Take Photo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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


const AdminEventContacts: React.FC = () => (
  <EventContactsErrorBoundary>
    <AdminEventContactsContent />
  </EventContactsErrorBoundary>
);

export default AdminEventContacts;
