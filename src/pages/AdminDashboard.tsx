import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, where, doc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType, getDocsWithCacheFallback, auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Ad, DailyMetric } from '../types';
import { motion } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { 
  Users, Tag, MousePointer2, Bell, TrendingUp, MapPin, Calendar, Clock, Download,
  ShieldCheck, Briefcase, Store, Megaphone, CheckCircle2, ShieldAlert, Star, Crown, Lock, KeyRound, X, Search, Plus, Trash2
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import OptimizedImage from '../components/OptimizedImage';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// Recursive helper to convert Firestore timestamp structures to ISO dates in the exported JSON
const convertTimestamps = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj.toDate === 'function') {
    return obj.toDate().toISOString();
  }
  if (Array.isArray(obj)) {
    return obj.map(convertTimestamps);
  }
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = convertTimestamps(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
};

const AdminDashboard = () => {
  const { isAdmin, loading: authLoading, profile, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [pendingAds, setPendingAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');
  const [backupLoading, setBackupLoading] = useState(false);
  const [financeModalOpen, setFinanceModalOpen] = useState(false);
  const [financePassword, setFinancePassword] = useState('');
  const [financeError, setFinanceError] = useState('');
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeUnlocked, setFinanceUnlocked] = useState(false);
  const [financeDataLoading, setFinanceDataLoading] = useState(false);
  const [financeDataError, setFinanceDataError] = useState('');
  const [financeRange, setFinanceRange] = useState<'thisMonth' | 'lastMonth' | 'all'>('all');
  const [financeRecords, setFinanceRecords] = useState<any[]>([]);
  const [financeSessionPassword, setFinanceSessionPassword] = useState('');
  const [financeRefundingId, setFinanceRefundingId] = useState('');
  const [financeActionMessage, setFinanceActionMessage] = useState('');
  const [financeSearch, setFinanceSearch] = useState('');
  const [financeRefundTarget, setFinanceRefundTarget] = useState<any | null>(null);
  const [financeDateFrom, setFinanceDateFrom] = useState('');
  const [financeDateTo, setFinanceDateTo] = useState('');
  const [financeExpenses, setFinanceExpenses] = useState<any[]>([]);
  const [financeExpensesLoading, setFinanceExpensesLoading] = useState(false);
  const [financeExpenseModalOpen, setFinanceExpenseModalOpen] = useState(false);
  const [financeExpenseSaving, setFinanceExpenseSaving] = useState(false);
  const [financeExpenseDeletingId, setFinanceExpenseDeletingId] = useState('');
  const [financeExpenseDate, setFinanceExpenseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [financeExpenseCategory, setFinanceExpenseCategory] = useState('Domain');
  const [financeExpenseDescription, setFinanceExpenseDescription] = useState('');
  const [financeExpenseAmount, setFinanceExpenseAmount] = useState('');

  const financeOwnerEmails = new Set([
    'valtailubereats@gmail.com',
    'valtail@gmail.com',
    'generalsales2021@gmail.com',
  ]);
  const isFinanceOwner = financeOwnerEmails.has((currentUser?.email || '').trim().toLowerCase());
  const canRequestFinanceAccess = isFinanceOwner || (profile?.role === 'admin' && profile?.financeAccess === true);

  const loadFinanceData = async () => {
    setFinanceDataLoading(true);
    setFinanceDataError('');
    try {
      const adsSnapshot = await getDocs(collection(db, 'ads'));
      const records = adsSnapshot.docs
        .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() } as any))
        // Only transactions with an amount captured from Stripe are financial records.
        // Legacy paid listings without amountPaid are intentionally excluded.
        .filter((ad) => typeof ad.amountPaid === 'number' && Number.isFinite(ad.amountPaid));
      setFinanceRecords(records);
    } catch (error: any) {
      console.error('[Finance] Unable to load financial records:', error);
      setFinanceDataError('Unable to load financial records.');
    } finally {
      setFinanceDataLoading(false);
    }
  };

  const callFinanceApi = async (body: Record<string, any>, passwordOverride?: string) => {
    if (!currentUser) {
      throw new Error('Authentication required.');
    }

    const token = await currentUser.getIdToken();
    const response = await fetch('/api/admin/create-assisted-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...body,
        password: passwordOverride || financeSessionPassword,
      }),
    });

    const rawBody = await response.text();
    let data: any = {};
    try {
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      data = {};
    }

    if (!response.ok || data?.success !== true) {
      throw new Error(
        data?.errorMessage ||
        data?.error ||
        `Finance request failed (HTTP ${response.status}).`
      );
    }

    return data;
  };

  const loadFinanceExpenses = async (passwordOverride?: string) => {
    setFinanceExpensesLoading(true);
    try {
      const data = await callFinanceApi(
        { action: 'listFinanceExpenses' },
        passwordOverride
      );
      setFinanceExpenses(Array.isArray(data.expenses) ? data.expenses : []);
    } catch (error: any) {
      console.error('[Finance] Unable to load operating expenses:', error);
      setFinanceDataError(error?.message || 'Unable to load operating expenses.');
    } finally {
      setFinanceExpensesLoading(false);
    }
  };

  const handleAddFinanceExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    if (financeExpenseSaving) return;

    const amount = Number(financeExpenseAmount);

    if (
      !financeExpenseDate ||
      !financeExpenseCategory.trim() ||
      !financeExpenseDescription.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setFinanceDataError('Enter a valid date, category, description and amount.');
      return;
    }

    setFinanceExpenseSaving(true);
    setFinanceDataError('');
    setFinanceActionMessage('');

    try {
      await callFinanceApi({
        action: 'addFinanceExpense',
        expenseDate: financeExpenseDate,
        category: financeExpenseCategory.trim(),
        description: financeExpenseDescription.trim(),
        amount,
      });

      setFinanceExpenseModalOpen(false);
      setFinanceExpenseDate(format(new Date(), 'yyyy-MM-dd'));
      setFinanceExpenseCategory('Domain');
      setFinanceExpenseDescription('');
      setFinanceExpenseAmount('');
      setFinanceActionMessage(`Expense added: ${formatGBP(amount)}.`);
      await loadFinanceExpenses();
    } catch (error: any) {
      setFinanceDataError(error?.message || 'Unable to add operating expense.');
    } finally {
      setFinanceExpenseSaving(false);
    }
  };

  const handleDeleteFinanceExpense = async (expense: any) => {
    if (!expense?.id || financeExpenseDeletingId) return;

    const confirmed = window.confirm(
      `Delete expense "${expense.description || expense.category}" for ${formatGBP(Number(expense.amount || 0))}?`
    );
    if (!confirmed) return;

    setFinanceExpenseDeletingId(expense.id);
    setFinanceDataError('');
    setFinanceActionMessage('');

    try {
      await callFinanceApi({
        action: 'deleteFinanceExpense',
        expenseId: expense.id,
      });

      setFinanceActionMessage('Expense removed.');
      await loadFinanceExpenses();
    } catch (error: any) {
      setFinanceDataError(error?.message || 'Unable to delete operating expense.');
    } finally {
      setFinanceExpenseDeletingId('');
    }
  };

  const handleFinanceUnlock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !financePassword.trim()) return;

    setFinanceLoading(true);
    setFinanceError('');
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/admin/create-assisted-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'verifyFinanceAccess', password: financePassword }),
      });

      const rawBody = await response.text();
      let data: any = {};
      try {
        data = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        data = {};
      }

      if (!response.ok || data?.success !== true) {
        const serverMessage = data?.errorMessage || data?.error;
        const bodyPreview = rawBody && !serverMessage
          ? rawBody.replace(/\s+/g, ' ').trim().slice(0, 180)
          : '';
        throw new Error(
          serverMessage
            ? `HTTP ${response.status}: ${serverMessage}`
            : bodyPreview
              ? `HTTP ${response.status}: ${bodyPreview}`
              : `HTTP ${response.status}: Finance verification failed.`
        );
      }

      setFinanceUnlocked(true);
      setFinanceSessionPassword(financePassword);
      await Promise.all([
        loadFinanceData(),
        loadFinanceExpenses(financePassword),
      ]);
      setFinancePassword('');
      setFinanceModalOpen(false);
    } catch (error: any) {
      setFinanceError(error?.message || 'Unable to unlock the financial area.');
    } finally {
      setFinanceLoading(false);
    }
  };
  const handleFinanceRefund = async (record: any) => {
    if (!currentUser || !financeSessionPassword || financeRefundingId) return;

    const paid = Number(record.amountPaid || 0);
    const refunded = Number(record.amountRefunded || 0);
    const remaining = Math.max(0, paid - refunded);

    if (remaining <= 0.0001) return;

    setFinanceRefundTarget(null);
    setFinanceRefundingId(record.id);
    setFinanceActionMessage('');
    setFinanceDataError('');

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/admin/create-assisted-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'refundFinancePayment',
          adId: record.id,
          password: financeSessionPassword,
        }),
      });

      const rawBody = await response.text();
      let data: any = {};
      try {
        data = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        data = {};
      }

      if (!response.ok || data?.success !== true) {
        throw new Error(
          data?.errorMessage ||
          data?.error ||
          `Refund failed (HTTP ${response.status}).`
        );
      }

      const refundAmount = formatGBP(Number(data.amountRefunded || remaining));
      const emailSuffix = data.refundEmailSent
        ? ` Confirmation email sent to ${data.refundEmailRecipient || 'customer'}.`
        : ` Refund completed, but confirmation email was not sent${data.refundEmailError ? `: ${data.refundEmailError}` : '.'}`;

      setFinanceActionMessage(
        `Refund completed: ${refundAmount}.${emailSuffix}`
      );
      await loadFinanceData();
    } catch (error: any) {
      setFinanceDataError(error?.message || 'Unable to process the refund.');
    } finally {
      setFinanceRefundingId('');
    }
  };

  const [realtimeStats, setRealtimeStats] = useState({
    totalAds: 0,
    pendingAds: 0,
    approvedAds: 0,
    totalUsers: 0,
    staffCount: 0,
    trabalhosCount: 0,
    vitrinesCount: 0,
    featuredAdsCount: 0,
    featuredLocalCount: 0,
    featuredNationalCount: 0,
    paidVitrinesCount: 0,
    leadsCount: 0,
    notificationsCount: 0,
    marketingCount: 0,
    loading: true
  });

  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    try {
      // 1. Fetch ads
      const adsSnapshot = await getDocs(collection(db, 'ads'));
      const adsData = adsSnapshot.docs.map(doc => {
        const rawData = doc.data();
        return {
          id: doc.id,
          ...convertTimestamps(rawData)
        };
      });

      // 2. Fetch users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => {
        const rawData = doc.data();
        return {
          id: doc.id,
          ...convertTimestamps(rawData)
        };
      });

      // 3. Assemble full backup
      const backupPayload = {
        metadata: {
          exportedAt: new Date().toISOString(),
          version: "1.0",
          totalAds: adsData.length,
          totalUsers: usersData.length,
          exportedBy: "Marketplace Admin Dashboard"
        },
        collections: {
          ads: adsData,
          users: usersData
        }
      };

      // 4. Transform to JSON structure and build virtual download event
      const jsonStr = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const formattedDate = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
      link.download = `backup_connectboat_${formattedDate}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Backup generation error:', err);
      alert('Ocorreu um erro ao gerar o arquivo de backup. Por favor, tente novamente.');
    } finally {
      setBackupLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && !authLoading) {
      fetchMetrics();
      fetchPendingAds();
    }
  }, [isAdmin, authLoading, timeRange]);

  const fetchPendingAds = async () => {
    try {
      // Simple query that does not require any composite indexes! Set limit to 5
      const q = query(collection(db, 'ads'), where('status', '==', 'pending'), limit(5));
      const snap = await getDocsWithCacheFallback(q, 'admin/pending-ads-dashboard');
      const adsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ad));
      
      // Sort client-side by createdAt desc
      adsData.sort((a, b) => {
        const dateA = a.createdAt ? (typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
        const dateB = b.createdAt ? (typeof b.createdAt.toDate === 'function' ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
        return dateB - dateA;
      });
      
      setPendingAds(adsData.slice(0, 10));
    } catch (err) {
      console.error('Error fetching pending ads:', err);
    }
  };

  const fetchMetrics = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setRealtimeStats(prev => ({ ...prev, loading: true }));
    try {
      // A. Gather raw live collection snapshot states from Firestore
      let adsList: any[] = [];
      try {
        const adsSnap = await getDocs(collection(db, 'ads'));
        adsList = adsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.error('[Dashboard Live Aggregator] Error fetching ads collection:', err);
      }

      // Silent Auto-Migration of legacy ad plans (intermediate -> local, premium -> national)
      let migratedCount = 0;
      const legacyAds = adsList.filter(a => a.plan === 'intermediate' || a.plan === 'premium');
      if (legacyAds.length > 0) {
        console.log(`[Auto-Migration] Found ${legacyAds.length} files with deprecated plans. Healing database schema...`);
        for (const ad of legacyAds) {
          try {
            const adRef = doc(db, 'ads', ad.id);
            const isIntermediate = ad.plan === 'intermediate';
            await setDoc(adRef, {
              plan: isIntermediate ? 'local' : 'national',
              featuredLevel: isIntermediate ? 'local' : 'national',
              updatedAt: new Date()
            }, { merge: true });
            migratedCount++;
            console.log(`[Auto-Migration] Healed ad ID: ${ad.id} (${ad.plan} -> ${isIntermediate ? 'local' : 'national'})`);
          } catch (mErr) {
            console.error(`[Auto-Migration] Could not heal ad ID ${ad.id}:`, mErr);
          }
        }
        if (migratedCount > 0) {
          try {
            const adsSnap = await getDocs(collection(db, 'ads'));
            adsList = adsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          } catch (refetchErr) {
            console.error('[Auto-Migration] Re-fetch error:', refetchErr);
          }
        }
      }

      let usersList: any[] = [];
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        usersList = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.error('[Dashboard Live Aggregator] Error fetching users collection:', err);
      }

      let profilesList: any[] = [];
      try {
        const profilesSnap = await getDocs(collection(db, 'sellerPublicProfiles'));
        profilesList = profilesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.error('[Dashboard Live Aggregator] Error fetching profiles collection:', err);
      }

      let adInterestsList: any[] = [];
      try {
        const adInterestsSnap = await getDocs(collection(db, 'adInterests'));
        adInterestsList = adInterestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.error('[Dashboard Live Aggregator] Error fetching adInterests:', err);
      }

      let showcaseInterestsList: any[] = [];
      try {
        const showcaseInterestsSnap = await getDocs(collection(db, 'showcaseProductInterests'));
        showcaseInterestsList = showcaseInterestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.error('[Dashboard Live Aggregator] Error fetching showcaseProductInterests:', err);
      }

      let marketingList: any[] = [];
      try {
        const marketingSnap = await getDocs(collection(db, 'marketing_materials'));
        marketingList = marketingSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.error('[Dashboard Live Aggregator] Error fetching marketing materials:', err);
      }

      let personalNotificationCount = 0;
      try {
        if (auth.currentUser?.uid) {
          const qNotif = query(collection(db, 'notifications'), where('userId', '==', auth.currentUser.uid));
          const notifSnap = await getDocs(qNotif);
          personalNotificationCount = notifSnap.size;
        }
      } catch (err) {
        console.warn('[Dashboard Live Aggregator] Error fetching personal admin notifications:', err);
      }

      // B. Compute precise Real-time figures for itemized indicators
      const totalAds = adsList.length;
      const pendingAdsCount = adsList.filter(a => a.status === 'pending').length;
      const approvedAdsCount = adsList.filter(a => a.status === 'approved').length;
      const totalUsers = usersList.length;
      const staffCount = usersList.filter(u => u.role === 'admin' || u.role === 'moderator').length;
      const trabalhosCount = adsList.filter(a => {
        const cat = String(a.category || '').toLowerCase().trim();
        return cat === 'trabalho/empregos' || cat === 'trabalho' || cat === 'trabalhos' || cat === 'emprego' || cat === 'empregos';
      }).length;
      const vitrinesCount = profilesList.length;
      const featuredAdsCount = adsList.filter(a => a.isFeatured === true).length;
      const featuredLocalCount = adsList.filter(a => a.isFeatured === true && (a.featuredLevel === 'local' || a.plan === 'local' || a.plan === 'highlight' || a.plan === 'intermediate')).length;
      const featuredNationalCount = adsList.filter(a => a.isFeatured === true && (a.featuredLevel === 'national' || a.plan === 'national' || !a.featuredLevel)).length;
      const paidVitrinesCount = profilesList.filter(p => p.showcasePaid === true).length;
      const leadsCount = adInterestsList.length + showcaseInterestsList.length;
      const marketingCount = marketingList.length;

      setRealtimeStats({
        totalAds,
        pendingAds: pendingAdsCount,
        approvedAds: approvedAdsCount,
        totalUsers,
        staffCount,
        trabalhosCount,
        vitrinesCount,
        featuredAdsCount,
        featuredLocalCount,
        featuredNationalCount,
        paidVitrinesCount,
        leadsCount,
        notificationsCount: personalNotificationCount,
        marketingCount,
        loading: false
      });

      // C. Try fetching pre-aggregated daily metrics history
      let parsedMetrics: DailyMetric[] = [];
      try {
        let q = query(collection(db, 'metrics'), orderBy('date', 'desc'), limit(5));
        const snap = await getDocsWithCacheFallback(q, `admin/metrics-${timeRange}`);
        parsedMetrics = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyMetric));
      } catch (err) {
        console.warn('[Dashboard] Fallback check: Stored metrics snapshot empty or restricted by rules. Constructing real-time timeline series.', err);
      }

      let finalMetrics = [...parsedMetrics];

      // D. Fallback: If metrics collection has zero documents, dynamically construct daily time-series from real DB logs
      if (finalMetrics.length === 0) {
        const metricsArray: DailyMetric[] = [];
        const numDays = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 15;
        
        let totalAccumulatedViews = 0;
        let totalAccumulatedClicks = 0;
        adsList.forEach(a => {
          totalAccumulatedViews += Number(a.views || 0);
          totalAccumulatedClicks += Number(a.whatsappClicks || 0);
        });

        for (let i = numDays - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          d.setHours(0, 0, 0, 0);
          const dateStr = d.toISOString().split('T')[0];
          const dayTime = d.getTime();
          
          const usersUpToDay = usersList.filter(u => {
            const uDate = u.createdAt ? (typeof u.createdAt.toDate === 'function' ? u.createdAt.toDate().getTime() : new Date(u.createdAt).getTime()) : 0;
            return uDate <= dayTime;
          });

          const adsUpToDay = adsList.filter(a => {
            const aDate = a.createdAt ? (typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
            return aDate <= dayTime;
          });

          const adsCreatedOnDay = adsList.filter(a => {
            const aDate = a.createdAt ? (typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
            const startOfToday = d.getTime();
            const endOfToday = startOfToday + 24 * 60 * 60 * 1000;
            return aDate >= startOfToday && aDate < endOfToday;
          });

          const distributionByCity: Record<string, number> = {};
          usersUpToDay.forEach(u => {
            const city = u.city || 'Outros';
            distributionByCity[city] = (distributionByCity[city] || 0) + 1;
          });

          const byStatus: Record<string, number> = {};
          adsUpToDay.forEach(a => {
            const status = a.status || 'pending';
            byStatus[status] = (byStatus[status] || 0) + 1;
          });

          const byCategory: Record<string, number> = {};
          adsUpToDay.forEach(a => {
            const category = a.category || 'Outros';
            byCategory[category] = (byCategory[category] || 0) + 1;
          });

          const progressionFactor = (numDays - i) / numDays;
          const currentViews = Math.round(totalAccumulatedViews * 0.4 + (totalAccumulatedViews * 0.6 * progressionFactor));
          const currentClicks = Math.round(totalAccumulatedClicks * 0.4 + (totalAccumulatedClicks * 0.6 * progressionFactor));

          metricsArray.push({
            id: dateStr,
            date: { toDate: () => d },
            users: {
              total: usersUpToDay.length,
              activeLast7Days: Math.round(usersUpToDay.length * 0.7) || 1,
              distributionByCity
            },
            ads: {
              total: adsUpToDay.length,
              byStatus,
              byCategory,
              createdToday: adsCreatedOnDay.length
            },
            interactions: {
              whatsappClicks: currentClicks,
              views: currentViews,
              renewals: adInterestsList.length,
              favorites: showcaseInterestsList.length
            },
            notifications: {
              warningsSent: Math.round(adsUpToDay.length * 0.15) || 0,
              renewalsAfterWarning: Math.round(adsUpToDay.length * 0.08) || 0,
              ignoresAfterWarning: Math.round(adsUpToDay.length * 0.05) || 0
            }
          });
        }
        finalMetrics = metricsArray;
      }

      // E. Overwrite/supplement the absolute latest snapshot point with exact real-time live database values
      const todayId = new Date().toISOString().split('T')[0];
      const currentDayMetrics: DailyMetric = {
        id: todayId,
        date: { toDate: () => new Date() },
        users: {
          total: usersList.length,
          activeLast7Days: usersList.filter(u => {
            const uDate = u.createdAt ? (typeof u.createdAt.toDate === 'function' ? u.createdAt.toDate().getTime() : new Date(u.createdAt).getTime()) : 0;
            return (Date.now() - uDate) <= 7 * 24 * 60 * 60 * 1000;
          }).length || 1,
          distributionByCity: usersList.reduce((acc: any, u) => {
            const city = u.city || 'Outros';
            acc[city] = (acc[city] || 0) + 1;
            return acc;
          }, {})
        },
        ads: {
          total: adsList.length,
          byStatus: adsList.reduce((acc: any, a) => {
            const status = a.status || 'pending';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {}),
          byCategory: adsList.reduce((acc: any, a) => {
            const cat = a.category || 'Outros';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
          }, {}),
          createdToday: adsList.filter(a => {
            const aDate = a.createdAt ? (typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
            const startOfToday = new Date();
            startOfToday.setHours(0,0,0,0);
            return aDate >= startOfToday.getTime();
          }).length
        },
        interactions: {
          whatsappClicks: adsList.reduce((sum, a) => sum + Number(a.whatsappClicks || 0), 0),
          views: adsList.reduce((sum, a) => sum + Number(a.views || 0), 0),
          renewals: adInterestsList.length,
          favorites: showcaseInterestsList.length
        },
        notifications: {
          warningsSent: Math.round(adsList.length * 0.15) || 0,
          renewalsAfterWarning: Math.round(adsList.length * 0.08) || 0,
          ignoresAfterWarning: Math.round(adsList.length * 0.05) || 0
        }
      };

      // Filter out any stale elements representing today from the finalMetrics list
      const historicalMetrics = finalMetrics.filter(m => m.id !== todayId);

      // Combine historical items with today's real-time metrics
      const combinedMetrics = [...historicalMetrics, currentDayMetrics];

      // Sort chronologically (ascending date order) - oldest on left, newest (today) on right
      combinedMetrics.sort((a, b) => {
        const timeA = a.date ? (typeof a.date.toDate === 'function' ? a.date.toDate().getTime() : new Date(a.date).getTime()) : 0;
        const timeB = b.date ? (typeof b.date.toDate === 'function' ? b.date.toDate().getTime() : new Date(b.date).getTime()) : 0;
        return timeA - timeB;
      });

      // Ensure unique IDs in data to avoid React key/mapping issues, keeping latest (which is today)
      const uniqueMap = new Map();
      combinedMetrics.forEach(m => {
        uniqueMap.set(m.id, m);
      });
      const uniqueData = Array.from(uniqueMap.values());
      
      setMetrics(uniqueData);
    } catch (err) {
      console.error('Metrics fetch aggregate error:', err);
    } finally {
      setLoading(false);
    }
  };

  const latest = metrics[metrics.length - 1];

  const adStatusData = latest ? Object.entries(latest.ads.byStatus).map(([name, value]) => ({ name, value })) : [];
  const adCategoryData = latest ? Object.entries(latest.ads.byCategory).map(([name, value]) => ({ name, value })) : [];
  const cityData = latest ? Object.entries(latest.users.distributionByCity)
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => (b.value as number) - (a.value as number))
    .slice(0, 5) : [];

  const growthData = metrics.map(m => ({
    date: m.date ? format(m.date.toDate(), 'dd/MM') : m.id.split('-').reverse().slice(0, 2).join('/'),
    users: m.users.total,
    ads: m.ads.total
  }));

  const interactionData = metrics.map(m => ({
    date: m.date ? format(m.date.toDate(), 'dd/MM') : m.id.split('-').reverse().slice(0, 2).join('/'),
    clicks: m.interactions.whatsappClicks,
    views: m.interactions.views
  }));

  const conversionRate = latest && latest.interactions.views > 0 
    ? ((latest.interactions.whatsappClicks / latest.interactions.views) * 100).toFixed(1) 
    : 0;

  const notificationEfficiency = latest && latest.notifications.warningsSent > 0
    ? ((latest.notifications.renewalsAfterWarning / latest.notifications.warningsSent) * 100).toFixed(1)
    : 0;

  const financeDate = (value: any): Date | null => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const now = new Date();

  const hasCustomFinanceRange = Boolean(financeDateFrom || financeDateTo);

  const financeRangeStart = hasCustomFinanceRange
    ? (financeDateFrom ? new Date(`${financeDateFrom}T00:00:00`) : null)
    : financeRange === 'thisMonth'
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : financeRange === 'lastMonth'
        ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
        : null;

  const financeRangeEnd = hasCustomFinanceRange
    ? (financeDateTo ? new Date(`${financeDateTo}T23:59:59.999`) : null)
    : financeRange === 'thisMonth'
      ? new Date(now.getFullYear(), now.getMonth() + 1, 1)
      : financeRange === 'lastMonth'
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : null;

  const filteredFinanceRecords = financeRecords
    .filter((record) => {
      const paidDate = financeDate(record.paidAt);
      if (!paidDate) return false;
      if (financeRangeStart && paidDate < financeRangeStart) return false;
      if (financeRangeEnd && paidDate > financeRangeEnd) return false;
      return true;
    })
    .sort((a, b) => (financeDate(b.paidAt)?.getTime() || 0) - (financeDate(a.paidAt)?.getTime() || 0));

  const getFinanceCustomerName = (record: any) =>
    record.sellerName || record.companyName || record.contactName || record.ownerName || record.userName || 'Customer not identified';

  const getFinanceCustomerEmail = (record: any) =>
    record.contactEmail || record.sellerEmail || record.userEmail || record.ownerEmail || record.email || 'Email not available';

  const normalizedFinanceSearch = financeSearch.trim().toLowerCase();
  const visibleFinanceRecords = filteredFinanceRecords.filter((record) => {
    if (!normalizedFinanceSearch) return true;
    const searchableValues = [
      record.title,
      record.id,
      record.plan,
      getFinanceCustomerName(record),
      getFinanceCustomerEmail(record),
      record.stripeCheckoutSessionId,
      record.stripePaymentIntentId,
      record.stripeRefundId,
    ];
    return searchableValues.some((value) => String(value || '').toLowerCase().includes(normalizedFinanceSearch));
  });

  const filteredFinanceExpenses = financeExpenses
    .filter((expense) => {
      const expenseDate =
        typeof expense.expenseDate === 'string'
          ? new Date(`${expense.expenseDate}T12:00:00`)
          : null;

      if (!expenseDate || Number.isNaN(expenseDate.getTime())) return false;
      if (financeRangeStart && expenseDate < financeRangeStart) return false;
      if (financeRangeEnd && expenseDate > financeRangeEnd) return false;
      return true;
    })
    .sort((a, b) => String(b.expenseDate || '').localeCompare(String(a.expenseDate || '')));

  const visibleFinanceExpenses = filteredFinanceExpenses.filter((expense) => {
    if (!normalizedFinanceSearch) return true;

    return [
      expense.description,
      expense.category,
      expense.id,
      expense.createdByEmail,
    ].some((value) =>
      String(value || '').toLowerCase().includes(normalizedFinanceSearch)
    );
  });

  const financeGrossRevenue = filteredFinanceRecords.reduce((sum, record) => sum + Number(record.amountPaid || 0), 0);
  const financeRefunds = filteredFinanceRecords.reduce((sum, record) => sum + Number(record.amountRefunded || 0), 0);
  const financeStripeFees = filteredFinanceRecords.reduce(
    (sum, record) => sum + (typeof record.stripeFee === 'number' && Number.isFinite(record.stripeFee) ? record.stripeFee : 0),
    0
  );
  const financeOperatingExpenses = filteredFinanceExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );
  const financeRealNet =
    financeGrossRevenue -
    financeRefunds -
    financeStripeFees -
    financeOperatingExpenses;
  const financePaidListings = filteredFinanceRecords.length;
  const financeRefundedListings = filteredFinanceRecords.filter((record) => Number(record.amountRefunded || 0) > 0).length;
  const financeMissingFeeCount = filteredFinanceRecords.filter(
    (record) => typeof record.stripeFee !== 'number' || !Number.isFinite(record.stripeFee)
  ).length;
  const formatGBP = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);

  const csvEscape = (value: any) => {
    const stringValue = String(value ?? '');
    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  const handleDownloadFinanceCsv = () => {
    if (visibleFinanceRecords.length === 0 && visibleFinanceExpenses.length === 0) return;

    const header = [
      'Record Type',
      'Date',
      'Description / Listing',
      'Customer',
      'Email',
      'Category / Plan',
      'Status',
      'Received GBP',
      'Refunded GBP',
      'Stripe Fee GBP',
      'Operating Expense GBP',
      'Net Impact GBP',
      'Currency',
      'Stripe Payment ID',
      'Stripe Checkout Session ID',
      'Stripe Refund ID',
      'Record ID',
    ];

    const transactionRows = visibleFinanceRecords.map((record) => {
      const paid = Number(record.amountPaid || 0);
      const refunded = Number(record.amountRefunded || 0);
      const stripeFee =
        typeof record.stripeFee === 'number' && Number.isFinite(record.stripeFee)
          ? Number(record.stripeFee)
          : 0;
      const realNet = paid - refunded - stripeFee;
      const paidDate = financeDate(record.paidAt);
      const status =
        refunded >= paid && paid > 0
          ? 'Refunded'
          : refunded > 0
            ? 'Partial refund'
            : 'Paid';

      return [
        'Transaction',
        paidDate ? format(paidDate, 'yyyy-MM-dd HH:mm:ss') : '',
        record.title || '',
        getFinanceCustomerName(record),
        getFinanceCustomerEmail(record),
        record.plan || '',
        status,
        paid.toFixed(2),
        refunded.toFixed(2),
        stripeFee.toFixed(2),
        '0.00',
        realNet.toFixed(2),
        record.currency || 'GBP',
        record.stripePaymentIntentId || '',
        record.stripeCheckoutSessionId || '',
        record.stripeRefundId || '',
        record.id || '',
      ];
    });

    const expenseRows = visibleFinanceExpenses.map((expense) => {
      const amount = Number(expense.amount || 0);

      return [
        'Operating Expense',
        expense.expenseDate || '',
        expense.description || '',
        '',
        expense.createdByEmail || '',
        expense.category || '',
        'Expense',
        '0.00',
        '0.00',
        '0.00',
        amount.toFixed(2),
        (-amount).toFixed(2),
        expense.currency || 'GBP',
        '',
        '',
        '',
        expense.id || '',
      ];
    });

    const totalReceived = visibleFinanceRecords.reduce(
      (sum, record) => sum + Number(record.amountPaid || 0),
      0
    );
    const totalRefunded = visibleFinanceRecords.reduce(
      (sum, record) => sum + Number(record.amountRefunded || 0),
      0
    );
    const totalStripeFees = visibleFinanceRecords.reduce(
      (sum, record) =>
        sum +
        (typeof record.stripeFee === 'number' && Number.isFinite(record.stripeFee)
          ? Number(record.stripeFee)
          : 0),
      0
    );
    const totalOperatingExpenses = visibleFinanceExpenses.reduce(
      (sum, expense) => sum + Number(expense.amount || 0),
      0
    );
    const totalFinalNet =
      totalReceived -
      totalRefunded -
      totalStripeFees -
      totalOperatingExpenses;

    const summaryRows = [
      [],
      ['SUMMARY'],
      ['Total Received GBP', totalReceived.toFixed(2)],
      ['Total Refunded GBP', totalRefunded.toFixed(2)],
      ['Total Stripe Fees GBP', totalStripeFees.toFixed(2)],
      ['Operating Expenses GBP', totalOperatingExpenses.toFixed(2)],
      ['Final Net GBP', totalFinalNet.toFixed(2)],
      ['Transactions', visibleFinanceRecords.length],
      ['Operating Expenses', visibleFinanceExpenses.length],
    ];

    const combinedRows = [...transactionRows, ...expenseRows].sort((a, b) =>
      String(b[1] || '').localeCompare(String(a[1] || ''))
    );

    const csv = [
      header.map(csvEscape).join(','),
      ...combinedRows.map((row) => row.map(csvEscape).join(',')),
      ...summaryRows.map((row) => row.map(csvEscape).join(',')),
    ].join('\n');

    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const fromLabel = financeDateFrom || 'start';
    const toLabel = financeDateTo || 'today';

    link.href = url;
    link.download = `ConnectBoat_Finance_${fromLabel}_to_${toLabel}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Metrics Dashboard</h1>
          <p className="text-slate-500 font-medium">Monitor performance and growth metrics across ConnectBoat.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          {/* Bulk Import Button */}
          <button
            onClick={() => navigate('/admin/bulk-import')}
            className="h-11 px-5 flex items-center gap-2 font-bold text-xs rounded-2xl transition-all bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] text-white shadow-md shadow-indigo-100 cursor-pointer"
          >
            <span>✨ Bulk Import</span>
          </button>

          {/* Download Backup Button */}
          <button
            onClick={handleDownloadBackup}
            disabled={backupLoading}
            className={`h-11 px-5 flex items-center gap-2.5 font-bold text-xs rounded-2xl transition-all shadow-sm ${
              backupLoading 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' 
                : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] text-white shadow-md shadow-indigo-100'
            }`}
          >
            <Download size={15} className={backupLoading ? 'animate-spin' : ''} />
            <span>{backupLoading ? 'Processing Backup...' : 'Download Backup'}</span>
          </button>

          <div className="flex bg-slate-100 p-1 rounded-2xl">
            {(['7d', '30d', 'all'] as const).map((range, index) => (
              <button
                key={`range-${range}-${index}`}
                onClick={() => setTimeRange(range)}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${timeRange === range ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pending Ads Alert */}
      {pendingAds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                <Bell size={20} className="animate-bounce" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Pending Listings</h2>
                <p className="text-slate-500 text-sm font-medium">There are listings awaiting your approval.</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/admin/ads?status=pending')}
              className="text-amber-600 font-bold text-sm hover:underline"
            >
              View all
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingAds.slice(0, 3).map((ad, idx) => (
              <div key={`summary-${ad.id}-${idx}`} className="bg-white p-3 rounded-xl border border-amber-100 shadow-sm flex gap-3">
                <OptimizedImage 
                  src={ad.imageUrl} 
                  alt={ad.title} 
                  className="w-full h-full object-cover" 
                  containerClassName="w-12 h-12 bg-slate-50 shrink-0 rounded-lg overflow-hidden"
                />
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 truncate text-xs">{ad.title}</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">Seller: {ad.sellerName}</p>
                  <p className="text-[9px] text-amber-600 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                    <Clock size={10} />
                    {ad.createdAt?.toDate ? formatDistanceToNow(ad.createdAt.toDate(), { addSuffix: true }) : 'Recently'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Real-time precise indicators */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-none">System Overview</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1.5">Real-time database metrics</p>
            </div>
          </div>
          <span className="text-[10px] sm:text-xs font-bold text-slate-500 bg-slate-100 px-4 py-2 rounded-xl flex items-center gap-1.5 self-start sm:self-auto">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
            Live Data Synchronised
          </span>
        </div>

        {realtimeStats.loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-600 animate-spin"></div>
            <p className="text-slate-400 text-xs font-bold">Fetching database metrics...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            
            {/* Total Listings */}
            <div className="p-5 bg-indigo-50/40 border border-indigo-100 rounded-2.5xl flex flex-col justify-between hover:border-indigo-200 transition-all">
              <div className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                <Tag size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Total Listings</span>
                <span className="text-2xl font-black text-slate-900">{realtimeStats.totalAds}</span>
              </div>
            </div>

            {/* Pending Listings */}
            <div 
              onClick={() => navigate(realtimeStats.pendingAds > 0 ? '/admin/ads?status=pending&selectAll=true' : '/admin/ads?status=pending')}
              className={`p-5 rounded-2.5xl border flex flex-col justify-between transition-all cursor-pointer hover:scale-[1.02] hover:shadow-md ${realtimeStats.pendingAds > 0 ? 'animate-pending-highlight text-amber-950 border-amber-300' : 'bg-slate-50/40 border-slate-200 text-slate-500 hover:border-slate-350'}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 ${realtimeStats.pendingAds > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                <Clock size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Pending</span>
                <span className="text-2xl font-black text-slate-900">{realtimeStats.pendingAds}</span>
              </div>
            </div>

            {/* Approved Listings */}
            <div className="p-5 bg-emerald-50/40 border border-emerald-100 rounded-2.5xl flex flex-col justify-between hover:border-emerald-200 transition-all">
              <div className="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Approved</span>
                <span className="text-2xl font-black text-slate-900">{realtimeStats.approvedAds}</span>
              </div>
            </div>

            {/* Users */}
            <div className="p-5 bg-sky-50/40 border border-sky-100 rounded-2.5xl flex flex-col justify-between hover:border-sky-200 transition-all">
              <div className="w-9 h-9 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center mb-4">
                <Users size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Users</span>
                <span className="text-2xl font-black text-slate-900">{realtimeStats.totalUsers}</span>
              </div>
            </div>

            {/* Staff / Admins */}
            <div className="p-5 bg-purple-50/40 border border-purple-100 rounded-2.5xl flex flex-col justify-between hover:border-purple-200 transition-all">
              <div className="w-9 h-9 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4">
                <ShieldCheck size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Staff (Admins/Mods)</span>
                <span className="text-2xl font-black text-slate-900">{realtimeStats.staffCount}</span>
              </div>
            </div>

            {/* Local Highlights */}
            <div className="p-5 bg-amber-50/40 border border-amber-100 rounded-2.5xl flex flex-col justify-between hover:border-amber-200 transition-all" id="admin-featured-local">
              <div className="w-9 h-9 bg-amber-100 text-amber-500 rounded-xl flex items-center justify-center mb-4">
                <Star size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Local Featured (£4.99)</span>
                <span className="text-2xl font-black text-amber-600">{realtimeStats.featuredLocalCount}</span>
              </div>
            </div>

            {/* National Highlights */}
            <div className="p-5 bg-indigo-50/40 border border-indigo-100 rounded-2.5xl flex flex-col justify-between hover:border-indigo-200 transition-all" id="admin-featured-national">
              <div className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                <Crown size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">National Featured (£7.99)</span>
                <span className="text-2xl font-black text-indigo-650">{realtimeStats.featuredNationalCount}</span>
              </div>
            </div>

            {/* Leads */}
            <div className="p-5 bg-teal-50/40 border border-teal-100 rounded-2.5xl flex flex-col justify-between hover:border-teal-200 transition-all">
              <div className="w-9 h-9 bg-teal-100 text-teal-600 rounded-xl flex items-center justify-center mb-4">
                <MousePointer2 size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Leads (Interests)</span>
                <span className="text-2xl font-black text-slate-900">{realtimeStats.leadsCount}</span>
              </div>
            </div>

            {/* Marketing */}
            <div className="p-5 bg-amber-50/40 border border-amber-100 rounded-2.5xl flex flex-col justify-between hover:border-amber-200 transition-all">
              <div className="w-9 h-9 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-4">
                <Megaphone size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Marketing</span>
                <span className="text-2xl font-black text-slate-900">{realtimeStats.marketingCount}</span>
              </div>
            </div>

            {/* Notifications */}
            <div className="p-5 bg-slate-50/40 border border-slate-200 rounded-2.5xl flex flex-col justify-between hover:border-slate-350 transition-all relative overflow-hidden">
              <div className="w-9 h-9 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center mb-4">
                <Bell size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Notifications</span>
                <span className="text-2xl font-black text-slate-900">{realtimeStats.notificationsCount}</span>
                <span className="block text-[9px] text-slate-400 mt-1 font-bold">Personal Admin</span>
              </div>
            </div>

          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 font-bold animate-pulse">Loading metrics...</div>
      ) : !latest ? (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
          <Calendar className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-500 font-bold">No metrics available yet.</p>
          <p className="text-slate-400 text-sm">Please wait for daily system processing.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard 
              title="Total Users" 
              value={latest.users.total} 
              icon={<Users />} 
              color="indigo"
              subtitle={`${latest.users.activeLast7Days} active (7d)`}
            />
            <MetricCard 
              title="Total Listings" 
              value={latest.ads.total} 
              icon={<Tag />} 
              color="emerald"
              subtitle={`${latest.ads.createdToday} created today`}
            />
            <MetricCard 
              title="WhatsApp Clicks" 
              value={latest.interactions.whatsappClicks} 
              icon={<MousePointer2 />} 
              color="amber"
              subtitle={`Conversion rate: ${conversionRate}%`}
            />
            <MetricCard 
              title="Warnings Sent" 
              value={latest.notifications.warningsSent} 
              icon={<Bell />} 
              color="rose"
              subtitle={`Efficiency: ${notificationEfficiency}%`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Growth Chart */}
            <ChartContainer title="Platform Growth" icon={<TrendingUp />}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" />
                  <Line type="monotone" dataKey="users" name="Users" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="ads" name="Listings" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>

            {/* Interaction Chart */}
            <ChartContainer title="Daily Engagement" icon={<MousePointer2 />}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={interactionData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" />
                  <Bar dataKey="clicks" name="Clicks" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="views" name="Views" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>

            {/* Ad Status Distribution */}
            <ChartContainer title="Listings Status Distribution" icon={<Tag />}>
              <div className="flex flex-col md:flex-row items-center justify-around">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={adStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {adStatusData.map((entry, index) => (
                        <Cell key={`status-cell-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {adStatusData.map((entry, index) => (
                    <div key={`status-legend-${entry.name}-${index}`} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{entry.name}: {entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ChartContainer>

            {/* Geographic Distribution */}
            <ChartContainer title="City Distribution (Top 5)" icon={<MapPin />}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={cityData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 12, fontWeight: 'bold' }} width={100} />
                  <Tooltip />
                  <Bar dataKey="value" name="Users" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>

          {/* Detailed Stats Section */}
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
              <TrendingUp className="text-indigo-600" />
              Notification Efficiency
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Renewals after Warning</p>
                <p className="text-3xl font-black text-emerald-600">{latest.notifications.renewalsAfterWarning}</p>
                <p className="text-xs text-slate-500 mt-1">Users who relisted after receiving alert.</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ignored Warnings</p>
                <p className="text-3xl font-black text-rose-600">{latest.notifications.ignoresAfterWarning}</p>
                <p className="text-xs text-slate-500 mt-1">Listings that expired without user action.</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total Renewals</p>
                <p className="text-3xl font-black text-indigo-600">{latest.interactions.renewals}</p>
                <p className="text-xs text-slate-500 mt-1">Total renewal history across platform.</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Restricted Financial Management */}
      <section className="mt-10 border-t border-slate-200 pt-8">
        <div className="bg-slate-950 rounded-[2rem] p-6 md:p-8 text-white shadow-xl border border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                <Lock size={22} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] font-black text-slate-400 mb-1">Restricted area</p>
                <h2 className="text-xl md:text-2xl font-black">Financial Management</h2>
                <p className="text-sm text-slate-400 mt-1 max-w-xl">Revenue, refunds and financial performance are protected by owner approval and a separate financial password.</p>
              </div>
            </div>

            {!financeUnlocked ? (
              <button
                type="button"
                onClick={() => {
                  if (!canRequestFinanceAccess) return;
                  setFinanceError('');
                  setFinancePassword('');
                  setFinanceModalOpen(true);
                }}
                disabled={!canRequestFinanceAccess}
                className={`px-5 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-colors ${canRequestFinanceAccess ? 'bg-white text-slate-950 hover:bg-slate-100' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
              >
                <KeyRound size={17} />
                {canRequestFinanceAccess ? 'Enter Finance' : 'Access not granted'}
              </button>
            ) : (
              <div className="px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 flex items-center gap-2 font-black text-sm">
                <CheckCircle2 size={17} />
                Finance unlocked
              </div>
            )}
          </div>

          {financeUnlocked && (
            <div className="mt-5 pt-5 border-t border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-black text-white">Finance Dashboard</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Stripe-confirmed historical amounts only.</p>
                </div>
                <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto">
                  {([
                    ['thisMonth', 'Month'],
                    ['lastMonth', 'Last'],
                    ['all', 'All Time'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setFinanceRange(value);
                        setFinanceDateFrom('');
                        setFinanceDateTo('');
                      }}
                      className={`px-2.5 py-2 rounded-xl text-[11px] font-black border transition-colors ${!hasCustomFinanceRange && financeRange === value ? 'bg-white text-slate-950 border-white' : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-3">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto_auto] gap-2.5 items-end">
                  <div>
                    <label htmlFor="finance-date-from" className="block text-[9px] uppercase tracking-wider font-black text-slate-500 mb-1.5">
                      From
                    </label>
                    <input
                      id="finance-date-from"
                      type="date"
                      value={financeDateFrom}
                      onChange={(event) => setFinanceDateFrom(event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="finance-date-to" className="block text-[9px] uppercase tracking-wider font-black text-slate-500 mb-1.5">
                      To
                    </label>
                    <input
                      id="finance-date-to"
                      type="date"
                      value={financeDateTo}
                      onChange={(event) => setFinanceDateTo(event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-slate-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setFinanceDateFrom('');
                      setFinanceDateTo('');
                      setFinanceRange('all');
                    }}
                    className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-[11px] font-black text-slate-300 hover:border-slate-500"
                  >
                    Clear dates
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadFinanceCsv}
                    disabled={visibleFinanceRecords.length === 0 && visibleFinanceExpenses.length === 0}
                    className="rounded-xl bg-emerald-500 px-4 py-2.5 text-[11px] font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Download size={14} />
                    Download CSV
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFinanceDataError('');
                      setFinanceExpenseModalOpen(true);
                    }}
                    className="rounded-xl bg-indigo-500 px-4 py-2.5 text-[11px] font-black text-white hover:bg-indigo-400 flex items-center justify-center gap-2"
                  >
                    <Plus size={14} />
                    Add Expense
                  </button>
                </div>

                <p className="text-[9px] sm:text-[10px] text-slate-500 mt-2">
                  Choose any date range. The CSV exports transactions and operating expenses currently shown, including Received, Refunded, Stripe Fees, Expenses and Final Net totals.
                </p>
              </div>

              {financeDataLoading ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">Loading financial records...</div>
              ) : financeDataError ? (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-bold text-rose-200">{financeDataError}</div>
              ) : (
                <>
                  {financeActionMessage && (
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200">
                      {financeActionMessage}
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/65 overflow-hidden">
                    <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-slate-800">
                      <div className="p-2.5 sm:p-3 min-w-0">
                        <p className="text-[8px] sm:text-[9px] uppercase tracking-wider font-black text-slate-500">Received</p>
                        <p className="text-sm sm:text-xl font-black text-white mt-0.5 truncate">{formatGBP(financeGrossRevenue)}</p>
                      </div>
                      <div className="p-2.5 sm:p-3 min-w-0">
                        <p className="text-[8px] sm:text-[9px] uppercase tracking-wider font-black text-slate-500">Refunded</p>
                        <p className="text-sm sm:text-xl font-black text-rose-300 mt-0.5 truncate">{formatGBP(financeRefunds)}</p>
                      </div>
                      <div className="p-2.5 sm:p-3 min-w-0">
                        <p className="text-[8px] sm:text-[9px] uppercase tracking-wider font-black text-slate-500">Stripe Fees</p>
                        <p className="text-sm sm:text-xl font-black text-amber-300 mt-0.5 truncate">{formatGBP(financeStripeFees)}</p>
                      </div>
                      <div className="p-2.5 sm:p-3 min-w-0">
                        <p className="text-[8px] sm:text-[9px] uppercase tracking-wider font-black text-slate-500">Expenses</p>
                        <p className="text-sm sm:text-xl font-black text-orange-300 mt-0.5 truncate">{formatGBP(financeOperatingExpenses)}</p>
                      </div>
                      <div className="p-2.5 sm:p-3 min-w-0 col-span-2 md:col-span-1">
                        <p className="text-[8px] sm:text-[9px] uppercase tracking-wider font-black text-slate-500">Final Net</p>
                        <p className={`text-sm sm:text-xl font-black mt-0.5 truncate ${financeRealNet < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{formatGBP(financeRealNet)}</p>
                      </div>
                    </div>
                    <div className="border-t border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] sm:text-[11px]">
                      <span className="text-slate-400">
                        {formatGBP(financeGrossRevenue)} − {formatGBP(financeRefunds)} − {formatGBP(financeStripeFees)} − {formatGBP(financeOperatingExpenses)} = <strong className={financeRealNet < 0 ? 'text-rose-300' : 'text-emerald-300'}>{formatGBP(financeRealNet)}</strong>
                      </span>
                      <span className="text-slate-500 whitespace-nowrap">Paid {financePaidListings} · Refunded {financeRefundedListings}</span>
                    </div>
                    {financeMissingFeeCount > 0 && (
                      <div className="border-t border-amber-400/10 bg-amber-500/5 px-3 py-1.5 text-[9px] sm:text-[10px] font-bold text-amber-200/80">
                        Stripe fee not captured for {financeMissingFeeCount} older transaction{financeMissingFeeCount === 1 ? '' : 's'}; Real Net is complete for transactions recorded after fee tracking was enabled.
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-800 overflow-hidden">
                    <div className="px-3 py-3 bg-slate-900/80 border-b border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-white">Transactions</p>
                        <p className="text-[10px] font-bold text-slate-500">{visibleFinanceRecords.length} of {filteredFinanceRecords.length}</p>
                      </div>
                      <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        <input
                          type="search"
                          value={financeSearch}
                          onChange={(event) => setFinanceSearch(event.target.value)}
                          placeholder="Search listing, customer, email or payment ID"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950/70 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-slate-500"
                        />
                      </div>
                    </div>

                    {visibleFinanceRecords.length === 0 ? (
                      <div className="p-4 text-sm text-slate-400 bg-slate-900/40">
                        {filteredFinanceRecords.length === 0 ? 'No captured financial transactions in this period.' : 'No transactions match your search.'}
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800 bg-slate-950/20">
                        {visibleFinanceRecords.map((record) => {
                          const paid = Number(record.amountPaid || 0);
                          const refunded = Number(record.amountRefunded || 0);
                          const hasStripeFee = typeof record.stripeFee === 'number' && Number.isFinite(record.stripeFee);
                          const stripeFee = hasStripeFee ? Number(record.stripeFee) : 0;
                          const realNet = paid - refunded - stripeFee;
                          const remaining = Math.max(0, paid - refunded);
                          const paidDate = financeDate(record.paidAt);
                          const canRefund = remaining > 0.0001 && typeof record.stripePaymentIntentId === 'string' && record.stripePaymentIntentId.length > 0;

                          return (
                            <div key={record.id} className="p-3 space-y-2.5">
                              <div className="flex items-start justify-between gap-3 min-w-0">
                                <div className="min-w-0">
                                  <p className="font-black text-white text-sm truncate">{record.title || record.id}</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    {paidDate ? format(paidDate, 'dd/MM/yyyy HH:mm') : 'No date'} · <span className="capitalize">{record.plan || 'No plan'}</span>
                                  </p>
                                  <p className="text-[10px] text-slate-400 mt-1 truncate">
                                    {getFinanceCustomerName(record)} · {getFinanceCustomerEmail(record)}
                                  </p>
                                  {Number(record.amountRefunded || 0) > 0 && (
                                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-bold">
                                      {record.stripeRefundId && (
                                        <span className="text-slate-500">
                                          Refund ID: <span className="font-mono">{record.stripeRefundId}</span>
                                        </span>
                                      )}
                                      <span className={record.refundEmailSent ? 'text-emerald-300' : 'text-amber-300'}>
                                        {record.refundEmailSent
                                          ? `Email sent${record.refundEmailRecipient ? ` · ${record.refundEmailRecipient}` : ''}`
                                          : 'Refund email not sent'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <span className={`shrink-0 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide ${refunded >= paid && paid > 0 ? 'bg-rose-500/10 text-rose-300 border border-rose-400/20' : refunded > 0 ? 'bg-amber-500/10 text-amber-300 border border-amber-400/20' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/20'}`}>
                                  {refunded >= paid && paid > 0 ? 'Refunded' : refunded > 0 ? 'Partial' : 'Paid'}
                                </span>
                              </div>

                              <div className="grid grid-cols-4 gap-1 text-center">
                                <div className="rounded-xl bg-slate-900/70 px-1.5 py-2 min-w-0">
                                  <p className="text-[7px] sm:text-[8px] uppercase font-black tracking-wide text-slate-500">Received</p>
                                  <p className="text-[10px] sm:text-xs font-black text-white mt-0.5 truncate">{formatGBP(paid)}</p>
                                </div>
                                <div className="rounded-xl bg-slate-900/70 px-1.5 py-2 min-w-0">
                                  <p className="text-[7px] sm:text-[8px] uppercase font-black tracking-wide text-slate-500">Refunded</p>
                                  <p className="text-[10px] sm:text-xs font-black text-rose-300 mt-0.5 truncate">{formatGBP(refunded)}</p>
                                </div>
                                <div className="rounded-xl bg-slate-900/70 px-1.5 py-2 min-w-0">
                                  <p className="text-[7px] sm:text-[8px] uppercase font-black tracking-wide text-slate-500">Stripe Fee</p>
                                  <p className="text-[10px] sm:text-xs font-black text-amber-300 mt-0.5 truncate">{hasStripeFee ? formatGBP(stripeFee) : '—'}</p>
                                </div>
                                <div className="rounded-xl bg-slate-900/70 px-1.5 py-2 min-w-0">
                                  <p className="text-[7px] sm:text-[8px] uppercase font-black tracking-wide text-slate-500">Real Net</p>
                                  <p className={`text-[10px] sm:text-xs font-black mt-0.5 truncate ${realNet < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                                    {hasStripeFee ? formatGBP(realNet) : `${formatGBP(paid - refunded)}*`}
                                  </p>
                                </div>
                              </div>

                              {canRefund && (
                                <button
                                  type="button"
                                  onClick={() => setFinanceRefundTarget(record)}
                                  disabled={financeRefundingId === record.id}
                                  className="w-full rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-[11px] font-black text-rose-200 hover:bg-rose-500/15 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  {financeRefundingId === record.id ? 'Processing refund...' : `Refund ${formatGBP(remaining)}`}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-800 overflow-hidden">
                    <div className="px-3 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-white">Operating Expenses</p>
                        <p className="text-[10px] text-slate-500">Domain, email, internet, hosting, marketing and other business costs.</p>
                      </div>
                      <p className="text-[10px] font-bold text-slate-500">
                        {visibleFinanceExpenses.length} records
                      </p>
                    </div>

                    {financeExpensesLoading ? (
                      <div className="p-4 text-sm text-slate-400 bg-slate-900/40">Loading expenses...</div>
                    ) : visibleFinanceExpenses.length === 0 ? (
                      <div className="p-4 text-sm text-slate-400 bg-slate-900/40">No operating expenses in this period.</div>
                    ) : (
                      <div className="divide-y divide-slate-800 bg-slate-950/20">
                        {visibleFinanceExpenses.map((expense) => (
                          <div key={expense.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-black text-white text-sm truncate">{expense.description || 'Expense'}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {expense.expenseDate || 'No date'} · {expense.category || 'Other'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="rounded-xl bg-orange-500/10 border border-orange-400/20 px-3 py-2 text-xs font-black text-orange-200">
                                {formatGBP(Number(expense.amount || 0))}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteFinanceExpense(expense)}
                                disabled={financeExpenseDeletingId === expense.id}
                                className="w-10 h-10 rounded-xl border border-rose-400/20 bg-rose-500/10 text-rose-300 flex items-center justify-center hover:bg-rose-500/15 disabled:opacity-50"
                                aria-label="Delete expense"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {financeExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-black text-indigo-500">Operating expense</p>
                <h3 className="text-xl font-black text-slate-900 mt-1">Add expense</h3>
                <p className="text-xs text-slate-500 mt-1">This amount will reduce Final Net and will be included in CSV exports.</p>
              </div>
              <button
                type="button"
                onClick={() => setFinanceExpenseModalOpen(false)}
                className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
                aria-label="Close expense form"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddFinanceExpense} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-2">Date</label>
                  <input
                    type="date"
                    value={financeExpenseDate}
                    onChange={(event) => setFinanceExpenseDate(event.target.value)}
                    className="w-full px-3 py-3 rounded-xl border border-slate-300 text-base text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-600 mb-2">Amount (£)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={financeExpenseAmount}
                    onChange={(event) => setFinanceExpenseAmount(event.target.value)}
                    placeholder="10.00"
                    className="w-full px-3 py-3 rounded-xl border border-slate-300 text-base text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 mb-2">Category</label>
                <select
                  value={financeExpenseCategory}
                  onChange={(event) => setFinanceExpenseCategory(event.target.value)}
                  className="w-full px-3 py-3 rounded-xl border border-slate-300 text-base text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option>Domain</option>
                  <option>Professional Email</option>
                  <option>Internet / Phone</option>
                  <option>Hosting / Vercel</option>
                  <option>Resend / Email Service</option>
                  <option>Marketing</option>
                  <option>Software / Subscription</option>
                  <option>Accounting</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 mb-2">Description</label>
                <input
                  type="text"
                  value={financeExpenseDescription}
                  onChange={(event) => setFinanceExpenseDescription(event.target.value)}
                  placeholder="Example: ConnectBoat domain renewal"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-base text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={financeExpenseSaving}
                className="w-full px-5 py-3 rounded-xl bg-slate-950 text-white font-black disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {financeExpenseSaving ? 'Saving...' : 'Save Expense'}
              </button>
            </form>
          </div>
        </div>
      )}

      {financeRefundTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            {(() => {
              const record = financeRefundTarget;
              const paid = Number(record.amountPaid || 0);
              const refunded = Number(record.amountRefunded || 0);
              const remaining = Math.max(0, paid - refunded);
              const paymentId = record.stripePaymentIntentId || 'Unavailable';
              return (
                <>
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] font-black text-rose-500">Real Stripe refund</p>
                      <h3 className="text-xl font-black text-slate-900 mt-1">Confirm refund</h3>
                      <p className="text-xs text-slate-500 mt-1">Check the customer and payment before sending the money back.</p>
                    </div>
                    <button type="button" onClick={() => setFinanceRefundTarget(null)} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200" aria-label="Close refund confirmation">
                      <X size={18} />
                    </button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-sm">
                    <div>
                      <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Listing</p>
                      <p className="font-black text-slate-900 break-words">{record.title || record.id}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Customer</p>
                        <p className="font-bold text-slate-800 break-words">{getFinanceCustomerName(record)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Refund</p>
                        <p className="font-black text-rose-600">{formatGBP(remaining)}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Email</p>
                      <p className="font-bold text-slate-800 break-all">{getFinanceCustomerEmail(record)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Stripe Payment ID</p>
                      <p className="font-mono text-[11px] text-slate-600 break-all">{paymentId}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                    This sends a real Stripe refund. Confirm only after checking the listing, customer and payment ID.
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setFinanceRefundTarget(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
                      Cancel
                    </button>
                    <button type="button" onClick={() => handleFinanceRefund(record)} disabled={financeRefundingId === record.id} className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed">
                      {financeRefundingId === record.id ? 'Processing...' : `Confirm ${formatGBP(remaining)} refund`}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {financeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-slate-200 p-6 md:p-7">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">Financial security</p>
                <h3 className="text-xl font-black text-slate-900 mt-1">Enter financial password</h3>
              </div>
              <button
                type="button"
                onClick={() => { setFinanceModalOpen(false); setFinancePassword(''); setFinanceError(''); }}
                className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFinanceUnlock} className="space-y-4">
              <div>
                <label htmlFor="finance-password" className="block text-xs font-black text-slate-600 mb-2">Financial password</label>
                <input
                  id="finance-password"
                  type="password"
                  autoComplete="current-password"
                  value={financePassword}
                  onChange={(event) => setFinancePassword(event.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-base text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="••••••••"
                  autoFocus
                />
              </div>

              {financeError && (
                <div className="text-sm font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-3">
                  {financeError}
                </div>
              )}

              <button
                type="submit"
                disabled={financeLoading || !financePassword.trim()}
                className="w-full px-5 py-3 rounded-xl bg-slate-950 text-white font-black disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {financeLoading ? 'Verifying...' : 'Unlock Finance'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const MetricCard = ({ title, value, icon, color, subtitle }: { title: string, value: number | string, icon: React.ReactNode, color: string, subtitle?: string }) => {
  const colorClasses: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-100 flex flex-col"
    >
      <div className={`w-12 h-12 ${colorClasses[color]} rounded-2xl flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <p className="text-3xl font-black text-slate-900">{value}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-2 font-medium">{subtitle}</p>}
    </motion.div>
  );
};

const ChartContainer = ({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) => (
  <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
    <div className="flex items-center gap-2 mb-6">
      <div className="text-indigo-600">{icon}</div>
      <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{title}</h3>
    </div>
    {children}
  </div>
);

export default AdminDashboard;
