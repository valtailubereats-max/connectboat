import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot, serverTimestamp, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, CommunityVideo } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Search, UserCheck, UserX, Film, ShieldAlert, Sparkles, 
  Trash2, Eye, EyeOff, CheckCircle2, XCircle, ArrowLeft, Loader2, Play, ExternalLink, X
} from 'lucide-react';

export default function AdminContentCreators() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [creators, setCreators] = useState<UserProfile[]>([]);
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [videoCounts, setVideoCounts] = useState<Record<string, number>>({});

  // Search and promote state
  const [allUsersSearchTerm, setAllUsersSearchTerm] = useState('');
  const [foundUsers, setFoundUsers] = useState<UserProfile[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Active creator details modal / panel for quick video access
  const [selectedCreator, setSelectedCreator] = useState<UserProfile | null>(null);
  const [selectedCreatorVideos, setSelectedCreatorVideos] = useState<CommunityVideo[]>([]);
  const [loadingCreatorVideos, setLoadingCreatorVideos] = useState(false);

  // General state
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Protect page
  useEffect(() => {
    if (!authLoading) {
      if (!user || !isAdmin) {
        navigate('/admin/dashboard', { replace: true });
      }
    }
  }, [authLoading, user, isAdmin, navigate]);

  // Fetch all content creators in real-time
  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'content_creator')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        uid: doc.id,
        id: doc.id,
        ...doc.data()
      })) as UserProfile[];
      
      setCreators(list);
      setLoadingCreators(false);

      // Fetch video counts for each creator
      const counts: Record<string, number> = {};
      await Promise.all(list.map(async (creator) => {
        const videoQuery = query(
          collection(db, 'videos'),
          where('ownerId', '==', creator.id)
        );
        const videoSnap = await getDocs(videoQuery);
        counts[creator.id] = videoSnap.size;
      }));
      setVideoCounts(counts);
    }, (err) => {
      console.error('Erro ao ler criadores:', err);
      setLoadingCreators(false);
    });

    return () => unsubscribe();
  }, []);

  // Search users to promote
  const handleSearchUsers = async (val: string) => {
    setAllUsersSearchTerm(val);
    if (val.trim().length < 2) {
      setFoundUsers([]);
      setShowSearchDropdown(false);
      return;
    }

    setSearchingUsers(true);
    setShowSearchDropdown(true);

    try {
      // Query to find users. Since Firestore doesn't do full text easily, we fetch and filter locally
      const snap = await getDocs(collection(db, 'users'));
      const term = val.toLowerCase();
      
      const filtered = snap.docs
        .map(doc => ({ id: doc.id, uid: doc.id, ...doc.data() } as UserProfile))
        .filter(u => {
          // Exclude already creators or admin/moderator
          if (u.role === 'admin' || u.role === 'moderator' || u.role === 'content_creator') {
            return false;
          }
          const nameMatch = (u.name || '').toLowerCase().includes(term);
          const emailMatch = (u.email || '').toLowerCase().includes(term);
          return nameMatch || emailMatch;
        })
        .slice(0, 10); // Limit to 10 results

      setFoundUsers(filtered);
    } catch (err) {
      console.error('Erro ao pesquisar utilizadores:', err);
    } finally {
      setSearchingUsers(false);
    }
  };

  // Promote a user to content_creator
  const promoteToCreator = async (targetUser: UserProfile) => {
    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, {
        role: 'content_creator',
        updatedAt: serverTimestamp()
      });

      setAllUsersSearchTerm('');
      setFoundUsers([]);
      setShowSearchDropdown(false);
      showNotification(`🎉 ${targetUser.name || 'Utilizador'} promovido a Criador de Conteúdo!`, 'success');
    } catch (err) {
      console.error('Erro ao promover:', err);
      showNotification('Erro ao promover utilizador.', 'error');
    }
  };

  // Demote/remove content_creator role
  const removeCreatorRole = async (creator: UserProfile) => {
    if (!window.confirm(`Tem a certeza que deseja remover o cargo de Criador de Conteúdo de ${creator.name || 'este utilizador'}?`)) return;

    try {
      const userRef = doc(db, 'users', creator.id);
      await updateDoc(userRef, {
        role: 'user',
        updatedAt: serverTimestamp()
      });
      showNotification('Cargo de Criador removido com sucesso.', 'success');
    } catch (err) {
      console.error('Erro ao despromover:', err);
      showNotification('Erro ao remover cargo.', 'error');
    }
  };

  // Block/unblock creator
  const toggleBlockCreator = async (creator: UserProfile, block: boolean) => {
    const actionText = block ? 'bloquear' : 'reativar';
    if (!window.confirm(`Tem a certeza que deseja ${actionText} o criador ${creator.name}?`)) return;

    try {
      const userRef = doc(db, 'users', creator.id);
      await updateDoc(userRef, {
        blocked: block,
        updatedAt: serverTimestamp()
      });
      showNotification(`Criador ${block ? 'bloqueado' : 'reativado'} com sucesso.`, 'success');
    } catch (err) {
      console.error('Erro ao atualizar bloqueio:', err);
      showNotification('Erro ao alterar status de bloqueio.', 'error');
    }
  };

  // Quick video list for selected creator
  const viewCreatorVideos = async (creator: UserProfile) => {
    setSelectedCreator(creator);
    setLoadingCreatorVideos(true);

    try {
      const q = query(
        collection(db, 'videos'),
        where('ownerId', '==', creator.id)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as CommunityVideo[];
      
      list.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      setSelectedCreatorVideos(list);
    } catch (err) {
      console.error('Erro ao ler vídeos do criador:', err);
    } finally {
      setLoadingCreatorVideos(false);
    }
  };

  // Toggle video visibility quickly from the creator's list
  const toggleVideoActive = async (video: CommunityVideo) => {
    try {
      const docRef = doc(db, 'videos', video.id);
      const newActive = !video.active;
      await updateDoc(docRef, {
        active: newActive,
        updatedAt: serverTimestamp()
      });
      
      // Update local state instantly
      setSelectedCreatorVideos(prev => 
        prev.map(v => v.id === video.id ? { ...v, active: newActive } : v)
      );

      showNotification('Visibilidade do vídeo atualizada.', 'success');
    } catch (err) {
      console.error('Erro ao atualizar visibilidade:', err);
    }
  };

  // Delete a video quickly
  const deleteVideoQuickly = async (videoId: string) => {
    if (!window.confirm('Excluir este vídeo definitivamente?')) return;

    try {
      await deleteDoc(doc(db, 'videos', videoId));
      setSelectedCreatorVideos(prev => prev.filter(v => v.id !== videoId));
      
      // Update creator count locally
      if (selectedCreator) {
        setVideoCounts(prev => ({
          ...prev,
          [selectedCreator.id]: Math.max(0, (prev[selectedCreator.id] || 1) - 1)
        }));
      }

      showNotification('Vídeo excluído com sucesso.', 'success');
    } catch (err) {
      console.error('Erro ao excluir:', err);
    }
  };

  const showNotification = (msg: string, type: 'success' | 'error') => {
    if (type === 'success') {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  if (authLoading || loadingCreators) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-red-600" />
          <span className="text-sm font-semibold text-slate-500">A carregar Criadores de Conteúdo...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 sm:p-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
            <Users size={28} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-brand font-black text-slate-950 leading-none">
              Gestão de Criadores de Conteúdo
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
              Promova parceiros, bloqueie acessos e acompanhe os vídeos publicados por criadores.
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 animate-fade-in">
          <XCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Quick Promotion Box */}
      <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-xs relative">
        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-3">
          Promover Utilizador a Criador de Conteúdo
        </h2>
        
        <div className="relative max-w-md">
          <div className="flex items-center gap-3 border border-slate-200 rounded-2xl px-4 py-3.5 focus-within:border-red-500 transition-colors">
            <Search size={18} className="text-slate-400" />
            <input
              type="text"
              placeholder="Pesquise por nome ou email para promover..."
              value={allUsersSearchTerm}
              onChange={(e) => handleSearchUsers(e.target.value)}
              className="w-full bg-transparent border-none text-sm outline-none font-semibold text-slate-800"
            />
          </div>

          {/* Autocomplete Dropdown */}
          {showSearchDropdown && (
            <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden max-h-64 overflow-y-auto">
              {searchingUsers ? (
                <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>A procurar...</span>
                </div>
              ) : foundUsers.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Nenhum utilizador comum encontrado.
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {foundUsers.map(user => (
                    <div 
                      key={user.id} 
                      className="p-3 hover:bg-slate-50 flex items-center justify-between gap-4 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">{user.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                      </div>
                      <button
                        onClick={() => promoteToCreator(user)}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-150 text-red-700 text-xs font-bold rounded-lg border border-red-200 transition-colors cursor-pointer"
                      >
                        Promover
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content Creators Table / List */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
            Criadores Ativos na Plataforma ({creators.length})
          </h2>
        </div>

        {creators.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Sparkles size={40} className="mx-auto text-slate-300 animate-pulse" />
            <p className="text-sm font-black uppercase tracking-wider">Nenhum criador registado</p>
            <p className="text-xs font-medium text-slate-450">Use a caixa acima para transformar um utilizador em Criador de Conteúdo.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-extrabold text-[10px] uppercase tracking-wider">
                  <th className="py-4 px-6">Nome / Criador</th>
                  <th className="py-4 px-6">Email</th>
                  <th className="py-4 px-6 text-center">Vídeos Publicados</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {creators.map((creator) => {
                  const isBlocked = creator.blocked === true;
                  const count = videoCounts[creator.id] || 0;
                  
                  return (
                    <tr key={creator.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-red-50 text-red-600 rounded-full flex items-center justify-center font-bold text-sm">
                            {(creator.name || 'C').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-brand font-black text-slate-900 text-sm">
                              {creator.name}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">
                              {creator.country || 'Sem país definido'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-xs sm:text-sm font-semibold text-slate-600">
                        {creator.email}
                      </td>

                      <td className="py-4 px-6 text-center font-black text-slate-800">
                        <button 
                          onClick={() => viewCreatorVideos(creator)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-all cursor-pointer"
                        >
                          <Film size={12} className="text-red-600" />
                          <span>{count} {count === 1 ? 'vídeo' : 'vídeos'}</span>
                        </button>
                      </td>

                      <td className="py-4 px-6 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          isBlocked 
                            ? 'bg-red-50 text-red-700 border-red-200' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {isBlocked ? (
                            <>
                              <XCircle size={10} />
                              <span>Bloqueado</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={10} />
                              <span>Ativo</span>
                            </>
                          )}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => viewCreatorVideos(creator)}
                            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-all cursor-pointer"
                            title="Ver Vídeos do Criador"
                          >
                            <Eye size={14} />
                          </button>
                          
                          {isBlocked ? (
                            <button
                              onClick={() => toggleBlockCreator(creator, false)}
                              className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200 transition-all cursor-pointer"
                              title="Reativar Criador"
                            >
                              <UserCheck size={14} />
                            </button>
                          ) : (
                            <button
                              onClick={() => toggleBlockCreator(creator, true)}
                              className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl border border-amber-200 transition-all cursor-pointer"
                              title="Bloquear Criador"
                            >
                              <UserX size={14} />
                            </button>
                          )}

                          <button
                            onClick={() => removeCreatorRole(creator)}
                            className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl border border-red-200 transition-all cursor-pointer"
                            title="Remover Role de Criador"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Creator Videos Drawer/Modal */}
      {selectedCreator && (
        <div className="fixed inset-0 z-50 overflow-y-auto" id="creator-videos-drawer">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={() => setSelectedCreator(null)} />

          <div className="flex min-h-full items-center justify-end p-0 sm:p-4">
            <div className="relative bg-white w-full max-w-2xl h-screen sm:h-[90vh] sm:rounded-3xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
              
              {/* Header */}
              <div className="bg-slate-50 border-b border-slate-100 px-6 py-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <Film size={20} className="text-red-600" />
                  <div>
                    <h2 className="text-base sm:text-lg font-brand font-black text-slate-900 leading-none">
                      Vídeos de {selectedCreator.name}
                    </h2>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 mt-1 uppercase">
                      {selectedCreator.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCreator(null)}
                  className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-xl transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Videos List Container */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loadingCreatorVideos ? (
                  <div className="py-12 text-center flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-red-600" />
                    <span className="text-xs font-semibold text-slate-500">A obter vídeos...</span>
                  </div>
                ) : selectedCreatorVideos.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 space-y-2">
                    <Film size={32} className="mx-auto text-slate-300" />
                    <p className="text-sm font-black uppercase tracking-wider">Sem vídeos publicados</p>
                    <p className="text-xs font-medium text-slate-450">Este criador ainda não enviou nenhum vídeo para a plataforma.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedCreatorVideos.map((video) => (
                      <div 
                        key={video.id} 
                        className="flex flex-col sm:flex-row gap-4 p-4 border border-slate-150 rounded-2xl hover:bg-slate-50/50 transition-all"
                      >
                        <div className="relative w-full sm:w-36 aspect-video rounded-lg overflow-hidden border border-slate-200 shrink-0">
                          <img 
                            src={video.thumbnailUrl} 
                            alt={video.title} 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <a 
                            href={video.youtubeUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="absolute inset-0 bg-black/30 hover:bg-black/50 flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity"
                          >
                            <Play size={18} />
                          </a>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2">
                          <div>
                            <span className="inline-block bg-slate-100 text-slate-600 text-[9px] font-black uppercase px-2 py-0.5 rounded mb-1">
                              {video.category}
                            </span>
                            <h4 className="font-brand font-black text-slate-950 text-xs sm:text-sm line-clamp-2 leading-snug">
                              {video.title}
                            </h4>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            {/* Toggle Visibilidade */}
                            <button
                              onClick={() => toggleVideoActive(video)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                                video.active 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : 'bg-red-50 text-red-700 border-red-200'
                              }`}
                            >
                              {video.active ? (
                                <>
                                  <CheckCircle2 size={10} />
                                  <span>Ativo</span>
                                </>
                              ) : (
                                <>
                                  <XCircle size={10} />
                                  <span>Inativo</span>
                                </>
                              )}
                            </button>

                            {/* Excluir Vídeo */}
                            <button
                              onClick={() => deleteVideoQuickly(video.id)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 hover:text-red-700 cursor-pointer"
                            >
                              <Trash2 size={12} />
                              <span>Excluir</span>
                            </button>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
