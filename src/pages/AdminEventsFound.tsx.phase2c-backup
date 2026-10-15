import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Loader2,
  RefreshCw,
  MapPin,
  Plus,
  Search,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  ExternalEventCandidate,
  ExternalEventReviewStatus,
  MarineEventCategory,
} from '../types/marineEvents';
import {
  canonicalizeEventUrl,
  generateEventDedupeKey,
  normalizeEventCity,
  normalizeEventTitle,
  normalizeEventVenue,
} from '../utils/eventDeduplication';

const COLLECTION_NAME = 'externalEventCandidates';

const CATEGORIES: MarineEventCategory[] = [
  'Boat Shows',
  'Regattas',
  'Marine Events',
  'Festivals',
  'Other',
];

const EDITABLE_FIELDS = [
  'title',
  'startDate',
  'endDate',
  'country',
  'city',
  'venue',
  'category',
  'website',
  'ticketUrl',
] as const;

type CandidateForm = {
  title: string;
  startDate: string;
  endDate: string;
  country: string;
  city: string;
  venue: string;
  category: MarineEventCategory;
  website: string;
  ticketUrl: string;
  sourceName: string;
  sourceUrl: string;
  externalId: string;
};

const emptyForm: CandidateForm = {
  title: '',
  startDate: '',
  endDate: '',
  country: 'United Kingdom',
  city: '',
  venue: '',
  category: 'Marine Events',
  website: '',
  ticketUrl: '',
  sourceName: 'Admin test candidate',
  sourceUrl: '',
  externalId: '',
};

