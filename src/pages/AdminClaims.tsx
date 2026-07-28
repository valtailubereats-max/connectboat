import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs, doc, updateDoc, serverTimestamp, where, increment, getDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldAlert, Calendar, Mail, User, Phone, CheckCircle2, 
  X, AlertCircle, RefreshCw, Filter, ExternalLink, ShieldCheck, HelpCircle,
  Copy, Check, Award, Search, MessageSquare, Send
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface ClaimRequest {
  id: string;
  adId: string;
  adTitle: string;
  userId: string;
  name: string;
  phone: string;
  email: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  verificationMethod?: 'email' | 'whatsapp' | 'manual';
  verificationCode?: string;
  verificationStatus?: 'sent' | 'confirmed' | 'invalid';
  verificationSentAt?: any;
  verificationConfirmedAt?: any;
}

const AdminClaims = () => {
  const { user, isAdmin, isModerator } = useAuth();
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [selectedClaimAd, setSelectedClaimAd] = useState<any | null>(null);
  const [selectedClaimAdLoading, setSelectedClaimAdLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedClaim, setSelectedClaim] = useState<ClaimRequest | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Phase 2: Captured entrepreneurs / Claimable businesses
  const [adminSubSection, setAdminSubSection] = useState<'requests' | 'captured'>('requests');
  const [capturedAds, setCapturedAds] = useState<any[]>([]);
  const [capturedLoading, setCapturedLoading] = useState(false);
  const [selectedAd, setSelectedAd] = useState<any | null>(null);
  const [capturedSearch, setCapturedSearch] = useState('');
  const [capturedClaimFilter, setCapturedClaimFilter] = useState<'all' | 'unclaimed' | 'pending' | 'claimed'>('all');
  const [capturedInviteFilter, setCapturedInviteFilter] = useState<'all' | 'not_sent' | 'sent' | 'responded'>('all');

  // Invitation text modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Phase 5: Verification Code state
  const [selectedMethod, setSelectedMethod] = useState<'email' | 'whatsapp' | 'manual'>('email');
  const [claimCopied, setClaimCopied] = useState(false);

  const fetchClaims = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const q = query(
        collection(db, 'businessClaimRequests'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ClaimRequest));
      setClaims(data);
    } catch (error) {
      console.error('Erro ao buscar pedidos de reivindicação:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar os pedidos da base de dados.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchCapturedAds = async () => {
    setCapturedLoading(true);
    try {
      const q = query(
        collection(db, 'ads'),
        where('isClaimableBusiness', '==', true)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCapturedAds(data);
    } catch (error) {
      console.error('Erro ao buscar anúncios de empreendedores:', error);
    } finally {
      setCapturedLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
    fetchCapturedAds();
  }, []);

  useEffect(() => {
    if (!selectedClaim) {
      setSelectedClaimAd(null);
      return;
    }

    // Set default verification method based on available info
    if (selectedClaim.email && selectedClaim.email.trim() !== '') {
      setSelectedMethod('email');
    } else if (selectedClaim.phone && selectedClaim.phone.trim() !== '') {
      setSelectedMethod('whatsapp');
    } else {
      setSelectedMethod('manual');
    }
    setClaimCopied(false);

    const fetchAd = async () => {
      setSelectedClaimAdLoading(true);
      try {
        const adRef = doc(db, 'ads', selectedClaim.adId);
        const adSnap = await getDoc(adRef);
        if (adSnap.exists()) {
          setSelectedClaimAd(adSnap.data());
        } else {
          setSelectedClaimAd(null);
        }
      } catch (err) {
        console.error('Erro ao buscar o anúncio do pedido:', err);
        setSelectedClaimAd(null);
      } finally {
        setSelectedClaimAdLoading(false);
      }
    };

    fetchAd();
  }, [selectedClaim]);

  const generateInvitationText = (ad: any) => {
    const viewsCount = ad.businessViews || 0;
    const adLink = `${window.location.origin}/anuncio/${ad.id}`;
    return `Olá! Esperamos que esteja tudo bem. 😊

Criámos uma página de apresentação totalmente gratuita para o seu negócio no ConnectBoat, a plataforma dedicada ao setor náutico e serviços marítimos.

Temos excelentes notícias: a sua página já conta com ${viewsCount} visualizações de potenciais clientes! 📈

Para assumir o controlo total da sua página gratuitamente, ativar o botão de contacto direto por WhatsApp, atualizar fotografias e gerir as suas informações:

1️⃣ Aceda à sua página: ${adLink}
2️⃣ Clique no botão "Reivindicar Negócio" (grátis)
3️⃣ Crie uma conta ou faça login se já tiver uma
4️⃣ Submeta os seus dados simples de verificação

Assim que for verificado, os seus clientes poderão falar diretamente consigo através do WhatsApp!

Ficamos à sua espera no ConnectBoat! 🤝`;
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2050);
  };

  const handleMarkAsSentClick = async (ad: any) => {
    setActionLoadingId(ad.id);
    try {
      const textMessage = generateInvitationText(ad);
      const adRef = doc(db, 'ads', ad.id);
      
      const nextCount = (ad.invitationCount || 0) + 1;
      
      await updateDoc(adRef, {
        invitationStatus: 'sent',
        invitationSentAt: serverTimestamp(),
        invitationCount: nextCount,
        invitationLastMessage: textMessage
      });

      // Update local array
      setCapturedAds(prev => prev.map(item => item.id === ad.id ? {
        ...item,
        invitationStatus: 'sent',
        invitationSentAt: { seconds: Date.now() / 1000 }, // mock timestamp to display immediately
        invitationCount: nextCount,
        invitationLastMessage: textMessage
      } : item));

      // Update selected item detail view
      if (selectedAd?.id === ad.id) {
        setSelectedAd(prev => prev ? {
          ...prev,
          invitationStatus: 'sent',
          invitationSentAt: { seconds: Date.now() / 1000 },
          invitationCount: nextCount,
          invitationLastMessage: textMessage
        } : null);
      }

      showFeedback('success', `Anúncio "${ad.title}" marcado como convite enviado (+1)!`);
    } catch (err) {
      console.error('Erro ao marcar como enviado:', err);
      showFeedback('error', 'Ocorreu um erro ao atualizar os dados do convite.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getMilestoneBadge = (views: number) => {
    if (views >= 100) {
      return {
        label: 'Muito interesse 🔥',
        style: 'bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 w-fit'
      };
    }
    if (views >= 50) {
      return {
        label: 'Muito interesse ★',
        style: 'bg-orange-50 text-orange-700 border-orange-200 text-[10px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 w-fit'
      };
    }
    if (views >= 25) {
      return {
        label: 'Bom potencial 👍',
        style: 'bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 w-fit'
      };
    }
    if (views >= 5) {
      return {
        label: 'Pronto para convite ✉️',
        style: 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 w-fit'
      };
    }
    return null;
  };

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => {
      setMessage(null);
    }, 5000);
  };

  const handleGenerateVerificationCode = async (claim: ClaimRequest, method: 'email' | 'whatsapp' | 'manual') => {
    setActionLoadingId(claim.id);
    try {
      const code = `ML-${Math.floor(100000 + Math.random() * 900000)}`;
      const claimRef = doc(db, 'businessClaimRequests', claim.id);
      
      const updateData = {
        verificationMethod: method,
        verificationCode: code,
        verificationStatus: 'sent',
        verificationSentAt: serverTimestamp()
      };

      await updateDoc(claimRef, updateData);

      // Update local states
      const localSentAt = new Date();
      setClaims(prev => prev.map(item => item.id === claim.id ? { 
        ...item, 
        verificationMethod: method, 
        verificationCode: code, 
        verificationStatus: 'sent', 
        verificationSentAt: localSentAt 
      } : item));
      
      if (selectedClaim?.id === claim.id) {
        setSelectedClaim(prev => prev ? { 
          ...prev, 
          verificationMethod: method, 
          verificationCode: code, 
          verificationStatus: 'sent', 
          verificationSentAt: localSentAt 
        } : null);
      }

      showFeedback('success', 'Código de verificação gerado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao gerar código de verificação:', error);
      showFeedback('error', `Erro ao gerar código de verificação: ${error?.message || String(error)}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const getVerificationMessage = (claim: ClaimRequest) => {
    const code = claim.verificationCode || '';
    if (claim.verificationMethod === 'email') {
      return {
        subject: 'Confirmação da propriedade do seu negócio',
        body: `Recebemos um pedido para ativação da página do seu negócio no ConnectBoat.

O seu código de confirmação é:
${code}

Entre novamente no ConnectBoat e introduza este código para concluir a verificação.

Após a confirmação, a equipa analisará a sua solicitação.`
      };
    } else if (claim.verificationMethod === 'whatsapp') {
      return {
        subject: '',
        body: `Olá.

Recebemos um pedido para ativação da página do seu negócio no ConnectBoat.

O seu código de confirmação é:
${code}

Entre novamente no ConnectBoat e introduza este código para concluir a verificação.

Obrigado.`
      };
    }
    return { subject: '', body: '' };
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setClaimCopied(true);
    setTimeout(() => setClaimCopied(false), 2000);
  };

  const handleApproveClaim = async (claim: ClaimRequest) => {
    if (!window.confirm(`Tem a certeza que deseja APROVAR a reivindicação do negócio para "${claim.name}"?`)) {
      return;
    }
    setActionLoadingId(claim.id);
    try {
      // 1. Atualizar o status da reivindicação na coleção `businessClaimRequests`
      const claimRef = doc(db, 'businessClaimRequests', claim.id);
      await updateDoc(claimRef, {
        status: 'approved',
        reviewedAt: serverTimestamp(),
        reviewedBy: user?.uid || 'admin'
      });

      // 2. Atualizar o anúncio correspondente em `ads/{adId}`
      const adRef = doc(db, 'ads', claim.adId);
      await updateDoc(adRef, {
        claimStatus: 'claimed',
        claimedBy: claim.userId,
        claimedAt: serverTimestamp(),
        // Trocar o vendedor do anúncio pelo requerente reivindicador
        sellerId: claim.userId,
        sellerName: claim.name,
        sellerPhone: claim.phone,
        sellerEmail: claim.email,
        invitationStatus: 'responded'
      });

      // Atualizar o estado local
      setClaims(prev => prev.map(item => item.id === claim.id ? { ...item, status: 'approved' } : item));
      if (selectedClaim?.id === claim.id) {
        setSelectedClaim(prev => prev ? { ...prev, status: 'approved' } : null);
      }

      showFeedback('success', `Pedido de reivindicação aprovado com sucesso! O anúncio agora pertence a ${claim.name}.`);
    } catch (error: any) {
      console.error('Erro ao aprovar reivindicação:', error);
      
      const isPermissionError = error?.code === 'permission-denied' || 
                               error?.message?.includes('permission') || 
                               error?.message?.includes('Missing or insufficient permissions');
                               
      if (isPermissionError) {
        console.error('🚨 [ERRO DE PERMISSÃO FIRESTORE - CAMINHOS BLOQUEADOS] 🚨');
        console.error(`- Tentativa falhada de escrita em: businessClaimRequests/${claim.id}`);
        console.error(`- Tentativa falhada de escrita em: ads/${claim.adId}`);
        console.error('Verifique as regras de segurança no firestore.rules e certifique-se de que o seu utilizador possui o papel de admin/moderador na coleção /users.');
        
        showFeedback(
          'error', 
          `Erro de permissão do Firestore (caminhos bloqueados: businessClaimRequests/${claim.id} ou ads/${claim.adId}). Verifique a consola e certifique-se de que a sua conta tem papel de administrador.`
        );
      } else {
        showFeedback('error', `Erro ao aprovar reivindicação: ${error?.message || String(error)}`);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectClaim = async (claim: ClaimRequest) => {
    if (!window.confirm(`Tem a certeza que deseja REJEITAR a reivindicação do negócio para "${claim.name}"?`)) {
      return;
    }
    setActionLoadingId(claim.id);
    try {
      // 1. Atualizar o status da reivindicação na coleção `businessClaimRequests`
      const claimRef = doc(db, 'businessClaimRequests', claim.id);
      await updateDoc(claimRef, {
        status: 'rejected',
        processedAt: serverTimestamp(),
        reviewedAt: serverTimestamp(),
        reviewedBy: user?.uid || 'admin'
      });

      // 2. Atualizar o anúncio correspondente para restaurar o status como não reivindicado
      const adRef = doc(db, 'ads', claim.adId);
      await updateDoc(adRef, {
        claimStatus: 'unclaimed'
      });

      // Atualizar o estado local
      setClaims(prev => prev.map(item => item.id === claim.id ? { ...item, status: 'rejected' } : item));
      if (selectedClaim?.id === claim.id) {
        setSelectedClaim(prev => prev ? { ...prev, status: 'rejected' } : null);
      }

      showFeedback('success', 'Pedido de reivindicação rejeitado com sucesso.');
    } catch (error) {
      console.error('Erro ao rejeitar reivindicação:', error);
      showFeedback('error', 'Ocorreu um erro ao processar a rejeição da reivindicação.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredClaims = claims.filter(item => {
    if (activeTab === 'all') return true;
    return item.status === activeTab;
  });

  const filteredCapturedAds = capturedAds.filter(ad => {
    const searchString = (ad.title || '') + ' ' + (ad.city || '') + ' ' + (ad.category || '');
    const matchesSearch = searchString.toLowerCase().includes(capturedSearch.toLowerCase());
    
    const effectiveClaimStatus = ad.claimStatus || 'unclaimed';
    const matchesClaim = capturedClaimFilter === 'all' || effectiveClaimStatus === capturedClaimFilter;
    
    const effectiveInviteStatus = ad.invitationStatus || 'not_sent';
    const matchesInvite = capturedInviteFilter === 'all' || effectiveInviteStatus === capturedInviteFilter;
    
    return matchesSearch && matchesClaim && matchesInvite;
  });

  const getStatusBadge = (status: 'pending' | 'approved' | 'rejected') => {
    switch (status) {
      case 'pending':
        return (
          <span className="bg-amber-50 text-amber-700 text-[10px] font-black px-2.5 py-1 rounded-full border border-amber-200 uppercase tracking-wider animate-pulse">
            Pendente
          </span>
        );
      case 'approved':
        return (
          <span className="bg-[#e8f7ee] text-pt-green text-[10px] font-black px-2.5 py-1 rounded-full border border-[#bfead0] uppercase tracking-wider">
            Aprovado
          </span>
        );
      case 'rejected':
        return (
          <span className="bg-rose-50 text-rose-700 text-[10px] font-black px-2.5 py-1 rounded-full border border-rose-200 uppercase tracking-wider">
            Recusado
          </span>
        );
      default:
        return null;
    }
  };

  const formatClaimDate = (timestamp: any) => {
    if (!timestamp) return 'Sem data';
    try {
      const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
      return format(date, "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: pt });
    } catch (e) {
      return 'Data inválida';
    }
  };

  return (
    <div className="space-y-8" id="admin-claims-panel">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            🛡️ Negócios Reivindicáveis
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
            Gestão Administrativa dos Empreendedores e Ativação de Páginas Gratuitas
          </p>
        </div>
        <button
          onClick={() => {
            fetchClaims();
            fetchCapturedAds();
          }}
          disabled={loading || capturedLoading}
          className="flex items-center gap-2 bg-indigo-550 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-indigo-600 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm cursor-pointer"
        >
          <RefreshCw size={14} className={(loading || capturedLoading) ? 'animate-spin' : ''} />
          Atualizar Tabelas
        </button>
      </div>

      {/* State Feedback Banner */}
      {message && (
        <div className={`p-4 rounded-2xl flex items-start gap-3 border ${
          message.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span className="text-sm font-extrabold">{message.text}</span>
        </div>
      )}

      {/* Sub-section Switcher */}
      <div className="flex bg-slate-150 p-1.5 rounded-2xl max-w-sm border border-slate-200/50">
        <button
          onClick={() => setAdminSubSection('requests')}
          className={`flex-1 py-2 px-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
            adminSubSection === 'requests'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          📋 Pedidos de Reivindicação
        </button>
        <button
          onClick={() => setAdminSubSection('captured')}
          className={`flex-1 py-2 px-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
            adminSubSection === 'captured'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          💼 Empresas Captadas
        </button>
      </div>

      <AnimatePresence mode="wait">
        {adminSubSection === 'requests' ? (
          <motion.div
            key="requests-sub"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Tabs list */}
            <div className="flex gap-2 overflow-x-auto pb-1" id="claims-tabs">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => {
                const count = tab === 'all' 
                  ? claims.length 
                  : claims.filter(item => item.status === tab).length;

                const labels = {
                  all: 'Todos',
                  pending: 'Pendentes',
                  approved: 'Aprovados',
                  rejected: 'Recusados'
                };

                return (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      setSelectedClaim(null);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === tab
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-100'
                    }`}
                  >
                    {labels[tab]} ({count})
                  </button>
                );
              })}
            </div>

            {/* Grid Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left column: Requests table/list */}
              <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden text-left">
                {loading ? (
                  <div className="p-12 text-center space-y-3">
                    <RefreshCw className="animate-spin text-indigo-600 mx-auto" size={28} />
                    <p className="text-sm text-slate-400 font-extrabold uppercase">A carregar solicitações...</p>
                  </div>
                ) : filteredClaims.length === 0 ? (
                  <div className="p-16 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                      <HelpCircle size={32} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-800 font-black text-sm">Nenhum pedido encontrado</p>
                      <p className="text-xs text-slate-400 font-medium">Nenhum pedido de ativação foi submetido nesta categoria.</p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-sans">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-wider border-b border-slate-100">
                          <th className="py-4 px-6 text-left">Anúncio / Solicitante</th>
                          <th className="py-2 px-4 text-center">Status</th>
                          <th className="py-2 px-4 text-left">Data</th>
                          <th className="py-2 px-4"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {filteredClaims.map((item) => (
                          <tr 
                            key={item.id} 
                            onClick={() => setSelectedClaim(item)}
                            className={`hover:bg-slate-50/75 cursor-pointer transition-colors ${
                              selectedClaim?.id === item.id ? 'bg-indigo-50/30' : ''
                            }`}
                          >
                            <td className="py-4 px-6 max-w-xs">
                              <span className="block text-slate-950 font-extrabold text-sm truncate">{item.adTitle}</span>
                              <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <User size={12} className="text-slate-400" /> {item.name}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <div className="flex flex-col items-center gap-1">
                                {getStatusBadge(item.status)}
                                {item.verificationStatus && (
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                                    item.verificationStatus === 'confirmed'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : item.verificationStatus === 'sent'
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-rose-50 text-rose-700'
                                  }`}>
                                    {item.verificationStatus === 'confirmed' && '✅ Verificado'}
                                    {item.verificationStatus === 'sent' && '⏳ Enviado'}
                                    {item.verificationStatus === 'invalid' && '❌ Inválido'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4 text-xs font-bold text-slate-400 whitespace-nowrap">
                              {formatClaimDate(item.createdAt)}
                            </td>
                            <td className="py-4 px-4 text-right">
                              <button className="text-indigo-600 hover:text-indigo-800 font-black text-xs uppercase tracking-wide">
                                Ver Detalhes
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Right column: Request Detail panel */}
              <div className="lg:col-span-5">
                <AnimatePresence mode="wait">
                  {selectedClaim ? (
                    <motion.div
                      key={selectedClaim.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-white rounded-3xl border border-slate-100 shadow-xl p-6 space-y-6 text-left relative overflow-hidden"
                    >
                      {/* Header ribbon */}
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-600" />

                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h3 className="font-black text-slate-900 text-lg leading-tight">Detalhes do Pedido</h3>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Reivindicação administrativa</p>
                        </div>
                        <button 
                          onClick={() => setSelectedClaim(null)}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-50"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {/* Ad context */}
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                        <span className="text-[10px] text-indigo-600 font-black uppercase tracking-wider block">Anúncio Alvo</span>
                        <p className="text-slate-900 font-black text-sm">{selectedClaim.adTitle}</p>
                        <Link
                          to={`/anuncio/${selectedClaim.adId}`}
                          target="_blank"
                          className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold mt-1"
                        >
                          Ver anúncio na plataforma <ExternalLink size={12} />
                        </Link>
                      </div>

                      {/* Sender Details */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none border-b border-slate-100 pb-2">Informação do Requerente</h4>
                        
                        <div className="grid grid-cols-1 gap-3 text-sm font-semibold">
                          <div className="flex items-center gap-3 py-1">
                            <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center">
                              <User size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider leading-none mb-0.5">Nome Completo</span>
                              <span className="text-slate-950 font-extrabold text-sm truncate block">{selectedClaim.name}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 py-1">
                            <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center">
                              <Phone size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider leading-none mb-0.5">Telefone</span>
                              <span className="text-slate-950 font-extrabold text-sm block">{selectedClaim.phone}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 py-1">
                            <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center">
                              <Mail size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider leading-none mb-0.5">Email</span>
                              <a href={`mailto:${selectedClaim.email}`} className="text-indigo-600 hover:text-indigo-800 font-black text-sm block truncate">
                                {selectedClaim.email}
                              </a>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 py-1">
                            <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center">
                              <Calendar size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider leading-none mb-0.5">Submetido em</span>
                              <span className="text-slate-600 text-sm block font-bold">{formatClaimDate(selectedClaim.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Comparação de Dados */}
                      <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-1.5 pb-2 border-b border-slate-200">
                          <ShieldCheck size={16} className="text-indigo-600" />
                          <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Comparação de Integridade</h4>
                        </div>
                        {selectedClaimAdLoading ? (
                          <div className="flex items-center gap-2 py-2 text-xs text-slate-400 font-bold">
                            <RefreshCw className="animate-spin" size={12} />
                            <span>A carregar dados originais do anúncio...</span>
                          </div>
                        ) : selectedClaimAd ? (
                          <div className="space-y-3 text-xs">
                            {/* Telefone */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wide mb-1">No Anúncio (Interno)</span>
                                <div className="p-2.5 bg-white border border-slate-200 rounded-xl font-extrabold text-slate-700">
                                  {selectedClaimAd.sellerPhone || 'Não definido'}
                                </div>
                              </div>
                              <div>
                                <span className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wide mb-1">Requerido pelo Usuário</span>
                                <div className={`p-2.5 border rounded-xl font-extrabold flex items-center justify-between ${
                                  selectedClaim && selectedClaimAd && (selectedClaim.phone.replace(/\D/g, '') === selectedClaimAd.sellerPhone?.replace(/\D/g, '') || selectedClaim.phone.trim() === selectedClaimAd.sellerPhone?.trim())
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                                    : 'bg-white border-slate-200 text-slate-700'
                                }`}>
                                  <span className="truncate">{selectedClaim.phone}</span>
                                  {selectedClaim && selectedClaimAd && (selectedClaim.phone.replace(/\D/g, '') === selectedClaimAd.sellerPhone?.replace(/\D/g, '') || selectedClaim.phone.trim() === selectedClaimAd.sellerPhone?.trim()) && (
                                    <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-md font-black">Coincide</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Email */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wide mb-1">No Anúncio (Interno)</span>
                                <div className="p-2.5 bg-white border border-slate-200 rounded-xl font-extrabold text-slate-700 truncate" title={selectedClaimAd.sellerEmail || selectedClaimAd.contactEmail || 'Nenhum'}>
                                  {selectedClaimAd.sellerEmail || selectedClaimAd.contactEmail || 'Não definido'}
                                </div>
                              </div>
                              <div>
                                <span className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wide mb-1">Requerido pelo Usuário</span>
                                <div className={`p-2.5 border rounded-xl font-extrabold flex items-center justify-between ${
                                  selectedClaim && selectedClaimAd && (selectedClaim.email.trim().toLowerCase() === (selectedClaimAd.sellerEmail || selectedClaimAd.contactEmail || '').trim().toLowerCase())
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                                    : 'bg-white border-slate-200 text-slate-700'
                                }`}>
                                  <span className="truncate" title={selectedClaim.email}>{selectedClaim.email}</span>
                                  {selectedClaim && selectedClaimAd && (selectedClaim.email.trim().toLowerCase() === (selectedClaimAd.sellerEmail || selectedClaimAd.contactEmail || '').trim().toLowerCase()) && (
                                    <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-md font-black">Coincide</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-rose-500 font-bold">Não foi possível carregar o anúncio correspondente.</p>
                        )}
                      </div>

                      {/* Message */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none border-b border-slate-100 pb-2">Mensagem de Reivindicação</h4>
                        <p className="text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm leading-relaxed whitespace-pre-wrap">
                          {selectedClaim.message || 'Nenhuma mensagem adicional fornecida.'}
                        </p>
                      </div>

                      {/* Verificação de Identidade */}
                      <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                          <div className="flex items-center gap-2">
                            <ShieldCheck size={18} className="text-indigo-600" />
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">Verificação de Identidade</h4>
                          </div>
                          {selectedClaim.verificationStatus && (
                            <span className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${
                              selectedClaim.verificationStatus === 'confirmed'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : selectedClaim.verificationStatus === 'sent'
                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : 'bg-rose-50 border-rose-200 text-rose-700'
                            }`}>
                              {selectedClaim.verificationStatus === 'confirmed' && '🟢 Código confirmado'}
                              {selectedClaim.verificationStatus === 'sent' && '🟡 Código enviado'}
                              {selectedClaim.verificationStatus === 'invalid' && '🔴 Código inválido'}
                            </span>
                          )}
                        </div>

                        {/* Status Grid */}
                        <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                          <div>
                            <span className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wide mb-1">Método de Envio</span>
                            <div className="p-2.5 bg-white border border-slate-200 rounded-xl font-extrabold text-slate-700">
                              {selectedClaim.verificationMethod 
                                ? selectedClaim.verificationMethod.toUpperCase() 
                                : 'Não Gerado'}
                            </div>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wide mb-1">Código Gerado</span>
                            <div className="p-2.5 bg-white border border-slate-200 rounded-xl font-mono font-black text-slate-700 tracking-wider">
                              {selectedClaim.verificationCode || '---'}
                            </div>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wide mb-1">Data de Envio</span>
                            <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600">
                              {selectedClaim.verificationSentAt 
                                ? (selectedClaim.verificationSentAt.toDate ? format(selectedClaim.verificationSentAt.toDate(), "dd/MM/yyyy HH:mm") : format(new Date(selectedClaim.verificationSentAt), "dd/MM/yyyy HH:mm"))
                                : '---'}
                            </div>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 font-extrabold uppercase tracking-wide mb-1">Data de Confirmação</span>
                            <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600">
                              {selectedClaim.verificationConfirmedAt 
                                ? (selectedClaim.verificationConfirmedAt.toDate ? format(selectedClaim.verificationConfirmedAt.toDate(), "dd/MM/yyyy HH:mm") : format(new Date(selectedClaim.verificationConfirmedAt), "dd/MM/yyyy HH:mm"))
                                : '---'}
                            </div>
                          </div>
                        </div>

                        {/* Code Generation options / Code copy */}
                        {selectedClaim.status === 'pending' && (
                          <div className="pt-2 border-t border-slate-100 space-y-3">
                            {!selectedClaim.verificationCode ? (
                              <div className="space-y-3">
                                <span className="block text-xs font-black text-slate-500 uppercase tracking-wide">Selecionar Canal para Envio:</span>
                                
                                {(!selectedClaim.email?.trim() && !selectedClaim.phone?.trim()) ? (
                                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold">
                                    Este pedido deverá ser verificado manualmente. (Nenhum email ou telefone fornecido)
                                  </div>
                                ) : (
                                  <div className="flex gap-4">
                                    {selectedClaim.email?.trim() && (
                                      <label className="flex items-center gap-2 text-xs font-extrabold text-slate-700 cursor-pointer">
                                        <input 
                                          type="radio" 
                                          name="verificationMethodRadio" 
                                          checked={selectedMethod === 'email'} 
                                          onChange={() => setSelectedMethod('email')}
                                          className="text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Email ({selectedClaim.email})
                                      </label>
                                    )}
                                    {selectedClaim.phone?.trim() && (
                                      <label className="flex items-center gap-2 text-xs font-extrabold text-slate-700 cursor-pointer">
                                        <input 
                                          type="radio" 
                                          name="verificationMethodRadio" 
                                          checked={selectedMethod === 'whatsapp'} 
                                          onChange={() => setSelectedMethod('whatsapp')}
                                          className="text-indigo-600 focus:ring-indigo-500"
                                        />
                                        WhatsApp ({selectedClaim.phone})
                                      </label>
                                    )}
                                  </div>
                                )}

                                <button
                                  type="button"
                                  disabled={actionLoadingId === selectedClaim.id || (!selectedClaim.email?.trim() && !selectedClaim.phone?.trim())}
                                  onClick={() => handleGenerateVerificationCode(selectedClaim, selectedMethod)}
                                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-black text-xs uppercase tracking-wide rounded-xl transition shadow"
                                >
                                  Gerar Código de Verificação
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">Mensagem Pronta para Copiar</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const msg = getVerificationMessage(selectedClaim);
                                        const textToCopy = msg.subject 
                                          ? `Assunto: ${msg.subject}\n\nMensagem:\n${msg.body}`
                                          : msg.body;
                                        copyToClipboard(textToCopy);
                                      }}
                                      className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-bold"
                                    >
                                      {claimCopied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                      {claimCopied ? 'Copiado!' : 'Copiar'}
                                    </button>
                                  </div>
                                  
                                  <div className="text-xs bg-slate-50 p-2.5 rounded-lg text-slate-600 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto border border-slate-100 select-all">
                                    {selectedClaim.verificationMethod === 'email' && (
                                      <>
                                        <span className="font-extrabold text-slate-800 block mb-1">Assunto: Confirmação da propriedade do seu negócio</span>
                                        <span className="block border-t border-slate-200 pt-1 mt-1" />
                                      </>
                                    )}
                                    {getVerificationMessage(selectedClaim).body}
                                  </div>
                                </div>

                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateVerificationCode(selectedClaim, selectedMethod)}
                                    className="text-slate-400 hover:text-indigo-600 text-xs font-extrabold"
                                  >
                                    Gerar Novo Código (Regerar)
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Call to Actions for claims */}
                      {selectedClaim.status === 'pending' ? (
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <button
                            type="button"
                            disabled={actionLoadingId === selectedClaim.id}
                            onClick={() => handleApproveClaim(selectedClaim)}
                            className="w-full flex items-center justify-center gap-1.5 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wide rounded-2xl transition shadow-md hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                          >
                            <CheckCircle2 size={16} />
                            <span>Aprovar</span>
                          </button>
                          <button
                            type="button"
                            disabled={actionLoadingId === selectedClaim.id}
                            onClick={() => handleRejectClaim(selectedClaim)}
                            className="w-full flex items-center justify-center gap-1.5 py-3 px-4 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs uppercase tracking-wide rounded-2xl transition shadow-md hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                          >
                            <X size={16} />
                            <span>Rejeitar</span>
                          </button>
                        </div>
                      ) : (
                        <div className={`p-4 rounded-2xl text-center border font-sans font-extrabold text-sm flex items-center justify-center gap-2 ${
                          selectedClaim.status === 'approved'
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                            : 'bg-rose-50 border-rose-100 text-rose-800'
                        }`}>
                          {selectedClaim.status === 'approved' ? (
                            <>
                              <ShieldCheck size={18} className="text-emerald-600" />
                              Reivindicação já aprovada por um administrador.
                            </>
                          ) : (
                            <>
                              <ShieldAlert size={18} className="text-rose-600" />
                              Reivindicação recusada por um administrador.
                            </>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-400 space-y-3 font-sans h-80 flex flex-col items-center justify-center">
                      <ShieldAlert size={36} className="text-slate-300" />
                      <div className="space-y-1">
                        <p className="font-extrabold text-sm text-slate-700">Nenhum pedido selecionado</p>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto">Selecione uma solicitação na tabela à esquerda para analisar as informações de contacto e aprovar ou recusar o pedido.</p>
                      </div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="captured-business-sub"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* Left column: Captured Ads list */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden text-left font-sans">
              
              {/* Dynamic Filter bar */}
              <div className="p-4 bg-slate-50 border-b border-slate-100 space-y-3">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Search size={15} />
                  </span>
                  <input
                    type="text"
                    value={capturedSearch}
                    onChange={(e) => setCapturedSearch(e.target.value)}
                    placeholder="Pesquisar por título do negócio, cidade ou categoria..."
                    className="w-full pl-9 pr-4 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wide">Status Reivindicação:</span>
                    <select
                      value={capturedClaimFilter}
                      onChange={(e) => setCapturedClaimFilter(e.target.value as any)}
                      className="bg-transparent font-black text-slate-705 text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="all">Ver Todos</option>
                      <option value="unclaimed">Não Reivindicado</option>
                      <option value="pending">Pendente (Mudou p/ claims)</option>
                      <option value="claimed">Reivindicado (Feito)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wide">Status Convite:</span>
                    <select
                      value={capturedInviteFilter}
                      onChange={(e) => setCapturedInviteFilter(e.target.value as any)}
                      className="bg-transparent font-black text-slate-705 text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="all">Ver Todos</option>
                      <option value="not_sent">Não Enviado</option>
                      <option value="sent">Enviado</option>
                      <option value="responded">Respondido</option>
                    </select>
                  </div>
                </div>
              </div>

              {capturedLoading ? (
                <div className="p-16 text-center space-y-3">
                  <RefreshCw className="animate-spin text-[#046a38] mx-auto" size={28} />
                  <p className="text-sm text-slate-400 font-black uppercase tracking-wider">A carregar negócios captados...</p>
                </div>
              ) : filteredCapturedAds.length === 0 ? (
                <div className="p-16 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-50/80 rounded-full flex items-center justify-center mx-auto text-slate-300">
                    <Award size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-slate-800 font-black text-sm">Nenhum registo encontrado</p>
                    <p className="text-xs text-slate-400 font-medium">Experimente ajustar os filtros ou redefinir a sua pesquisa por termos mais curtos.</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-sans">
                    <thead>
                      <tr className="bg-slate-50 text-slate-450 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-100">
                        <th className="py-4 px-5 text-left">Empresa / Cidade</th>
                        <th className="py-4 px-4 text-center">Visitas</th>
                        <th className="py-2 px-4 text-center">Status Reivindicável</th>
                        <th className="py-2 px-4 text-center">Convite</th>
                        <th className="py-2 px-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {filteredCapturedAds.map((ad) => {
                        const milestone = getMilestoneBadge(ad.businessViews || 0);
                        const displayClaimStatus = ad.claimStatus || 'unclaimed';
                        const displayInviteStatus = ad.invitationStatus || 'not_sent';

                        return (
                          <tr 
                            key={ad.id} 
                            onClick={() => setSelectedAd(ad)}
                            className={`hover:bg-slate-50/75 cursor-pointer transition-all ${
                              selectedAd?.id === ad.id ? 'bg-emerald-50/20' : ''
                            }`}
                          >
                            <td className="py-4 px-5 max-w-xs">
                              <span className="block text-slate-950 font-extrabold text-sm truncate">{ad.title}</span>
                              <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                                <span className="text-slate-400 font-bold">{ad.city} ({ad.country || 'Portugal'})</span>
                                <span className="text-slate-300">•</span>
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">{ad.category}</span>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center whitespace-nowrap">
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-extrabold text-slate-900 text-sm">{ad.businessViews || 0} visitas</span>
                                {milestone && (
                                  <span className={milestone.style}>
                                    {milestone.label}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center">
                              {displayClaimStatus === 'claimed' ? (
                                <span className="bg-[#e8f7ee] text-pt-green text-[10px] font-black px-2.5 py-1 rounded-full border border-[#bfead0] uppercase tracking-wider">
                                  Reivindicado
                                </span>
                              ) : displayClaimStatus === 'pending' ? (
                                <span className="bg-amber-50 text-amber-700 text-[10px] font-black px-2.5 py-1 rounded-full border border-amber-200 uppercase tracking-wider animate-pulse">
                                  Pendente
                                </span>
                              ) : (
                                <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-2.5 py-1 rounded-full border border-slate-200 uppercase tracking-wider">
                                  Livre (Unclaimed)
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-center">
                              {displayInviteStatus === 'sent' ? (
                                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-2 py-1 rounded-full border border-indigo-150 uppercase tracking-wider flex items-center justify-center gap-1 mx-auto w-fit">
                                  Enviado (x{ad.invitationCount || 1})
                                </span>
                              ) : displayInviteStatus === 'responded' ? (
                                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-1 rounded-full border border-emerald-150 uppercase tracking-wider flex items-center justify-center gap-1 mx-auto w-fit">
                                  Respondido
                                </span>
                              ) : (
                                <span className="bg-slate-50 text-slate-400 text-[10px] font-black px-2 py-1 rounded-full border border-slate-150 uppercase tracking-wider flex items-center justify-center gap-1 mx-auto w-fit">
                                  Não enviado
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-right">
                              <button className="text-[#046a38] hover:text-emerald-800 font-black text-xs uppercase tracking-wider">
                                Gerir
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right column: Captured Ad detail panel */}
            <div className="lg:col-span-5">
              <AnimatePresence mode="wait">
                {selectedAd ? (
                  <motion.div
                    key={`detail-${selectedAd.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-white rounded-3xl border border-slate-100 shadow-xl p-6 space-y-6 text-left relative overflow-hidden"
                  >
                    {/* Header ribbon styled in PT green */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#046a38]" />

                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="font-black text-slate-900 text-lg leading-tight">Ficha do Negócio</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Acompanhamento e Ativação</p>
                      </div>
                      <button 
                        onClick={() => setSelectedAd(null)}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-50 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Ad Context Information */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 space-y-2">
                      <span className="text-[10px] text-emerald-700 font-black uppercase tracking-wider block">Anúncio Reivindicável</span>
                      <p className="text-slate-900 font-extrabold text-base leading-tight">{selectedAd.title}</p>
                      <p className="text-xs text-slate-500 font-semibold">{selectedAd.city} ({selectedAd.country || 'Portugal'}) • {selectedAd.category}</p>
                      
                      <div className="flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-slate-500">
                        <span>Criado em:</span>
                        <span className="font-black text-slate-700">
                          {selectedAd.createdAt ? formatClaimDate(selectedAd.createdAt) : 'Data recente'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Status do Negócio:</span>
                        {selectedAd.claimStatus === 'claimed' ? (
                          <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-md border border-emerald-150 uppercase tracking-wider">
                            Reivindicado
                          </span>
                        ) : selectedAd.claimStatus === 'pending' ? (
                          <span className="bg-amber-50 text-amber-700 text-[9px] font-black px-2 py-0.5 rounded-md border border-amber-200 uppercase tracking-wider">
                            Pendente
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-505 text-slate-600 text-[9px] font-black px-2 py-0.5 rounded-md border border-slate-200 uppercase tracking-wider">
                            Livre (Unclaimed)
                          </span>
                        )}
                      </div>

                      <a
                        href={`/anuncio/${selectedAd.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-950 font-black mt-2"
                      >
                        Ver anúncio na plataforma <ExternalLink size={12} />
                      </a>
                    </div>

                    {/* Views Analytics */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none border-b border-slate-100 pb-2">Atividade da Página</h4>
                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                          <span className="text-[10px] block text-slate-400 font-bold uppercase tracking-wide">Visualizações</span>
                          <span className="text-xl font-black text-slate-900 mt-1 block">{selectedAd.businessViews || 0}</span>
                        </div>

                        <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 flex flex-col justify-center items-center">
                          <span className="text-[10px] block text-slate-400 font-bold uppercase tracking-wide mb-1">Qualificação / Marco</span>
                          {getMilestoneBadge(selectedAd.businessViews || 0) ? (
                            <span className={getMilestoneBadge(selectedAd.businessViews || 0)?.style}>
                              {getMilestoneBadge(selectedAd.businessViews || 0)?.label}
                            </span>
                          ) : (
                            <span className="text-xs font-black text-slate-400">Pocas visitas</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Contact Details */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none border-b border-slate-100 pb-2">Contactos do Proprietário</h4>
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        <div className="flex items-center gap-3 py-1 bg-slate-50/40 px-2 rounded-xl">
                          <div className="w-8 h-8 rounded-xl bg-slate-105 bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
                            <Phone size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wide leading-none mb-0.5">Telefone Comercial</span>
                            <span className="text-slate-900 font-extrabold text-sm block">
                              {selectedAd.contactPhone || selectedAd.sellerPhone || 'Não especificado'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 py-1 bg-slate-50/40 px-2 rounded-xl">
                          <div className="w-8 h-8 rounded-xl bg-slate-105 bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
                            <Mail size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wide leading-none mb-0.5">Email</span>
                            <span className="text-slate-900 font-extrabold text-sm block truncate leading-tight">
                              {selectedAd.contactEmail || 'Não especificado'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Invitation details */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none border-b border-slate-100 pb-2">Histórico do Convite</h4>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[9px] block text-slate-400 font-bold uppercase">Estado</span>
                          <span className="font-extrabold text-slate-800 block mt-0.5 uppercase tracking-wider text-[10px]">
                            {selectedAd.invitationStatus === 'sent' 
                              ? 'Enviado ✉️' 
                              : selectedAd.invitationStatus === 'responded' 
                              ? 'Respondido 🎉' 
                              : 'Não Enviado ❌'}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[9px] block text-slate-400 font-bold uppercase">Tentativas</span>
                          <span className="font-extrabold text-slate-850 text-slate-900 block mt-0.5">
                            {selectedAd.invitationCount || 0} vezes
                          </span>
                        </div>
                      </div>

                      {selectedAd.invitationSentAt && (
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Último envio em:{' '}
                          <span className="font-black text-slate-600">
                            {formatClaimDate(selectedAd.invitationSentAt)}
                          </span>
                        </div>
                      )}

                      {selectedAd.invitationLastMessage && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase block tracking-wider">Último Texto Enviado:</span>
                          <p className="text-[11px] leading-relaxed select-all bg-slate-50 p-3 rounded-xl border border-slate-100 text-slate-600 max-h-24 overflow-y-auto font-mono whitespace-pre-wrap">
                            {selectedAd.invitationLastMessage}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Invitation Actions */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowInviteModal(true);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wide rounded-2xl transition shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                      >
                        <MessageSquare size={14} />
                        <span>Gerar Convite</span>
                      </button>

                      <button
                        type="button"
                        disabled={actionLoadingId === selectedAd.id}
                        onClick={() => handleMarkAsSentClick(selectedAd)}
                        className="w-full flex items-center justify-center gap-1.5 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wide rounded-2xl transition shadow-md disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                      >
                        <Send size={14} />
                        <span>Marcar Enviado</span>
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-400 space-y-3 font-sans h-80 flex flex-col items-center justify-center">
                    <Award size={36} className="text-slate-300" />
                    <div className="space-y-1">
                      <p className="font-extrabold text-sm text-slate-700">Nenhum negócio selecionado</p>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto">Selecione uma empresa ou anúncio captado na tabela à esquerda para verificar a atividade, contactar e expedir convites de reivindicação.</p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal - Gerar Convite */}
      <AnimatePresence>
        {showInviteModal && selectedAd && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInviteModal(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 text-left relative overflow-hidden z-10 font-sans"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <div className="space-y-0.5">
                  <h3 className="text-base font-black text-slate-900">Convite de Reivindicação</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Copia e envia por WhatsApp, FB ou Email</p>
                </div>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-50 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs font-mono select-all leading-relaxed break-words whitespace-pre-wrap overflow-y-auto max-h-80 shadow-inner">
                  {generateInvitationText(selectedAd)}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyText(generateInvitationText(selectedAd))}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 px-4 bg-[#046a38] hover:bg-[#03552d] text-white font-black text-xs uppercase tracking-wide rounded-2xl transition cursor-pointer shadow-md"
                  >
                    {copiedText ? (
                      <>
                        <Check size={14} />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copiar Mensagem</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      handleMarkAsSentClick(selectedAd);
                      setShowInviteModal(false);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase tracking-wide rounded-2xl transition cursor-pointer"
                  >
                    <Send size={14} />
                    <span>Marcar Enviado</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminClaims;
