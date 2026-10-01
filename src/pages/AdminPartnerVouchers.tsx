import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Edit3, Plus, RefreshCcw, Ticket, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

type Voucher = {
  code: string;
  partnerName?: string;
  active?: boolean;
  allowedCategories?: string[];
  usageCount?: number;
  attributedListingsCount?: number;
  fundedFreeStandardCount?: number;
  firstFreeAttributedCount?: number;
  startsAt?: string;
  expiresAt?: string;
  maxUses?: number;
};

type VoucherUsage = {
  id: string;
  partnerCode?: string;
  partnerName?: string;
  adId?: string;
  userId?: string;
  category?: string;
  promotionSource?: string;
  attributionOnly?: boolean;
  partnerFundedFreeStandard?: boolean;
  createdAt?: string;
};

type FormState = {
  code: string;
  partnerName: string;
  active: boolean;
  allowedCategories: string[];
  startsAt: string;
  expiresAt: string;
  maxUses: string;
};

const EMPTY_FORM: FormState = {
  code: '', partnerName: '', active: true, allowedCategories: [], startsAt: '', expiresAt: '', maxUses: '',
};

const isoDate = (value?: string) => value ? value.slice(0, 10) : '';
const formatDate = (value?: string) => value
  ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Europe/London' }).format(new Date(value))
  : '—';
const count = (value?: number) => Number(value || 0).toLocaleString('en-GB');

