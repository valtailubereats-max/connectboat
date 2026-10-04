import React, { useState } from 'react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { AlertTriangle, CheckCircle, Database, Play, ShieldCheck } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const OPTIONAL_TIMESTAMP_FIELDS = [
  'updatedAt',
  'paidAt',
  'featuredActivatedAt',
  'planStartedAt',
  'externalPromotionConsentAt',
  'expirationDate',
  'planExpiresAt',
  'featuredUntil',
  'activatedAt',
] as const;

type TimestampFieldName = 'createdAt' | (typeof OPTIONAL_TIMESTAMP_FIELDS)[number];

interface AffectedDocument {
  documentId: string;
  title: string | null;
  sellerEmail: string | null;
  sellerId: string | null;
  type: string;
  value: unknown;
  serverTimestampSentinel: boolean;
}

interface FieldAuditResult {
  valid: number;
  invalid: number;
  missing: number;
  affectedDocuments: AffectedDocument[];
}

interface TimestampAuditReport {
  auditedAt: string;
  totalAdsChecked: number;
  fields: Record<TimestampFieldName, FieldAuditResult>;
}

const emptyFieldResult = (): FieldAuditResult => ({
  valid: 0,
  invalid: 0,
  missing: 0,
  affectedDocuments: [],
});

const valueType = (value: unknown): string => {
  if (value === undefined) return 'missing';
  if (value === null) return 'null';
  if (value instanceof Timestamp) return 'Firestore Timestamp';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'JavaScript Date';
  return typeof value === 'object' ? 'map' : typeof value;
};

const printableValue = (value: unknown): unknown => {
  if (value === undefined) return null;
  if (value instanceof Timestamp) {
    return {
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
      iso: value.toDate().toISOString(),
    };
  }
  if (value instanceof Date) return value.toISOString();
  return value;
};

const isServerTimestampSentinel = (value: unknown): boolean => (
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (value as Record<string, unknown>)._methodName === 'serverTimestamp'
);

