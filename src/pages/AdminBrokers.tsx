import React, { useEffect, useState } from 'react';
import { brokerRequest } from '../utils/brokers';

export default function AdminBrokers() {
  const [data, setData] = useState<any>({ applications: [], profiles: [], codes: [] });
  const [selected, setSelected] = useState<any>(null);
  const [note, setNote] = useState('');
  const [tier, setTier] = useState(5);
  const [expiry, setExpiry] = useState('');
  const [newCode, setNewCode] = useState('');
  const [details, setDetails] = useState<any>(null);
  const [message, setMessage] = useState('');
  const refresh = async () => setData(await brokerRequest('list'));
  useEffect(() => { refresh().catch(error => setMessage(error.message)); }, []);
  const act = async (action: string, payload: Record<string, unknown>) => {
    try { const result = await brokerRequest(action, payload); if (result.code) setNewCode(result.code); const refreshed = await brokerRequest('list'); setData(refreshed); setSelected(refreshed.applications.find((item: any) => item.uid === selected?.uid) || null); if (selected?.uid) setDetails(await brokerRequest('status', { uid: selected.uid })); setMessage('Saved.'); }
    catch (error: any) { setMessage(error.message); }
  };
  const profile = data.profiles.find((item: any) => item.uid === selected?.uid);
  const codes = data.codes.filter((item: any) => item.uid === selected?.uid);
  return <div className="space-y-6 p-6 text-slate-900">
    <div><h1 className="text-3xl font-black">Broker Programme</h1><p className="text-slate-600">Review professional evidence, issue activation codes and manage benefits.</p></div>
    {message && <p role="status" className="rounded-xl bg-sky-50 p-3">{message}</p>}
    {newCode && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4"><p className="font-bold">Copy this code now. It will not be shown again.</p><code className="mt-2 block text-xl font-bold">{newCode}</code><button className="mt-2 underline" onClick={() => navigator.clipboard.writeText(newCode)}>Copy code</button></div>}
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border bg-white p-5"><h2 className="mb-4 text-xl font-bold">Applications</h2><div className="space-y-2">{data.applications.map((item: any) => <button key={item.uid} onClick={() => { setSelected(item); setNote(item.internalNote || ''); setNewCode(''); brokerRequest('status', { uid: item.uid }).then(setDetails).catch(error => setMessage(error.message)); }} className="flex w-full justify-between rounded-xl border p-3 text-left hover:bg-sky-50"><span><strong>{item.companyName}</strong><small className="block text-slate-500">{item.fullName}</small></span><span className="font-semibold capitalize">{item.status}</span></button>)}</div></section>
      <section className="rounded-2xl border bg-white p-5"><h2 className="mb-4 text-xl font-bold">Application and account</h2>{selected ? <div className="space-y-3 text-sm"><p><strong>Company:</strong> {selected.companyName}</p><p><strong>Name:</strong> {selected.fullName}</p><p><strong>Email:</strong> {selected.professionalEmail}</p><p><strong>Telephone:</strong> {selected.phone}</p><p><strong>Website:</strong> <a className="text-sky-700 underline" href={selected.website} target="_blank" rel="noreferrer">{selected.website}</a></p><p><strong>About:</strong> {selected.description}</p><p><strong>Boat listings:</strong></p><ul className="list-inside list-disc">{selected.boatLinks?.map((link: string) => <li key={link}><a className="break-all text-sky-700 underline" href={link} target="_blank" rel="noreferrer">{link}</a></li>)}</ul><p><strong>Proof:</strong> {selected.proofType} — {selected.proof}</p><p><strong>Referrer:</strong> {selected.referredBy || 'None'}</p>
        <label className="block font-semibold">Internal note<textarea value={note} onChange={event => setNote(event.target.value)} className="mt-1 block min-h-20 w-full rounded-lg border p-2 font-normal"/></label><button onClick={() => act('note', { uid: selected.uid, note })} className="rounded-lg border px-4 py-2 font-semibold">Save internal note</button>
        {selected.status === 'pending' && <div className="flex gap-2"><button onClick={() => act('decide', { uid: selected.uid, decision: 'approved', note })} className="rounded-lg bg-green-700 px-4 py-2 font-bold text-white">Approve</button><button onClick={() => act('decide', { uid: selected.uid, decision: 'rejected', note })} className="rounded-lg bg-red-700 px-4 py-2 font-bold text-white">Reject</button></div>}
        {selected.status === 'approved' && !profile?.activatedAt && <div className="rounded-xl bg-slate-50 p-3"><label>Starting tier <select value={tier} onChange={event => setTier(Number(event.target.value))} className="ml-2 rounded border p-1">{[5, 10, 20, 30].map(value => <option key={value} value={value}>{value}%</option>)}</select></label><label className="mt-2 block">Optional expiry <input type="date" value={expiry} onChange={event => setExpiry(event.target.value)} className="ml-2 rounded border p-1"/></label><button onClick={() => act('issue', { uid: selected.uid, initialTier: tier, expiresAt: expiry || null })} className="mt-3 rounded-lg bg-sky-800 px-4 py-2 font-bold text-white">Create unique code</button></div>}
        {profile && <div className="rounded-xl bg-slate-50 p-3"><p><strong>Benefit:</strong> {profile.status}</p><p><strong>Starting tier:</strong> {profile.initialTier}%</p><p><strong>Activated:</strong> {profile.activatedAt?._seconds ? new Date(profile.activatedAt._seconds * 1000).toLocaleDateString('en-GB') : 'Not yet'}</p>{profile.status === 'active' && <button onClick={() => { const reason = window.prompt('Reason for revocation'); if (reason) act('revoke', { uid: selected.uid, reason }); }} className="mt-2 rounded-lg bg-red-700 px-4 py-2 font-bold text-white">Revoke benefit</button>}</div>}
        {details?.profile?.status === 'active' && <div className="rounded-xl bg-sky-50 p-3"><p><strong>Current discount:</strong> {details.currentDiscount}%</p><p><strong>Qualifying listings:</strong> {details.total}</p><p><strong>This month:</strong> {details.currentMonthCount}</p><p><strong>Referral reward:</strong> {details.validReferral ? 'Unlocked' : 'Pending'}</p><p><strong>Next monthly review:</strong> {details.nextReview}</p></div>}
        {codes.map((item: any) => <div key={item.id} className="rounded-xl border p-3"><p><strong>Code state:</strong> {item.status}</p><p><strong>Used by:</strong> {item.usedBy || '—'}</p><p><strong>Used at:</strong> {item.usedAt?._seconds ? new Date(item.usedAt._seconds * 1000).toLocaleString('en-GB') : '—'}</p>{item.status === 'issued' && <button onClick={() => act('revokeCode', { codeId: item.id })} className="mt-2 text-red-700 underline">Revoke unused code</button>}</div>)}
      </div> : <p className="text-slate-500">Select an application.</p>}</section>
    </div>
  </div>;
}