const toMillis = (value: unknown) => {
  if (value && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
};

const formatDateRange = (startDate: string, endDate?: string) => {
  const format = (value?: string) => {
    if (!value) return '';
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const start = format(startDate);
  const end = format(endDate);
  return end && end !== start ? `${start} – ${end}` : start;
};

const formFromCandidate = (candidate: ExternalEventCandidate): CandidateForm => ({
  title: candidate.title || '',
  startDate: candidate.startDate || '',
  endDate: candidate.endDate || '',
  country: candidate.country || '',
  city: candidate.city || '',
  venue: candidate.venue || '',
  category: candidate.category || 'Marine Events',
  website: candidate.website || '',
  ticketUrl: candidate.ticketUrl || '',
  sourceName: candidate.sourceName || '',
  sourceUrl: candidate.sourceUrl || '',
  externalId: candidate.externalId || '',
});

export default function AdminEventsFound() {
  const { isAdmin, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<ExternalEventCandidate[]>([]);
  const [filter, setFilter] = useState<ExternalEventReviewStatus | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingBritishMarine, setCheckingBritishMarine] = useState(false);
  const [checkingRya, setCheckingRya] = useState(false);
  const [actionId, setActionId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExternalEventCandidate | null>(null);
  const [form, setForm] = useState<CandidateForm>(emptyForm);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const toast = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage(null), 4500);
  };

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));
      const list = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as ExternalEventCandidate[];

      list.sort((a, b) => toMillis(b.firstFoundAt) - toMillis(a.firstFoundAt));
      setCandidates(list);
    } catch (error) {
      console.error('Error loading Events Found candidates:', error);
      toast('Could not load Events Found.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadCandidates();
    else if (!authLoading) setLoading(false);
  }, [isAdmin, authLoading]);

  const counts = useMemo(() => ({
    all: candidates.length,
    pending: candidates.filter((candidate) => candidate.reviewStatus === 'pending').length,
    approved: candidates.filter((candidate) => candidate.reviewStatus === 'approved').length,
    rejected: candidates.filter((candidate) => candidate.reviewStatus === 'rejected').length,
  }), [candidates]);

  const visibleCandidates = useMemo(
    () => filter === 'all'
      ? candidates
      : candidates.filter((candidate) => candidate.reviewStatus === filter),
    [candidates, filter],
  );

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEdit = (candidate: ExternalEventCandidate) => {
    if (candidate.reviewStatus !== 'pending') {
      toast('Only pending candidates can be edited.', 'error');
      return;
    }

    setEditing(candidate);
    setForm(formFromCandidate(candidate));
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validateForm = () => {
    if (!form.title.trim() || !form.startDate || !form.city.trim()) {
      toast('Title, start date and city are required.', 'error');
      return false;
    }

    if (form.endDate && form.endDate < form.startDate) {
      toast('End date cannot be before the start date.', 'error');
      return false;
    }

    if (!editing && !form.sourceName.trim()) {
      toast('Source name is required for a test candidate.', 'error');
      return false;
    }

    return true;
  };

  const saveCandidate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !isAdmin || !validateForm()) return;

    setSaving(true);
    try {
      const website = canonicalizeEventUrl(form.website);
      const ticketUrl = canonicalizeEventUrl(form.ticketUrl);
      const normalizedTitle = normalizeEventTitle(form.title);
      const normalizedCity = normalizeEventCity(form.city);
      const normalizedVenue = normalizeEventVenue(form.venue);
      const dedupeKey = generateEventDedupeKey(form.title, form.startDate, form.city);

      const eventFields = {
        title: form.title.trim(),
        startDate: form.startDate,
        endDate: form.endDate || '',
        country: form.country.trim(),
        city: form.city.trim(),
        venue: form.venue.trim(),
        category: form.category,
        website,
        ticketUrl,
        normalizedTitle,
        normalizedCity,
        normalizedVenue,
        canonicalWebsite: website,
        dedupeKey,
      };

      if (editing) {
        const nextValues = formFromCandidate({ ...editing, ...eventFields });
        const changedFields = EDITABLE_FIELDS.filter(
          (field) => nextValues[field] !== formFromCandidate(editing)[field],
        );
        const adminEditedFields = Array.from(new Set([
          ...(editing.adminEditedFields || []),
          ...changedFields,
        ]));

        await updateDoc(doc(db, COLLECTION_NAME, editing.id), {
          ...eventFields,
          adminEditedFields,
          updatedAt: serverTimestamp(),
        });
        toast('Candidate updated. No public event was created.');
      } else {
        const sourceName = form.sourceName.trim();
        const sourceUrl = canonicalizeEventUrl(form.sourceUrl);
        const externalId = form.externalId.trim();

        await addDoc(collection(db, COLLECTION_NAME), {
          ...eventFields,
          source: 'imported',
          sourceName,
          sourceUrl,
          externalId,
          externalSources: [{ sourceName, sourceUrl, externalId }],
          reviewStatus: 'pending',
          possibleDuplicateOf: '',
          duplicateConfidence: 0,
          firstFoundAt: serverTimestamp(),
          lastCheckedAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
          adminEditedFields: [],
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast('Test candidate added to Events Found.');
      }

      closeForm();
      await loadCandidates();
    } catch (error) {
      console.error('Error saving Events Found candidate:', error);
      toast('Could not save the candidate.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const rejectCandidate = async (candidate: ExternalEventCandidate) => {
    if (!user || candidate.reviewStatus !== 'pending') return;
    if (!window.confirm(`Reject "${candidate.title}"? It will remain private and no public event will be created.`)) {
      return;
    }

    const rejectionReason = window.prompt('Optional rejection reason:', '') ?? '';
    setActionId(candidate.id);

    try {
      await updateDoc(doc(db, COLLECTION_NAME, candidate.id), {
        reviewStatus: 'rejected',
        rejectionReason: rejectionReason.trim(),
        reviewedAt: serverTimestamp(),
        reviewedBy: user.uid,
        updatedAt: serverTimestamp(),
      });

      setCandidates((current) => current.map((item) => item.id === candidate.id
        ? {
            ...item,
            reviewStatus: 'rejected',
            rejectionReason: rejectionReason.trim(),
            reviewedBy: user.uid,
          }
        : item));
      toast('Candidate rejected and kept private.');
    } catch (error) {
      console.error('Error rejecting Events Found candidate:', error);
      toast('Could not reject the candidate.', 'error');
    } finally {
      setActionId('');
    }
  };

  const checkBritishMarine = async () => {
    if (!user || !isAdmin || checkingBritishMarine) return;

    setCheckingBritishMarine(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/discover-listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'discoverBritishMarineEvents' }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success !== true) {
        throw new Error(payload?.error || 'Could not check British Marine.');
      }

      const created = Number(payload.created || 0);
      const existing = Number(payload.existing || 0);
      const eligible = Number(payload.eligible || 0);
      const skipped = Number(payload.skippedPast || 0)
        + Number(payload.skippedNonUk || 0)
        + Number(payload.skippedIrrelevant || 0)
        + Number(payload.skippedIncomplete || 0);

      toast(`British Marine checked: ${eligible} eligible event${eligible === 1 ? '' : 's'}, ${created} new candidate${created === 1 ? '' : 's'}, ${existing} already known${skipped ? `, ${skipped} skipped` : ''}.`);
      await loadCandidates();
    } catch (error) {
      console.error('Error checking British Marine events:', error);
      toast(error instanceof Error ? error.message : 'Could not check British Marine.', 'error');
    } finally {
      setCheckingBritishMarine(false);
    }
  };

  const checkRya = async () => {
    if (!user || !isAdmin || checkingRya) return;

    setCheckingRya(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/discover-listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'discoverRyaEvents' }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success !== true) {
        throw new Error(payload?.error || 'Could not check RYA.');
      }

      const created = Number(payload.created || 0);
      const existing = Number(payload.existing || 0);
      const eligible = Number(payload.eligible || 0);
      const skipped = Number(payload.skippedPast || 0)
        + Number(payload.skippedNonUk || 0)
        + Number(payload.skippedIrrelevant || 0)
        + Number(payload.skippedIncomplete || 0);

      toast(`RYA checked: ${eligible} eligible event${eligible === 1 ? '' : 's'}, ${created} new candidate${created === 1 ? '' : 's'}, ${existing} already known${skipped ? `, ${skipped} skipped` : ''}.`);
      await loadCandidates();
    } catch (error) {
      console.error('Error checking RYA events:', error);
      toast(error instanceof Error ? error.message : 'Could not check RYA.', 'error');
    } finally {
      setCheckingRya(false);
    }
  };

  const approveCandidate = async (candidate: ExternalEventCandidate) => {
    if (!user || candidate.reviewStatus !== 'pending') return;
    if (!window.confirm(`Approve "${candidate.title}" and publish it in Marine Events?`)) return;

    setActionId(candidate.id);
    try {
      const candidateRef = doc(db, COLLECTION_NAME, candidate.id);
      const deterministicEventId = `imported_${candidate.id}`;
      const eventRef = doc(db, 'marineEvents', deterministicEventId);

      const result = await runTransaction(db, async (transaction) => {
        const candidateSnapshot = await transaction.get(candidateRef);
        if (!candidateSnapshot.exists()) throw new Error('Candidate no longer exists.');

        const current = candidateSnapshot.data() as Omit<ExternalEventCandidate, 'id'>;
        if (current.publishedEventId) {
          return { eventId: current.publishedEventId, created: false };
        }

        if (current.reviewStatus === 'rejected') {
          throw new Error('Rejected candidates cannot be approved.');
        }

        const existingEvent = await transaction.get(eventRef);
        const timestamp = serverTimestamp();

        if (!existingEvent.exists()) {
          transaction.set(eventRef, {
            title: String(current.title || '').trim(),
            description: '',
            category: current.category || 'Marine Events',
            startDate: current.startDate || '',
            endDate: current.endDate || '',
            country: current.country || '',
            city: current.city || '',
            venue: current.venue || '',
            website: current.website || '',
            ticketUrl: current.ticketUrl || '',
            imageUrl: '',
            source: 'imported',
            sourceName: current.sourceName || '',
            sourceUrl: current.sourceUrl || '',
            externalId: current.externalId || '',
            externalSources: Array.isArray(current.externalSources) ? current.externalSources : [],
            externalCandidateId: candidate.id,
            plan: 'standard',
            configuredPlanPrice: 0,
            paymentStatus: 'not_required',
            pricePaid: 0,
            approvalStatus: 'approved',
            status: 'published',
            active: true,
            awaitingAdminApproval: false,
            approvedAt: timestamp,
            approvedBy: user.uid,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }

        transaction.update(candidateRef, {
          reviewStatus: 'approved',
          publishedEventId: deterministicEventId,
          reviewedAt: timestamp,
          reviewedBy: user.uid,
          rejectionReason: '',
          updatedAt: timestamp,
        });

        return { eventId: deterministicEventId, created: !existingEvent.exists() };
      });

      setCandidates((current) => current.map((item) => item.id === candidate.id
        ? {
            ...item,
            reviewStatus: 'approved',
            publishedEventId: result.eventId,
            reviewedBy: user.uid,
          }
        : item));

      toast(
        result.created
          ? 'Candidate approved and published as a Standard Marine Event.'
          : 'This candidate was already published; no duplicate was created.',
      );
    } catch (error) {
      console.error('Error approving Events Found candidate:', error);
      toast(error instanceof Error ? error.message : 'Could not approve the candidate.', 'error');
    } finally {
      setActionId('');
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
        <ShieldAlert size={38} className="mx-auto text-red-600" />
        <h1 className="mt-4 text-2xl font-black text-slate-900">Restricted Access</h1>
        <p className="mt-2 text-sm text-slate-500">Only ConnectBoat administrators can access Events Found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-7 pb-16" id="admin-events-found">
      {message && (
        <div className={`fixed top-5 right-5 z-[100] rounded-2xl px-5 py-4 shadow-xl border font-bold text-sm ${
          message.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-[0.18em]">
            <Search size={16} />
            ConnectBoat
          </div>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Events Found</h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Private review area for externally discovered event candidates.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => navigate('/admin/fotos')}
            className="inline-flex items-center justify-center gap-2 border border-slate-200 bg-white text-slate-700 rounded-2xl px-5 py-3.5 text-sm font-black"
          >
            <CalendarDays size={18} />
            Marine Events
          </button>
          <button
            type="button"
            onClick={checkBritishMarine}
            disabled={checkingBritishMarine}
            className="inline-flex items-center justify-center gap-2 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-60 text-indigo-700 rounded-2xl px-5 py-3.5 text-sm font-black"
          >
            {checkingBritishMarine
              ? <Loader2 size={18} className="animate-spin" />
              : <RefreshCw size={18} />}
            {checkingBritishMarine ? 'Checking British Marine...' : 'Check British Marine'}
          </button>
          <button
            type="button"
            onClick={checkRya}
            disabled={checkingRya}
            className="inline-flex items-center justify-center gap-2 border border-sky-200 bg-sky-50 hover:bg-sky-100 disabled:opacity-60 text-sky-700 rounded-2xl px-5 py-3.5 text-sm font-black"
          >
            {checkingRya
              ? <Loader2 size={18} className="animate-spin" />
              : <RefreshCw size={18} />}
            {checkingRya ? 'Checking RYA...' : 'Check RYA'}
          </button>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl px-5 py-3.5 text-sm font-black shadow-sm"
          >
            <Plus size={18} />
            Add Candidate
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-black">Candidates are private and never publish automatically.</p>
            <p className="mt-1 font-medium text-amber-800">
              Check British Marine and Check RYA discover UK candidates privately. Nothing is published until you approve it. Add Candidate remains available for manual testing.
            </p>
          </div>
        </div>
      </div>

      {formOpen && (
        <form onSubmit={saveCandidate} className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-black text-slate-900 text-xl">
                {editing ? 'Edit Candidate' : 'Add Test Candidate'}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                This form writes only to externalEventCandidates.
              </p>
            </div>
            <button type="button" onClick={closeForm} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 grid lg:grid-cols-2 gap-5">
            <label className="lg:col-span-2">
              <span className="text-xs font-black text-slate-600">Event title *</span>
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:border-indigo-500"
              />
            </label>

            <label>
              <span className="text-xs font-black text-slate-600">Start date *</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold"
              />
            </label>

            <label>
              <span className="text-xs font-black text-slate-600">End date</span>
              <input
                type="date"
                value={form.endDate}
                onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold"
              />
            </label>

            <label>
              <span className="text-xs font-black text-slate-600">Country</span>
              <input
                value={form.country}
                onChange={(event) => setForm({ ...form, country: event.target.value })}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold"
              />
            </label>

            <label>
              <span className="text-xs font-black text-slate-600">City *</span>
              <input
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold"
              />
            </label>

            <label>
              <span className="text-xs font-black text-slate-600">Venue</span>
              <input
                value={form.venue}
                onChange={(event) => setForm({ ...form, venue: event.target.value })}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold"
              />
            </label>

            <label>
              <span className="text-xs font-black text-slate-600">Category</span>
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value as MarineEventCategory })}
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold bg-white"
              >
                {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>

            <label>
              <span className="text-xs font-black text-slate-600">Official website</span>
              <input
                value={form.website}
                onChange={(event) => setForm({ ...form, website: event.target.value })}
                placeholder="https://..."
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold"
              />
            </label>

            <label>
              <span className="text-xs font-black text-slate-600">Tickets URL</span>
              <input
                value={form.ticketUrl}
                onChange={(event) => setForm({ ...form, ticketUrl: event.target.value })}
                placeholder="https://..."
                className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold"
              />
            </label>

            {!editing && (
              <>
                <label>
                  <span className="text-xs font-black text-slate-600">Source name *</span>
                  <input
                    value={form.sourceName}
                    onChange={(event) => setForm({ ...form, sourceName: event.target.value })}
                    className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold"
                  />
                </label>

                <label>
                  <span className="text-xs font-black text-slate-600">Source URL</span>
                  <input
                    value={form.sourceUrl}
                    onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })}
                    placeholder="https://..."
                    className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold"
                  />
                </label>

                <label>
                  <span className="text-xs font-black text-slate-600">External ID</span>
                  <input
                    value={form.externalId}
                    onChange={(event) => setForm({ ...form, externalId: event.target.value })}
                    className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold"
                  />
                </label>
              </>
            )}
          </div>

          <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
            <button type="button" onClick={closeForm} className="px-5 py-3 rounded-xl border border-slate-200 bg-white font-black text-sm text-slate-600">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-black text-sm inline-flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={17} className="animate-spin" />}
              {editing ? 'Save Candidate' : 'Create Candidate'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-sm flex flex-wrap gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={`px-4 py-2.5 rounded-xl text-sm font-black capitalize transition ${
              filter === status
                ? 'bg-slate-900 text-white'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {status} ({counts[status]})
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="animate-spin text-indigo-600" size={34} />
          </div>
        ) : visibleCandidates.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <Search size={40} className="mx-auto text-slate-300" />
            <h2 className="mt-4 text-lg font-black text-slate-900">No {filter === 'all' ? '' : filter} candidates found</h2>
            <p className="mt-2 text-sm text-slate-500">Use Check British Marine or Check RYA to discover candidates, or Add Candidate for a manual test.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleCandidates.map((candidate) => {
              const busy = actionId === candidate.id;
              return (
                <article key={candidate.id} className="p-5 sm:p-6">
                  <div className="flex flex-col xl:flex-row xl:items-center gap-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-black text-slate-900 text-lg">{candidate.title}</h2>
                        <span className={`text-[10px] uppercase tracking-wider font-black px-2.5 py-1 rounded-full ${
                          candidate.reviewStatus === 'approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : candidate.reviewStatus === 'rejected'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {candidate.reviewStatus || 'pending'}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider font-black px-2.5 py-1 rounded-full bg-sky-50 text-sky-700">
                          {candidate.category || 'Marine Events'}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays size={15} className="text-indigo-600" />
                          {formatDateRange(candidate.startDate, candidate.endDate)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin size={15} className="text-indigo-600" />
                          {[candidate.venue, candidate.city, candidate.country].filter(Boolean).join(', ')}
                        </span>
                      </div>

                      <div className="mt-3 text-xs text-slate-500">
                        <span className="font-black text-slate-700">Source:</span>{' '}
                        {candidate.sourceName || 'Unknown source'}
                        {candidate.externalId && <span> · ID: {candidate.externalId}</span>}
                      </div>

                      {candidate.possibleDuplicateOf && (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                          <AlertTriangle size={15} />
                          Possible duplicate of {candidate.possibleDuplicateOf}
                          {typeof candidate.duplicateConfidence === 'number' && candidate.duplicateConfidence > 0
                            ? ` (${Math.round(candidate.duplicateConfidence * 100)}%)`
                            : ''}
                        </div>
                      )}

                      {candidate.reviewStatus === 'rejected' && candidate.rejectionReason && (
                        <p className="mt-3 text-xs font-semibold text-rose-700">Reason: {candidate.rejectionReason}</p>
                      )}

                      {candidate.publishedEventId && (
                        <p className="mt-3 text-xs font-semibold text-emerald-700">
                          Published event: {candidate.publishedEventId}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 shrink-0">
                      {candidate.sourceUrl && (
                        <a
                          href={candidate.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-indigo-600 text-xs font-black"
                        >
                          <ExternalLink size={16} />
                          View Source
                        </a>
                      )}

                      {candidate.reviewStatus === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(candidate)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-indigo-600 disabled:opacity-50 text-xs font-black"
                          >
                            <Edit3 size={16} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => approveCandidate(candidate)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 text-xs font-black"
                          >
                            {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => rejectCandidate(candidate)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50 text-xs font-black"
                          >
                            <XCircle size={16} />
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
