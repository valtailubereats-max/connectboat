import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, storage, getDocsWithCacheFallback } from '../firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  CalendarDays,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  MapPin,
  Plus,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';

type EventPlan = 'standard' | 'featured' | 'premium';
type EventStatus = 'draft' | 'published' | 'ended';
type EventCategory = 'Boat Shows' | 'Regattas' | 'Marine Events' | 'Festivals' | 'Other';

type MarineEvent = {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  startDate: string;
  endDate?: string;
  country: string;
  city: string;
  venue: string;
  website?: string;
  ticketUrl?: string;
  imageUrl?: string;
  plan: EventPlan;
  pricePaid: number;
  paymentStatus: 'admin_free' | 'free' | 'paid' | 'pending';
  status: EventStatus;
  active: boolean;
  source: 'admin' | 'organizer';
  createdAt?: any;
  updatedAt?: any;
};

const CATEGORIES: EventCategory[] = [
  'Boat Shows',
  'Regattas',
  'Marine Events',
  'Festivals',
  'Other',
];

const PLAN_INFO: Record<EventPlan, { name: string; price: number; description: string }> = {
  standard: {
    name: 'Standard',
    price: 0,
    description: 'Normal listing in the Marine Events calendar.',
  },
  featured: {
    name: 'Featured',
    price: 9.99,
    description: 'Highlighted event with priority positioning.',
  },
  premium: {
    name: 'Premium',
    price: 19.99,
    description: 'Top-page prominence plus Featured visibility.',
  },
};

const compressImage = (file: File, maxWidth = 1600, quality = 0.86): Promise<Blob | File> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', quality);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });

const emptyForm = {
  title: '',
  description: '',
  category: 'Boat Shows' as EventCategory,
  startDate: '',
  endDate: '',
  country: 'United Kingdom',
  city: '',
  venue: '',
  website: '',
  ticketUrl: '',
  imageUrl: '',
  plan: 'standard' as EventPlan,
  status: 'published' as EventStatus,
  active: true,
};

