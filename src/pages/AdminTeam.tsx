import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, parseFirestoreDate } from '../firebase';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  Shield, 
  ShieldAlert, 
  ShieldCheck,
  User,
  Mail,
  Calendar,
  Clock,
  Briefcase,
  AlertCircle,
  TrendingUp,
  Award
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';

const AdminTeam = () => {
  const { profile, user, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string>('all');

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-center max-w-md mx-auto my-12">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={32} />
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">Acesso Restrito</h1>
        <p className="text-slate-500 font-medium mb-6">Apenas utilizadores com o cargo de Administrador possuem permissões para gerir a equipa.</p>
      </div>
    );
  }

  const fetchUsers = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const q = query(collection(db, 'users'), limit(100));
      const querySnapshot = await getDocs(q);
      const usersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as UserProfile));
      
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
    } catch (err: any) {
      console.error("Error loading users:", err);
      let message = "Ocorreu um erro ao carregar os utilizadores.";
      if (err?.code === 'permission-denied') {
        message = "Erro de Permissão (Firestore Rules): A sua conta de administrador não tem privilégios delegados nas regras de segurança para listar utilizadores.";
      } else if (err?.code === 'resource-exhausted') {
        message = "Erro de Limite (Quota): O marketplace atingiu a cota diária de leitura gratuita do Firebase. Por favor, tente novamente amanhã.";
      } else if (err instanceof Error) {
        try {
          // Parse the error message as JSON if possible to understand more details
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
      setUsers(users.map(u => u.uid === userId || u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const filteredUsers = users.filter(user => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = !search || 
      (user.email || '').toLowerCase().includes(search) || 
      (user.name || '').toLowerCase().includes(search);
    
    // Explicit role typing checks
    const roleToCheck = user.role || 'user';
    const matchesRole = filterRole === 'all' || roleToCheck === filterRole;

    return matchesSearch && matchesRole;
  });

  // Analytics helper for executive summary cards
  const teamStats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    moderators: users.filter(u => u.role === 'moderator').length,
    regularUsers: users.filter(u => !u.role || u.role === 'user').length,
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Briefcase className="text-indigo-600 h-8 w-8" />
            <span>Gestão de Equipe</span>
          </h1>
          <p className="text-slate-500 font-medium">Controle os níveis e permissões de acesso da equipe do marketplace.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-50 text-slate-500 rounded-xl flex items-center justify-center font-bold">
            <Users size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">Total Utilizadores</p>
            <p className="text-2xl font-black text-slate-950 mt-0.5">{teamStats.total}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold">
            <Shield size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-indigo-500">Administradores</p>
            <p className="text-2xl font-black text-indigo-950 mt-0.5">{teamStats.admins}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-bold">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-amber-500">Moderadores</p>
            <p className="text-2xl font-black text-amber-950 mt-0.5">{teamStats.moderators}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center font-bold">
            <User size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">Utilizadores Comuns</p>
            <p className="text-2xl font-black text-slate-950 mt-0.5">{teamStats.regularUsers}</p>
          </div>
        </div>
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

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Pesquisar utilizador por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
          />
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl self-start md:self-auto shrink-0">
          {(['all', 'admin', 'moderator', 'user'] as const).map((roleVal) => {
            const labelStr = 
              roleVal === 'all' ? 'Ver Todos' : 
              roleVal === 'admin' ? 'Admins' : 
              roleVal === 'moderator' ? 'Moderadores' : 'Comuns';
            return (
              <button
                key={roleVal}
                onClick={() => setFilterRole(roleVal)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  filterRole === roleVal
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {labelStr}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Listing Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 font-bold space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          <p className="animate-pulse">A carregar equipe e utilizadores...</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Utilizador</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Contacto</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Cargo Atual</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Registo</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Atribuir Nível / Permissões</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((item, idx) => {
                  const currentRole = item.role || 'user';
                  const isUpdating = updatingUserId === item.uid || updatingUserId === item.id;
                  
                  return (
                    <tr key={`team-user-${item.id || item.uid || idx}-${idx}`} className="hover:bg-slate-50/30 transition-colors">
                      {/* Name and email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                            currentRole === 'admin' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                            currentRole === 'moderator' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                            'bg-slate-50 text-slate-600'
                          }`}>
                            {(item.name?.[0] || item.email?.[0] || '?').toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                              {item.name || 'Sem nome'}
                              {currentRole === 'admin' && <Shield size={14} className="text-indigo-600" title="Administrador" />}
                              {currentRole === 'moderator' && <ShieldCheck size={14} className="text-amber-500" title="Moderador" />}
                            </p>
                            <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                              <Mail size={12} className="text-slate-400" />
                              {item.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Contact phone */}
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-700">{item.phone || 'Sem telefone'}</span>
                      </td>

                      {/* Role representation badges */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                          currentRole === 'admin' 
                            ? 'bg-indigo-50 text-indigo-700' 
                            : currentRole === 'moderator'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-50 text-slate-500'
                        }`}>
                          {currentRole === 'admin' && <Shield size={10} />}
                          {currentRole === 'moderator' && <ShieldCheck size={10} />}
                          {currentRole === 'user' && <User size={10} />}
                          {currentRole === 'admin' ? 'Admin' : currentRole === 'moderator' ? 'Moderador' : 'Comum'}
                        </span>
                      </td>

                      {/* User's creation date */}
                      <td className="px-6 py-4 text-xs font-bold text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-400" />
                          <span>{parseFirestoreDate(item.acceptedTermsAt) ? format(parseFirestoreDate(item.acceptedTermsAt)!, 'dd/MM/yyyy') : 'N/A'}</span>
                        </div>
                      </td>

                      {/* Actions for change role */}
                      <td className="px-6 py-4 text-right">
                        {isUpdating ? (
                          <div className="flex justify-end pr-8">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Make Standard User */}
                            {currentRole !== 'user' && (
                              <button
                                onClick={() => handleUpdateRole(item.id || item.uid, 'user', currentRole)}
                                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl transition-all"
                                title="Atribuir Utilizador Comum"
                              >
                                Rebaixar a Comum
                              </button>
                            )}
                            
                            {/* Make Moderator button */}
                            {currentRole !== 'moderator' && (
                              <button
                                onClick={() => handleUpdateRole(item.id || item.uid, 'moderator', currentRole)}
                                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 font-bold text-xs rounded-xl transition-all border border-amber-100/50"
                                title="Atribuir Moderador"
                              >
                                Tornar Moderador
                              </button>
                            )}

                            {/* Make Admin button */}
                            {currentRole !== 'admin' && (
                              <button
                                onClick={() => handleUpdateRole(item.id || item.uid, 'admin', currentRole)}
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-xs rounded-xl transition-all border border-indigo-100/50"
                                title="Atribuir Administrador"
                              >
                                Tornar Admin
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="p-16 text-center text-slate-400">
              <AlertCircle size={24} className="mx-auto text-slate-300 mb-2" />
              <p className="font-medium text-sm">Nenhum utilizador encontrado com os filtros atuais.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminTeam;
