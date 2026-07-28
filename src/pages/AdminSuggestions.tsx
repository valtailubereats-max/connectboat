import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs, doc, updateDoc, deleteDoc, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Calendar, Mail, User, CheckCircle2, 
  Archive, AlertCircle, RefreshCw, Trash2, Filter, Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Suggestion {
  id: string;
  name: string;
  email: string;
  message: string;
  status: 'new' | 'reviewed' | 'archived';
  createdAt: any;
}

const AdminSuggestions = () => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'reviewed' | 'archived'>('all');
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [updateLoadingId, setUpdateLoadingId] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'suggestions'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Suggestion));
      setSuggestions(data);
    } catch (error) {
      console.error('Erro ao buscar sugestões:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: 'new' | 'reviewed' | 'archived') => {
    setUpdateLoadingId(id);
    try {
      const docRef = doc(db, 'suggestions', id);
      await updateDoc(docRef, { status: newStatus });
      
      // Update local state smoothly
      setSuggestions(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
      if (selectedSuggestion?.id === id) {
        setSelectedSuggestion(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    } finally {
      setUpdateLoadingId(null);
    }
  };

  const handleDeleteSuggestion = async (id: string) => {
    if (!window.confirm('Tem a certeza de que deseja excluir permanentemente esta sugestão?')) {
      return;
    }
    try {
      const docRef = doc(db, 'suggestions', id);
      await deleteDoc(docRef);
      setSuggestions(prev => prev.filter(item => item.id !== id));
      if (selectedSuggestion?.id === id) {
        setSelectedSuggestion(null);
      }
    } catch (error) {
      console.error('Erro ao excluir sugestão:', error);
    }
  };

  const filteredSuggestions = suggestions.filter(item => {
    if (activeTab === 'all') return true;
    return item.status === activeTab;
  });

  const getStatusBadge = (status: 'new' | 'reviewed' | 'archived') => {
    switch (status) {
      case 'new':
        return (
          <span className="bg-amber-50 text-amber-700 text-[10px] font-black px-2.5 py-1 rounded-full border border-amber-200 uppercase tracking-wider">
            Nova
          </span>
        );
      case 'reviewed':
        return (
          <span className="bg-[#e8f7ee] text-pt-green text-[10px] font-black px-2.5 py-1 rounded-full border border-[#bfead0] uppercase tracking-wider">
            Revisada
          </span>
        );
      case 'archived':
        return (
          <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-2.5 py-1 rounded-full border border-slate-200 uppercase tracking-wider">
            Arquivada
          </span>
        );
      default:
        return null;
    }
  };

  const formatSuggestionDate = (timestamp: any) => {
    if (!timestamp) return 'Sem data';
    try {
      const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
      return format(date, "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: pt });
    } catch (e) {
      return 'Data inválida';
    }
  };

  return (
    <div className="space-y-8" id="admin-suggestions-panel">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            💡 Caixa de Sugestões
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
            Espaço de ideias enviadas pela comunidade de utilizadores
          </p>
        </div>
        <button
          onClick={fetchSuggestions}
          disabled={loading}
          className="flex items-center gap-2 bg-indigo-550 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-indigo-600 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar Tabela
        </button>
      </div>

      {/* Tabs list */}
      <div className="flex gap-2 overflow-x-auto pb-1" id="suggestions-tabs">
        {(['all', 'new', 'reviewed', 'archived'] as const).map(tab => {
          const count = tab === 'all' 
            ? suggestions.length 
            : suggestions.filter(s => s.status === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === tab
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {tab === 'all' ? 'Tudo' : tab === 'new' ? 'Novas' : tab === 'reviewed' ? 'Revisadas' : 'Arquivadas'}
              <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[10px] ${
                activeTab === tab ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-sm font-bold text-slate-500 tracking-tight">A carregar sugestões...</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-8">
          {/* List of Suggestions */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden" id="suggestions-list-table">
              <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <Filter size={16} className="text-slate-400" />
                  Resultados ({filteredSuggestions.length})
                </h3>
              </div>

              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {filteredSuggestions.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-sm font-medium">
                    Nenhuma sugestão encontrada nesta categoria.
                  </div>
                ) : (
                  filteredSuggestions.map(item => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedSuggestion(item)}
                      className={`p-6 hover:bg-indigo-50/20 transition-all cursor-pointer flex gap-4 ${
                        selectedSuggestion?.id === item.id ? 'bg-indigo-50/35 border-l-4 border-indigo-600' : ''
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-150 flex items-center justify-center shrink-0 font-black text-slate-700 bg-slate-100">
                        {item.name[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-start gap-2 mb-1.5">
                          <div>
                            <p className="font-extrabold text-slate-900 truncate text-[14px]">{item.name}</p>
                            <p className="text-xs text-slate-400 font-semibold truncate leading-none mt-0.5">{item.email}</p>
                          </div>
                          {getStatusBadge(item.status)}
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">
                          {item.message}
                        </p>
                        <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {formatSuggestionDate(item.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Details / Actions side panel */}
          <div className="lg:col-span-5">
            <AnimatePresence mode="wait">
              {selectedSuggestion ? (
                <motion.div
                  key={selectedSuggestion.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-xl space-y-6"
                  id="suggestion-details-card"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-black text-slate-900 text-[18px]">Detalhes da Sugestão</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        ID: {selectedSuggestion.id}
                      </p>
                    </div>
                    {getStatusBadge(selectedSuggestion.status)}
                  </div>

                  {/* sender metadata */}
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                      <User size={14} className="text-slate-400 shrink-0" />
                      <span className="font-bold text-slate-900 truncate">{selectedSuggestion.name}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                      <Mail size={14} className="text-slate-400 shrink-0" />
                      <a href={`mailto:${selectedSuggestion.email}`} className="text-indigo-600 hover:underline truncate">
                        {selectedSuggestion.email}
                      </a>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
                      <Calendar size={14} className="text-slate-400 shrink-0" />
                      <span className="text-slate-400">{formatSuggestionDate(selectedSuggestion.createdAt)}</span>
                    </div>
                  </div>

                  {/* Suggestion body */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">As suas Ideias / Sugestões</h4>
                    <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-5 rounded-2xl border border-slate-100 whitespace-pre-line font-medium min-h-[140px]">
                      {selectedSuggestion.message}
                    </p>
                  </div>

                  {/* Admin actions */}
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Definir Estado</h4>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleUpdateStatus(selectedSuggestion.id, 'new')}
                        disabled={updateLoadingId !== null}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer border ${
                          selectedSuggestion.status === 'new'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-100'
                            : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        Nova
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(selectedSuggestion.id, 'reviewed')}
                        disabled={updateLoadingId !== null}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer border ${
                          selectedSuggestion.status === 'reviewed'
                            ? 'bg-pt-green text-white border-pt-green shadow-md shadow-emerald-50'
                            : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        Revisada
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(selectedSuggestion.id, 'archived')}
                        disabled={updateLoadingId !== null}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer border ${
                          selectedSuggestion.status === 'archived'
                            ? 'bg-slate-500 text-white border-slate-500 shadow-md shadow-slate-100'
                            : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        Arquivar
                      </button>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleDeleteSuggestion(selectedSuggestion.id)}
                        className="w-full flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-3 pr-4 rounded-xl text-xs transition-all border border-rose-100 cursor-pointer uppercase tracking-wider"
                      >
                        <Trash2 size={14} /> Excluir permanentemente
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="bg-slate-50 rounded-3xl p-10 border border-slate-100 text-center text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
                    <Eye size={20} />
                  </div>
                  <h3 className="font-extrabold text-slate-700 text-sm mb-1">Dica de Administração</h3>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                    Selecione uma sugestão ao lado para ver todos os detalhes e alterar o seu estado de análise.
                  </p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSuggestions;
