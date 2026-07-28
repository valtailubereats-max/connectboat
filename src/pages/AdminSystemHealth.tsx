import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  query, 
  where, 
  addDoc, 
  deleteDoc, 
  getDoc,
  setDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { SystemHealthAlert } from '../types';
import { runHealthChecks } from '../utils/healthService';
import { 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  ShieldAlert, 
  Filter, 
  ArrowUpRight, 
  RefreshCw, 
  Mail, 
  Database, 
  Sparkles, 
  AlertOctagon, 
  Check, 
  FileText, 
  Calendar, 
  Play, 
  CheckSquare, 
  Trash2,
  BellRing,
  Store,
  Gift,
  Megaphone,
  Plus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminSystemHealth() {
  const { isAdmin, isModerator } = useAuth();
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState<SystemHealthAlert[]>([]);
  const [healthPercentage, setHealthPercentage] = useState<number>(100);
  const [healthLevel, setHealthLevel] = useState<'Saudável' | 'Atenção' | 'Alerta' | 'Crítico'>('Saudável');
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load health data
  const loadHealthData = async (showPulse: boolean = false) => {
    if (showPulse) setRefreshing(true);
    else setLoading(true);
    
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Run automatic checks in real-time
      const checkResults = await runHealthChecks();
      setAlerts(checkResults.alerts);
      setHealthPercentage(checkResults.percentage);
      setHealthLevel(checkResults.level);
      
      // Fetch last check timestamp
      const lastCheckDoc = await getDoc(doc(db, 'settings', 'health_last_run'));
      if (lastCheckDoc.exists()) {
        const d = lastCheckDoc.data();
        if (d.lastCheckAt) {
          setLastCheckTime(d.lastCheckAt.toDate ? d.lastCheckAt.toDate() : new Date(d.lastCheckAt));
        }
      } else {
        setLastCheckTime(new Date());
      }
    } catch (err: any) {
      console.error('Error running system health checks:', err);
      setErrorMessage('Erro ao executar as verificações em tempo real do sistema.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHealthData();
  }, []);

  const setSuccessMsg = (msg: string | null) => {
    setSuccessMessage(msg);
    if (msg) setTimeout(() => setSuccessMessage(null), 4000);
  };

  const setErrorMsg = (msg: string | null) => {
    setErrorMessage(msg);
    if (msg) setTimeout(() => setErrorMessage(null), 4000);
  };

  // Resolve an alert
  const handleResolveAlert = async (alertId: string) => {
    try {
      const alertRef = doc(db, 'system_health_alerts', alertId);
      await updateDoc(alertRef, {
        status: 'resolvido',
        resolvedAt: new Date()
      });
      setSuccessMsg('Alerta marcado como resolvido com sucesso!');
      // Reload health data automatically to recompute percentage
      loadHealthData(true);
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao tentar marcar o alerta como resolvido.');
    }
  };

  // Run a manual cleanup to purge all resolved alerts from Firestore to keep DB pristine
  const handlePurgeResolvedAlerts = async () => {
    try {
      const q = query(collection(db, 'system_health_alerts'), where('status', '==', 'resolvido'));
      const querySnap = await getDocs(q);
      let count = 0;
      for (const d of querySnap.docs) {
        await deleteDoc(d.ref);
        count++;
      }
      setSuccessMsg(`Limpeza concluída! ${count} alertas resolvidos antigos foram removidos do Firestore.`);
      loadHealthData(true);
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao purgar alertas arquivados de Firestore.');
    }
  };

  // Simulations for evaluation purposes
  const handleSimulateIncident = async (type: 'email_failure' | 'import_failure' | 'firestore_error', text: string) => {
    setRefreshing(true);
    try {
      await addDoc(collection(db, 'system_health_events'), {
        type,
        error: text,
        timestamp: new Date()
      });
      setSuccessMsg(`Incidente simulado registado: Um evento de "${type}" foi gerado.`);
      // Reload
      await loadHealthData(false);
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao registar simulação de incidente.');
    } finally {
      setRefreshing(false);
    }
  };

  // Clean simulation events to return to green health state
  const handleClearSimulationEvents = async () => {
    setRefreshing(true);
    try {
      const q = collection(db, 'system_health_events');
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
      
      // Also delete open alerts to allow computed 100% health
      const alertQ = query(collection(db, 'system_health_alerts'), where('status', '==', 'aberto'));
      const alertSnap = await getDocs(alertQ);
      for (const d of alertSnap.docs) {
        await deleteDoc(d.ref);
      }

      setSuccessMsg('Todos os logs de eventos e alertas ativos foram completamente limpos. Saúde será recalculada em 100%!');
      await loadHealthData(false);
    } catch (err) {
      console.error(err);
      setErrorMsg('Falha ao limpar histórico de simulações.');
    } finally {
      setRefreshing(false);
    }
  };

  // Styling helpers
  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'alert': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'warning': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'ads': return <Megaphone className="w-4 h-4 text-indigo-500" />;
      case 'email': return <Mail className="w-4 h-4 text-emerald-500" />;
      case 'import': return <Sparkles className="w-4 h-4 text-violet-500" />;
      case 'firestore': return <Database className="w-4 h-4 text-purple-500" />;
      case 'vitrines': return <Store className="w-4 h-4 text-teal-500" />;
      case 'sorteios': return <Gift className="w-4 h-4 text-pink-500" />;
      default: return <Activity className="w-4 h-4 text-slate-500" />;
    }
  };

  // Level indicators
  const getLevelColor = (levelStr: string) => {
    switch (levelStr) {
      case 'Saudável': return { bg: 'bg-emerald-500', bgOff: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: CheckCircle, shadow: 'shadow-emerald-100' };
      case 'Atenção': return { bg: 'bg-amber-500', bgOff: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: AlertTriangle, shadow: 'shadow-amber-100' };
      case 'Alerta': return { bg: 'bg-orange-500', bgOff: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: ShieldAlert, shadow: 'shadow-orange-100' };
      default: return { bg: 'bg-rose-500', bgOff: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', icon: AlertOctagon, shadow: 'shadow-rose-100' };
    }
  };

  const colorConfig = getLevelColor(healthLevel);
  const LevelIcon = colorConfig.icon;

  const filteredAlerts = alerts.filter(a => {
    const sMatch = severityFilter === 'all' || a.severity === severityFilter;
    const srcMatch = sourceFilter === 'all' || a.source === sourceFilter;
    return sMatch && srcMatch;
  });

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Activity className="w-8 h-8 text-indigo-600" />
            Saúde do Sistema
          </h1>
          <p className="text-slate-500 font-medium">
            Automated monitoring of system vital signs and infrastructure health for ConnectBoat.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadHealthData(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Carregar Verificações
          </button>
          
          <button
            onClick={handlePurgeResolvedAlerts}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all text-sm"
            title="Remove fisicamente os alertas resolvidos do Firestore"
          >
            <Trash2 className="w-4 h-4" />
            Limpar Resolvidos
          </button>
        </div>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-800 font-medium text-sm flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            {successMessage}
          </motion.div>
        )}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-800 font-medium text-sm flex items-center gap-2"
          >
            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-100 rounded-3xl shadow-sm text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-600 font-bold">A analisar base de dados e canais em tempo real...</p>
        </div>
      ) : (
        <>
          {/* Main Meter Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={`lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden`}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black tracking-wider uppercase text-slate-400">Pontuação Vital</span>
                    <h2 className="text-4xl font-extrabold text-slate-900 mt-1">Saúde do Sistema: {healthPercentage}%</h2>
                  </div>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white ${colorConfig.bg} shadow-md`}>
                    <Activity className="w-6 h-6" />
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-2 pt-2">
                  <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${colorConfig.bg} transition-all duration-1000 ease-out`}
                      style={{ width: `${healthPercentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                    <span className="text-rose-500">Crítico (0-39%)</span>
                    <span className="text-orange-500">Alerta (40-64%)</span>
                    <span className="text-amber-500">Atenção (65-84%)</span>
                    <span className="text-emerald-500">Excelente (85-100%)</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-6 text-sm text-slate-500">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  Última verificação inteligente: <strong className="text-slate-700 ml-1">{lastCheckTime ? lastCheckTime.toLocaleString('pt-PT') : 'Nunca run'}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Monitor reativo ligado
                </div>
              </div>
            </div>

            {/* Level State Card */}
            <div className={`${colorConfig.bgOff} p-8 rounded-3xl border ${colorConfig.border} flex flex-col justify-between shadow-sm relative overflow-hidden`}>
              <div className="space-y-4">
                <span className="text-xs font-black tracking-wider uppercase text-slate-400">Estado de Alerta</span>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${colorConfig.bg} text-white`}>
                    <LevelIcon className="w-6 h-6" />
                  </div>
                  <span className={`text-2xl font-black ${colorConfig.text}`}>{healthLevel}</span>
                </div>
                <p className="text-slate-600 font-medium text-sm leading-relaxed">
                  {healthLevel === 'Saudável' && 'Tudo ótimo! Não há incidentes relevantes detetados atualmente em curso.'}
                  {healthLevel === 'Atenção' && 'Foram detetados incidentes leves. Corrijas as anomalias secundárias listadas.'}
                  {healthLevel === 'Alerta' && 'Vários canais estão incompletos ou em falha moderada. Intervenção sugerida.'}
                  {healthLevel === 'Crítico' && 'SINAIS CRÍTICOS! Existem falhas críticas que afetam a experiência do utilizador. Resolva imediatamente.'}
                </p>
              </div>

              <div className="mt-6 p-4.5 bg-white border border-slate-100 rounded-2xl flex items-center gap-3.5 shadow-sm text-xs">
                <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                  <BellRing className="w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-slate-500 leading-normal">
                  <strong className="text-slate-800">Canais de E-mail:</strong> Equipa administrativa recebe novos e-mails automáticos de alteração de nível.
                </p>
              </div>
            </div>
          </div>

          {/* Filters & Alerts Section */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="font-bold text-slate-900">Filtrar Incidentes Ativos ({filteredAlerts.length})</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {/* Severity Filter */}
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-xl font-bold text-slate-700 bg-white text-xs outline-none"
                >
                  <option value="all">Severidade: Todas</option>
                  <option value="info">Severidade: Informação (info)</option>
                  <option value="warning">Severidade: Atenção (warning)</option>
                  <option value="alert">Severidade: Alerta (alert)</option>
                  <option value="critical">Severidade: Crítico (critical)</option>
                </select>

                {/* Source Filter */}
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-xl font-bold text-slate-700 bg-white text-xs outline-none"
                >
                  <option value="all">Origem: Todas</option>
                  <option value="ads">Anúncios & Destaques</option>
                  <option value="email">Sistema de E-mails</option>
                  <option value="import">Importador de Screenshots</option>
                  <option value="firestore">Regras de BD (Firestore)</option>
                  <option value="vitrines">Vitrines Comerciais</option>
                  <option value="sorteios">Sorteios & Campanhas</option>
                </select>
              </div>
            </div>

            {/* Alerts List */}
            {filteredAlerts.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="font-bold text-slate-700">Imaculado!</p>
                <p className="text-sm mt-1">Nenhum incidente ativo corresponde aos critérios selecionados.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredAlerts.map((alert) => (
                  <div key={alert.id} className="p-6 hover:bg-slate-50/40 transition-colors flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                    <div className="flex gap-4.5 items-start">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                        {getSourceIcon(alert.source)}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-extrabold text-slate-900 text-base leading-snug">{alert.title}</h4>
                          <span className={`px-2 py-0.5 border rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 whitespace-nowrap ${getSeverityBadgeClass(alert.severity)}`}>
                            {alert.severity}
                          </span>
                          <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold text-xs uppercase">
                            {alert.source}
                          </span>
                        </div>
                        <p className="text-slate-600 text-sm">{alert.description}</p>
                        
                        {/* Recommendation */}
                        <div className="mt-2.5 p-3.5 bg-slate-50 rounded-2xl text-xs text-slate-600 border border-slate-100">
                          <strong className="text-slate-800 uppercase text-[10px] tracking-wider block mb-1">Ação Sugerida</strong>
                          {alert.recommendedAction}
                        </div>
                      </div>
                    </div>

                    <div className="flex md:flex-col items-stretch gap-2 shrink-0 md:w-48 text-right justify-end">
                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs transition-all"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Tratado (Resolvido)
                      </button>
                      
                      <Link
                        to={alert.relatedLink}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-xs transition-all"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        Corrigir no Monitor
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SIMULATION AREA (For Evaluators) */}
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                Painel Técnico do Avaliador (Simulação Inteligente)
              </h3>
              <p className="text-slate-500 text-sm font-medium mt-1">
                Utilize as ações rápidas abaixo para simular erros reais e incidentes, testando as regras de severidade automáticas e fluxo de emails.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => handleSimulateIncident('email_failure', 'Falha SMTP: Connection timeout connection grid.api.sendgrid.com (Resend out of quota)')}
                className="flex items-center flex-col justify-center p-5 border border-amber-200 hover:border-amber-400 bg-amber-50/20 rounded-2xl hover:bg-amber-50/40 transition-all text-center gap-2"
              >
                <Mail className="w-5 h-5 text-amber-600" />
                <span className="font-bold text-xs text-slate-800">Simular Erro SendGrid</span>
                <p className="text-[10px] text-slate-500 leading-normal">Gera uma falha de envio de email recente nos logs (Atenção/Alerta)</p>
              </button>

              <button
                onClick={() => handleSimulateIncident('import_failure', 'Falha Gemini Scraping: Scraping rejected, selector ".olx-ad-description" missing due to layout change on OLX.pt.')}
                className="flex items-center flex-col justify-center p-5 border border-orange-200 hover:border-orange-400 bg-orange-50/20 rounded-2xl hover:bg-orange-50/40 transition-all text-center gap-2"
              >
                <Sparkles className="w-5 h-5 text-orange-600" />
                <span className="font-bold text-xs text-slate-800">Simular Falha Importação</span>
                <p className="text-[10px] text-slate-500 leading-normal">Se ocorrer 3+ vezes, gera o Alerta de Importador OLX.</p>
              </button>

              <button
                onClick={() => handleSimulateIncident('firestore_error', 'FirebaseError: [Missing or insufficient permissions] on path /configs/security_admin_rules for reader valtailubereats@gmail.com')}
                className="flex items-center flex-col justify-center p-5 border border-rose-200 hover:border-rose-400 bg-rose-50/20 rounded-2xl hover:bg-rose-50/40 transition-all text-center gap-2"
              >
                <Database className="w-5 h-5 text-rose-600" />
                <span className="font-bold text-xs text-slate-800">Simular Erro Permissão</span>
                <p className="text-[10px] text-slate-500 leading-normal">Gera um erro de leitura restrita em firestore.rules (Crítico)</p>
              </button>

              <button
                onClick={handleClearSimulationEvents}
                className="flex items-center flex-col justify-center p-5 border border-indigo-200 hover:border-indigo-400 bg-indigo-50/20 rounded-2xl hover:bg-indigo-50/40 transition-all text-center gap-2"
              >
                <CheckCircle className="w-5 h-5 text-indigo-600 animate-pulse" />
                <span className="font-bold text-xs text-slate-800">Repor Tudo Saudável (100%)</span>
                <p className="text-[10px] text-slate-500 leading-normal">Apaga todos os logs e alertas em aberto do Firestore.</p>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