const displayValue = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export default function AdminTimestampAudit() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<TimestampAuditReport | null>(null);

  if (authLoading || !user || isAdmin !== true) return null;

  const runAudit = async () => {
    // Defence in depth: never read the collection unless the current AuthContext
    // has finished loading and confirms an authenticated administrator.
    if (authLoading || !user || isAdmin !== true || running) return;

    setRunning(true);
    setError(null);

    try {
      // Read-only Client SDK operation using the current Firebase Auth session.
      const snapshot = await getDocs(collection(db, 'ads'));
      const fields = {
        createdAt: emptyFieldResult(),
        ...Object.fromEntries(
          OPTIONAL_TIMESTAMP_FIELDS.map((fieldName) => [fieldName, emptyFieldResult()]),
        ),
      } as Record<TimestampFieldName, FieldAuditResult>;

      for (const documentSnapshot of snapshot.docs) {
        const data = documentSnapshot.data() as Record<string, unknown>;

        const addAffectedDocument = (fieldName: TimestampFieldName, value: unknown) => {
          fields[fieldName].affectedDocuments.push({
            documentId: documentSnapshot.id,
            title: typeof data.title === 'string' ? data.title : null,
            sellerEmail: typeof data.sellerEmail === 'string' ? data.sellerEmail : null,
            sellerId: typeof data.sellerId === 'string' ? data.sellerId : null,
            type: valueType(value),
            value: printableValue(value),
            serverTimestampSentinel: isServerTimestampSentinel(value),
          });
        };

        const createdAt = data.createdAt;
        if (createdAt instanceof Timestamp) {
          fields.createdAt.valid += 1;
        } else {
          fields.createdAt.invalid += 1;
          if (createdAt === undefined) fields.createdAt.missing += 1;
          addAffectedDocument('createdAt', createdAt);
        }

        for (const fieldName of OPTIONAL_TIMESTAMP_FIELDS) {
          const value = data[fieldName];
          if (value === undefined) {
            fields[fieldName].missing += 1;
          } else if (value instanceof Timestamp) {
            fields[fieldName].valid += 1;
          } else {
            fields[fieldName].invalid += 1;
            addAffectedDocument(fieldName, value);
          }
        }
      }

      const nextReport: TimestampAuditReport = {
        auditedAt: new Date().toISOString(),
        totalAdsChecked: snapshot.size,
        fields,
      };

      setReport(nextReport);
      console.info('[Admin Timestamp Audit] Read-only report:', nextReport);
    } catch (auditError) {
      console.error('[Admin Timestamp Audit] Read-only audit failed:', auditError);
      setError(
        auditError instanceof Error
          ? auditError.message
          : 'The timestamp audit could not read the ads collection.',
      );
    } finally {
      setRunning(false);
    }
  };

  const fieldEntries = report
    ? (Object.entries(report.fields) as [TimestampFieldName, FieldAuditResult][])
    : [];

  return (
    <section className="rounded-3xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-black text-slate-900">Read-only Timestamp Audit</h2>
          </div>
          <p className="mt-1 text-xs font-medium text-slate-600">
            Admin-only diagnostic. Reads every listing with your current Firebase Auth session and never writes changes.
          </p>
        </div>
        <button
          type="button"
          onClick={runAudit}
          disabled={running}
          className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? <Database className="h-4 w-4 animate-pulse" /> : <Play className="h-4 w-4" />}
          {running ? 'Auditing timestamps…' : 'Run timestamp audit'}
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {report && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ads checked</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{report.totalAdsChecked}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Valid createdAt</p>
              <p className="mt-1 text-2xl font-black text-emerald-800">{report.fields.createdAt.valid}</p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-rose-600">Invalid createdAt</p>
              <p className="mt-1 text-2xl font-black text-rose-800">{report.fields.createdAt.invalid}</p>
            </div>
          </div>

          <p className="text-[11px] font-medium text-slate-500">
            Completed {new Date(report.auditedAt).toLocaleString('en-GB')}. Missing createdAt values count as invalid;
            missing optional fields are reported separately and do not count as invalid.
          </p>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Field</th>
                  <th className="px-4 py-3">Valid</th>
                  <th className="px-4 py-3">Invalid</th>
                  <th className="px-4 py-3">Missing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fieldEntries.map(([fieldName, result]) => (
                  <React.Fragment key={fieldName}>
                    <tr>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">{fieldName}</td>
                      <td className="px-4 py-3 font-black text-emerald-700">{result.valid}</td>
                      <td className={`px-4 py-3 font-black ${result.invalid ? 'text-rose-700' : 'text-slate-400'}`}>
                        {result.invalid}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-500">{result.missing}</td>
                    </tr>
                    {result.affectedDocuments.length > 0 && (
                      <tr>
                        <td colSpan={4} className="bg-rose-50/40 px-4 py-3">
                          <details open={fieldName === 'createdAt'}>
                            <summary className="cursor-pointer font-black text-rose-800">
                              Show {result.affectedDocuments.length} affected document(s)
                            </summary>
                            <div className="mt-3 space-y-3">
                              {result.affectedDocuments.map((affected) => (
                                <div
                                  key={`${fieldName}-${affected.documentId}`}
                                  className="rounded-xl border border-rose-200 bg-white p-3 text-slate-700"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <p className="font-black text-slate-900">{affected.title || '(untitled listing)'}</p>
                                      <p className="mt-0.5 font-mono text-[10px] text-slate-500">{affected.documentId}</p>
                                    </div>
                                    {affected.serverTimestampSentinel && (
                                      <span className="rounded-full bg-rose-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white">
                                        {'{_methodName: "serverTimestamp"} detected'}
                                      </span>
                                    )}
                                  </div>
                                  <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <div><dt className="font-black text-slate-500">sellerEmail</dt><dd className="break-all">{affected.sellerEmail || '—'}</dd></div>
                                    <div><dt className="font-black text-slate-500">sellerId</dt><dd className="break-all font-mono">{affected.sellerId || '—'}</dd></div>
                                    <div><dt className="font-black text-slate-500">Invalid type</dt><dd className="font-mono">{affected.type}</dd></div>
                                    <div><dt className="font-black text-slate-500">Current value</dt><dd className="break-all font-mono">{displayValue(affected.value)}</dd></div>
                                  </dl>
                                </div>
                              ))}
                            </div>
                          </details>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {report.fields.createdAt.invalid === 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
              <CheckCircle className="h-4 w-4" />
              Every listing has a valid Firestore Timestamp in createdAt.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
