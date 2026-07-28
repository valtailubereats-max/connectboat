import React, { useState } from 'react';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Database, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Play, 
  Check, 
  Loader2,
  HelpCircle
} from 'lucide-react';

export const AdminMigrationWidget = () => {
  const [totalAds, setTotalAds] = useState<number | null>(null);
  const [missingCountryCount, setMissingCountryCount] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [updatedCount, setUpdatedCount] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setErrorMessage(null);
    setUpdatedCount(null);
    setShowConfirm(false);
    setLogs([]);
    addLog('A iniciar análise da base de dados de anúncios...');

    try {
      const adsSnap = await getDocs(collection(db, 'ads'));
      addLog(`Encontrados no total ${adsSnap.size} anúncios no Firestore.`);
      
      let blankCount = 0;
      adsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.country) {
          blankCount++;
        }
      });

      setTotalAds(adsSnap.size);
      setMissingCountryCount(blankCount);
      addLog(`Análise concluída: ${blankCount} anúncios não possuem o campo "country".`);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(`Erro ao analisar anúncios: ${err.message || err}`);
      addLog(`ERRO: ${err.message || err}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleMigrate = async () => {
    if (missingCountryCount === null || missingCountryCount === 0) return;
    setMigrating(true);
    setErrorMessage(null);
    addLog('A iniciar processo de migração para o país "Portugal"...');

    try {
      const adsSnap = await getDocs(collection(db, 'ads'));
      const oldAdsToMigrate: string[] = [];

      adsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.country) {
          oldAdsToMigrate.push(docSnap.id);
        }
      });

      addLog(`Confirmados ${oldAdsToMigrate.length} anúncios sem país para migrar.`);
      
      let batch = writeBatch(db);
      let countInBatch = 0;
      let totalUpdated = 0;
      const CHUNK_SIZE = 40; // Safely below Firestore's 500 write limit

      for (const adId of oldAdsToMigrate) {
        const adRef = doc(db, 'ads', adId);
        batch.update(adRef, { country: 'Portugal' });
        countInBatch++;
        totalUpdated++;

        if (countInBatch === CHUNK_SIZE) {
          addLog(`A enviar lote de ${countInBatch} atualizações para o Firestore...`);
          await batch.commit();
          addLog(`Lote de ${countInBatch} enviado com sucesso! Progresso: ${totalUpdated}/${oldAdsToMigrate.length}`);
          batch = writeBatch(db);
          countInBatch = 0;
        }
      }

      // Commit remaining updates in last batch
      if (countInBatch > 0) {
        addLog(`A enviar lote final de ${countInBatch} atualizações...`);
        await batch.commit();
        addLog(`Lote final enviado com sucesso!`);
      }

      setUpdatedCount(totalUpdated);
      setMissingCountryCount(0);
      setShowConfirm(false);
      addLog(`Migração finalizada! Total de ${totalUpdated} anúncios preenchidos com "Portugal".`);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(`Erro durante a migração: ${err.message || err}`);
      addLog(`ERRO DE MIGRAÇÃO: ${err.message || err}`);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
          <Database size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Migração de Dados (Manutenção)</h2>
          <p className="text-xs text-slate-500 font-medium">Rotina administrativa para preencher anúncios legados sem o campo "país" como "Portugal".</p>
        </div>
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
        <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
        <div className="space-y-1 text-xs text-amber-800 font-medium leading-relaxed">
          <p className="font-extrabold text-amber-900">Informação Importante antes de Otimizar a Home por País:</p>
          <p>Para otimizar as consultas e buscas filtrando diretamente pelo país ativo no Firestore, todos os anúncios antigos devem possuir o atributo <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">country</code>. Esta rotina identifica os anúncios criados antes do lançamento multi-países e preenche com <code className="bg-amber-100 px-1 py-0.5 font-bold rounded">"Portugal"</code> com segurança.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={analyzing || migrating}
          className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-all flex items-center gap-2"
        >
          {analyzing ? (
            <Loader2 className="animate-spin text-slate-500" size={16} />
          ) : (
            <RefreshCw size={16} />
          )}
          {analyzing ? 'Analyzing...' : 'Analyze Listings Without Country'}
        </button>

        {missingCountryCount !== null && missingCountryCount > 0 && (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={migrating || analyzing}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
          >
            <Play size={16} />
            Start Migration
          </button>
        )}
      </div>

      {missingCountryCount !== null && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
            <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Total Listings Analyzed</p>
            <p className="text-2xl font-black text-slate-800">{totalAds}</p>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl relative overflow-hidden">
            <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Missing Country (Legacy)</p>
            <div className="flex items-center gap-2 mt-1">
              <p className={`text-2xl font-black ${missingCountryCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                {missingCountryCount}
              </p>
              {missingCountryCount > 0 ? (
                <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">Pendente</span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold flex items-center gap-1">
                  <Check size={10} /> Ok
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="p-5 bg-rose-50 border border-rose-200 rounded-xl space-y-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <HelpCircle className="text-rose-500 shrink-0 mt-0.5" size={20} />
            <div className="space-y-1">
              <h4 className="text-sm font-black text-rose-900">Tem certeza que deseja aplicar a migração automática?</h4>
              <p className="text-xs text-rose-700 font-medium">Os {missingCountryCount} anúncios listados acima receberão de forma definitiva o país <code className="bg-rose-100 px-1 py-0.5 rounded font-mono font-bold">"Portugal"</code>. Esta operação é segura, protege anúncios criados anteriormente e NÃO remove nenhum dado.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pl-8">
            <button
              type="button"
              onClick={handleMigrate}
              disabled={migrating}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
            >
              {migrating ? (
                <Loader2 className="animate-spin" size={14} />
              ) : (
                <Check size={14} />
              )}
              {migrating ? 'A migrar...' : 'Confirmar e Migrar'}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              disabled={migrating}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {updatedCount !== null && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 font-bold text-sm shadow-sm animate-fade-in">
          <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
          <span>Sucesso! Foram atualizados no total {updatedCount} anúncios com o país "Portugal".</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl font-bold text-sm shadow-sm">
          {errorMessage}
        </div>
      )}

      {logs.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Histórico de execução</p>
          <div className="p-4 bg-slate-900 text-slate-300 text-[11px] font-mono rounded-xl max-h-48 overflow-y-auto space-y-1 border border-slate-800">
            {logs.map((log, i) => (
              <div key={`log-line-${i}`} className="truncate">{log}</div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
