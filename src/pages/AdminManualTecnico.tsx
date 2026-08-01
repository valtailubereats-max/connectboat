import React, { useState, useMemo } from 'react';
import { 
  Search, 
  BookOpen, 
  Copy, 
  ExternalLink, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  Database, 
  UserCheck, 
  Cpu, 
  Play, 
  ArrowRight,
  Sparkles,
  Layers,
  Code
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { manualItems, technicalFlows, ManualItem, ManualItemType, TechnicalFlow } from '../data/systemTechnicalManual';

// Simple Alert Toast component state inside the page to prevent needing external toast libraries
interface ToastState {
  message: string;
  type: 'success' | 'info';
  visible: boolean;
}

const AdminManualTecnico: React.FC = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<ManualItemType | 'All'>('All');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'items' | 'flows'>('items');

  // Copy status indicators
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Toast feedback state
  const [toast, setToast] = useState<ToastState>({
    message: '',
    type: 'success',
    visible: false
  });

  const triggerToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type, visible: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 2500);
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    triggerToast(`Copiado: ${label}`);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Pre-defined type filter buttons
  const typesList: (ManualItemType | 'All')[] = [
    'All',
    'Page',
    'Button',
    'Form',
    'Flow',
    'Admin',
    'Firestore',
    'Monetisation',
    'Showcase',
    'Listings'
  ];

  // Search filter logic
  const filteredItems = useMemo(() => {
    return manualItems.filter(item => {
      // Filter by type
      if (selectedType !== 'All' && item.type !== selectedType) {
        return false;
      }

      // Filter by search terms
      if (!searchTerm.trim()) {
        return true;
      }

      const q = searchTerm.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.route.toLowerCase().includes(q) ||
        item.mainFile.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        item.tags.some(t => t.toLowerCase().includes(q)) ||
        item.firestoreCollections.some(c => c.toLowerCase().includes(q)) ||
        item.relatedComponents.some(c => c.toLowerCase().includes(q)) ||
        item.relatedFunctions.some(f => f.toLowerCase().includes(q))
      );
    });
  }, [searchTerm, selectedType]);

  // Search filter logic for flows (when active)
  const filteredFlows = useMemo(() => {
    if (!searchTerm.trim()) {
      return technicalFlows;
    }
    const q = searchTerm.toLowerCase();
    return technicalFlows.filter(flow => 
      flow.title.toLowerCase().includes(q) ||
      flow.description.toLowerCase().includes(q) ||
      flow.startPoint.toLowerCase().includes(q) ||
      flow.expectedResult.toLowerCase().includes(q) ||
      flow.mainFiles.some(f => f.toLowerCase().includes(q)) ||
      flow.firestoreCollections.some(c => c.toLowerCase().includes(q))
    );
  }, [searchTerm]);

  if (authLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Double check authorization
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white rounded-3xl p-8 shadow-xl border border-red-100 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={32} />
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">Acesso Restrito</h1>
        <p className="text-slate-500 mb-6">Esta secção é exclusiva para administradores e programadores do sistema.</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-md cursor-pointer"
        >
          Voltar ao Início
        </button>
      </div>
    );
  }

  const getTypeBadgeColor = (type: ManualItemType) => {
    switch (type) {
      case 'Page': return 'bg-sky-50 text-sky-700 border-sky-100';
      case 'Button': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'Form': return 'bg-violet-50 text-violet-700 border-violet-100';
      case 'Flow': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Admin': return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'Firestore': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'Monetisation': return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'Showcase': return 'bg-pt-green/10 text-emerald-800 border-emerald-100';
      case 'Listings': return 'bg-blue-50 text-blue-700 border-blue-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const canNavigateRoute = (route: string) => {
    return route && route !== 'Todas as rotas (Global)' && route !== 'Interno' && route !== 'Redirecionamento Externo' && route !== 'N/A' && route !== 'N/A (Nível de Segurança)' && !route.includes(':');
  };

  return (
    <div className="space-y-8 select-none relative">
      {/* Visual Floating Toast Notification */}
      {toast.visible && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2 animate-bounce">
          <Sparkles size={16} className="text-amber-400" />
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      )}

      {/* Hero Header Area */}
      <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-10 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute right-0 top-0 w-96 h-96 bg-gradient-to-br from-indigo-600/20 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 w-80 h-80 bg-gradient-to-tr from-emerald-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/10 text-xs font-bold uppercase tracking-widest text-indigo-300">
              <Code size={12} /> Console Técnico do Desenvolvedor
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Manual Técnico do Sistema
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl font-medium leading-relaxed">
              Internal documentation for <strong className="text-sky-450 text-medium">ConnectBoat</strong>. Search routes, codebase paths, Firestore collections, and interactive flow logic.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('items')}
              className={`px-5 py-2.5 rounded-2xl font-extrabold text-sm transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'items'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <Layers size={16} /> Componentes do App
            </button>
            <button
              onClick={() => setActiveTab('flows')}
              className={`px-5 py-2.5 rounded-2xl font-extrabold text-sm transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'flows'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <Cpu size={16} /> Fluxos Críticos
            </button>
          </div>
        </div>
      </div>

      {/* Main Search & Filter Console Panel */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          {/* Main search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar página, botão, função, rota, arquivo ou fluxo..."
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white outline-none rounded-2xl text-slate-950 font-bold transition-all placeholder:text-slate-400 placeholder:font-medium shadow-inner text-sm sm:text-base"
              id="technical-manual-search-bar"
            />
          </div>

          {/* Quick Counter */}
          <div className="px-5 py-4 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-between md:justify-center gap-4">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Resultados:</span>
            <span className="px-3 py-1 bg-indigo-500 text-white rounded-xl font-black text-sm shadow-xs">
              {activeTab === 'items' ? filteredItems.length : filteredFlows.length}
            </span>
          </div>
        </div>

        {/* Filter Badges (Only relevant for page components tab) */}
        {activeTab === 'items' && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mr-2">Filtros:</span>
            {typesList.map((type) => {
              const count = type === 'All' 
                ? manualItems.length 
                : manualItems.filter(i => i.type === type).length;

              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                    selectedType === type
                      ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  {type === 'All' ? 'Todos' : type}
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] ${
                    selectedType === type ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* CONDITIONAL SECTION RENDER */}

      {activeTab === 'items' && (
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-100 p-8 space-y-4">
              <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <Search size={28} />
              </div>
              <p className="text-slate-500 font-bold text-lg">Nenhum registo técnico coincide com a pesquisa.</p>
              <p className="text-slate-400 text-xs">Experimente usar tags mais genéricas como "anúncio", "vitrina" ou "dados".</p>
              <button 
                onClick={() => { setSearchTerm(''); setSelectedType('All'); }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItems.map((item) => {
                const isExpanded = expandedItemId === item.id;
                return (
                  <div 
                    key={item.id}
                    className={`bg-white rounded-[1.75rem] border hover:border-slate-300 transition-all shadow-xs overflow-hidden flex flex-col justify-between ${
                      isExpanded 
                        ? 'col-span-1 md:col-span-2 border-indigo-200 ring-2 ring-indigo-500/10 shadow-lg' 
                        : 'border-slate-100 hover:shadow-md'
                    }`}
                  >
                    {/* Visual Card Header */}
                    <div 
                      className="p-5 flex items-start gap-4 cursor-pointer select-none"
                      onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                    >
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-indigo-500 shrink-0 border border-slate-100">
                        <BookOpen size={24} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border shadow-xs ${getTypeBadgeColor(item.type)}`}>
                            {item.type}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 truncate max-w-[200px]" title={item.mainFile}>
                            📂 {item.mainFile.split('/').pop()}
                          </span>
                        </div>
                        <h3 className="font-extrabold text-slate-900 text-base sm:text-lg leading-tight">
                          {item.title}
                        </h3>
                        <p className="text-slate-500 text-xs line-clamp-2 md:line-clamp-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                      <button className="text-slate-400 hover:text-slate-600 p-1 rounded-xl hover:bg-slate-50">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                    </div>

                    {/* Collapsed view metadata preview bar */}
                    {!isExpanded && (
                      <div className="px-5 py-3.5 bg-slate-50/50 border-t border-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          <span className="font-extrabold shrink-0">Rota:</span>
                          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold truncate max-w-[250px]" title={item.route}>
                            {item.route}
                          </code>
                        </div>
                        <div className="flex gap-2">
                          {item.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-[9px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-400 font-bold">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* EXPANDED DETAILED CONSOLE EXPANSION */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/40 p-6 space-y-6">
                        {/* Summary and Route Navigation Action Box */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col justify-between gap-2.5">
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Caminho da Rota do Frontend</p>
                              <code className="text-xs font-mono font-bold text-slate-800 break-all select-all block mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                {item.route}
                              </code>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleCopyText(item.route, 'Rota')}
                                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 flex items-center gap-1 cursor-pointer flex-1 justify-center"
                              >
                                <Copy size={11} /> Copiar
                              </button>
                              {canNavigateRoute(item.route) && (
                                <Link 
                                  to={item.route}
                                  className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-lg text-[11px] font-bold text-indigo-600 flex items-center gap-1 flex-1 justify-center"
                                >
                                  <ExternalLink size={11} /> Ir para Página
                                </Link>
                              )}
                            </div>
                          </div>

                          <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col justify-between gap-2.5">
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Arquivo de Código Fonte Principal</p>
                              <code className="text-xs font-mono font-bold text-slate-800 break-all select-all block mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                {item.mainFile}
                              </code>
                            </div>
                            <button 
                              onClick={() => handleCopyText(item.mainFile, 'Caminho de Arquivo')}
                              className="w-full px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 flex items-center gap-1.5 cursor-pointer justify-center"
                            >
                              <Copy size={12} /> Copiar Caminho de Código
                            </button>
                          </div>

                          <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-2">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Perfil Autorizado de Acesso</p>
                            <div className="flex items-center gap-2 text-slate-800 font-extrabold text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <UserCheck size={16} className="text-emerald-500" />
                              <span>{item.access}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 block leading-relaxed pt-1">
                              Controlado pelo router do front e as regras de segurança no Firestore.
                            </p>
                          </div>
                        </div>

                        {/* Middle detailed metadata columns */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Code structural details */}
                          <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5 border-b pb-2">
                              <Code size={14} className="text-slate-550" /> Detalhes Estruturais do Código
                            </h4>

                            <div className="space-y-3.5">
                              <div>
                                <span className="text-xs text-slate-500 font-black block mb-1">Componentes Relacionados:</span>
                                {item.relatedComponents.length === 0 ? <span className="text-xs text-slate-400 font-medium italic">Nenhum componente secundário.</span> : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {item.relatedComponents.map(comp => (
                                      <code 
                                        key={comp} 
                                        className="text-[10px] bg-white border border-slate-200/60 text-slate-700 px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-indigo-50 transition-colors"
                                        onClick={() => handleCopyText(comp, 'Componente')}
                                      >
                                        {comp.split('/').pop()}
                                      </code>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div>
                                <span className="text-xs text-slate-500 font-black block mb-1">Funções Importantes Relacionadas:</span>
                                {item.relatedFunctions.length === 0 ? <span className="text-xs text-slate-400 font-medium italic">Nenhuma lógica isolada relevante.</span> : (
                                  <div className="flex flex-wrap gap-1.15">
                                    {item.relatedFunctions.map(fn => (
                                      <code key={fn} className="text-[10px] bg-slate-900 text-amber-300 font-mono font-bold px-2 py-0.5 rounded shadow-inner">
                                        {fn}()
                                      </code>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div>
                                <span className="text-xs text-slate-500 font-black block mb-1">Dicionário de Botões e CTAs:</span>
                                <div className="flex flex-wrap gap-1 text-[11px] font-semibold text-slate-600">
                                  {item.buttons.map(btn => (
                                    <span key={btn} className="px-2 py-1 bg-white border border-slate-150 rounded-lg text-slate-700 font-bold shadow-2xs">
                                      🔘 {btn}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <span className="text-xs text-slate-500 font-black block mb-2">Ações Disparadas por este Registo:</span>
                                <ul className="list-disc pl-4 text-xs text-slate-600 font-medium space-y-1">
                                  {item.actions.map((act, index) => (
                                    <li key={index}>{act}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>

                          {/* Database and Operations details */}
                          <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5 border-b pb-2">
                              <Database size={14} className="text-slate-550" /> Persistência de Dados & Monitorização
                            </h4>

                            <div className="space-y-3.5">
                              <div>
                                <span className="text-xs text-slate-500 font-black block mb-1.5">Coleções Firestore Relacionadas:</span>
                                <div className="flex flex-wrap gap-2">
                                  {item.firestoreCollections.map(col => (
                                    <div key={col} className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-xl text-xs font-black shadow-xs">
                                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                      <span>{col}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-150 space-y-1.5">
                                <span className="text-xs text-amber-800 font-black flex items-center gap-1.5">
                                  <AlertTriangle size={14} className="text-amber-600 shrink-0" /> Possíveis Pontos de Falha
                                </span>
                                <ul className="pl-4 list-disc text-[11px] text-amber-900/80 font-semibold space-y-1">
                                  {item.failurePoints.map((pt, i) => (
                                    <li key={i}>{pt}</li>
                                  ))}
                                </ul>
                              </div>

                              <div className="p-3.5 bg-slate-900 text-white rounded-2xl space-y-1 shadow-sm">
                                <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider block">Observações Técnicas Complementares:</span>
                                <p className="text-[11px] text-slate-305 leading-relaxed font-semibold">
                                  {item.technicalNotes}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* bottom action bars */}
                        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-xs font-bold text-slate-400">Tags de Pesquisa:</span>
                            {item.tags.map(tag => (
                              <span 
                                key={tag} 
                                onClick={() => setSearchTerm(tag)}
                                className="text-[10px] text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-100/60 px-2 py-0.5 rounded-md font-bold cursor-pointer transition"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>

                          <button
                            onClick={() => {
                              const details = `Título: ${item.title}\nTipo: ${item.type}\nRota: ${item.route}\nArquivo principal: ${item.mainFile}\nColeções Firestore: ${item.firestoreCollections.join(', ')}\nDetalhes técnicos:\n - ${item.technicalNotes}`;
                              handleCopyText(details, 'Detalhes Técnicos');
                            }}
                            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Copy size={12} /> Copiar Todos os Detalhes Técnicos
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* FLUXOS CRITICOS TAB SECTION */}

      {activeTab === 'flows' && (
        <div className="space-y-6">
          <div className="p-4 sm:p-6 bg-indigo-50 border border-indigo-150 rounded-3xl flex items-start gap-4">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow">
              <Cpu size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-indigo-950">Seção Especial: Fluxos de Processo Críticos</h2>
              <p className="text-xs text-indigo-700/80 font-bold mt-1 max-w-3xl leading-relaxed">
                Detailed end-to-end transaction flows for ConnectBoat. Review pages, code files, affected collections, and expected results.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {filteredFlows.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 p-8">
                <p className="text-slate-500 font-bold">Nenhum fluxo encontrado para a palavra-chave "{searchTerm}".</p>
              </div>
            ) : (
              filteredFlows.map((flow) => (
                <div key={flow.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-xs hover:shadow-md transition-all overflow-hidden p-6 sm:p-8 space-y-6">
                  {/* Flow Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-indigo-100/60 text-indigo-800 text-[10px] font-black rounded uppercase tracking-wider">
                          Fluxo Estruturado
                        </span>
                      </div>
                      <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
                        <Play size={18} className="text-emerald-500 fill-emerald-500 shrink-0" />
                        {flow.title}
                      </h3>
                    </div>
                    <div className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-xs text-slate-700 font-bold shrink-0">
                      Início em: <span className="text-indigo-600 font-black">{flow.startPoint}</span>
                    </div>
                  </div>

                  {/* Flow Body Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                    {/* Details Column (7cols) */}
                    <div className="md:col-span-8 flex flex-col justify-between space-y-4">
                      <div>
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Descrição Comercial</span>
                        <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                          {flow.description}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        <div>
                          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Páginas Envolvidas</span>
                          <div className="flex flex-wrap gap-1.5">
                            {flow.pagesInvolved.map(page => (
                              <span key={page} className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold shadow-2xs">
                                📄 {page}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Coleções Firestore Envolvidas</span>
                          <div className="flex flex-wrap gap-1.5">
                            {flow.firestoreCollections.map(col => (
                              <span key={col} className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold rounded-lg shadow-2xs">
                                🗄️ {col}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Main file list copies */}
                      <div>
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1.5">Controladores e Arquivos Principais</span>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {flow.mainFiles.map(file => (
                            <code 
                              key={file} 
                              className="bg-white border border-slate-200/60 hover:bg-indigo-50/50 hover:border-indigo-200 p-2 rounded-xl text-slate-700 font-mono font-bold flex items-center justify-between gap-3 cursor-pointer shrink-0 transition"
                              title="Copiar caminho"
                              onClick={() => handleCopyText(file, 'Caminho do arquivo')}
                            >
                              <span>📂 {file}</span>
                              <Copy size={11} className="text-slate-400" />
                            </code>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Step-by-Step Expected Result flow box (4cols) */}
                    <div className="md:col-span-4 bg-slate-900 rounded-2xl p-5 text-white flex flex-col justify-between shadow-inner border border-slate-850">
                      <div>
                        <div className="flex items-center gap-1.5 border-b border-indigo-500/20 pb-2 mb-3">
                          <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider">Entregável Esperado</span>
                        </div>
                        <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                          {flow.expectedResult}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-indigo-500/10 space-y-2">
                        <span className="text-[10px] text-slate-400 font-medium uppercase mt-2 block">Botões Relacionados</span>
                        <div className="flex flex-wrap gap-1">
                          {flow.buttonsInvolved.map(btn => (
                            <span key={btn} className="bg-white/10 border border-white/5 text-white text-[10px] font-black px-2 py-0.5 rounded-lg">
                              {btn}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManualTecnico;
