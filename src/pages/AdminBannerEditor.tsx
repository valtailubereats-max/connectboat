import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { 
  Sliders, 
  Save, 
  RotateCcw, 
  Monitor, 
  Smartphone, 
  Check, 
  Sparkles, 
  Type, 
  Palette, 
  Move, 
  Eye,
  Info,
  ArrowUpDown
} from 'lucide-react';
import { BannerConfig, DEFAULT_BANNER_CONFIG, BannerDeviceConfig } from '../types';

const boatBannerBg = "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&w=1600&q=80";

export default function AdminBannerEditor() {
  const { bannerConfig: initialBannerConfig } = useSettings();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'desktop' | 'mobile'>('desktop');
  const [config, setConfig] = useState<BannerConfig>(DEFAULT_BANNER_CONFIG);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (initialBannerConfig) {
      setConfig({
        id: 'bannerConfig',
        enabled: initialBannerConfig.enabled !== undefined ? initialBannerConfig.enabled : true,
        desktop: {
          ...DEFAULT_BANNER_CONFIG.desktop,
          ...(initialBannerConfig.desktop || {})
        },
        mobile: {
          ...DEFAULT_BANNER_CONFIG.mobile,
          ...(initialBannerConfig.mobile || {})
        }
      });
    }
  }, [initialBannerConfig]);

  const currentDeviceConfig = config[activeTab];

  const getPosY = (val?: number) => (val === 90 ? 0 : (val ?? 0));

  const updateDeviceConfig = (key: keyof BannerDeviceConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [key]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSavedSuccess(false);

      const docRef = doc(db, 'settings', 'bannerConfig');
      const payload: BannerConfig = {
        ...config,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || 'admin'
      };

      await setDoc(docRef, payload, { merge: true });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving banner configuration:", err);
      alert("Failed to save banner configuration. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset the banner configuration to defaults?")) {
      setConfig(DEFAULT_BANNER_CONFIG);
    }
  };

  const textEn = currentDeviceConfig.customTextEn || 'Buy, sell and charter boats, yachts, gear & marine services across the United Kingdom.';
  const textPt = currentDeviceConfig.customTextPt || 'Compre, venda e alugue barcos, iates, equipamentos e serviços marítimos.';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 rounded-2xl">
              <Sliders size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Editor do Banner Principal
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                Customize em tempo real as frases, estilo, cores e posicionamento da caixa de texto do banner principal.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all cursor-pointer"
          >
            <RotateCcw size={15} />
            Restaurar Padrão
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : savedSuccess ? (
              <>
                <Check size={16} className="text-emerald-300" />
                Guardado com Sucesso!
              </>
            ) : (
              <>
                <Save size={16} />
                Guardar Alterações
              </>
            )}
          </button>
        </div>
      </div>

      {/* Selector Desktop vs Mobile */}
      <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl max-w-md mx-auto">
        <button
          onClick={() => setActiveTab('desktop')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'desktop'
              ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Monitor size={16} />
          <span>Computador (Desktop)</span>
        </button>
        <button
          onClick={() => setActiveTab('mobile')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'mobile'
              ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Smartphone size={16} />
          <span>Telemóvel (Mobile)</span>
        </button>
      </div>

      {/* LIVE PREVIEW BANNER */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-sm">
            <Eye size={16} className="text-sky-500" />
            <span>Pré-visualização em Tempo Real ({activeTab === 'desktop' ? 'Computador' : 'Telemóvel'})</span>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input 
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig(prev => ({ ...prev, enabled: e.target.checked }))}
              className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
            />
            <span>Exibir Caixa do Banner</span>
          </label>
        </div>

        <div className="flex justify-center bg-slate-950 p-4 sm:p-6 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
          <div 
            className={`relative overflow-hidden rounded-2xl bg-slate-950 transition-all duration-300 w-full ${
              activeTab === 'mobile' ? 'max-w-[360px] min-h-[280px]' : 'max-w-full min-h-[380px]'
            }`}
          >
            {/* Background Image */}
            <img 
              src={boatBannerBg} 
              alt="Banner Preview" 
              className="w-full h-full object-cover absolute inset-0"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-black/20 to-slate-950/90" />

            <div className="relative z-10 p-5 h-full flex flex-col justify-between min-h-[280px] sm:min-h-[380px]">
              {/* Top Banner Row */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight">ConnectBoat</h2>
                <div className="flex items-center gap-2">
                  <div className="bg-black/50 backdrop-blur-md border border-white/20 text-white font-bold text-xs px-2.5 py-1 rounded-lg">
                    Active Listings
                  </div>
                </div>
              </div>

              {/* Dynamic Subtitle Overlay Box */}
              {config.enabled && (
                <div 
                  className={`mt-auto pt-6 w-full flex ${
                    currentDeviceConfig.textAlign === 'left' ? 'justify-start' : 
                    currentDeviceConfig.textAlign === 'center' ? 'justify-center' : 'justify-end'
                  }`}
                  style={{
                    transform: `translateY(${-1 * getPosY(currentDeviceConfig.posY)}px)`,
                    transition: 'transform 0.15s ease-out'
                  }}
                >
                  <div 
                    className="inline-flex items-center shadow-2xl max-w-full transition-all"
                    style={{
                      backgroundColor: `${currentDeviceConfig.bgColor || '#0f172a'}${Math.round(((currentDeviceConfig.bgOpacity ?? 80) / 100) * 255).toString(16).padStart(2, '0')}`,
                      backdropFilter: `blur(${currentDeviceConfig.backdropBlur ?? 12}px)`,
                      borderRadius: `${currentDeviceConfig.borderRadius ?? 16}px`,
                      paddingTop: `${currentDeviceConfig.paddingVertical ?? 12}px`,
                      paddingBottom: `${currentDeviceConfig.paddingVertical ?? 12}px`,
                      paddingLeft: `${currentDeviceConfig.paddingHorizontal ?? 20}px`,
                      paddingRight: `${currentDeviceConfig.paddingHorizontal ?? 20}px`,
                    }}
                  >
                    <p 
                      className="font-medium italic tracking-wide leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
                      style={{
                        color: currentDeviceConfig.textColor || '#ffffff',
                        fontSize: `${currentDeviceConfig.fontSize || 14}px`,
                        textAlign: currentDeviceConfig.textAlign || 'right',
                      }}
                    >
                      {textEn}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* EDITING FORM PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* PANEL 1: MESSAGES / TEXT */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <Type size={18} className="text-sky-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Frases do Banner ({activeTab === 'desktop' ? 'Desktop' : 'Mobile'})
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                🇬🇧 Reino Unido / Inglês (UK Text)
              </label>
              <textarea
                rows={3}
                value={currentDeviceConfig.customTextEn || ''}
                onChange={(e) => updateDeviceConfig('customTextEn', e.target.value)}
                placeholder="Buy, sell and charter boats, yachts, gear & marine services across the United Kingdom."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                🇵🇹 Portugal / Português (PT Text)
              </label>
              <textarea
                rows={3}
                value={currentDeviceConfig.customTextPt || ''}
                onChange={(e) => updateDeviceConfig('customTextPt', e.target.value)}
                placeholder="Compre, venda e alugue barcos, iates, equipamentos e serviços marítimos."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>

        {/* PANEL 2: STYLING & COLORS */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <Palette size={18} className="text-sky-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Cores, Fundo & Tipografia ({activeTab === 'desktop' ? 'Desktop' : 'Mobile'})
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Color Pickers */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Cor do Texto
              </label>
              <div className="flex items-center gap-2">
                <input 
                  type="color"
                  value={currentDeviceConfig.textColor || '#ffffff'}
                  onChange={(e) => updateDeviceConfig('textColor', e.target.value)}
                  className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5 bg-transparent"
                />
                <input 
                  type="text"
                  value={currentDeviceConfig.textColor || '#ffffff'}
                  onChange={(e) => updateDeviceConfig('textColor', e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Cor de Fundo da Caixa
              </label>
              <div className="flex items-center gap-2">
                <input 
                  type="color"
                  value={currentDeviceConfig.bgColor || '#0f172a'}
                  onChange={(e) => updateDeviceConfig('bgColor', e.target.value)}
                  className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5 bg-transparent"
                />
                <input 
                  type="text"
                  value={currentDeviceConfig.bgColor || '#0f172a'}
                  onChange={(e) => updateDeviceConfig('bgColor', e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Opacidade de Fundo */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                <span>Opacidade do Fundo</span>
                <span>{currentDeviceConfig.bgOpacity ?? 80}%</span>
              </div>
              <input 
                type="range"
                min="0"
                max="100"
                value={currentDeviceConfig.bgOpacity ?? 80}
                onChange={(e) => updateDeviceConfig('bgOpacity', Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>

            {/* Blur de Fundo */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                <span>Efeito Vidro (Blur)</span>
                <span>{currentDeviceConfig.backdropBlur ?? 12}px</span>
              </div>
              <input 
                type="range"
                min="0"
                max="24"
                value={currentDeviceConfig.backdropBlur ?? 12}
                onChange={(e) => updateDeviceConfig('backdropBlur', Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>

            {/* Posição Vertical (Cima / Baixo) */}
            <div className="sm:col-span-2 bg-sky-50/60 dark:bg-sky-950/40 p-3.5 rounded-2xl border border-sky-100 dark:border-sky-900/60 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <ArrowUpDown size={15} className="text-sky-600 dark:text-sky-400" />
                  Posição Vertical da Caixa (Cima / Baixo)
                </span>
                <span className="px-2 py-0.5 bg-sky-100 dark:bg-sky-900/80 text-sky-700 dark:text-sky-300 rounded-md font-mono text-[11px]">
                  {getPosY(currentDeviceConfig.posY)}px
                </span>
              </div>
              <input 
                type="range"
                min="-80"
                max="140"
                value={getPosY(currentDeviceConfig.posY)}
                onChange={(e) => updateDeviceConfig('posY', Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium pt-0.5">
                <span>⬇️ Mais para Baixo (-80px)</span>
                <span>Padrão (0px)</span>
                <span>⬆️ Mais para Cima (+140px)</span>
              </div>
            </div>

            {/* Tamanho da Fonte */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                <span>Tamanho da Fonte</span>
                <span>{currentDeviceConfig.fontSize || 14}px</span>
              </div>
              <input 
                type="range"
                min="8"
                max="32"
                value={currentDeviceConfig.fontSize || 14}
                onChange={(e) => updateDeviceConfig('fontSize', Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>

            {/* Alinhamento do Texto */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Alinhamento do Texto
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => updateDeviceConfig('textAlign', align)}
                    className={`py-1.5 text-xs font-bold capitalize rounded-lg transition-all ${
                      currentDeviceConfig.textAlign === align
                        ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {align === 'left' ? 'Esquerda' : align === 'center' ? 'Centro' : 'Direita'}
                  </button>
                ))}
              </div>
            </div>

            {/* Padding Vertical */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                <span>Espaçamento Vertical</span>
                <span>{currentDeviceConfig.paddingVertical ?? 12}px</span>
              </div>
              <input 
                type="range"
                min="0"
                max="40"
                value={currentDeviceConfig.paddingVertical ?? 12}
                onChange={(e) => updateDeviceConfig('paddingVertical', Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>

            {/* Border Radius */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                <span>Arredondamento Bordas</span>
                <span>{currentDeviceConfig.borderRadius ?? 16}px</span>
              </div>
              <input 
                type="range"
                min="0"
                max="40"
                value={currentDeviceConfig.borderRadius ?? 16}
                onChange={(e) => updateDeviceConfig('borderRadius', Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