const AdminPartnerVouchers: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { categories } = useSettings();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState<Voucher | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [expandedCode, setExpandedCode] = useState('');
  const [usages, setUsages] = useState<Record<string, VoucherUsage[]>>({});
  const [usageLoading, setUsageLoading] = useState('');

  const categoryOptions = useMemo(() => [...new Set([
    'Boats for Sale', 'Boats for Hire', 'Boat Parts', 'Boat Engines', 'Marine Electronics',
    'Trailers', 'Marinas', 'Boat Services', 'Accessories', 'Wanted', ...categories,
  ])].filter(Boolean).sort(), [categories]);

  const apiRequest = useCallback(async (body: Record<string, unknown>) => {
    if (!user) throw new Error('Authentication required.');
    const token = await user.getIdToken();
    const response = await fetch('/api/admin/create-assisted-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success !== true) throw new Error(payload.errorMessage || 'Partner Voucher request failed.');
    return payload;
  }, [user]);

  const loadVouchers = useCallback(async () => {
    if (!isAdmin || !user) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest({ action: 'partnerVouchersList' });
      setVouchers(Array.isArray(result.vouchers) ? result.vouchers : []);
    } catch (err: any) {
      setError(err?.message || 'Could not load vouchers.');
    } finally {
      setLoading(false);
    }
  }, [apiRequest, isAdmin, user]);

  useEffect(() => { void loadVouchers(); }, [loadVouchers]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setSuccess('');
    setShowForm(true);
  };

  const openEdit = (voucher: Voucher) => {
    setEditing(voucher);
    setForm({
      code: voucher.code,
      partnerName: voucher.partnerName || '',
      active: voucher.active === true,
      allowedCategories: voucher.allowedCategories || [],
      startsAt: isoDate(voucher.startsAt),
      expiresAt: isoDate(voucher.expiresAt),
      maxUses: voucher.maxUses === undefined ? '' : String(voucher.maxUses),
    });
    setError('');
    setSuccess('');
    setShowForm(true);
  };

  const saveVoucher = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest({
        action: editing ? 'partnerVoucherUpdate' : 'partnerVoucherCreate',
        code: form.code,
        partnerName: form.partnerName,
        active: form.active,
        allowedCategories: form.allowedCategories,
        startsAt: form.startsAt || null,
        expiresAt: form.expiresAt || null,
        maxUses: form.maxUses === '' ? null : Number(form.maxUses),
      });
      setShowForm(false);
      setSuccess(editing ? `${form.code} updated successfully.` : `${form.code.toUpperCase()} created successfully.`);
      await loadVouchers();
    } catch (err: any) {
      setError(err?.message || 'Could not save voucher.');
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (category: string) => {
    setForm(current => ({
      ...current,
      allowedCategories: current.allowedCategories.includes(category)
        ? current.allowedCategories.filter(item => item !== category)
        : [...current.allowedCategories, category],
    }));
  };

  const toggleResults = async (code: string) => {
    if (expandedCode === code) {
      setExpandedCode('');
      return;
    }
    setExpandedCode(code);
    if (usages[code]) return;
    setUsageLoading(code);
    setError('');
    try {
      const result = await apiRequest({ action: 'partnerVoucherUsagesList', code });
      setUsages(current => ({ ...current, [code]: Array.isArray(result.usages) ? result.usages : [] }));
    } catch (err: any) {
      setError(err?.message || 'Could not load voucher usages.');
    } finally {
      setUsageLoading('');
    }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-black text-slate-900">Admin access required</h1>
        <p className="mt-2 text-sm text-slate-500">Partner Vouchers are restricted to administrators.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-indigo-600"><Ticket size={20} /><span className="text-xs font-black uppercase tracking-widest">Partnerships</span></div>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Partner Vouchers</h1>
          <p className="mt-1 text-sm text-slate-500">Create voucher configurations and review their attributed listings.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadVouchers()} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">
            <RefreshCcw size={16} /> Refresh
          </button>
          <button type="button" onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700">
            <Plus size={18} /> New Voucher
          </button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
      {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{success}</div>}

      {loading ? (
        <div className="flex justify-center rounded-3xl border border-slate-200 bg-white p-16"><RefreshCcw className="animate-spin text-indigo-600" /></div>
      ) : vouchers.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <Ticket className="mx-auto text-slate-300" size={40} />
          <h2 className="mt-3 font-black text-slate-900">No Partner Vouchers yet</h2>
          <p className="mt-1 text-sm text-slate-500">Create the first voucher when you are ready.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {vouchers.map(voucher => (
            <section key={voucher.code} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-slate-900 px-3 py-1.5 font-mono text-sm font-black text-white">{voucher.code}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${voucher.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {voucher.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <h2 className="mt-2 text-lg font-black text-slate-900">{voucher.partnerName || 'Unnamed partner'}</h2>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {(voucher.allowedCategories || []).length ? voucher.allowedCategories!.join(' • ') : 'All categories'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => openEdit(voucher)} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><Edit3 size={15} /> Edit</button>
                    <button type="button" onClick={() => void toggleResults(voucher.code)} className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-black text-indigo-700 hover:bg-indigo-100">
                      Results <ChevronDown size={16} className={expandedCode === voucher.code ? 'rotate-180' : ''} />
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    ['Usage Count', voucher.usageCount],
                    ['Attributed Listings', voucher.attributedListingsCount],
                    ['Funded Free Standard', voucher.fundedFreeStandardCount],
                    ['First Free Attributed', voucher.firstFreeAttributedCount],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
                      <p className="mt-1 text-2xl font-black text-slate-900">{count(value as number)}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                  <p><strong>Starts:</strong> {formatDate(voucher.startsAt)}</p>
                  <p><strong>Expires:</strong> {formatDate(voucher.expiresAt)}</p>
                  <p><strong>Max Uses:</strong> {voucher.maxUses === undefined ? 'Unlimited' : voucher.maxUses}</p>
                </div>
              </div>

              {expandedCode === voucher.code && (
                <div className="border-t border-slate-200 bg-slate-50 p-5 sm:p-6">
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Usage records</h3>
                  {usageLoading === voucher.code ? (
                    <div className="py-8 text-center"><RefreshCcw className="mx-auto animate-spin text-indigo-600" /></div>
                  ) : (usages[voucher.code] || []).length === 0 ? (
                    <p className="mt-3 rounded-xl bg-white p-4 text-sm text-slate-500">No usage records found for this voucher.</p>
                  ) : (
                    <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                      <table className="min-w-[1000px] w-full text-left text-xs">
                        <thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-500"><tr>
                          <th className="p-3">Created</th><th className="p-3">Partner</th><th className="p-3">Ad ID</th><th className="p-3">User ID</th><th className="p-3">Category</th><th className="p-3">Source</th><th className="p-3">Attribution only</th><th className="p-3">Funded Standard</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {usages[voucher.code].map(usage => <tr key={usage.id} className="hover:bg-slate-50">
                            <td className="p-3 whitespace-nowrap">{formatDate(usage.createdAt)}</td>
                            <td className="p-3 font-bold">{usage.partnerName || usage.partnerCode || '—'}</td>
                            <td className="p-3 font-mono">{usage.adId || '—'}</td><td className="p-3 font-mono">{usage.userId || '—'}</td>
                            <td className="p-3">{usage.category || '—'}</td><td className="p-3">{usage.promotionSource || '—'}</td>
                            <td className="p-3">{usage.attributionOnly ? 'Yes' : 'No'}</td><td className="p-3">{usage.partnerFundedFreeStandard ? 'Yes' : 'No'}</td>
                          </tr>)}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <form onSubmit={saveVoucher} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-5 sm:p-6">
              <div><h2 className="text-xl font-black text-slate-900">{editing ? `Edit ${editing.code}` : 'New Partner Voucher'}</h2><p className="text-xs text-slate-500">Historical counters cannot be edited here.</p></div>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"><X size={18} /></button>
            </div>
            <div className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-black uppercase tracking-wide text-slate-600">Voucher Code
                  <input required disabled={!!editing} value={form.code} onChange={event => setForm(current => ({ ...current, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') }))} className="mt-2 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 font-mono text-sm font-bold outline-none focus:border-indigo-500 disabled:opacity-60" />
                </label>
                <label className="text-xs font-black uppercase tracking-wide text-slate-600">Partner Name
                  <input required value={form.partnerName} onChange={event => setForm(current => ({ ...current, partnerName: event.target.value }))} className="mt-2 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500" />
                </label>
              </div>

              <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <span><span className="block text-sm font-black text-slate-900">Active</span><span className="text-xs text-slate-500">Inactive vouchers cannot be validated or used.</span></span>
                <input type="checkbox" checked={form.active} onChange={event => setForm(current => ({ ...current, active: event.target.checked }))} className="h-5 w-5 accent-indigo-600" />
              </label>

              <div><p className="text-xs font-black uppercase tracking-wide text-slate-600">Allowed Categories</p><p className="mt-1 text-xs text-slate-500">Leave all unticked to allow every category supported by the existing voucher logic.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {categoryOptions.map(category => <label key={category} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><input type="checkbox" checked={form.allowedCategories.includes(category)} onChange={() => toggleCategory(category)} className="h-4 w-4 accent-indigo-600" />{category}</label>)}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-xs font-black uppercase tracking-wide text-slate-600">Starts At <span className="normal-case text-slate-400">(optional)</span><input type="date" value={form.startsAt} onChange={event => setForm(current => ({ ...current, startsAt: event.target.value }))} className="mt-2 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" /></label>
                <label className="text-xs font-black uppercase tracking-wide text-slate-600">Expires At <span className="normal-case text-slate-400">(optional)</span><input type="date" min={form.startsAt || undefined} value={form.expiresAt} onChange={event => setForm(current => ({ ...current, expiresAt: event.target.value }))} className="mt-2 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" /></label>
                <label className="text-xs font-black uppercase tracking-wide text-slate-600">Max Uses <span className="normal-case text-slate-400">(optional)</span><input type="number" min="1" step="1" value={form.maxUses} onChange={event => setForm(current => ({ ...current, maxUses: event.target.value }))} placeholder="Unlimited" className="mt-2 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-indigo-500" /></label>
              </div>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white p-5 sm:p-6">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-600">Cancel</button>
              <button disabled={saving} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? <RefreshCcw className="animate-spin" size={16} /> : <Check size={16} />}{editing ? 'Save Changes' : 'Create Voucher'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminPartnerVouchers;
