import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, getDocWithCacheFallback } from '../firebase';
import { MarketplaceSettings, CATEGORIES } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  Save, 
  Plus, 
  X as CloseIcon,
  Clock,
  Image as ImageIcon,
  AlertTriangle,
  Tag,
  CheckCircle2,
  AlertCircle,
  Mail,
  Send
} from 'lucide-react';
import { sendEmailGeneric } from '../utils/emailService';
import { AdminMigrationWidget } from '../components/AdminMigrationWidget';

interface AdminSettingsProps {
  onClose?: () => void;
}

const AdminSettings = ({ onClose }: AdminSettingsProps) => {
  const [settings, setSettings] = useState<MarketplaceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Email Configuration and Interactive Testing state
  const [emailsEnabled, setEmailsEnabled] = useState(() => {
    return localStorage.getItem('emails_enabled') !== 'false';
  });
  const [testTemplate, setTestTemplate] = useState('anuncio_aprovado');
  const [testTo, setTestTo] = useState('utilizador_teste@dominio.com');
  const [testName, setTestName] = useState('Rita Santos');
  const [testTitle, setTestTitle] = useState('Sofá de Pele Confortável - Excelentes Condições');
  const [testReason, setTestReason] = useState('O preço apresentado deve corresponder ao valor real do produto.');
  const [testRating, setTestRating] = useState(5);
  const [testComment, setTestComment] = useState('Excelente vendedor, respondeu rápido e ajudou a carregar o móvel!');
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [testResult, setTestResult] = useState<any>(null);

  const handleToggleEmails = (checked: boolean) => {
    setEmailsEnabled(checked);
    localStorage.setItem('emails_enabled', checked ? 'true' : 'false');
  };

  const handleSendTestEmail = async () => {
    setTestStatus('sending');
    setTestResult(null);
    try {
      let data: any = {};
      if (testTemplate === 'anuncio_aprovado') {
        data = { sellerName: testName, adTitle: testTitle, adId: 'test-ad-approved-123' };
      } else if (testTemplate === 'anuncio_rejeitado') {
        data = { sellerName: testName, adTitle: testTitle, reason: testReason };
      } else if (testTemplate === 'anuncio_pendente_staff') {
        data = { staffEmails: [testTo], adTitle: testTitle, adId: 'test-ad-pending-123', sellerName: testName };
      } else if (testTemplate === 'interesse_contacto') {
        data = { sellerName: testName, adTitle: testTitle, interestedName: 'José Martins', adId: 'test-ad-interest-123' };
      } else if (testTemplate === 'review_recebida') {
        data = { sellerName: testName, reviewerName: 'José Martins', rating: testRating, comment: testComment, adTitle: testTitle };
      } else if (testTemplate === 'compra_concluida') {
        data = { sellerName: testName, buyerName: 'José Martins', adTitle: testTitle };
      } else if (testTemplate === 'boas_vindas') {
        data = { userName: testName };
      }

      // Envia uma requisição real de teste para o backend de email
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template: testTemplate,
          to: testTo,
          data: data,
        }),
      });

      const result = await response.json();
      if (response.ok && result?.success) {
        setTestStatus('success');
        setTestResult(result);
      } else {
        setTestStatus('error');
        setTestResult(result || { error: 'Falha desconhecida no envio do email' });
      }
    } catch (err: any) {
      console.error('Erro de teste de e-mail:', err);
      setTestStatus('error');
      setTestResult({ error: err?.message || String(err) });
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const settingsSnap = await getDocWithCacheFallback(doc(db, 'settings', 'global'), 'settings/global');
      if (settingsSnap.exists()) {
        const data = settingsSnap.data() as MarketplaceSettings;
        setSettings({
          ...data,
          planDurations: {
            free: data.planDurations?.free || 30,
            local: data.planDurations?.local || 30,
            national: data.planDurations?.national || 30,
            showcase: data.planDurations?.showcase || 30,
            intermediate: data.planDurations?.intermediate || 180,
            premium: data.planDurations?.premium || 365
          },
          planPrices: data.planPrices || {
            local: 4.99,
            national: 7.99,
            showcase: 8.99
          },
          maxImages: data.maxImages ? {
            free: data.maxImages.free || 2,
            local: data.maxImages.local || 4,
            national: data.maxImages.national === 4 ? 6 : (data.maxImages.national || 6),
            showcase: data.maxImages.showcase || 6,
            intermediate: data.maxImages.intermediate || 3,
            premium: data.maxImages.premium || 5
          } : {
            free: 2,
            local: 4,
            national: 6,
            showcase: 6,
            intermediate: 3,
            premium: 5
          },
          maxShowcaseProducts: data.maxShowcaseProducts || 6,
          categories: data.categories || CATEGORIES,
          ptRibbonScale: data.ptRibbonScale !== undefined ? data.ptRibbonScale : 150,
          showTotalAdsBadge: data.showTotalAdsBadge !== undefined ? data.showTotalAdsBadge : true,
          highlightSpeed: data.highlightSpeed !== undefined ? data.highlightSpeed : 6,
          showTotalUsersBadge: data.showTotalUsersBadge !== undefined ? data.showTotalUsersBadge : false,
          searchGroupBgColor: data.searchGroupBgColor || '#ffffff',
          searchGroupOpacity: data.searchGroupOpacity !== undefined ? data.searchGroupOpacity : 10,
          compactCardMode: data.compactCardMode !== undefined ? data.compactCardMode : false,
          enableFotosFeature: data.enableFotosFeature !== undefined ? data.enableFotosFeature : false,
          launchPromoActive: data.launchPromoActive !== undefined ? data.launchPromoActive : true
        });
      } else {
        const defaultSettings: MarketplaceSettings = {
          id: 'global',
          planDurations: { free: 30, local: 30, national: 30, showcase: 30, intermediate: 180, premium: 365 },
          planPrices: { local: 4.99, national: 7.99, showcase: 8.99 },
          maxImages: { free: 2, local: 4, national: 6, showcase: 6, intermediate: 3, premium: 5 },
          maxShowcaseProducts: 6,
          expirationAction: 'archive',
          warningDays: 3,
          categories: CATEGORIES,
          ptRibbonScale: 150,
          showTotalAdsBadge: true,
          highlightSpeed: 6,
          showTotalUsersBadge: false,
          searchGroupBgColor: '#ffffff',
          searchGroupOpacity: 10,
          compactCardMode: false,
          enableFotosFeature: false,
          launchPromoActive: true
        };
        await setDoc(doc(db, 'settings', 'global'), defaultSettings);
        setSettings(defaultSettings);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'settings/global');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await updateDoc(doc(db, 'settings', 'global'), { ...settings });
      setSuccessMsg('Configurações salvas com sucesso.');
      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
      }, 2000);
      
      setTimeout(() => {
        setSuccessMsg(null);
      }, 4000);
      if (onClose) {
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setErrorMsg('Não foi possível salvar as configurações. Tente novamente.');
      setTimeout(() => {
        setErrorMsg(null);
      }, 4000);
      try {
        handleFirestoreError(err, OperationType.UPDATE, 'settings/global');
      } catch (logErr) {
        // Silently capture Firestore exception logging
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = () => {
    if (!newCategory.trim() || !settings) return;
    if (settings.categories?.includes(newCategory.trim())) {
      alert('Esta categoria já existe.');
      return;
    }
    setSettings({
      ...settings,
      categories: [...(settings.categories || CATEGORIES), newCategory.trim()]
    });
    setNewCategory('');
  };

  const handleRemoveCategory = (cat: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      categories: (settings.categories || CATEGORIES).filter(c => c !== cat)
    });
  };

  if (loading) {
    return <div className="text-center py-20 text-slate-400 font-bold animate-pulse">A carregar definições...</div>;
  }

  if (!settings) return null;

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Definições do Marketplace</h1>
        <p className="text-slate-500 font-medium">Configure as regras de negócio, planos e categorias.</p>
      </div>

      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 font-bold text-sm shadow-sm"
          >
            <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
            <span>{successMsg}</span>
          </motion.div>
        )}

        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-3 font-bold text-sm shadow-sm"
          >
            <AlertCircle className="text-rose-500 shrink-0" size={20} />
            <span>{errorMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleUpdateSettings} className="space-y-8">
        {/* Settings: Planos e Preços de Monetização */}
        <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Clock size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Configuração dos Planos Comerciais</h2>
          </div>

          <div className="space-y-6">
            {/* Anúncio Gratuito */}
            <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-4">
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                <span>⚪</span> Anúncio Gratuito
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Duração (Dias)</label>
                  <input
                    type="number"
                    value={settings.planDurations.free}
                    onChange={(e) => setSettings({
                      ...settings,
                      planDurations: { ...settings.planDurations, free: parseInt(e.target.value) || 0 }
                    })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-600 outline-none transition-all font-bold text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Máximo de Fotos</label>
                  <input
                    type="number"
                    value={settings.maxImages.free}
                    onChange={(e) => setSettings({
                      ...settings,
                      maxImages: { ...settings.maxImages, free: parseInt(e.target.value) || 0 }
                    })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-600 outline-none transition-all font-bold text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Destaque Local */}
            <div className="p-5 bg-amber-50/20 rounded-2xl border border-amber-100 space-y-4">
              <h3 className="text-sm font-black text-amber-700 uppercase tracking-widest flex items-center gap-2">
                <span>⭐</span> Destaque Local
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Valor (£ / €)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.planPrices?.local ?? 4.99}
                    onChange={(e) => setSettings({
                      ...settings,
                      planPrices: { ...settings.planPrices, local: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl focus:border-amber-500 outline-none transition-all font-bold text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Duração (Dias)</label>
                  <input
                    type="number"
                    value={settings.planDurations.local}
                    onChange={(e) => setSettings({
                      ...settings,
                      planDurations: { ...settings.planDurations, local: parseInt(e.target.value) || 0 }
                    })}
                    className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl focus:border-amber-500 outline-none transition-all font-bold text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Máximo de Fotos</label>
                  <input
                    type="number"
                    value={settings.maxImages.local}
                    onChange={(e) => setSettings({
                      ...settings,
                      maxImages: { ...settings.maxImages, local: parseInt(e.target.value) || 0 }
                    })}
                    className="w-full px-4 py-2.5 bg-white border border-amber-200 rounded-xl focus:border-amber-500 outline-none transition-all font-bold text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Destaque Nacional */}
            <div className="p-5 bg-indigo-50/20 rounded-2xl border border-indigo-100 space-y-4">
              <h3 className="text-sm font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                <span>👑</span> Destaque Nacional
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Valor (£ / €)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.planPrices?.national ?? 7.99}
                    onChange={(e) => setSettings({
                      ...settings,
                      planPrices: { ...settings.planPrices, national: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl focus:border-indigo-500 outline-none transition-all font-bold text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Duração (Dias)</label>
                  <input
                    type="number"
                    value={settings.planDurations.national}
                    onChange={(e) => setSettings({
                      ...settings,
                      planDurations: { ...settings.planDurations, national: parseInt(e.target.value) || 0 }
                    })}
                    className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl focus:border-indigo-500 outline-none transition-all font-bold text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Máximo de Fotos</label>
                  <input
                    type="number"
                    value={settings.maxImages.national}
                    onChange={(e) => setSettings({
                      ...settings,
                      maxImages: { ...settings.maxImages, national: parseInt(e.target.value) || 0 }
                    })}
                    className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl focus:border-indigo-500 outline-none transition-all font-bold text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Vitrine Digital */}
            <div className="p-5 bg-teal-50/20 rounded-2xl border border-teal-100 space-y-4">
              <h3 className="text-sm font-black text-teal-700 uppercase tracking-widest flex items-center gap-2">
                <span>🏪</span> Vitrine Digital
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Valor Mensal (£ / €)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.planPrices?.showcase ?? 8.99}
                    onChange={(e) => setSettings({
                      ...settings,
                      planPrices: { ...settings.planPrices, showcase: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full px-4 py-2.5 bg-white border border-teal-200 rounded-xl focus:border-teal-500 outline-none transition-all font-bold text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500">Máximo de Produtos</label>
                  <input
                    type="number"
                    value={settings.maxShowcaseProducts ?? 6}
                    onChange={(e) => setSettings({
                      ...settings,
                      maxShowcaseProducts: parseInt(e.target.value) || 0
                    })}
                    className="w-full px-4 py-2.5 bg-white border border-teal-200 rounded-xl focus:border-teal-500 outline-none transition-all font-bold text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Expiration Rules */}
        <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Regras de Expiração</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Ação ao Expirar</label>
              <select
                value={settings.expirationAction}
                onChange={(e) => setSettings({ ...settings, expirationAction: e.target.value as 'archive' | 'delete' })}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-bold appearance-none"
              >
                <option value="archive">Arquivar (Ocultar do público)</option>
                <option value="delete">Eliminar Permanentemente</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Dias para Aviso Prévio</label>
              <input
                type="number"
                value={settings.warningDays}
                onChange={(e) => setSettings({ ...settings, warningDays: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-bold"
              />
            </div>
          </div>
        </section>

        {/* Homepage Display Settings */}
        <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Settings size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Configurações de Exibição da Home</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-900">Mostrar Total de Anúncios</h3>
                <p className="text-xs text-slate-500 font-medium">Exibe no topo da página principal a quantidade total acumulada de anúncios aprovados no sistema.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={!!settings.showTotalAdsBadge} 
                  onChange={(e) => setSettings({ ...settings, showTotalAdsBadge: e.target.checked })} 
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-900">Mostrar Total de Utilizadores (Público)</h3>
                <p className="text-xs text-slate-500 font-medium font-semibold">Torna visível o indicador com o total de utilizadores registados na página principal para visitantes comuns. (Admins/Moderadores sempre conseguem ver).</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={!!settings.showTotalUsersBadge} 
                  onChange={(e) => setSettings({ ...settings, showTotalUsersBadge: e.target.checked })} 
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-900">Modo Card Compacto</h3>
                <p className="text-xs text-slate-500 font-medium">Ativa ou desativa a visualização de cards de forma mais compacta na página principal e nas listagens comuns da plataforma.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={!!settings.compactCardMode} 
                  onChange={(e) => setSettings({ ...settings, compactCardMode: e.target.checked })} 
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-900">Ativar Secção de Fotos (Público)</h3>
                <p className="text-xs text-slate-500 font-medium">Ativa ou desativa a visualização do botão e o acesso à Loja de Fotos para os utilizadores finais.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.enableFotosFeature !== false} 
                  onChange={(e) => setSettings({ ...settings, enableFotosFeature: e.target.checked })} 
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-emerald-100">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 text-emerald-950">
                  <span>🎁 Promoção de Lançamento Ativa</span>
                </h3>
                <p className="text-xs text-emerald-800 font-medium font-semibold leading-relaxed">
                  Quando ativo, exibe mensagens indicando que as funcionalidades premium (Destaque Local, Destaque Nacional e Vitrine Digital) estão gratuitas durante a fase de lançamento da plataforma.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={settings.launchPromoActive !== false} 
                  onChange={(e) => setSettings({ ...settings, launchPromoActive: e.target.checked })} 
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Velocidade do Carrossel (Destaques)</h3>
                  <p className="text-xs text-slate-500 font-medium">Ajuste a velocidade do movimento contínuo dos anúncios destacados na página principal.</p>
                </div>
                <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl text-xs font-black">
                  {settings.highlightSpeed === 0 ? 'Parado' : `${settings.highlightSpeed}x`}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Parado</span>
                <input 
                  type="range" 
                  min="0" 
                  max="10" 
                  step="1"
                  value={settings.highlightSpeed !== undefined ? settings.highlightSpeed : 6} 
                  onChange={(e) => setSettings({ ...settings, highlightSpeed: parseInt(e.target.value) })} 
                  className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Rápido</span>
              </div>
            </div>
          </div>
        </section>

        {/* Controle de Cores e Transparência da Pesquisa da Home */}
        <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-xl">🎨</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Personalização dos Elementos da Barra de Pesquisa</h2>
          </div>
          
          <p className="text-sm text-slate-500 font-medium mb-6">
            Ajuste a cor de fundo e a transparência comuns aplicadas a todos os botões/campos da barra de pesquisa e filtros na Home.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cor de Fundo */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <label className="block text-sm font-bold text-slate-900">Cor de Fundo Base</label>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={settings.searchGroupBgColor || '#ffffff'} 
                  onChange={(e) => setSettings({ ...settings, searchGroupBgColor: e.target.value })} 
                  className="w-12 h-12 rounded-xl cursor-pointer border-2 border-slate-200"
                />
                <input 
                  type="text" 
                  value={settings.searchGroupBgColor || '#ffffff'} 
                  onChange={(e) => setSettings({ ...settings, searchGroupBgColor: e.target.value })} 
                  placeholder="#ffffff"
                  className="flex-1 px-4 py-2.5 bg-white border-2 border-slate-100 rounded-xl focus:border-indigo-600 outline-none transition-all font-mono font-bold"
                />
              </div>
            </div>

            {/* Opacidade / Transparência */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 font-medium">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-bold text-slate-900">Transparência (Opacidade)</label>
                <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl text-xs font-black">
                  {settings.searchGroupOpacity !== undefined ? settings.searchGroupOpacity : 10}%
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Transparente</span>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="5"
                  value={settings.searchGroupOpacity !== undefined ? settings.searchGroupOpacity : 10} 
                  onChange={(e) => setSettings({ ...settings, searchGroupOpacity: parseInt(e.target.value) })} 
                  className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Opaco</span>
              </div>
              <p className="text-[11px] text-slate-400">Um valor menor torna os elementos mais transparentes com o fundo da imagem, maior é mais sólido.</p>
            </div>
          </div>
        </section>

        {/* Categories Management */}
        <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Tag size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Gerir Categorias</h2>
          </div>
          
          <div className="space-y-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Nova categoria..."
                className="flex-1 px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-600 focus:bg-white outline-none transition-all font-bold"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="h-[48px] bg-indigo-600 text-white px-6 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
              >
                <Plus size={20} />
                Adicionar
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {(settings.categories || CATEGORIES).map((cat, idx) => (
                <div 
                  key={`cat-manage-${idx}`}
                  className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 group hover:border-indigo-200 transition-all"
                >
                  <span className="text-sm font-bold text-slate-700">{cat}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(cat)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <CloseIcon size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="sticky bottom-8 z-20">
          <button
            type="submit"
            disabled={saving || isSaved}
            className={`w-full md:w-auto flex items-center justify-center gap-3 px-10 py-4 rounded-2xl font-black text-lg transition-all shadow-2xl disabled:opacity-50 ${
              isSaved 
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200/50' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200/50'
            }`}
          >
            {isSaved ? <CheckCircle2 size={24} /> : <Save size={24} />}
            {saving ? 'Salvando...' : isSaved ? 'CONFIGURAÇÕES SALVAS!' : 'GUARDAR CONFIGURAÇÕES'}
          </button>
        </div>
      </form>

      {/* SISTEMA DE ENVIO DE E-MAILS AUTOMÁTICOS */}
      <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <Mail size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Configurações de E-mails Automáticos</h2>
              <p className="text-xs text-slate-500 font-medium">Controle o envio e realize simulações de e-mails em tempo real.</p>
            </div>
          </div>
          
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={emailsEnabled} 
              onChange={(e) => handleToggleEmails(e.target.checked)} 
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-medium text-slate-600">
          <AlertCircle size={18} className="text-indigo-500" />
          <p>
            <strong>Status de Integração:</strong> Se as variáveis de ambiente <code>RESEND_API_KEY</code> ou <code>SENDGRID_API_KEY</code> estiverem presentes no servidor, os e-mails serão enviados de modo real. Caso contrário, o sistema executará as simulações em logs de desenvolvimento perfeitamente formatados.
          </p>
        </div>

        {/* Simulador Interativo */}
        <div className="bg-slate-50 p-5 md:p-6 rounded-2xl border border-slate-100 space-y-5">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <span>🧪</span> Simulador Interativo de Envio de E-mails (Sandbox)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Template para teste</label>
              <select
                value={testTemplate}
                onChange={(e) => setTestTemplate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none font-bold text-xs"
              >
                <option value="anuncio_aprovado">1. Anúncio Aprovado</option>
                <option value="anuncio_rejeitado">2. Anúncio Rejeitado</option>
                <option value="anuncio_pendente_staff">3. Novo Anúncio Pendente (Staff)</option>
                <option value="interesse_contacto">4. Clique de Interesse no WhatsApp</option>
                <option value="review_recebida">5. Avaliação Pública Recebida</option>
                <option value="compra_concluida">6. Compra/Venda Concluída</option>
                <option value="boas_vindas">7. Boas-vindas ao registar conta</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">E-mail do Destinatário</label>
              <input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-semibold"
                placeholder="exemplo@dominio.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200/65 pt-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nome do Utilizador</label>
              <input
                type="text"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Título de Exemplo do Anúncio</label>
              <input
                type="text"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-semibold"
              />
            </div>

            {testTemplate === 'anuncio_rejeitado' && (
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Motivo da Rejeção</label>
                <textarea
                  value={testReason}
                  onChange={(e) => setTestReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-semibold h-16 resize-none"
                />
              </div>
            )}

            {testTemplate === 'review_recebida' && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Classificação (1 a 5 estrelas)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={testRating}
                    onChange={(e) => setTestRating(parseInt(e.target.value) || 5)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Comentário Público</label>
                  <input
                    type="text"
                    value={testComment}
                    onChange={(e) => setTestComment(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-semibold"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-3 pt-3">
            <button
              onClick={handleSendTestEmail}
              disabled={testStatus === 'sending'}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 self-start w-full md:w-auto"
            >
              <Send size={14} />
              {testStatus === 'sending' ? 'A ENVIAR/SIMULAR...' : 'DISPARAR EMAIL DE TESTE'}
            </button>

            {/* Test Logging Feedback Box */}
            {testStatus !== 'idle' && (
              <div className={`mt-3 p-4 rounded-xl text-xs font-mono space-y-2 max-h-56 overflow-y-auto border ${
                testStatus === 'success' 
                  ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' 
                  : testStatus === 'error'
                  ? 'bg-red-50/50 border-red-100 text-red-800'
                  : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}>
                {testStatus === 'sending' && <p className="animate-pulse">⏳ A processar requisição segura para o backend de e-mails...</p>}
                {testStatus === 'success' && (
                  <>
                    <p className="font-bold flex items-center gap-1.5 text-emerald-700">
                      ✅ SUCESSO COPIADO PARA LOGS!
                    </p>
                    <p>Status: OK</p>
                    {testResult?.simulated ? (
                      <p className="italic">Modo de Operação: Simulado em Desenvolvimento (Logs do terminal detalham conteúdo completo)</p>
                    ) : (
                      <p className="italic">Modo de Operação: Real ({testResult?.provider || 'API Provedor'})</p>
                    )}
                  </>
                )}
                {testStatus === 'error' && (
                  <>
                    <p className="font-bold text-red-700">❌ FALHA NO ENVIO DO TESTE</p>
                    <p>Erro operacional: {testResult?.error || 'Erro interno do servidor backend'}</p>
                  </>
                )}
                {testResult && (
                  <pre className="bg-white/80 p-3 rounded-lg text-[10px] leading-relaxed border border-current/10 max-w-full overflow-x-auto text-slate-800">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <AdminMigrationWidget />
    </div>
  );
};

export default AdminSettings;
