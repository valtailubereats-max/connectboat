import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Users, RefreshCw, Copy, Check, ExternalLink, QrCode, 
  TrendingUp, MousePointerClick, Calendar, UserPlus, LogIn, Award
} from 'lucide-react';
import { format } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';

interface InvitationAction {
  id: string;
  action: 'visit' | 'register_click' | 'login_click';
  campaign: string;
  country: string;
  userAgentSimplified?: string;
  createdAt: any;
}

const AdminInvitations = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [actions, setActions] = useState<InvitationAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('whatsapp');

  // List of initial campaigns to select for QR Code generation
  const campaignsList = [
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'facebook', label: 'Facebook' },
    { id: 'cartaz', label: 'Printed Poster' },
    { id: 'evento', label: 'Events' },
    { id: 'parceiro', label: 'Partners' },
    { id: 'direto', label: 'Direct / No Campaign' }
  ];

  const fetchInvitationMetrics = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'invitationVisits'),
        orderBy('createdAt', 'desc'),
        limit(150)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as InvitationAction));
      setActions(data);
    } catch (error) {
      console.error('Error fetching invitation statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchInvitationMetrics();
    }
  }, [isAdmin, authLoading]);

  // Compute metrics
  const totalVisits = actions.filter(a => a.action === 'visit').length;
  const totalRegisters = actions.filter(a => a.action === 'register_click').length;
  const totalLogins = actions.filter(a => a.action === 'login_click').length;

  // Compute campaign-wise stats
  const campaignStats: { [key: string]: { visits: number; registers: number; logins: number } } = {};
  
  // Initialize campaignStats with known ones to ensure they show up in the breakdown table
  campaignsList.forEach(c => {
    campaignStats[c.id] = { visits: 0, registers: 0, logins: 0 };
  });

  actions.forEach(a => {
    const camp = a.campaign || 'direto';
    if (!campaignStats[camp]) {
      campaignStats[camp] = { visits: 0, registers: 0, logins: 0 };
    }
    if (a.action === 'visit') campaignStats[camp].visits += 1;
    if (a.action === 'register_click') campaignStats[camp].registers += 1;
    if (a.action === 'login_click') campaignStats[camp].logins += 1;
  });

  const getQRLink = () => {
 return `https://connectboat.co.uk/?campaign=${selectedCampaign}`;
  };

  const handleCopyLink = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatActionDate = (timestamp: any) => {
    if (!timestamp) return 'No date';
    try {
      const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
      return format(date, "dd MMMM, HH:mm", { locale: enGB });
    } catch (e) {
      return 'Recent date';
    }
  };

  const getActionBadge = (action: 'visit' | 'register_click' | 'login_click') => {
    switch (action) {
      case 'visit':
        return (
          <span className="bg-blue-50 text-blue-700 text-[10px] font-black px-2.5 py-1 rounded-full border border-blue-100 uppercase tracking-wider flex items-center gap-1 w-fit">
            <TrendingUp size={10} /> Visit
          </span>
        );
      case 'register_click':
        return (
          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-100 uppercase tracking-wider flex items-center gap-1 w-fit">
            <UserPlus size={10} /> Create Account
          </span>
        );
      case 'login_click':
        return (
          <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-2.5 py-1 rounded-full border border-indigo-100 uppercase tracking-wider flex items-center gap-1 w-fit">
            <LogIn size={10} /> Log In
          </span>
        );
      default:
        return null;
    }
  };

  if (authLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#046a38] mx-auto mb-2"></div>
        <p className="text-xs text-slate-400 font-bold">Checking credentials...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 p-8">
        <p className="text-sm font-black text-rose-500">Access denied</p>
        <p className="text-xs text-slate-400 font-bold mt-1">Only administrators can access this area.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8" id="admin-invitations-panel">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            ✉️ Invitations & Campaigns
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
            Management and tracking of visits and conversions generated by QR Code or Links
          </p>
        </div>
        <button
          onClick={fetchInvitationMetrics}
          disabled={loading}
          className="flex items-center gap-2 bg-indigo-550 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-[#046a38] font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Data
        </button>
      </div>

      {/* METRIC CARD BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">Global Visits</span>
            <span className="text-2xl font-black text-slate-900 leading-none block mt-2">{totalVisits}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserPlus size={24} />
          </div>
          <div>
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">Register (Clicks)</span>
            <span className="text-2xl font-black text-slate-900 leading-none block mt-2">{totalRegisters}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <LogIn size={24} />
          </div>
          <div>
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">Log In (Clicks)</span>
            <span className="text-2xl font-black text-slate-900 leading-none block mt-2">{totalLogins}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* QR CODE GENERATOR & REUSABLE ASSETS */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <QrCode size={20} className="text-emerald-605 text-[#046a38]" /> Campaign QR Code
            </h3>
            <p className="text-xs text-slate-400 font-semibold mt-1">
              Generate and download specific codes for different locations and strategies
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                Select Channel / Campaign
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {campaignsList.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCampaign(c.id)}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      selectedCampaign === c.id 
                        ? 'border-[#046a38] bg-emerald-50 text-[#046a38]' 
                        : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 p-5 bg-slate-50 rounded-2xl border border-slate-100 items-center">
              <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-inner shrink-0">
                <QRCodeSVG value={getQRLink()} size={140} marginSize={2} />
              </div>
              
              <div className="space-y-3 w-full">
                <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-600 truncate max-w-full select-all">
                  {getQRLink()}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyLink(getQRLink())}
                    className="flex-1 font-bold text-xs bg-[#046a38] hover:bg-[#03552d] text-white py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    {copied ? (
                      <>
                        <Check size={14} /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Copy Link
                      </>
                    )}
                  </button>

                  <a
                    href={getQRLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 py-2.5 px-4 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm text-center justify-center leading-none"
                  >
                    <span>Test Link</span>
                    <ExternalLink size={14} />
                  </a>
                </div>
                <p className="text-[10px] text-slate-400 font-bold leading-normal">
                  💡 Point your phone camera at the QR Code to open the invitation page with tracked campaign details.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CAMPAIGNS BREAKDOWN */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Award size={20} className="text-indigo-600" /> Conversions by Campaign
            </h3>
            <p className="text-xs text-slate-400 font-semibold mt-1">
              Individual performance and conversion rate of active strategies
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-500 font-medium">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-2">Campaign</th>
                  <th className="py-3 px-2">Visits</th>
                  <th className="py-3 px-2">Registrations</th>
                  <th className="py-3 px-2">Logins</th>
                  <th className="py-3 px-2">Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-sans">
                {Object.keys(campaignStats).map(campId => {
                  const stats = campaignStats[campId];
                  const label = campaignsList.find(c => c.id === campId)?.label || campId;
                  const convRate = stats.visits > 0 ? ((stats.registers / stats.visits) * 100).toFixed(1) : '0.0';
                  
                  return (
                    <tr key={campId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-2 font-black text-slate-900 capitalize">{label}</td>
                      <td className="py-3 px-2 text-slate-800">{stats.visits}</td>
                      <td className="py-3 px-2 text-emerald-600 font-semibold">{stats.registers}</td>
                      <td className="py-3 px-2 text-indigo-600 font-semibold">{stats.logins}</td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          parseFloat(convRate) > 15 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-150 text-slate-600'
                        }`}>
                          {convRate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* RECENT ACTIVITY */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm space-y-4">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Calendar size={20} className="text-blue-500" /> Recent Activities
          </h3>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Real-time list of latest accesses and registered invitation actions
          </p>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#046a38] mx-auto mb-2"></div>
              <p className="text-xs text-slate-400 font-bold">Loading latest interactions...</p>
            </div>
          ) : actions.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-sm font-bold text-slate-400">No actions recorded yet.</p>
              <p className="text-xs text-slate-400 font-bold mt-1">Share your invitation links to view metrics here!</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-500 font-medium">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Source / Campaign</th>
                  <th className="py-3 px-4">Community</th>
                  <th className="py-3 px-4">Device</th>
                  <th className="py-3 px-4">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-sans">
                {actions.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4">{getActionBadge(act.action)}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-800 uppercase tracking-wide text-[11px]">{act.campaign}</td>
                    <td className="py-3.5 px-4 text-slate-600">{act.country}</td>
                    <td className="py-3.5 px-4 text-slate-600">{act.userAgentSimplified || 'Unknown'}</td>
                    <td className="py-3.5 px-4 text-slate-400 font-bold">{formatActionDate(act.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminInvitations;
