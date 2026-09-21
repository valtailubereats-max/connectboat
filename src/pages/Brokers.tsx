import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Anchor, ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, Copy, LockKeyhole, Ship, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { brokerRequest } from '../utils/brokers';

const steps = [5, 10, 20, 30, 35];
const empty = { fullName: '', companyName: '', professionalEmail: '', phone: '', website: '', description: '', proofType: 'company_number', proof: '', boatLinks: ['', '', ''] };
const card = 'rounded-3xl border border-slate-200 bg-white p-6 shadow-sm';

export default function Brokers() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState<any>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const ref = params.get('ref') || '';
  const refresh = async () => {
    if (user) setStatus(await brokerRequest('status'));
  };
  useEffect(() => { if (user) refresh().catch(error => setMessage(error.message)); }, [user?.uid]);
  const act = async (action: string, payload: Record<string, unknown>, success: string) => {
    setBusy(true); setMessage('');
    try { await brokerRequest(action, payload); await refresh(); setMessage(success); }
    catch (error: any) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  const registerUrl = `/login?mode=register&redirect=${encodeURIComponent(`/brokers${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`)}`;
  const loginUrl = `/login?mode=login&redirect=${encodeURIComponent(`/brokers${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`)}`;
  const application = status?.application;
  const profile = status?.profile;
  const active = profile?.status === 'active';
  const current = status?.currentDiscount || 0;
  const next = steps.find(tier => tier > current && (tier < 35 || status?.validReferral));
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <section className="bg-gradient-to-br from-slate-950 via-sky-950 to-cyan-900 px-5 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-white/10 px-4 py-2 text-sm font-semibold text-cyan-100"><Anchor size={16}/> ConnectBoat Broker Programme</div>
        <h1 className="max-w-3xl text-4xl font-black tracking-tight md:text-6xl">More opportunity for professional boat brokers.</h1>
        <p className="mt-5 max-w-2xl text-lg text-sky-100">Apply with evidence of your marine business. Once approved, activate your unique code and save on paid Boats for Sale and Boats for Hire listing plans.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {!user && <><Link to={loginUrl} className="rounded-xl bg-white px-6 py-3 font-bold text-slate-950">Log in as a Broker</Link><Link to={registerUrl} className="rounded-xl border border-white/50 px-6 py-3 font-bold text-white">Register as a Broker</Link></>}
          {user && <a href="#broker-account" className="rounded-xl bg-white px-6 py-3 font-bold text-slate-950">Your broker account <ArrowRight className="ml-2 inline" size={16}/></a>}
        </div>
      </div>
    </section>
    <div className="mx-auto max-w-6xl space-y-8 px-5 py-10">
      <section className={card}>
        <h2 className="text-2xl font-black">Your route through the programme</h2>
        <p className="mt-2 text-slate-600">Each qualifying listing is paid, approved and placed in Boats for Sale or Boats for Hire. Your first listing can receive a discount as soon as you activate your code.</p>
        <div className="relative mt-8 grid grid-cols-5 gap-2 before:absolute before:left-[10%] before:right-[10%] before:top-5 before:h-1 before:rounded-full before:bg-sky-100">
          {steps.map((tier, index) => <div key={tier} className="relative text-center"><span className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full ${index === 4 ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-800'}`}><Ship size={20}/></span><strong className="mt-3 block text-lg">{tier}%</strong><span className="block text-xs text-slate-500">{index === 0 ? 'Listings 1–5' : index === 1 ? '6–10' : index === 2 ? '11–30' : index === 3 ? '31 onwards' : 'Referral reward'}</span></div>)}
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3"><p className="rounded-2xl bg-sky-50 p-4 text-sm text-sky-950"><BadgeCheck className="mb-2"/> Applications and professional evidence are reviewed by ConnectBoat.</p><p className="rounded-2xl bg-sky-50 p-4 text-sm text-sky-950"><CalendarDays className="mb-2"/> After six months, five qualifying listings in a month move you up one tier the following month; fewer move you down one tier, never below 5%.</p><p className="rounded-2xl bg-sky-50 p-4 text-sm text-sky-950"><LockKeyhole className="mb-2"/> Media Boost stays at its normal £2 price. ConnectBoat may remove benefits if information is false or no longer valid.</p></div>
      </section>
      <section id="broker-account" className={card}>
        <h2 className="text-2xl font-black">Your broker account</h2>
        {message && <p role="status" className="mt-4 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">{message}</p>}
        {loading ? <p className="mt-5">Loading…</p> : !user ? <p className="mt-5 text-slate-600">Sign in or register to apply. Your normal ConnectBoat account can become a broker account.</p> : <div className="mt-6 space-y-6">
          {active ? <>
            <div aria-label="Broker tier progress" className="rounded-2xl bg-sky-50 p-5"><div className="mb-2 flex justify-between text-sm font-bold"><span>Current tier: {current}%</span><span>{next ? `Next: ${next}%` : 'Highest available tier'}</span></div><div className="h-3 overflow-hidden rounded-full bg-sky-200"><div className="h-full rounded-full bg-sky-700 transition-all" style={{ width: `${Math.min(100, current / 35 * 100)}%` }}/></div></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[['Current discount', `${current}%`], ['Qualifying listings', status.total], ['Paid and approved this month', status.currentMonthCount], ['Needed to reach five', Math.max(0, 5 - status.currentMonthCount)]].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-5"><span className="text-sm text-slate-500">{label}</span><strong className="mt-2 block text-3xl text-sky-800">{value}</strong></div>)}
            </div>
            <div className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border border-slate-200 p-5"><p><CheckCircle2 className="mr-2 inline text-green-600" size={18}/> Benefit active since {profile.activatedAt ? new Date(profile.activatedAt._seconds ? profile.activatedAt._seconds * 1000 : profile.activatedAt).toLocaleDateString('en-GB') : 'today'}</p><p className="mt-2 text-sm text-slate-600">Next monthly review: {status.nextReview ? new Date(`${status.nextReview}-01T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'after your initial six months'}. {next ? `Next possible tier: ${next}%.` : 'You are at your available ceiling.'}</p><p className="mt-2 text-sm text-slate-600">After six months, reach five qualifying listings this month to move up one tier next month. Your tier can also move down one step if you do not reach five.</p></div><div className="rounded-2xl border border-slate-200 p-5"><h3 className="font-bold">Invite another broker</h3><p className="mt-2 text-sm text-slate-600">Your ceiling becomes 35% after your referred broker applies, is approved, activates their code and has a first paid and approved boat listing.</p><div className="mt-3 flex gap-2"><input readOnly aria-label="Broker referral link" value={status.referralLink || ''} className="min-w-0 flex-1 rounded-lg border p-2 text-sm"/><button aria-label="Copy referral link" onClick={() => navigator.clipboard.writeText(status.referralLink)} className="rounded-lg bg-sky-800 p-2 text-white"><Copy size={18}/></button></div><p className="mt-2 text-sm font-semibold">Referral reward: {status.validReferral ? 'unlocked' : 'awaiting a qualifying referral'}</p></div></div>
            <div className="rounded-2xl border border-slate-200 p-5"><h3 className="font-bold">Tier history</h3>{status.history?.length ? <ul className="mt-3 space-y-2 text-sm">{status.history.map((item: any, index: number) => <li key={`${item.month}-${index}`} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 p-2"><span>{item.month}: {item.from}% → {item.to}%</span><span>{item.phase === 'initial' ? `${item.qualifyingListings} qualifying listings reached` : `${item.qualifyingListings} qualifying listings in the preceding month`}</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No tier changes yet.</p>}</div>
          </> : application?.status === 'approved' ? <div className="max-w-lg"><p className="mb-4">Your application has been approved. Enter the single-use code supplied by ConnectBoat to activate your benefit.</p><div className="flex gap-2"><input aria-label="Broker activation code" value={code} onChange={event => setCode(event.target.value)} className="min-w-0 flex-1 rounded-xl border p-3" placeholder="CB-XXXXXXXXXXXXXXXX"/><button disabled={busy} onClick={() => act('activate', { code }, 'Your broker benefit is now active.')} className="rounded-xl bg-sky-800 px-5 font-bold text-white">Activate</button></div></div> : application?.status === 'pending' ? <p className="rounded-2xl bg-amber-50 p-5 text-amber-900">Your application is under review. ConnectBoat will check your professional evidence.</p> : profile?.status === 'revoked' ? <p className="rounded-2xl bg-red-50 p-5 text-red-800">Your broker benefit has been revoked. Contact ConnectBoat if you believe this is an error.</p> : <form onSubmit={event => { event.preventDefault(); act('apply', { ...form, referredBy: ref }, 'Your application has been submitted for review.'); }} className="grid gap-4 md:grid-cols-2">
            {[['fullName', 'Full name'], ['companyName', 'Company name'], ['professionalEmail', 'Professional email'], ['phone', 'Telephone'], ['website', 'Website or professional page']].map(([key, label]) => <label key={key} className="text-sm font-semibold">{label}<input required type={key === 'professionalEmail' ? 'email' : key === 'website' ? 'url' : 'text'} value={(form as any)[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} className="mt-1 block w-full rounded-xl border p-3 font-normal"/></label>)}
            <label className="md:col-span-2 text-sm font-semibold">About your business<textarea required value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className="mt-1 block min-h-24 w-full rounded-xl border p-3 font-normal"/></label>
            <div className="md:col-span-2"><p className="mb-2 text-sm font-semibold">Links to at least three boats you currently advertise</p>{form.boatLinks.map((link, index) => <input key={index} required type="url" aria-label={`Boat listing link ${index + 1}`} value={link} onChange={event => setForm({ ...form, boatLinks: form.boatLinks.map((item, position) => position === index ? event.target.value : item) })} className="mb-2 block w-full rounded-xl border p-3" placeholder={`Boat listing ${index + 1}`}/>)}</div>
            <label className="text-sm font-semibold">Professional proof<select value={form.proofType} onChange={event => setForm({ ...form, proofType: event.target.value })} className="mt-1 block w-full rounded-xl border p-3 font-normal"><option value="company_number">Companies House number</option><option value="broker_profile">Broker/dealer profile link</option><option value="association">Marine trade association link</option><option value="insurance_certificate">Professional insurance certificate link</option></select></label>
            <label className="text-sm font-semibold">Proof number or restricted link<input required value={form.proof} onChange={event => setForm({ ...form, proof: event.target.value })} className="mt-1 block w-full rounded-xl border p-3 font-normal"/></label>
            <div className="md:col-span-2"><p className="mb-3 text-xs text-slate-500">Do not submit passports, driving licences, bank statements or other personal documents. If using an insurance link, ensure it only exposes professional information.</p><button disabled={busy} className="rounded-xl bg-sky-800 px-7 py-3 font-bold text-white disabled:opacity-50">{busy ? 'Submitting…' : 'Submit application'}</button></div>
          </form>}
        </div>}
      </section>
    </div>
  </main>;
}
