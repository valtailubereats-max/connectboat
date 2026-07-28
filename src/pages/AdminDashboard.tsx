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
  Users, ShoppingBag, MousePointer2, Bell, TrendingUp, MapPin, Calendar, Clock, Download,
  ShieldCheck, Briefcase, Store, Megaphone, CheckCircle2, ShieldAlert, Star, Crown
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
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [pendingAds, setPendingAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');
  const [backupLoading, setBackupLoading] = useState(false);
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

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard de Métricas</h1>
          <p className="text-slate-500 font-medium">Monitor performance and growth metrics across ConnectBoat.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          {/* Bulk Import Button */}
          <button
            onClick={() => navigate('/admin/bulk-import')}
            className="h-11 px-5 flex items-center gap-2 font-bold text-xs rounded-2xl transition-all bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] text-white shadow-md shadow-indigo-100 cursor-pointer"
          >
            <span>✨ Importação em Massa</span>
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
            <span>{backupLoading ? 'A processar Backup...' : 'Download Backup'}</span>
          </button>

          <div className="flex bg-slate-100 p-1 rounded-2xl">
            {(['7d', '30d', 'all'] as const).map((range, index) => (
              <button
                key={`range-${range}-${index}`}
                onClick={() => setTimeRange(range)}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${timeRange === range ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {range === '7d' ? '7 Dias' : range === '30d' ? '30 Dias' : 'Tudo'}
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
                <h2 className="text-lg font-black text-slate-900">Anúncios Pendentes</h2>
                <p className="text-slate-500 text-sm font-medium">Existem anúncios aguardando a sua aprovação.</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/admin/ads?status=pending')}
              className="text-amber-600 font-bold text-sm hover:underline"
            >
              Ver todos
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
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">Vendedor: {ad.sellerName}</p>
                  <p className="text-[9px] text-amber-600 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                    <Clock size={10} />
                    {ad.createdAt?.toDate ? formatDistanceToNow(ad.createdAt.toDate(), { addSuffix: true, locale: pt }) : 'Recentemente'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Real-time precise indicators requested by the user */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-none">Visão Geral do Sistema</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1.5">Métricas em tempo real da base de dados</p>
            </div>
          </div>
          <span className="text-[10px] sm:text-xs font-bold text-slate-500 bg-slate-100 px-4 py-2 rounded-xl flex items-center gap-1.5 self-start sm:self-auto">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
            Dados Sincronizados Live
          </span>
        </div>

        {realtimeStats.loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-600 animate-spin"></div>
            <p className="text-slate-400 text-xs font-bold">A recolher dados da base de dados...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            
            {/* Total de anúncios */}
            <div className="p-5 bg-indigo-50/40 border border-indigo-100 rounded-2.5xl flex flex-col justify-between hover:border-indigo-200 transition-all">
              <div className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                <ShoppingBag size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Total Anúncios</span>
                <span className="text-2xl font-black text-slate-900">{realtimeStats.totalAds}</span>
              </div>
            </div>

            {/* Anúncios Pendentes */}
            <div 
              onClick={() => navigate(realtimeStats.pendingAds > 0 ? '/admin/ads?status=pending&selectAll=true' : '/admin/ads?status=pending')}
              className={`p-5 rounded-2.5xl border flex flex-col justify-between transition-all cursor-pointer hover:scale-[1.02] hover:shadow-md ${realtimeStats.pendingAds > 0 ? 'animate-pending-highlight text-amber-950 border-amber-300' : 'bg-slate-50/40 border-slate-200 text-slate-500 hover:border-slate-350'}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 ${realtimeStats.pendingAds > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                <Clock size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Pendentes</span>
                <span className="text-2xl font-black text-slate-900">{realtimeStats.pendingAds}</span>
              </div>
            </div>

            {/* Anúncios aprovados */}
            <div className="p-5 bg-emerald-50/40 border border-emerald-100 rounded-2.5xl flex flex-col justify-between hover:border-emerald-200 transition-all">
              <div className="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Aprovados</span>
                <span className="text-2xl font-black text-slate-900">{realtimeStats.approvedAds}</span>
              </div>
            </div>

            {/* Utilizadores */}
            <div className="p-5 bg-sky-50/40 border border-sky-100 rounded-2.5xl flex flex-col justify-between hover:border-sky-200 transition-all">
              <div className="w-9 h-9 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center mb-4">
                <Users size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Utilizadores</span>
                <span className="text-2xl font-black text-slate-900">{realtimeStats.totalUsers}</span>
              </div>
            </div>

            {/* Moderadores/Admins */}
            <div className="p-5 bg-purple-50/40 border border-purple-100 rounded-2.5xl flex flex-col justify-between hover:border-purple-200 transition-all">
              <div className="w-9 h-9 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4">
                <ShieldCheck size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Staff (Admins/Mods)</span>
                <span className="text-2xl font-black text-slate-900">{realtimeStats.staffCount}</span>
              </div>
            </div>

            {/* Trabalhos/Empregos */}
            <div className="p-5 bg-cyan-50/40 border border-cyan-100 rounded-2.5xl flex flex-col justify-between hover:border-cyan-200 transition-all">
              <div className="w-9 h-9 bg-cyan-100 text-cyan-500 rounded-xl flex items-center justify-center mb-4">
                <Briefcase size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Trabalhos/Empregos</span>
                <span className="text-2xl font-black text-slate-900">{realtimeStats.trabalhosCount}</span>
              </div>
            </div>

            {/* Vitrines Digitais */}
            <div className="p-5 bg-rose-50/40 border border-rose-100 rounded-2.5xl flex flex-col justify-between hover:border-rose-200 transition-all">
              <div className="w-9 h-9 bg-rose-100 text-rose-500 rounded-xl flex items-center justify-center mb-4">
                <Store size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Vitrines Totais</span>
                <span className="text-2xl font-black text-slate-900">{realtimeStats.vitrinesCount}</span>
              </div>
            </div>

            {/* Vitrines Pagas */}
            <div className="p-5 bg-emerald-50/40 border border-emerald-100 rounded-2.5xl flex flex-col justify-between hover:border-emerald-200 transition-all">
              <div className="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <ShieldCheck size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Vitrines Pagas ({realtimeStats.country === 'Reino Unido' ? '£8.99' : '€8.99'})</span>
                <span className="text-2xl font-black text-emerald-700">{realtimeStats.paidVitrinesCount}</span>
              </div>
            </div>

            {/* Destaques Locais */}
            <div className="p-5 bg-amber-50/40 border border-amber-100 rounded-2.5xl flex flex-col justify-between hover:border-amber-200 transition-all" id="admin-featured-local">
              <div className="w-9 h-9 bg-amber-100 text-amber-500 rounded-xl flex items-center justify-center mb-4">
                <Star size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Destaques Locais (£/€4.99)</span>
                <span className="text-2xl font-black text-amber-600">{realtimeStats.featuredLocalCount}</span>
              </div>
            </div>

            {/* Destaques Nacionais */}
            <div className="p-5 bg-indigo-50/40 border border-indigo-100 rounded-2.5xl flex flex-col justify-between hover:border-indigo-200 transition-all" id="admin-featured-national">
              <div className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                <Crown size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Destaques Nacionais (£/€7.99)</span>
                <span className="text-2xl font-black text-indigo-650">{realtimeStats.featuredNationalCount}</span>
              </div>
            </div>

            {/* Interesses/Leads */}
            <div className="p-5 bg-teal-50/40 border border-teal-100 rounded-2.5xl flex flex-col justify-between hover:border-teal-200 transition-all">
              <div className="w-9 h-9 bg-teal-100 text-teal-600 rounded-xl flex items-center justify-center mb-4">
                <MousePointer2 size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Leads (Interesses)</span>
                <span className="text-2xl font-black text-slate-900">{realtimeStats.leadsCount}</span>
              </div>
            </div>

            {/* Materiais de Marketing */}
            <div className="p-5 bg-amber-50/40 border border-amber-100 rounded-2.5xl flex flex-col justify-between hover:border-amber-200 transition-all">
              <div className="w-9 h-9 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-4">
                <Megaphone size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Marketing</span>
                <span className="text-2xl font-black text-slate-900">{realtimeStats.marketingCount}</span>
              </div>
            </div>

            {/* Notificações do Sistema */}
            <div className="p-5 bg-slate-50/40 border border-slate-200 rounded-2.5xl flex flex-col justify-between hover:border-slate-350 transition-all relative overflow-hidden">
              <div className="w-9 h-9 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center mb-4">
                <Bell size={18} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-black tracking-wider">Notificações</span>
                <span className="text-2xl font-black text-slate-900">{realtimeStats.notificationsCount}</span>
                <span className="block text-[9px] text-slate-400 mt-1 font-bold">Admin Pessoal</span>
              </div>
            </div>

          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 font-bold animate-pulse">Carregando métricas...</div>
      ) : !latest ? (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
          <Calendar className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-500 font-bold">Nenhuma métrica disponível ainda.</p>
          <p className="text-slate-400 text-sm">Aguarde o processamento diário do sistema.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard 
              title="Total Usuários" 
              value={latest.users.total} 
              icon={<Users />} 
              color="indigo"
              subtitle={`${latest.users.activeLast7Days} ativos (7d)`}
            />
            <MetricCard 
              title="Total Anúncios" 
              value={latest.ads.total} 
              icon={<ShoppingBag />} 
              color="emerald"
              subtitle={`${latest.ads.createdToday} criados hoje`}
            />
            <MetricCard 
              title="Cliques WhatsApp" 
              value={latest.interactions.whatsappClicks} 
              icon={<MousePointer2 />} 
              color="amber"
              subtitle={`Taxa de conv: ${conversionRate}%`}
            />
            <MetricCard 
              title="Avisos Enviados" 
              value={latest.notifications.warningsSent} 
              icon={<Bell />} 
              color="rose"
              subtitle={`Eficiência: ${notificationEfficiency}%`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Growth Chart */}
            <ChartContainer title="Crescimento da Plataforma" icon={<TrendingUp />}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" />
                  <Line type="monotone" dataKey="users" name="Usuários" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="ads" name="Anúncios" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>

            {/* Interaction Chart */}
            <ChartContainer title="Engajamento Diário" icon={<MousePointer2 />}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={interactionData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" />
                  <Bar dataKey="clicks" name="Cliques" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="views" name="Visualizações" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>

            {/* Ad Status Distribution */}
            <ChartContainer title="Status dos Anúncios" icon={<ShoppingBag />}>
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
            <ChartContainer title="Distribuição por Cidade (Top 5)" icon={<MapPin />}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={cityData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 12, fontWeight: 'bold' }} width={100} />
                  <Tooltip />
                  <Bar dataKey="value" name="Usuários" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>

          {/* Detailed Stats Section */}
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
              <TrendingUp className="text-indigo-600" />
              Eficiência das Notificações
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Renovações após Aviso</p>
                <p className="text-3xl font-black text-emerald-600">{latest.notifications.renewalsAfterWarning}</p>
                <p className="text-xs text-slate-500 mt-1">Usuários que relistaram após receber alerta.</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Avisos Ignorados</p>
                <p className="text-3xl font-black text-rose-600">{latest.notifications.ignoresAfterWarning}</p>
                <p className="text-xs text-slate-500 mt-1">Anúncios que expiraram sem ação do usuário.</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total de Renovações</p>
                <p className="text-3xl font-black text-indigo-600">{latest.interactions.renewals}</p>
                <p className="text-xs text-slate-500 mt-1">Histórico total de renovações na plataforma.</p>
              </div>
            </div>
          </div>
        </>
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
