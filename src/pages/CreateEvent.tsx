import React, { useMemo, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { CalendarDays, CheckCircle2, Image as ImageIcon, Loader2, MapPin, Ticket, UploadCloud } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

type EventPlan = 'standard' | 'featured' | 'premium';
type EventCategory = 'Boat Shows' | 'Regattas' | 'Marine Events' | 'Festivals' | 'Other';

type FormState = {
  title: string;
  description: string;
  category: EventCategory;
  startDate: string;
  endDate: string;
  country: string;
  city: string;
  venue: string;
  website: string;
  ticketUrl: string;
  imageUrl: string;
  plan: EventPlan;
};

const initialForm: FormState = {
  title: '',
  description: '',
  category: 'Marine Events',
  startDate: '',
  endDate: '',
  country: 'United Kingdom',
  city: '',
  venue: '',
  website: '',
  ticketUrl: '',
  imageUrl: '',
  plan: 'standard',
};

const plans: Array<{
  id: EventPlan;
  title: string;
  price: string;
  description: string;
}> = [
  {
    id: 'standard',
    title: 'Standard',
    price: 'FREE',
    description: 'Your event can be published after admin approval.',
  },
  {
    id: 'featured',
    title: 'Featured',
    price: '£9.99',
    description: 'Extra visibility in the Marine Events area.',
  },
  {
    id: 'premium',
    title: 'Premium',
    price: '£19.99',
    description: 'Maximum visibility and eligibility for the featured event area.',
  },
];

const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export default function CreateEvent() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === form.plan) || plans[0],
    [form.plan],
  );

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage('');

    if (!user) {
      navigate('/login?mode=register');
      return;
    }

    if (!form.title.trim() || !form.startDate || !form.city.trim()) {
      setErrorMessage('Please complete the event title, start date and city.');
      return;
    }

    if (form.endDate && form.endDate < form.startDate) {
      setErrorMessage('The end date cannot be earlier than the start date.');
      return;
    }

    setSubmitting(true);

    try {
      await addDoc(collection(db, 'marineEvents'), {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        startDate: form.startDate,
        endDate: form.endDate || '',
        country: form.country.trim(),
        city: form.city.trim(),
        venue: form.venue.trim(),
        website: normalizeUrl(form.website),
        ticketUrl: normalizeUrl(form.ticketUrl),
        imageUrl: normalizeUrl(form.imageUrl),
        plan: form.plan,
        status: 'draft',
        active: false,
        approvalStatus: 'pending',
        paymentStatus: form.plan === 'standard' ? 'not_required' : 'pending',
        pricePaid: 0,
        configuredPlanPrice: form.plan === 'featured' ? 9.99 : form.plan === 'premium' ? 19.99 : 0,
        source: 'public_submission',
        submittedByUserId: user.uid,
        submittedByEmail: user.email || '',
        submittedByName: profile?.name || user.displayName || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSuccess(true);
      setForm(initialForm);
    } catch (error) {
      console.error('Error submitting marine event:', error);
      setErrorMessage('Could not submit the event. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-sm p-8 sm:p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 size={34} />
          </div>
          <h1 className="mt-5 text-2xl sm:text-3xl font-black text-slate-900">
            Event submitted
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            Your event was sent to ConnectBoat for review. It will only appear publicly after admin approval.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => setSuccess(false)}
              className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-sm"
            >
              Submit Another Event
            </button>
            <button
              type="button"
              onClick={() => navigate('/events')}
              className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm"
            >
              Back to Marine Events
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 -mx-1.5 xs:-mx-2 sm:-mx-6 lg:-mx-8 -my-4 sm:-my-8">
      <section className="bg-slate-950 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <div className="inline-flex items-center gap-2 text-sky-300 text-xs font-black uppercase tracking-[0.2em]">
            <CalendarDays size={17} />
            ConnectBoat Marine Events
          </div>
          <h1 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight">
            List Your Event
          </h1>
          <p className="mt-4 text-slate-300 max-w-2xl leading-relaxed">
            Submit your boat show, regatta, festival or marine event for review by ConnectBoat.
          </p>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <form onSubmit={handleSubmit} className="space-y-7">
          <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-sm">
            <h2 className="text-xl font-black text-slate-900">Event Details</h2>
            <p className="mt-1 text-sm text-slate-500">Tell visitors what your event is about.</p>

            <div className="mt-6 grid md:grid-cols-2 gap-5">
              <label className="md:col-span-2">
                <span className="block text-sm font-black text-slate-700 mb-2">Event Title *</span>
                <input
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-500"
                  placeholder="e.g. Southampton International Boat Show"
                />
              </label>

              <label>
                <span className="block text-sm font-black text-slate-700 mb-2">Category</span>
                <select
                  value={form.category}
                  onChange={(e) => updateField('category', e.target.value as EventCategory)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-500 bg-white"
                >
                  <option>Boat Shows</option>
                  <option>Regattas</option>
                  <option>Marine Events</option>
                  <option>Festivals</option>
                  <option>Other</option>
                </select>
              </label>

              <label>
                <span className="block text-sm font-black text-slate-700 mb-2">Country</span>
                <input
                  value={form.country}
                  onChange={(e) => updateField('country', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-500"
                />
              </label>

              <label>
                <span className="block text-sm font-black text-slate-700 mb-2">Start Date *</span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => updateField('startDate', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-500"
                />
              </label>

              <label>
                <span className="block text-sm font-black text-slate-700 mb-2">End Date</span>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => updateField('endDate', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-500"
                />
              </label>

              <label>
                <span className="block text-sm font-black text-slate-700 mb-2">City *</span>
                <div className="relative">
                  <MapPin size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 outline-none focus:border-sky-500"
                    placeholder="Southampton"
                  />
                </div>
              </label>

              <label>
                <span className="block text-sm font-black text-slate-700 mb-2">Venue</span>
                <input
                  value={form.venue}
                  onChange={(e) => updateField('venue', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-500"
                  placeholder="Mayflower Park"
                />
              </label>

              <label className="md:col-span-2">
                <span className="block text-sm font-black text-slate-700 mb-2">Description</span>
                <textarea
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  className="w-full min-h-36 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-500 resize-y"
                  placeholder="Describe the event, attractions, exhibitors, activities and what visitors can expect."
                />
              </label>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-sm">
            <h2 className="text-xl font-black text-slate-900">Links & Image</h2>
            <p className="mt-1 text-sm text-slate-500">You can add official event links and an image URL.</p>

            <div className="mt-6 grid md:grid-cols-2 gap-5">
              <label>
                <span className="block text-sm font-black text-slate-700 mb-2">Official Website</span>
                <input
                  value={form.website}
                  onChange={(e) => updateField('website', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-sky-500"
                  placeholder="https://..."
                />
              </label>

              <label>
                <span className="block text-sm font-black text-slate-700 mb-2">Tickets URL</span>
                <div className="relative">
                  <Ticket size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.ticketUrl}
                    onChange={(e) => updateField('ticketUrl', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 outline-none focus:border-sky-500"
                    placeholder="https://..."
                  />
                </div>
              </label>

              <label className="md:col-span-2">
                <span className="block text-sm font-black text-slate-700 mb-2">Event Image URL</span>
                <div className="relative">
                  <ImageIcon size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.imageUrl}
                    onChange={(e) => updateField('imageUrl', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 outline-none focus:border-sky-500"
                    placeholder="https://..."
                  />
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Direct file upload will be added in a later step. For now, use a public image URL.
                </p>
              </label>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-sm">
            <h2 className="text-xl font-black text-slate-900">Choose Your Event Plan</h2>
            <p className="mt-1 text-sm text-slate-500">
              Paid plans will be connected to Stripe after this submission flow is tested.
            </p>

            <div className="mt-6 grid md:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const selected = form.plan === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => updateField('plan', plan.id)}
                    className={`text-left rounded-2xl border-2 p-5 transition-all ${
                      selected
                        ? 'border-sky-500 bg-sky-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-black text-slate-900">{plan.title}</span>
                      {selected && <CheckCircle2 size={19} className="text-sky-600" />}
                    </div>
                    <div className="mt-3 text-2xl font-black text-slate-950">{plan.price}</div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">{plan.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-sm font-black text-slate-800">
                Selected: {selectedPlan.title} — {selectedPlan.price}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                All public submissions require ConnectBoat admin approval before publication.
              </p>
            </div>
          </section>

          {errorMessage && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm font-bold">
              {errorMessage}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              onClick={() => navigate('/events')}
              className="px-5 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-black text-sm"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-black text-sm shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <UploadCloud size={18} />
                  Submit Event for Review
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
