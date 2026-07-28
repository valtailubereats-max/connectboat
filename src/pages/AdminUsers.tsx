import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, updateDoc, doc, getDocs, getDoc, setDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, parseFirestoreDate } from '../firebase';
import { UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  Shield, 
  ShieldAlert, 
  UserCheck, 
  UserX,
  Mail,
  Calendar,
  Clock,
  MoreVertical,
  AlertCircle,
  Sparkles,
  Pencil,
  X,
  MapPin,
  Phone,
  LayoutGrid,
  Table,
  Check
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { manualAddCredits, manualAddPoints } from '../utils/rewards';

const ALL_COLUMNS = [
  { id: 'nome', label: 'Nome', mandatory: true },
  { id: 'email', label: 'Email', mandatory: false },
  { id: 'telefone', label: 'Telefone', mandatory: false },
  { id: 'pais', label: 'País/Nacionalidade', mandatory: false },
  { id: 'cidade', label: 'Cidade', mandatory: false },
  { id: 'role', label: 'Cargo/Role', mandatory: false },
  { id: 'criacao', label: 'Data de Criação', mandatory: false },
  { id: 'ultimoAcesso', label: 'Último Acesso', mandatory: false },
  { id: 'totalAnuncios', label: 'Total de Anúncios', mandatory: false },
  { id: 'vitrineAtiva', label: 'Vitrine Ativa', mandatory: false },
  { id: 'acoes', label: 'Ações', mandatory: true },
];

const AdminUsers = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [limitAmount, setLimitAmount] = useState(100);
  const [hasMore, setHasMore] = useState(false);
  const [userAdCounts, setUserAdCounts] = useState<Record<string, number>>({});
  
  // New States: ERP / Scalability Improved View Modes & Columns
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
    return (localStorage.getItem('admin_users_view_mode') as 'cards' | 'table') || 'table';
  });
  
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('admin_users_visible_cols');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // ensure mandatory are present
          return [...new Set(['nome', 'acoes', ...parsed])];
        }
      } catch (e) {
        // Fallback
      }
    }
    return ['nome', 'email', 'telefone', 'pais', 'cidade', 'role', 'criacao', 'ultimoAcesso', 'totalAnuncios', 'vitrineAtiva', 'acoes'];
  });

  const isColVisible = (id: string) => visibleColumns.includes(id);

  const toggleColumn = (id: string) => {
    if (id === 'nome' || id === 'acoes') return;
    setVisibleColumns(prev => {
      const updated = prev.includes(id) ? prev.filter(colId => colId !== id) : [...prev, id];
      localStorage.setItem('admin_users_visible_cols', JSON.stringify(updated));
      return updated;
    });
  };
  
  // Debug Tool States
  const [debugSelectedUserId, setDebugSelectedUserId] = useState<string>('');
  const [debugStatus, setDebugStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  
  const { isAdmin } = useAuth();

  // User Profile Editing States
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editCountry, setEditCountry] = useState<'Portugal' | 'Reino Unido' | ''>('');
  const [editRole, setEditRole] = useState<'user' | 'moderator' | 'admin'>('user');
  const [editReferralCredits, setEditReferralCredits] = useState<number>(0);
  const [editPointsFromAds, setEditPointsFromAds] = useState<number>(0);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [editShowcaseActive, setEditShowcaseActive] = useState(false);
  const [editShowcaseApproved, setEditShowcaseApproved] = useState(false);
  const [editShowcaseName, setEditShowcaseName] = useState('');

  const handleOpenEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setEditName(user.name || '');
    setEditEmail(user.email || '');
    setEditPhone(user.phone || '');
    setEditCity(user.city || '');
    setEditCountry(user.country || '');
    setEditRole(user.role || 'user');
    setEditReferralCredits(user.referralCredits || 0);
    setEditPointsFromAds(user.pointsFromAds || 0);
    setEditShowcaseActive(user.showcaseActive || false);
    setEditShowcaseApproved(user.showcaseApproved || false);
    setEditShowcaseName(user.showcaseName || '');
    setEditError(null);
    setEditSuccess(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!isAdmin) {
      setEditError("Apenas administradores podem editar dados dos utilizadores.");
      return;
    }

    const editingUserId = editingUser.id || editingUser.uid;
    if (!editingUserId) {
      setEditError("ID do utilizador inválido.");
      return;
    }

    setIsSaving(true);
    setEditError(null);
    setEditSuccess(null);

    try {
      // Validate Name
      if (!editName.trim()) {
        setEditError("O nome não pode estar vazio.");
        setIsSaving(false);
        return;
      }

      // Check if phone has at least 7 digits (if provided)
      let finalPhone = editPhone.trim();
      if (finalPhone) {
        const digitsOnly = finalPhone.replace(/\D/g, '').trim();
        if (digitsOnly.length < 7) {
          setEditError("Por favor, insira um número de telemóvel válido (mínimo 7 dígitos).");
          setIsSaving(false);
          return;
        }

        // Validate phone uniqueness: same logic as Profile
        const usersQuery = query(
          collection(db, 'users'),
          where('phone', '==', finalPhone)
        );
        const querySnap = await getDocs(usersQuery);
        const duplicateUser = querySnap.docs.find(doc => doc.id !== editingUserId);
        if (duplicateUser) {
          setEditError("Este número de telemóvel já está associado a outro utilizador. Por favor, utilize outro número.");
          setIsSaving(false);
          return;
        }
      }

      // Update basic fields in user document (SetDoc with merge: true)
      const userDocRef = doc(db, 'users', editingUserId);
      const updatedFields: any = {
        name: editName.trim(),
        phone: finalPhone,
        city: editCity.trim(),
        country: editCountry || null,
        role: editRole,
        referralCredits: Number(editReferralCredits) || 0,
        pointsFromAds: Number(editPointsFromAds) || 0,
        showcaseActive: editShowcaseActive,
        showcaseApproved: editShowcaseApproved,
      };

      await setDoc(userDocRef, updatedFields, { merge: true });

      // Synchronize to sellerPublicProfiles
      try {
        const publicRef = doc(db, 'sellerPublicProfiles', editingUserId);
        const publicSnap = await getDoc(publicRef);
        const now = new Date();
        
        const publicPayload: any = {
          displayName: editName.trim(),
          city: editCity.trim(),
          country: editCountry || null,
          updatedAt: now,
          showcaseActive: editShowcaseActive,
          showcaseApproved: editShowcaseApproved,
        };
        
        if (!publicSnap.exists()) {
          const fallbackCreated = editingUser?.acceptedTermsAt 
            ? (typeof editingUser.acceptedTermsAt.toDate === 'function' 
                ? editingUser.acceptedTermsAt.toDate() 
                : (editingUser.acceptedTermsAt instanceof Date ? editingUser.acceptedTermsAt : new Date(editingUser.acceptedTermsAt))) 
            : now;
          publicPayload.createdAt = fallbackCreated instanceof Date && !isNaN(fallbackCreated.getTime()) ? fallbackCreated : now;
        }
        
        await setDoc(publicRef, publicPayload, { merge: true });
      } catch (syncErr) {
        console.error('[Sync] Erro ao sincronizar para sellerPublicProfiles:', syncErr);
      }

      // Success feedback
      setEditSuccess("Dados do utilizador atualizados com sucesso!");
      
      // Update local state list to reflect changes immediately
      setUsers(users.map(u => (u.id === editingUserId || u.uid === editingUserId) ? { 
        ...u, 
        name: editName.trim(),
        phone: finalPhone,
        city: editCity.trim(),
        country: editCountry as 'Portugal' | 'Reino Unido' | undefined,
        role: editRole,
        referralCredits: Number(editReferralCredits) || 0,
        pointsFromAds: Number(editPointsFromAds) || 0,
        showcaseActive: editShowcaseActive,
        showcaseApproved: editShowcaseApproved,
      } : u));

      // Close modal gracefully after a short delay
      setTimeout(() => {
        setEditingUser(null);
      }, 2000);

    } catch (err: any) {
      console.error("Error editing user:", err);
      let errMsg = "Ocorreu um erro ao guardar as alterações.";
      if (err?.code === 'permission-denied') {
        errMsg = "Erro de Permissão (Firestore Rules): Sem privilégios de administrador adequados.";
      } else if (err instanceof Error) {
        errMsg = err.message;
      }
      setEditError(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    fetchUsers(limitAmount);
  }, [limitAmount]);

  // Fetch real ad counts for each user in memory
  useEffect(() => {
    const fetchAdCounts = async () => {
      try {
        const adsSnap = await getDocs(collection(db, 'ads'));
        const counts: Record<string, number> = {};
        adsSnap.docs.forEach(docSnap => {
          const adData = docSnap.data();
          const sellerId = adData.sellerId;
          if (sellerId) {
            counts[sellerId] = (counts[sellerId] || 0) + 1;
          }
        });
        setUserAdCounts(counts);
      } catch (err) {
        console.error("Error fetching ad counts:", err);
      }
    };
    fetchAdCounts();
  }, []);

  const fetchUsers = async (currentLimit: number = limitAmount) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const q = query(collection(db, 'users'), limit(currentLimit + 1));
      const querySnapshot = await getDocs(q);
      let usersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as UserProfile));
      
      if (usersData.length > currentLimit) {
        setHasMore(true);
        usersData = usersData.slice(0, currentLimit);
      } else {
        setHasMore(false);
      }
      
      // Sort client-side to be robust against missing indexes and missing fields
      usersData.sort((a, b) => {
        const dateA = parseFirestoreDate(a.acceptedTermsAt);
        const dateB = parseFirestoreDate(b.acceptedTermsAt);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.getTime() - dateA.getTime();
      });

      setUsers(usersData);
      
      if (usersData.length > 0) {
        setDebugSelectedUserId(usersData[0].id || usersData[0].uid || '');
      }
    } catch (err: any) {
      console.error("Error loading users:", err);
      let message = "Ocorreu um erro ao carregar os utilizadores.";
      if (err?.code === 'permission-denied') {
        message = "Erro de Permissão (Firestore Rules): A sua conta de administrador não tem privilégios delegados nas regras de segurança para listar utilizadores.";
      } else if (err?.code === 'resource-exhausted') {
        message = "Erro de Limite (Quota): O marketplace atingiu a cota diária de leitura gratuita do Firebase. Por favor, tente novamente amanhã.";
      } else if (err instanceof Error) {
        try {
          const details = JSON.parse(err.message);
          message = `Erro: ${details.error || err.message}`;
        } catch {
          message = err.message;
        }
      }
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'user' | 'moderator' | 'admin', currentRole: string) => {
    if (newRole === currentRole) return;
    
    const roleLabels = {
      user: 'Utilizador Comum',
      moderator: 'Moderador',
      admin: 'Administrador'
    };

    if (!window.confirm(`Tem a certeza que deseja alterar o cargo deste utilizador para ${roleLabels[newRole]}?`)) return;

    setUpdatingUserId(userId);
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setUsers(users.map(u => (u.uid === userId || u.id === userId) ? { ...u, role: newRole } : u));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDebugAction = async (actionType: 'credit' | 'points50' | 'points150') => {
    if (!debugSelectedUserId) {
      setDebugStatus({ type: 'error', message: 'Selecione um utilizador primeiro.' });
      return;
    }
    setDebugLoading(true);
    setDebugStatus(null);
    try {
      let success = false;
      const targetUser = users.find(u => u.id === debugSelectedUserId || u.uid === debugSelectedUserId);
      const name = targetUser ? (targetUser.name || targetUser.email || debugSelectedUserId) : debugSelectedUserId;
      
      if (actionType === 'credit') {
        success = await manualAddCredits(debugSelectedUserId, 1);
        if (success) {
          setDebugStatus({ type: 'success', message: `1 Crédito de Destaque adicionado com sucesso a ${name}!` });
        }
      } else if (actionType === 'points50') {
        success = await manualAddPoints(debugSelectedUserId, 50);
        if (success) {
          setDebugStatus({ type: 'success', message: `50 Pontos adicionados com sucesso a ${name}!` });
        }
      } else if (actionType === 'points150') {
        success = await manualAddPoints(debugSelectedUserId, 150);
        if (success) {
          setDebugStatus({ type: 'success', message: `150 Pontos adicionados com sucesso a ${name}! (Destaques adicionais gerados se elegível)` });
        }
      }

      if (success) {
        // Refresh local user list to show changes immediately
        await fetchUsers();
      } else {
        setDebugStatus({ type: 'error', message: `Não foi possível atualizar o utilizador. Verifique as permissões.` });
      }
    } catch (err: any) {
      console.error(err);
      setDebugStatus({ type: 'error', message: `Erro ao executar ação debug: ${err.message}` });
    } finally {
      setDebugLoading(false);
    }
  };

  // 1. Unified Filter & Search logic
  const filteredUsers = users.filter(user => {
    // Quick Filters
    if (activeFilter === 'regular') {
      const role = user.role || 'user';
      if (role !== 'user') return false;
    } else if (activeFilter === 'moderator') {
      if (user.role !== 'moderator') return false;
    } else if (activeFilter === 'admin') {
      if (user.role !== 'admin') return false;
    } else if (activeFilter === 'portugal') {
      if (user.country !== 'Portugal') return false;
    } else if (activeFilter === 'uk') {
      if (user.country !== 'Reino Unido') return false;
    } else if (activeFilter === 'showcase_active') {
      if (!user.showcaseActive) return false;
    } else if (activeFilter === 'showcase_inactive') {
      if (user.showcaseActive) return false;
    }

    // Global Search: name, email, phone, city, country, role, user ID
    const search = searchTerm.toLowerCase().trim();
    if (!search) return true;
    
    const nameMatch = (user.name || '').toLowerCase().includes(search);
    const emailMatch = (user.email || '').toLowerCase().includes(search);
    const phoneMatch = (user.phone || '').toLowerCase().includes(search);
    const cityMatch = (user.city || '').toLowerCase().includes(search);
    const countryMatch = (user.country || '').toLowerCase().includes(search);
    const roleMatch = (user.role || 'user').toLowerCase().includes(search);
    const idMatch = (user.id || '').toLowerCase().includes(search) || (user.uid || '').toLowerCase().includes(search);
    
    return nameMatch || emailMatch || phoneMatch || cityMatch || countryMatch || roleMatch || idMatch;
  });

  // Analytics of loaded users
  const countStats = {
    all: users.length,
    regular: users.filter(u => !u.role || u.role === 'user').length,
    moderators: users.filter(u => u.role === 'moderator').length,
    admins: users.filter(u => u.role === 'admin').length,
    portugal: users.filter(u => u.country === 'Portugal').length,
    uk: users.filter(u => u.country === 'Reino Unido').length,
    showcaseActive: users.filter(u => u.showcaseActive).length,
    showcaseInactive: users.filter(u => !u.showcaseActive).length,
  };

  const QUICK_FILTERS = [
    { id: 'all', label: 'Todos', count: countStats.all },
    { id: 'regular', label: 'Utilizadores Comuns', count: countStats.regular },
    { id: 'moderator', label: 'Moderadores', count: countStats.moderators },
    { id: 'admin', label: 'Admins', count: countStats.admins },
    { id: 'portugal', label: 'Portugal 🇵🇹', count: countStats.portugal },
    { id: 'uk', label: 'Reino Unido 🇬🇧', count: countStats.uk },
    { id: 'showcase_active', label: 'Com Vitrine Ativa 💚', count: countStats.showcaseActive },
    { id: 'showcase_inactive', label: 'Sem Vitrine Ativa', count: countStats.showcaseInactive },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Utilizadores / Membros</h1>
        <p className="text-slate-500 font-medium">Controle as contas de utilizadores, vitrines digitais de empreendedores, cargos e créditos de destaques.</p>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-5 rounded-2xl flex items-start gap-3.5 text-sm font-bold shadow-sm">
          <AlertCircle size={20} className="shrink-0 text-red-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-extrabold text-red-950">Falha ao obter lista (Firestore ERROR)</p>
            <p className="font-medium text-red-700 leading-relaxed text-xs">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Dynamic Summary Cards to match Gestão de Equipe executive statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-50 text-slate-500 rounded-xl flex items-center justify-center font-black text-sm">
            👥
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">Total</p>
            <p className="text-xl font-black text-slate-950 mt-0.5">{countStats.all}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black text-sm">
            👑
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-indigo-500">Admins</p>
            <p className="text-xl font-black text-indigo-950 mt-0.5">{countStats.admins}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-black text-sm">
            ⚡
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-amber-500">Moderadores</p>
            <p className="text-xl font-black text-amber-950 mt-0.5">{countStats.moderators}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-black text-sm">
            🏪
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-emerald-500">Com Vitrine</p>
            <p className="text-xl font-black text-emerald-950 mt-0.5">{countStats.showcaseActive}</p>
          </div>
        </div>
      </div>

      {/* Global Search and Advanced Controls card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Global search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Pesquisar por id, nome, email, telemóvel, cidade, país ou cargo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-semibold text-slate-800"
            />
          </div>

          {/* View Mode Switcher Pill */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl shrink-0 gap-1 self-start lg:self-auto">
            <button
              onClick={() => {
                setViewMode('table');
                localStorage.setItem('admin_users_view_mode', 'table');
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Lista Tabela Compacta"
            >
              <Table size={15} />
              <span>Compacto</span>
            </button>
            <button
              onClick={() => {
                setViewMode('cards');
                localStorage.setItem('admin_users_view_mode', 'cards');
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'cards'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Lista de Fichas/Cards"
            >
              <LayoutGrid size={15} />
              <span>Fichas</span>
            </button>
          </div>
        </div>

        {/* Quick Filters Pill Container */}
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Filtros rápidos</h4>
          <div className="flex flex-wrap gap-2">
            {QUICK_FILTERS.map((filter) => {
              const isActive = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border flex items-center gap-1.5 shadow-2xs ${
                    isActive 
                      ? 'bg-indigo-600 border-indigo-600 text-white' 
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-350 hover:bg-slate-50'
                  }`}
                >
                  <span>{filter.label}</span>
                  <span className={`inline-block px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                    isActive ? 'bg-indigo-850 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {filter.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Customizable Visible Columns Selector (ERP Checklist Feature) */}
        {viewMode === 'table' && (
          <div className="pt-3.5 border-t border-slate-100 space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Colunas visíveis</h4>
            <div className="flex flex-wrap gap-x-4 gap-y-2 bg-slate-50 p-3 rounded-xl border border-slate-150">
              {ALL_COLUMNS.map((col) => {
                const isMandatory = col.mandatory;
                const isChecked = isColVisible(col.id);
                return (
                  <label 
                    key={col.id} 
                    className={`flex items-center gap-2 text-xs font-semibold select-none transition-all ${
                      isMandatory 
                        ? 'text-indigo-600/75 cursor-not-allowed opacity-80' 
                        : isChecked 
                          ? 'text-slate-800 hover:text-indigo-600 cursor-pointer' 
                          : 'text-slate-400 hover:text-slate-600 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isMandatory}
                      onChange={() => toggleColumn(col.id)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 w-3.5 h-3.5 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <span>
                      {col.label} 
                      {isMandatory && <span className="text-[8px] text-indigo-500 font-bold tracking-wider uppercase ml-1">(Obrigatória)</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Reward Points Simulation Tool (Admin Only) */}
      <div className="bg-amber-50/70 border border-amber-200 p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="text-amber-600 animate-pulse" size={18} />
          <h2 className="text-sm font-black text-amber-900 uppercase tracking-wider">🔬 Ferramenta de Teste de Recompensas (Modo Debug)</h2>
        </div>
        <p className="text-xs text-amber-800 font-semibold mb-4 leading-relaxed">
          Simule as transações de pontos de destaque em tempo real. Cada 150 pontos acumulados convertem-se automaticamente em 1 Crédito de Destaque.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-4 space-y-1">
            <label className="block text-[10px] font-black text-amber-900 uppercase tracking-widest leading-none">Selecionar Utilizador</label>
            <select
              value={debugSelectedUserId}
              onChange={(e) => setDebugSelectedUserId(e.target.value)}
              disabled={debugLoading || users.length === 0}
              className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              {users.length === 0 ? (
                <option value="">A carregar utilizadores...</option>
              ) : (
                users.map(u => (
                  <option key={u.id || u.uid} value={u.id || u.uid}>
                    {u.name || 'Sem nome'} ({u.email || u.id})
                  </option>
                ))
              )}
            </select>
          </div>
          
          <div className="md:col-span-8 flex flex-wrap gap-2 pt-2 md:pt-4">
            <button
              onClick={() => handleDebugAction('points50')}
              disabled={debugLoading || !debugSelectedUserId}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-sm transition-colors cursor-pointer"
            >
              Adicionar 50 Pontos
            </button>
            <button
              onClick={() => handleDebugAction('points150')}
              disabled={debugLoading || !debugSelectedUserId}
              className="px-4 py-2.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-sm transition-colors cursor-pointer"
            >
              Adicionar 150 Pontos (Gera Crédito)
            </button>
            <button
              onClick={() => handleDebugAction('credit')}
              disabled={debugLoading || !debugSelectedUserId}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-sm transition-colors cursor-pointer"
            >
              Adicionar 1 Crédito Destaque
            </button>
          </div>
        </div>
        
        {debugStatus && (
          <div className={`mt-4 p-3 rounded-xl text-xs font-bold transition-all ${
            debugStatus.type === 'success' 
              ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' 
              : 'bg-rose-50 border border-rose-100 text-rose-800'
          }`}>
            {debugStatus.message}
          </div>
        )}
      </div>

      {/* Main content Area */}
      {loading ? (
        <div className="text-center py-20 text-slate-400 font-bold animate-pulse flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-2 border-indigo-600 border-b-transparent rounded-full animate-spin"></div>
          <p>A carregar utilizadores...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <p className="text-xs text-slate-500 font-bold">
              A pesquisar localmente nos <span className="text-indigo-600">{filteredUsers.length}</span> utilizadores carregados.
            </p>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              <AlertCircle size={28} className="mx-auto text-slate-350 mb-2" />
              <p className="font-bold text-sm">Nenhum utilizador encontrado com os filtros e busca aplicados.</p>
            </div>
          ) : viewMode === 'table' ? (
            /* --- VIEW MODE: TABLE COMPACT --- */
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse table-auto">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {isColVisible('nome') && (
                        <th className="px-3.5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Membro</th>
                      )}
                      {isColVisible('email') && (
                        <th className="px-3.5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Email</th>
                      )}
                      {isColVisible('telefone') && (
                        <th className="px-3.5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Telefone</th>
                      )}
                      {isColVisible('pais') && (
                        <th className="px-3.5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">País</th>
                      )}
                      {isColVisible('cidade') && (
                        <th className="px-3.5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Cidade</th>
                      )}
                      {isColVisible('role') && (
                        <th className="px-3.5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Cargo/Role</th>
                      )}
                      {isColVisible('criacao') && (
                        <th className="px-3.5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Data Criação</th>
                      )}
                      {isColVisible('ultimoAcesso') && (
                        <th className="px-3.5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">Último Acesso</th>
                      )}
                      {isColVisible('totalAnuncios') && (
                        <th className="px-3.5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Anúncios</th>
                      )}
                      {isColVisible('vitrineAtiva') && (
                        <th className="px-3.5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Vitrine</th>
                      )}
                      {isColVisible('acoes') && (
                        <th className="px-3.5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right pr-6">Ações</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((user, idx) => {
                      const uid = user.id || user.uid;
                      const adCount = userAdCounts[uid] || 0;
                      return (
                        <tr key={`${uid}-${idx}`} className="hover:bg-slate-50/50 transition-colors text-xs">
                          {isColVisible('nome') && (
                            <td className="px-3.5 py-2 font-bold text-slate-900">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-indigo-50 text-indigo-700 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0">
                                  {(user.name?.[0] || user.email?.[0] || '?').toUpperCase()}
                                </div>
                                <span className="truncate max-w-[120px]">{user.name || 'Sem nome'}</span>
                              </div>
                            </td>
                          )}

                          {isColVisible('email') && (
                            <td className="px-3.5 py-2 text-slate-600 font-semibold truncate max-w-[130px]" title={user.email}>
                              {user.email || 'N/A'}
                            </td>
                          )}

                          {isColVisible('telefone') && (
                            <td className="px-3.5 py-2 text-slate-600 font-bold whitespace-nowrap">
                              {user.phone || 'Sem telemóvel'}
                            </td>
                          )}

                          {isColVisible('pais') && (
                            <td className="px-3.5 py-2 text-center text-xs font-bold">
                              {user.country === 'Reino Unido' ? '🇬🇧 UK' : user.country === 'Portugal' ? '🇵🇹 PT' : '—'}
                            </td>
                          )}

                          {isColVisible('cidade') && (
                            <td className="px-3.5 py-2 text-slate-600 font-bold truncate max-w-[90px]">
                              {user.city || '—'}
                            </td>
                          )}

                          {isColVisible('role') && (
                            <td className="px-3.5 py-2 text-center">
                              <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                user.role === 'admin' 
                                  ? 'bg-indigo-100 text-indigo-700' 
                                  : user.role === 'moderator'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-150 text-slate-600'
                              }`}>
                                {user.role || 'user'}
                              </span>
                            </td>
                          )}

                          {isColVisible('criacao') && (
                            <td className="px-3.5 py-2 text-slate-500 font-medium whitespace-nowrap">
                              {parseFirestoreDate(user.acceptedTermsAt) 
                                ? format(parseFirestoreDate(user.acceptedTermsAt)!, 'dd/MM/yyyy') 
                                : '—'}
                            </td>
                          )}

                          {isColVisible('ultimoAcesso') && (
                            <td className="px-3.5 py-2 text-slate-500 font-medium whitespace-nowrap">
                              {parseFirestoreDate(user.lastLoginAt) 
                                ? formatDistanceToNow(parseFirestoreDate(user.lastLoginAt)!, { addSuffix: true, locale: pt }) 
                                : 'Nunca'}
                            </td>
                          )}

                          {isColVisible('totalAnuncios') && (
                            <td className="px-3.5 py-2 text-center font-black">
                              <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-black ${
                                adCount > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-400'
                              }`}>
                                {adCount}
                              </span>
                            </td>
                          )}

                          {isColVisible('vitrineAtiva') && (
                            <td className="px-3.5 py-2 text-center font-bold">
                              {user.showcaseActive ? (
                                <span className={`inline-flex items-center text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                                  user.showcaseApproved 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                    : 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                                }`}>
                                  {user.showcaseApproved ? 'ATIVA' : 'PENDENTE'}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-bold">—</span>
                              )}
                            </td>
                          )}

                          {isColVisible('acoes') && (
                            <td className="px-3.5 py-2 text-right pr-6 whitespace-nowrap">
                              {updatingUserId === uid ? (
                                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                              ) : (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    onClick={() => handleOpenEditModal(user)}
                                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 font-bold text-[10px] rounded-lg border border-emerald-100"
                                    title="Editar Perfil"
                                  >
                                    Editar
                                  </button>
                                  {user.role !== 'user' && user.role !== undefined && (
                                    <button
                                      onClick={() => handleUpdateRole(uid, 'user', user.role || 'user')}
                                      className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-[10px] rounded-lg"
                                      title="Fazer Comum"
                                    >
                                      Comum
                                    </button>
                                  )}
                                  {user.role !== 'moderator' && (
                                    <button
                                      onClick={() => handleUpdateRole(uid, 'moderator', user.role || 'user')}
                                      className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-600 font-bold text-[10px] rounded-lg border border-amber-100/50"
                                      title="Tornar Moderador"
                                    >
                                      Mod
                                    </button>
                                  )}
                                  {user.role !== 'admin' && (
                                    <button
                                      onClick={() => handleUpdateRole(uid, 'admin', user.role || 'user')}
                                      className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-[10px] rounded-lg border border-indigo-100/50"
                                      title="Tornar Admin"
                                    >
                                      Admin
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* --- VIEW MODE: CARDS GRID --- */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUsers.map((user, idx) => {
                const uid = user.id || user.uid;
                const adCount = userAdCounts[uid] || 0;
                const roleBadgeColor = 
                  user.role === 'admin' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                  user.role === 'moderator' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                  'bg-slate-100 text-slate-600 border-slate-200';

                return (
                  <div key={`${uid}-${idx}`} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4 hover:shadow-md transition-all">
                    {/* Card Header: Avatar & Name */}
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-black text-lg shadow-2xs">
                        {(user.name?.[0] || user.email?.[0] || '?').toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-extrabold text-slate-900 truncate leading-none mb-1">
                          {user.name || 'Sem nome'}
                        </h4>
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${roleBadgeColor}`}>
                          {user.role || 'user'}
                        </span>
                      </div>
                    </div>

                    {/* Contact Rows */}
                    <div className="space-y-1.5 text-xs text-slate-600 font-bold bg-slate-50 p-3 rounded-2xl">
                      <p className="flex items-center gap-1.5 truncate">
                        <Mail size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate">{user.email || 'N/A'}</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Phone size={13} className="text-slate-400 shrink-0" />
                        <span>{user.phone || 'Sem telemóvel'}</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate">
                          {user.city || 'Sem cidade'} {user.country === 'Portugal' ? '🇵🇹' : user.country === 'Reino Unido' ? '🇬🇧' : ''}
                        </span>
                      </p>
                    </div>

                    {/* Metadata & Stats */}
                    <div className="grid grid-cols-2 gap-3 text-[11px] font-semibold text-slate-500">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Membro desde</p>
                        <p className="font-bold text-slate-800">
                          {parseFirestoreDate(user.acceptedTermsAt) 
                            ? format(parseFirestoreDate(user.acceptedTermsAt)!, 'dd/MM/yyyy') 
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Último login</p>
                        <p className="font-bold text-slate-800 truncate">
                          {parseFirestoreDate(user.lastLoginAt) 
                            ? formatDistanceToNow(parseFirestoreDate(user.lastLoginAt)!, { addSuffix: true, locale: pt }) 
                            : 'Nunca'}
                        </p>
                      </div>
                    </div>

                    {/* Showcase Status & Ads count badges */}
                    <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Atividades</p>
                        <div className="flex gap-1.5 items-center">
                          <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-black">
                            {adCount} Anúncios
                          </span>
                          {user.showcaseActive && (
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-black ${
                              user.showcaseApproved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {user.showcaseApproved ? 'Vitrine ✓' : 'Vitrine Pendente ⏳'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="pt-2 flex flex-wrap gap-1 items-center justify-end">
                      <button
                        onClick={() => handleOpenEditModal(user)}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-100 flex items-center gap-1"
                        title="Editar Utilizador"
                      >
                        <Pencil size={11} />
                        Editar
                      </button>
                      {user.role !== 'user' && user.role !== undefined && (
                        <button
                          onClick={() => handleUpdateRole(uid, 'user', user.role || 'user')}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl"
                        >
                          Tornar Comum
                        </button>
                      )}
                      {user.role !== 'moderator' && (
                        <button
                          onClick={() => handleUpdateRole(uid, 'moderator', user.role || 'user')}
                          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 font-bold text-xs rounded-xl border border-amber-100"
                        >
                          Tornar Moderador
                        </button>
                      )}
                      {user.role !== 'admin' && (
                        <button
                          onClick={() => handleUpdateRole(uid, 'admin', user.role || 'user')}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-xs rounded-xl border border-indigo-100"
                        >
                          Tornar Admin
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasMore && (
            <div className="p-4 border border-slate-200 hover:border-indigo-100 rounded-2xl flex justify-center bg-white shadow-xs">
              <button
                onClick={() => setLimitAmount(prev => prev + 100)}
                className="px-6 py-2.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 text-indigo-600 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2"
              >
                <Users size={14} className="text-indigo-500 animate-pulse" />
                Carregar mais utilizadores (+100)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit User Profile Modal (Intact popup modal layout) */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in-50 duration-200"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Pencil size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-950 text-base leading-tight">Editar Perfil do Utilizador</h3>
                    <p className="text-xs text-slate-500 font-medium font-mono">ID: {editingUser.id || editingUser.uid}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="w-8 h-8 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors shadow-sm cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body / Form */}
              <form onSubmit={handleSaveUser} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {editError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl flex items-start gap-2.5 text-xs font-bold leading-relaxed shadow-sm">
                    <AlertCircle size={16} className="shrink-0 text-rose-600 mt-0.5" />
                    <span>{editError}</span>
                  </div>
                )}

                {editSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-start gap-2.5 text-xs font-bold leading-relaxed shadow-sm">
                    <UserCheck size={16} className="shrink-0 text-emerald-600 mt-0.5" />
                    <span>{editSuccess}</span>
                  </div>
                )}

                {/* Email Field (ReadOnly) */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-800 uppercase tracking-widest">Email de Login (Apenas Leitura)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editEmail}
                      readOnly
                      disabled
                      className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-500 cursor-not-allowed focus:outline-none"
                    />
                  </div>
                  <div className="flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50/50 border border-amber-200/50 rounded-xl p-2.5 font-bold leading-relaxed">
                    <AlertCircle size={14} className="shrink-0 text-amber-600 mt-0.5" />
                    <span>O email de login não pode ser alterado diretamente aqui para preservar a integridade do Firebase Authentication.</span>
                  </div>
                </div>

                {/* Display Name Field */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-800 uppercase tracking-widest">Nome Completo / Exibição</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Ex: João Silva"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
                  />
                </div>

                {/* Phone Field */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-800 uppercase tracking-widest">Telefone / Telemóvel</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Ex: +351912345678"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* City field */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-800 uppercase tracking-widest">Cidade</label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                        placeholder="Ex: Lisboa"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Country Field */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-800 uppercase tracking-widest">País</label>
                    <select
                      value={editCountry}
                      onChange={(e) => setEditCountry(e.target.value as 'Portugal' | 'Reino Unido' | '')}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm cursor-pointer"
                    >
                      <option value="">Selecione o País...</option>
                      <option value="Portugal">Portugal</option>
                      <option value="Reino Unido">Reino Unido</option>
                    </select>
                  </div>
                </div>

                {/* Role field */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-800 uppercase tracking-widest">Cargo de Autenticação</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as 'user' | 'moderator' | 'admin')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm cursor-pointer"
                  >
                    <option value="user">Utilizador Comum (user)</option>
                    <option value="moderator">Moderador (moderator)</option>
                    <option value="admin">Administrador (admin)</option>
                  </select>
                </div>

                {/* Rewards / Points and Credits Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-800 uppercase tracking-widest">Créditos de Destaque</label>
                    <input
                      type="number"
                      min="0"
                      value={editReferralCredits}
                      onChange={(e) => setEditReferralCredits(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-800 uppercase tracking-widest">Pontos de Progresso</label>
                    <input
                      type="number"
                      min="0"
                      value={editPointsFromAds}
                      onChange={(e) => setEditPointsFromAds(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
                    />
                  </div>
                </div>

                {/* Showcase Moderation Block */}
                <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl space-y-4">
                  <h4 className="text-[11px] font-black text-indigo-950 uppercase tracking-wider">Moderação de Vitrine Digital</h4>
                  
                  {editShowcaseActive && editShowcaseName && (
                    <p className="text-xs font-extrabold text-indigo-800">
                      Nome da Vitrine: <span className="text-slate-900">"{editShowcaseName}"</span>
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Vitrine Ativada pelo Dono:</span>
                      <span className="text-[10px] text-slate-500 block">Indica se o empreendedor ativou a vitrine na conta dele.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditShowcaseActive(!editShowcaseActive)}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        editShowcaseActive ? 'bg-indigo-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          editShowcaseActive ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-indigo-100/50 pt-3">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block flex items-center gap-1">Aprovado pela Moderação: {editShowcaseApproved ? '💚' : '⏳'}</span>
                      <span className="text-[10px] text-slate-500 block">Se desmarcado, a vitrine fica em análise e oculta do público.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditShowcaseApproved(!editShowcaseApproved)}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        editShowcaseApproved ? 'bg-emerald-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          editShowcaseApproved ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Submit Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    disabled={isSaving}
                    className="px-5 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-2xl font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !!editSuccess}
                    className={`px-6 py-3 rounded-2xl font-bold text-xs transition-colors shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                      editSuccess 
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
                    }`}
                  >
                    {isSaving ? (
                      <div className="w-4 h-4 border-2 border-white border-b-transparent rounded-full animate-spin"></div>
                    ) : (
                      <UserCheck size={14} />
                    )}
                    {isSaving ? 'A guardar...' : editSuccess ? '✓ Guardado com Sucesso!' : 'Guardar Alterações'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminUsers;