export default function AdminFotos() {
  const { isAdmin, user, loading: authLoading } = useAuth();

  const [events, setEvents] = useState<MarineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MarineEvent | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const colPath = 'marineEvents';

  const toast = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage(null), 4200);
  };

  const loadEvents = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, colPath), orderBy('createdAt', 'desc'));
      const snap = await getDocsWithCacheFallback(q, colPath);
      const list: MarineEvent[] = [];
      snap.forEach((item) => list.push({ id: item.id, ...item.data() } as MarineEvent));
      setEvents(list);
    } catch (error) {
      console.error('Error loading marine events:', error);
      toast('Could not load Marine Events.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadEvents();
  }, [isAdmin]);

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setSelectedFile(null);
    setFormOpen(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setSelectedFile(null);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEdit = (event: MarineEvent) => {
    setEditing(event);
    setForm({
      title: event.title || '',
      description: event.description || '',
      category: event.category || 'Boat Shows',
      startDate: event.startDate || '',
      endDate: event.endDate || '',
      country: event.country || 'United Kingdom',
      city: event.city || '',
      venue: event.venue || '',
      website: event.website || '',
      ticketUrl: event.ticketUrl || '',
      imageUrl: event.imageUrl || '',
      plan: event.plan || 'standard',
      status: event.status || 'published',
      active: event.active !== false,
    });
    setSelectedFile(null);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storageRef = ref(storage, `marine_events/${Date.now()}_${safeName}`);
      const snapshot = await uploadBytes(storageRef, compressed);
      return await getDownloadURL(snapshot.ref);
    } finally {
      setUploading(false);
    }
  };

  const normaliseUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const saveEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title.trim() || !form.startDate || !form.city.trim()) {
      toast('Title, start date and city are required.', 'error');
      return;
    }

    if (form.endDate && form.endDate < form.startDate) {
      toast('End date cannot be before the start date.', 'error');
      return;
    }

    setSaving(true);
    try {
      let imageUrl = form.imageUrl.trim();
      if (selectedFile) imageUrl = await uploadImage(selectedFile);

      const planPrice = PLAN_INFO[form.plan].price;

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        startDate: form.startDate,
        endDate: form.endDate || '',
        country: form.country.trim() || 'United Kingdom',
        city: form.city.trim(),
        venue: form.venue.trim(),
        website: normaliseUrl(form.website),
        ticketUrl: normaliseUrl(form.ticketUrl),
        imageUrl,
        plan: form.plan,
        // Admin-created events bypass Stripe intentionally.
        pricePaid: 0,
        configuredPlanPrice: planPrice,
        paymentStatus: 'admin_free',
        status: form.status,
        active: form.active,
        source: 'admin',
        updatedAt: serverTimestamp(),
      };

      if (editing) {
        await updateDoc(doc(db, colPath, editing.id), payload);
        toast('Marine Event updated.');
      } else {
        await addDoc(collection(db, colPath), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast('Marine Event created.');
      }

      resetForm();
      await loadEvents();
    } catch (error) {
      console.error('Error saving marine event:', error);
      toast('Could not save the event.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (event: MarineEvent) => {
    try {
      await updateDoc(doc(db, colPath, event.id), {
        active: !event.active,
        updatedAt: serverTimestamp(),
      });
      setEvents((current) =>
        current.map((item) => (item.id === event.id ? { ...item, active: !item.active } : item))
      );
    } catch (error) {
      console.error(error);
      toast('Could not change event visibility.', 'error');
    }
  };

  const removeEvent = async (event: MarineEvent) => {
    if (!window.confirm(`Delete "${event.title}"? This action cannot be undone.`)) return;

    try {
      await deleteDoc(doc(db, colPath, event.id));
      setEvents((current) => current.filter((item) => item.id !== event.id));
      toast('Marine Event deleted.');
    } catch (error) {
      console.error(error);
      toast('Could not delete the event.', 'error');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[55vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white rounded-3xl border border-slate-200 p-8 text-center shadow-sm">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={34} />
        </div>
        <h1 className="text-2xl font-black text-slate-900">Restricted Access</h1>
        <p className="mt-2 text-sm text-slate-500">
          Only ConnectBoat administrators can manage Marine Events.
        </p>
      </div>
    );
  }

  const publishedCount = events.filter((event) => event.active && event.status === 'published').length;
  const featuredCount = events.filter((event) => event.plan === 'featured').length;
  const premiumCount = events.filter((event) => event.plan === 'premium').length;

  return (
    <div className="max-w-7xl mx-auto space-y-7 pb-16" id="admin-marine-events">
      {message && (
        <div
          className={`fixed top-5 right-5 z-[100] rounded-2xl px-5 py-4 shadow-xl border font-bold text-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-[0.18em]">
            <CalendarDays size={16} />
            ConnectBoat
          </div>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Marine Events</h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Create, publish and manage marine events displayed on ConnectBoat.
          </p>
        </div>

        <button
          onClick={openNew}
          className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl px-5 py-3.5 text-sm font-black shadow-sm"
        >
          <Plus size={18} />
          Add Event
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Total Events', events.length, CalendarDays],
          ['Published', publishedCount, CheckCircle2],
          ['Featured', featuredCount, Star],
          ['Premium', premiumCount, Sparkles],
        ].map(([label, value, Icon]: any) => (
          <div key={label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <Icon size={20} className="text-indigo-600 mb-3" />
            <div className="text-2xl font-black text-slate-900">{value}</div>
            <div className="text-xs font-bold text-slate-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
        <div className="font-black text-indigo-950 text-sm">Event pricing model</div>
        <div className="mt-3 grid sm:grid-cols-3 gap-3">
          {(Object.keys(PLAN_INFO) as EventPlan[]).map((key) => (
            <div key={key} className="bg-white/80 border border-indigo-100 rounded-xl p-4">
              <div className="font-black text-slate-900">{PLAN_INFO[key].name}</div>
              <div className="text-lg font-black text-indigo-700 mt-1">
                {PLAN_INFO[key].price === 0 ? 'FREE' : `£${PLAN_INFO[key].price.toFixed(2)}`}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {PLAN_INFO[key].description}
              </p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-indigo-700 font-bold mt-3">
          Events created directly by an administrator bypass payment. Public organiser submissions
          will use these plans when the Stripe submission flow is connected.
        </p>
      </div>

      {formOpen && (
        <form onSubmit={saveEvent} className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-black text-slate-900 text-xl">
                {editing ? 'Edit Marine Event' : 'Add Marine Event'}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Admin-created events can use any visibility plan without Stripe payment.
              </p>
            </div>
            <button type="button" onClick={resetForm} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 grid lg:grid-cols-2 gap-5">
            <label className="lg:col-span-2">
              <span className="text-xs font-black text-slate-600">Event title *</span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-indigo-500"
                placeholder="Southampton International Boat Show"
              />
            </label>

            <label>
              <span className="text-xs font-black text-slate-600">Category</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as EventCategory })}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-white"
              >
                {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>

            <label>
              <span className="text-xs font-black text-slate-600">Visibility plan</span>
              <select
                value={form.plan}
                onChange={(e) => setForm({ ...form, plan: e.target.value as EventPlan })}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-white"
              >
                <option value="standard">Standard — FREE</option>
                <option value="featured">Featured — £9.99</option>
                <option value="premium">Premium — £19.99</option>
              </select>
            </label>

            <label>
              <span className="text-xs font-black text-slate-600">Start date *</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold"
              />
            </label>

            <label>
              <span className="text-xs font-black text-slate-600">End date</span>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold"
              />
            </label>

            <label>
              <span className="text-xs font-black text-slate-600">Country</span>
              <input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold"
              />
            </label>

            <label>
              <span className="text-xs font-black text-slate-600">City *</span>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold"
                placeholder="Southampton"
              />
            </label>

            <label className="lg:col-span-2">
              <span className="text-xs font-black text-slate-600">Venue / Location</span>
              <input
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold"
                placeholder="Mayflower Park"
              />
            </label>

            <label>
              <span className="text-xs font-black text-slate-600">Official website</span>
              <input
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold"
                placeholder="https://..."
              />
            </label>

            <label>
              <span className="text-xs font-black text-slate-600">Tickets URL</span>
              <input
                value={form.ticketUrl}
                onChange={(e) => setForm({ ...form, ticketUrl: e.target.value })}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold"
                placeholder="https://..."
              />
            </label>

            <label className="lg:col-span-2">
              <span className="text-xs font-black text-slate-600">Description</span>
              <textarea
                rows={5}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold resize-y"
                placeholder="Tell visitors what makes this event worth attending..."
              />
            </label>

            <div className="lg:col-span-2">
              <span className="text-xs font-black text-slate-600">Event image</span>
              <div className="mt-2 grid md:grid-cols-[1fr_auto] gap-3">
                <input
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold"
                  placeholder="Image URL, or upload a file"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-black text-slate-700"
                >
                  <UploadCloud size={17} />
                  {selectedFile ? selectedFile.name : 'Upload Image'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <label>
              <span className="text-xs font-black text-slate-600">Status</span>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as EventStatus })}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-white"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="ended">Ended</option>
              </select>
            </label>

            <label className="flex items-end">
              <span className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3">
                <span className="text-sm font-black text-slate-700">Visible on website</span>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-5 h-5"
                />
              </span>
            </label>
          </div>

          <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
            <button type="button" onClick={resetForm} className="px-5 py-3 rounded-xl border border-slate-200 bg-white font-black text-sm text-slate-600">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-black text-sm inline-flex items-center justify-center gap-2"
            >
              {(saving || uploading) && <Loader2 size={17} className="animate-spin" />}
              {editing ? 'Save Changes' : 'Create Event'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="font-black text-slate-900">Event Management</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {events.length} {events.length === 1 ? 'event' : 'events'} registered.
          </p>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="animate-spin text-indigo-600" size={34} />
          </div>
        ) : events.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <ImagePlus size={38} className="mx-auto text-slate-300 mb-4" />
            <h3 className="font-black text-slate-900 text-lg">No Marine Events yet</h3>
            <p className="text-sm text-slate-500 mt-2">
              Create the first event and it will be ready for the public Events page.
            </p>
            <button onClick={openNew} className="mt-5 inline-flex items-center gap-2 bg-slate-900 text-white rounded-xl px-5 py-3 text-sm font-black">
              <Plus size={17} /> Add Event
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {events.map((event) => (
              <div key={event.id} className="p-5 sm:p-6 flex flex-col lg:flex-row gap-5 lg:items-center">
                <div className="w-full lg:w-28 h-24 rounded-2xl overflow-hidden bg-slate-100 shrink-0">
                  {event.imageUrl ? (
                    <img src={event.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <CalendarDays size={30} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-slate-900">{event.title}</h3>
                    <span className={`text-[10px] uppercase tracking-wider font-black px-2.5 py-1 rounded-full ${
                      event.plan === 'premium'
                        ? 'bg-amber-100 text-amber-800'
                        : event.plan === 'featured'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {event.plan || 'standard'}
                    </span>
                    {!event.active && (
                      <span className="text-[10px] uppercase font-black px-2.5 py-1 rounded-full bg-red-50 text-red-600">
                        Hidden
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={14} />
                      {event.startDate || 'No date'}{event.endDate ? ` → ${event.endDate}` : ''}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={14} />
                      {[event.venue, event.city, event.country].filter(Boolean).join(', ')}
                    </span>
                  </div>

                  <div className="mt-2 text-[11px] font-bold text-slate-400">
                    {event.category} · {event.paymentStatus === 'admin_free' ? 'Added by Admin — no charge' : event.paymentStatus}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  {event.website && (
                    <a
                      href={event.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-600"
                      title="Open official website"
                    >
                      <ExternalLink size={17} />
                    </a>
                  )}
                  <button
                    onClick={() => toggleActive(event)}
                    className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-600"
                    title={event.active ? 'Hide event' : 'Show event'}
                  >
                    {event.active ? <Eye size={17} /> : <EyeOff size={17} />}
                  </button>
                  <button
                    onClick={() => openEdit(event)}
                    className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-600"
                    title="Edit event"
                  >
                    <Edit3 size={17} />
                  </button>
                  <button
                    onClick={() => removeEvent(event)}
                    className="p-2.5 rounded-xl border border-red-100 bg-red-50 text-red-500 hover:bg-red-100"
                    title="Delete event"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
