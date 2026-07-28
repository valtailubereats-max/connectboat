import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Store, 
  Search, 
  Check, 
  X, 
  Pencil, 
  Eye, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle,
  Clock, 
  Trash2, 
  Instagram, 
  Facebook, 
  Phone,
  Settings,
  Shield,
  Filter,
  RefreshCw,
  TrendingUp
} from 'lucide-react';

const CATEGORIES = [
  'Restaurantes e Cafés',
  'Lojas e Retalho',
  'Serviços de Beleza',
  'Educação e Explicações',
  'Serviços Profissionais',
  'Turismo e Alojamento',
  'Saúde e Bem-estar',
  'Artesanato e Criativos',
  'Outros'
];

export default function AdminShowcases() {
  const { isAdmin } = useAuth();
  const [showcases, setShowcases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'active' | 'inactive'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Edit State
  const [editingShowcase, setEditingShowcase] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editFacebook, setEditFacebook] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [editCover, setEditCover] = useState('');
  const [editLogo, setEditLogo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Fetch Showcases
  const fetchShowcases = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const snap = await getDocs(collection(db, 'sellerPublicProfiles'));
      const list = snap.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      }));
      // Filter out items that do not have any showcase data configured at all (i.e. just basic user profile, no name/active)
      const validShowcases = list.filter((item: any) => item.showcaseName || item.showcaseActive !== undefined);
      setShowcases(validShowcases);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.GET, 'sellerPublicProfiles');
      setErrorMsg('Falha ao descarregar as vitrines de negócios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShowcases();
  }, []);

  // Approve / Reject Showcase
  const handleToggleApproval = async (uid: string, currentApproved: boolean) => {
    try {
      setErrorMsg(null);
      setSuccessMsg(null);
      const newStatus = !currentApproved;

      // Update in sellerPublicProfiles
      const publicRef = doc(db, 'sellerPublicProfiles', uid);
      await updateDoc(publicRef, {
        showcaseApproved: newStatus
      });

      // Update in users
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          showcaseApproved: newStatus
        });
      }

      // Update local state
      setShowcases(prev => prev.map(s => s.uid === uid ? { ...s, showcaseApproved: newStatus } : s));
      setSuccessMsg(newStatus ? 'Vitrine aprovada com sucesso e ativada publicamente!' : 'Vitrine colocada em estado de moderação/pendente.');
      
      // Auto dismiss success message after 4s
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Erro ao atualizar estado de aprovação da vitrine.');
    }
  };

  // Toggle Showcase Active by Admin
  const handleToggleActive = async (uid: string, currentActive: boolean) => {
    try {
      setErrorMsg(null);
      setSuccessMsg(null);
      const newActive = !currentActive;

      // Update in sellerPublicProfiles
      const publicRef = doc(db, 'sellerPublicProfiles', uid);
      await updateDoc(publicRef, {
        showcaseActive: newActive
      });

      // Update in users
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          showcaseActive: newActive
        });
      }

      // Update local state
      setShowcases(prev => prev.map(s => s.uid === uid ? { ...s, showcaseActive: newActive } : s));
      setSuccessMsg(newActive ? 'Vitrine ativada com sucesso!' : 'Vitrine desativada com sucesso.');
      
      // Auto dismiss success message after 4s
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Erro ao alterar o estado ativo da vitrine.');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (sc: any) => {
    setEditingShowcase(sc);
    setEditName(sc.showcaseName || '');
    setEditSlug(sc.showcaseSlug || '');
    setEditCategory(sc.showcaseCategory || 'Outros');
    setEditDescription(sc.showcaseDescription || '');
    setEditWhatsapp(sc.showcaseWhatsapp || '');
    setEditFacebook(sc.showcaseFacebook || '');
    setEditInstagram(sc.showcaseInstagram || '');
    setEditCover(sc.showcaseCover || '');
    setEditLogo(sc.showcaseLogo || '');
    setEditError(null);
  };

  // Save Edits from Staff Modal
  const handleSaveEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShowcase) return;
    setIsSaving(true);
    setEditError(null);

    const checkSlug = editSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!checkSlug) {
      setEditError("O link da vitrine (slug) não pode estar vazio.");
      setIsSaving(false);
      return;
    }

    try {
      // 1. Check if slug exists elsewhere in local list
      const slugExists = showcases.some(s => s.showcaseSlug === checkSlug && s.uid !== editingShowcase.uid);
      if (slugExists) {
        setEditError("Este link (slug) já está a ser utilizado por outro negócio.");
        setIsSaving(false);
        return;
      }

      const uid = editingShowcase.uid;

      // 2. Prepare payload
      const updatedValues = {
        showcaseName: editName.trim(),
        showcaseSlug: checkSlug,
        showcaseCategory: editCategory,
        showcaseDescription: editDescription.trim(),
        showcaseWhatsapp: editWhatsapp.trim(),
        showcaseFacebook: editFacebook.trim(),
        showcaseInstagram: editInstagram.trim(),
        showcaseCover: editCover.trim(),
        showcaseLogo: editLogo.trim(),
        updatedAt: new Date()
      };

      // 3. Update public profile
      const publicRef = doc(db, 'sellerPublicProfiles', uid);
      await updateDoc(publicRef, updatedValues);

      // 4. Update core user doc
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, updatedValues);
      }

      // Update local state
      setShowcases(prev => prev.map(s => s.uid === uid ? { ...s, ...updatedValues } : s));
      setIsSaved(true);
      setSuccessMsg("Dados da vitrine atualizados com sucesso pela equipe!");
      setTimeout(() => {
        setIsSaved(false);
        setEditingShowcase(null);
        setSuccessMsg(null);
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setEditError("Erro ao guardar modificações na base de dados.");
    } finally {
      setIsSaving(false);
    }
  };

  // Filter lists
  const filteredShowcases = showcases.filter(sc => {
    // 1. Status rule
    const isApproved = sc.showcaseApproved === true;
    const isActive = sc.showcaseActive === true;

    if (statusFilter === 'pending' && isApproved) return false;
    if (statusFilter === 'approved' && !isApproved) return false;
    if (statusFilter === 'active' && (!isActive || !isApproved)) return false;
    if (statusFilter === 'inactive' && isActive && isApproved) return false;

    // 2. Category rule
    if (categoryFilter !== 'all' && sc.showcaseCategory !== categoryFilter) return false;

    // 3. Query search
    const queryStr = searchTerm.toLowerCase();
    const nameMatch = (sc.showcaseName || '').toLowerCase().includes(queryStr);
    const descMatch = (sc.showcaseDescription || '').toLowerCase().includes(queryStr);
    const slugMatch = (sc.showcaseSlug || '').toLowerCase().includes(queryStr);
    const ownerMatch = (sc.displayName || sc.name || sc.email || '').toLowerCase().includes(queryStr);

    return nameMatch || descMatch || slugMatch || ownerMatch;
  });

  // Calculate Stat Cards
  const totalCount = showcases.length;
  const pendingCount = showcases.filter(sc => sc.showcaseApproved !== true).length;
  const approvedActiveCount = showcases.filter(sc => sc.showcaseApproved === true && sc.showcaseActive === true).length;
  const disabledCount = showcases.filter(sc => sc.showcaseApproved === true && sc.showcaseActive !== true).length;

  return (
    <div className="space-y-8" id="admin-showcases-page">
      {/* Title & Stats Grid */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Store className="text-indigo-600" size={32} />
            Gerenciador de Vitrines
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Moderação de negócios, ativação pública, revisão de logos e edição direta de perfis de empreendedores.
          </p>
        </div>
        <button 
          onClick={fetchShowcases}
          className="flex items-center gap-1.5 self-start md:self-center px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 rounded-xl hover:shadow-sm transition-all text-xs font-bold"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Sincronizar Dados
        </button>
      </div>

      {/* Alert Feedbacks */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl flex items-center gap-2.5 text-xs font-bold"
          >
            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl flex items-center gap-2.5 text-xs font-bold"
          >
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stat KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Registos Totais</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-slate-900">{totalCount}</span>
            <span className="p-1 px-2 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-lg">Lojas</span>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">Em Moderação ⏳</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-amber-600">{pendingCount}</span>
            <span className={`p-1 px-2 text-[10px] font-black rounded-lg ${pendingCount > 0 ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
              Revisar
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">Ativas no Mapa 💚</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-emerald-600">{approvedActiveCount}</span>
            <span className="p-1 px-2 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-lg">Visíveis</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Desativadas/Pausa 💤</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-slate-600">{disabledCount}</span>
            <span className="p-1 px-2 bg-slate-100 text-slate-600 text-[10px] font-black rounded-lg">Ocultas</span>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3.5">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar por negócio, slug link, email do dono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-indigo-600 focus:bg-white text-sm transition-all text-slate-800"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status filters */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Todas
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${statusFilter === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Pendentes {pendingCount > 0 && <span className="p-0.5 px-1.5 text-[9px] bg-white text-amber-600 font-extrabold rounded-full">{pendingCount}</span>}
              </button>
              <button
                onClick={() => setStatusFilter('approved')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${statusFilter === 'approved' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Aprovadas
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${statusFilter === 'active' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Públicas
              </button>
            </div>

            {/* Category Dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-600"
            >
              <option value="all">Todas as Categorias</option>
              {CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 text-slate-400 space-y-4 shadow-sm">
          <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
          <span className="text-xs font-bold">A descarregar vitrines de negócios...</span>
        </div>
      ) : filteredShowcases.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-3xl border border-slate-100 text-slate-400 space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mx-auto">
            <Store size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">Nenhuma vitrine encontrada</h3>
            <p className="text-xs text-slate-500">Tente modificar seus termos de pesquisa ou filtros de estado.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden" id="showcases-table-wrapper">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-4 px-6">Negócio</th>
                  <th className="py-4 px-3">Estado de Moderação</th>
                  <th className="py-4 px-3">Ativa pelo Dono</th>
                  <th className="py-4 px-3">Categoria / Cidade</th>
                  <th className="py-4 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredShowcases.map((sc, idx) => {
                  const fallbackLogo = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80';
                  const isApproved = sc.showcaseApproved === true;
                  const isActive = sc.showcaseActive === true;
                  const isPending = !isApproved;

                  return (
                    <tr key={sc.uid || idx} className="hover:bg-slate-50/50 transition-colors text-slate-800">
                      
                      {/* Business Main Info column */}
                      <td className="py-4 px-6 min-w-[280px]">
                        <div className="flex items-center gap-3">
                          <img 
                            src={sc.showcaseLogo || fallbackLogo} 
                            alt={sc.showcaseName} 
                            onError={(e) => { (e.target as HTMLImageElement).src = fallbackLogo; }}
                            className="w-11 h-11 rounded-xl object-cover bg-slate-100 border border-slate-150 shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 text-sm truncate">{sc.showcaseName || 'Sem nome definido'}</h4>
                            <p className="text-[10px] font-medium text-slate-500 font-mono truncate">
                              /{sc.showcaseSlug || 'slug-indisponivel'}
                            </p>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                              <span className="font-semibold text-slate-700">{sc.displayName || sc.name || 'Dono desconhecido'}</span>
                              <span>•</span>
                              <span className="truncate max-w-[150px]">{sc.email || 'Sem email'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Moderation Status column */}
                      <td className="py-4 px-3">
                        <div className="flex flex-col gap-1.5">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg self-start">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                              Aprovada 💚
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg self-start animate-pulse">
                              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                              Pendente ⏳
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Active Status column */}
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(sc.uid, isActive)}
                            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              isActive ? 'bg-indigo-600' : 'bg-slate-200'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                isActive ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span className="text-xs font-semibold text-slate-500">
                            {isActive ? 'Ativada' : 'Deitada'}
                          </span>
                        </div>
                      </td>

                      {/* Category / Location column */}
                      <td className="py-4 px-3">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-slate-700 bg-slate-100 p-1 px-2 rounded-lg inline-block">
                            {sc.showcaseCategory || 'Outros'}
                          </span>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {sc.city || 'N/D'}, {sc.country === 'Portugal' ? '🇵🇹 Portugal' : sc.country === 'Reino Unido' ? '🇬🇧 Reino Unido' : sc.country || 'N/D'}
                          </p>
                        </div>
                      </td>

                      {/* Action buttons list column */}
                      <td className="py-4 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          
                          {/* Live view button */}
                          {sc.showcaseSlug && (
                            <a
                              href={`/empreendedores/${sc.showcaseSlug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Visualizar no site"
                            >
                              <ExternalLink size={15} />
                            </a>
                          )}

                          {/* Quick Approval Change trigger */}
                          <button
                            onClick={() => handleToggleApproval(sc.uid, isApproved)}
                            className={`p-2 rounded-lg transition-all ${
                              isApproved 
                                ? 'text-amber-500 hover:bg-amber-50' 
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={isApproved ? "Colocar em Moderação (Bloquear)" : "Aprovar em definitivo"}
                          >
                            {isApproved ? <X size={15} /> : <Check size={16} />}
                          </button>

                          {/* Edit Details */}
                          <button
                            onClick={() => handleOpenEdit(sc)}
                            className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                            title="Editar dados da Vitrine"
                          >
                            <Pencil size={15} />
                          </button>

                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Showcase Edit modal dialog */}
      <AnimatePresence>
        {editingShowcase && (
          <div className="fixed inset-0 z-[999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 my-8 flex flex-col"
            >
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-900 text-base">Modificar Dados de Vitrine (Painel de Gestão)</h3>
                  <p className="text-[11px] text-slate-500">
                    Modificações feitas aqui serão sincronizadas no perfil do vendedor e no perfil público ({editingShowcase.displayName || editingShowcase.email}).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingShowcase(null)}
                  className="p-2 bg-slate-200/50 hover:bg-slate-200 text-slate-700 rounded-full transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveEdits} className="overflow-y-auto p-6 space-y-5 max-h-[70vh]">
                {editError && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-xl text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={14} className="text-red-600 shrink-0" />
                    <span>{editError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Business Name */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">Nome do Negócio</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      placeholder="Ex: Pastelaria Lisboa gourmet"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-indigo-600 focus:bg-white text-slate-800"
                    />
                  </div>

                  {/* Slug / link */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">Link Personalizado (Slug URL)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">/empreendedores/</span>
                      <input
                        type="text"
                        value={editSlug}
                        onChange={(e) => setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                        required
                        placeholder="pastelaria-lisboa"
                        className="w-full pl-[134px] pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none font-mono focus:border-indigo-600 focus:bg-white text-slate-800"
                      />
                    </div>
                  </div>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Category Selection */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">Categoria do Negócio</label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-indigo-600 focus:bg-white text-slate-800"
                    >
                      {CATEGORIES.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>

                  {/* WhatsApp contact */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">WhatsApp de Contacto (com código país)</label>
                    <input
                      type="text"
                      value={editWhatsapp}
                      onChange={(e) => setEditWhatsapp(e.target.value)}
                      placeholder="Ex: 351912345678"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-indigo-600 focus:bg-white text-slate-800 font-mono"
                    />
                  </div>

                </div>

                {/* Cover & Logo URLs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">URL do Logotipo do Negócio</label>
                    <input
                      type="text"
                      value={editLogo}
                      onChange={(e) => setEditLogo(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-indigo-600 focus:bg-white text-slate-800 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">URL da Capa do Negócio</label>
                    <input
                      type="text"
                      value={editCover}
                      onChange={(e) => setEditCover(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-indigo-600 focus:bg-white text-slate-800 font-mono"
                    />
                  </div>

                </div>

                {/* Social links */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                      <Instagram size={12} className="text-pink-500" /> Instagram Username
                    </label>
                    <input
                      type="text"
                      value={editInstagram}
                      onChange={(e) => setEditInstagram(e.target.value)}
                      placeholder="Ex: asuasalao_oficial"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-indigo-600 focus:bg-white text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                      <Facebook size={12} className="text-blue-600" /> Facebook Username/Link
                    </label>
                    <input
                      type="text"
                      value={editFacebook}
                      onChange={(e) => setEditFacebook(e.target.value)}
                      placeholder="Ex: asuaempresa"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-indigo-600 focus:bg-white text-slate-800"
                    />
                  </div>

                </div>

                {/* Short Bio text */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">Breve Descrição / Bio do Negócio</label>
                  <textarea
                    rows={4}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    required
                    placeholder="Conte um pouco sobre o negócio, serviços principais, atendimento e facilidades..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:border-indigo-600 focus:bg-white text-slate-800 leading-relaxed resize-none"
                  />
                </div>

                {/* Footer action buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingShowcase(null)}
                    disabled={isSaving}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || isSaved}
                    className={`px-5 py-2 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1 disabled:opacity-50 ${
                      isSaved 
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100 shadow-md' 
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                    }`}
                  >
                    {isSaving && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                    {isSaved ? (
                      <>
                        <Check size={12} strokeWidth={3} />
                        <span>✓ Guardado!</span>
                      </>
                    ) : (
                      <span>Guardar Alterações</span>
                    )}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
