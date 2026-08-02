import React, { useState, useEffect, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { 
  BannerConfig, 
  BannerDeviceConfig, 
  DEFAULT_BANNER_CONFIG, 
  DEFAULT_BANNER_DEVICE_DESKTOP, 
  DEFAULT_BANNER_DEVICE_MOBILE 
} from '../types';
import { 
  Save, 
  RotateCcw, 
  Monitor, 
  Smartphone, 
  Move, 
  Sliders, 
  Eye, 
  Check, 
  Sparkles, 
  Globe, 
  Type, 
  Palette, 
  Maximize2, 
  ShieldAlert,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';

const lisbonAerial = "https://images.unsplash.com/photo-1513673054901-2b5f51551112?auto=format&fit=crop&q=80&w=2000";
const londonAerial = "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&q=80&w=2000";

interface AdminBannerEditorProps {
  onSaved?: () => void;
}

export const AdminBannerEditor: React.FC<AdminBannerEditorProps> = ({ onSaved }) => {
  const { user, isAdmin } = useAuth();
  const { bannerConfig: initialBannerConfig } = useSettings();

  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [countryPreview, setCountryPreview] = useState<'Portugal' | 'United Kingdom'>('Portugal');
  const [showDragOutline, setShowDragOutline] = useState(true);

  // Local editable configuration state
  const [config, setConfig] = useState<BannerConfig>(() => {
    return initialBannerConfig || DEFAULT_BANNER_CONFIG;
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronize with Firestore initial config if loaded after initial mount
  useEffect(() => {
    if (initialBannerConfig) {
      setConfig(initialBannerConfig);
    }
  }, [initialBannerConfig]);

  const activeDeviceConfig = deviceMode === 'desktop' ? config.desktop : config.mobile;

  const updateActiveDeviceConfig = (updates: Partial<BannerDeviceConfig>) => {
    setConfig(prev => ({
      ...prev,
      [deviceMode]: {
        ...prev[deviceMode],
        ...updates
      }
    }));
  };

  // Drag & Drop Handling on Banner Canvas
  const bannerCanvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    updatePositionFromPointer(e.clientX, e.clientY);
  };

  const updatePositionFromPointer = (clientX: number, clientY: number) => {
    if (!bannerCanvasRef.current) return;
    const rect = bannerCanvasRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    let offsetX = clientX - rect.left;
    let offsetY = clientY - rect.top;

    // Clamp inside container (0 to rect.width)
    offsetX = Math.max(0, Math.min(rect.width, offsetX));
    offsetY = Math.max(0, Math.min(rect.height, offsetY));

    const newPosX = Math.round((offsetX / rect.width) * 1000) / 10;
    const newPosY = Math.round((offsetY / rect.height) * 1000) / 10;

    updateActiveDeviceConfig({
      posX: newPosX,
      posY: newPosY
    });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      updatePositionFromPointer(e.clientX, e.clientY);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging]);

  // Save to Firestore
  const handleSave = async () => {
    if (!isAdmin) {
      setErrorMessage("Permissão negada. Apenas administradores podem guardar configurações.");
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    try {
      const docData: BannerConfig = {
        ...config,
        id: 'bannerConfig',
        updatedAt: new Date(),
        updatedBy: user?.email || 'Admin'
      };

      await setDoc(doc(db, 'settings', 'bannerConfig'), docData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      if (onSaved) onSaved();
    } catch (err: any) {
      console.error("Erro ao guardar bannerConfig no Firestore:", err);
      setErrorMessage(err?.message || "Falha ao guardar configurações no Firestore.");
    } finally {
      setSaving(false);
    }
  };

  // Reset active device or total config to defaults
  const handleResetDevice = () => {
    if (window.confirm(`Descartar alterações e restaurar os valores padrão para ${deviceMode.toUpperCase()}?`)) {
      updateActiveDeviceConfig(
        deviceMode === 'desktop' ? DEFAULT_BANNER_DEVICE_DESKTOP : DEFAULT_BANNER_DEVICE_MOBILE
      );
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-3xl mt-8">
        <ShieldAlert size={48} className="mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-900 dark:text-red-200 mb-2">Acesso Restrito</h2>
        <p className="text-sm text-red-700 dark:text-red-300">
          O Editor Visual do Banner Principal é reservado exclusivamente a utilizadores com o cargo de Administrador.
        </p>
      </div>
    );
  }

  // Calculate position & CSS styles dynamically
  const bgOpacityVal = activeDeviceConfig.bgOpacity / 100;
  let bgStyle = activeDeviceConfig.bgColor || '#0f172a';
  if (bgStyle.startsWith('#') && bgStyle.length === 7) {
    const opacityHex = Math.round(bgOpacityVal * 255).toString(16).padStart(2, '0');
    bgStyle = `${bgStyle}${opacityHex}`;
  } else {
    bgStyle = `rgba(15, 23, 42, ${bgOpacityVal})`;
  }

  const boxDynamicStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${activeDeviceConfig.posX}%`,
    top: `${activeDeviceConfig.posY}%`,
    transform: `translate(-${activeDeviceConfig.posX}%, -${activeDeviceConfig.posY}%)`,
    width: `${activeDeviceConfig.width}%`,
    maxWidth: '100%',
    height: activeDeviceConfig.height && activeDeviceConfig.height > 0 ? `${activeDeviceConfig.height}px` : 'auto',
    paddingTop: `${activeDeviceConfig.paddingVertical}px`,
    paddingBottom: `${activeDeviceConfig.paddingVertical}px`,
    paddingLeft: `${activeDeviceConfig.paddingHorizontal}px`,
    paddingRight: `${activeDeviceConfig.paddingHorizontal}px`,
    borderRadius: `${activeDeviceConfig.borderRadius}px`,
    backgroundColor: bgStyle,
    backdropFilter: `blur(${activeDeviceConfig.backdropBlur ?? 12}px)`,
    WebkitBackdropFilter: `blur(${activeDeviceConfig.backdropBlur ?? 12}px)`,
    fontSize: `${activeDeviceConfig.fontSize}px`,
    textAlign: activeDeviceConfig.textAlign,
    color: activeDeviceConfig.textColor || '#ffffff',
    userSelect: 'none',
    touchAction: 'none'
  };

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-extrabold uppercase text-xs tracking-wider mb-1">
            <Sparkles size={16} />
            <span>Ferramenta Administrativa</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Editor Visual do Banner Principal
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Arraste a caixa de texto livremente sobre o banner ou use os seletores deslizantes em tempo real.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={handleResetDevice}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl transition-all cursor-pointer"
            title="Restaurar Padrões para o Dispositivo Atual"
          >
            <RotateCcw size={14} />
            <span>Restaurar Padrão</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-black text-white rounded-2xl shadow-lg transition-all cursor-pointer ${
              saveSuccess 
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30'
                : 'bg-sky-600 hover:bg-sky-700 shadow-sky-500/30'
            } disabled:opacity-50`}
          >
            {saving ? (
              <span className="animate-spin">⏳</span>
            ) : saveSuccess ? (
              <Check size={16} />
            ) : (
              <Save size={16} />
            )}
            <span>{saving ? 'A guardar...' : saveSuccess ? 'Guardado com Sucesso!' : 'Salvar no Firestore'}</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-100 dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 text-xs font-bold rounded-2xl flex items-center gap-2">
          <ShieldAlert size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Mode Switcher & Preview Controls Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-white">
        {/* Device Switcher */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setDeviceMode('desktop')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              deviceMode === 'desktop' 
                ? 'bg-sky-500 text-white shadow-md' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Monitor size={15} />
            <span>Computador (Desktop)</span>
          </button>

          <button
            onClick={() => setDeviceMode('mobile')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              deviceMode === 'mobile' 
                ? 'bg-sky-500 text-white shadow-md' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Smartphone size={15} />
            <span>Telemóvel (Mobile)</span>
          </button>
        </div>

        {/* Region & Outline Helpers */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCountryPreview(prev => prev === 'Portugal' ? 'United Kingdom' : 'Portugal')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-all cursor-pointer"
            title="Alternar Imagem de Fundo (Portugal vs UK)"
          >
            <Globe size={14} className="text-sky-400" />
            <span>Fundo: {countryPreview}</span>
          </button>

          <button
            onClick={() => setShowDragOutline(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
              showDragOutline 
                ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500/50' 
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Eye size={14} />
            <span>{showDragOutline} Guia de Arraste</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT GRID: Banner Canvas Preview (Left) + Sliders Controls (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left / Top: Banner Preview Canvas */}
        <div className="lg:col-span-7 xl:col-span-7 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Move size={14} className="text-sky-500 animate-pulse" />
              <span>Canvas do Banner ({deviceMode.toUpperCase()})</span>
            </span>
            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
              X: {activeDeviceConfig.posX}% | Y: {activeDeviceConfig.posY}%
            </span>
          </div>

          {/* Device Wrapper */}
          <div 
            className={`transition-all duration-300 w-full flex justify-center ${
              deviceMode === 'mobile' ? 'max-w-[390px] mx-auto p-4 bg-slate-900/90 rounded-[40px] border-4 border-slate-800 shadow-2xl relative' : 'w-full'
            }`}
          >
            {/* Phone Speaker Notch if in Mobile Mode */}
            {deviceMode === 'mobile' && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-950 rounded-full z-20 flex items-center justify-center">
                <div className="w-8 h-1 bg-slate-800 rounded-full" />
              </div>
            )}

            {/* EXACT HOME BANNER REPLICA CANVAS */}
            <div 
              ref={bannerCanvasRef}
              className={`relative overflow-hidden shadow-2xl rounded-2xl sm:rounded-3xl transition-all max-w-full bg-slate-950 select-none ${
                deviceMode === 'mobile' 
                  ? 'w-full min-h-[300px] h-[340px] border border-slate-700/50 mt-4' 
                  : 'w-full min-h-[260px] sm:min-h-[340px] md:min-h-[400px] lg:min-h-[440px]'
              }`}
            >
              {/* Dynamic Background Image */}
              <div className="absolute inset-0 z-0 overflow-hidden bg-slate-950 pointer-events-none">
                <img 
                  src={countryPreview === 'Portugal' ? lisbonAerial : londonAerial} 
                  alt="Banner Preview" 
                  className="w-full h-full object-cover object-[center_20%]"
                />
                {/* Top-to-bottom Gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-black/15 to-slate-950/90" />
              </div>

              {/* Banner Header Overlay (Title + Badges) */}
              <div className="relative z-10 w-full h-full flex flex-col justify-between p-4 sm:p-8 md:p-10 pointer-events-none">
                <div className="flex flex-row items-start justify-between gap-2 w-full">
                  <h1 className="text-base sm:text-2xl md:text-4xl font-black text-white tracking-tight leading-tight drop-shadow-[0_4px_14px_rgba(0,0,0,0.9)]">
                    ConnectBoat<span className="text-sky-400 font-light"> Marketplace</span>
                  </h1>

                  {/* Dummy Floating Badges */}
                  <div className="flex flex-row items-center gap-1.5 sm:gap-2 shrink-0">
                    <div className="flex items-center bg-black/50 backdrop-blur-md border border-white/15 rounded-lg px-2 py-1 shadow-lg">
                      <span className="text-white font-black text-xs sm:text-base mr-1">128</span>
                      <span className="text-white/70 text-[7px] sm:text-[8px] uppercase font-black leading-none">Anúncios</span>
                    </div>
                    <div className="flex items-center bg-white/10 backdrop-blur-md border border-white/20 rounded-lg px-2 py-1 shadow-lg">
                      <span className="text-amber-300 font-black text-xs sm:text-base mr-1">450</span>
                      <span className="text-white/80 text-[7px] sm:text-[8px] uppercase font-black leading-none">Membros</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* DYNAMIC MOVABLE SUBTITLE / TEXT BOX */}
              <div
                onPointerDown={handlePointerDown}
                style={boxDynamicStyle}
                className={`group cursor-grab active:cursor-grabbing transition-shadow duration-150 z-30 ${
                  showDragOutline 
                    ? 'ring-2 ring-sky-400/80 ring-offset-2 ring-offset-slate-950 shadow-sky-500/20 shadow-2xl' 
                    : 'shadow-2xl'
                }`}
              >
                {/* Visual Drag Handle Icon Badge (Visible on hover or edit mode) */}
                {showDragOutline && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-sky-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-40">
                    <Move size={10} />
                    <span>Arraste para Mover</span>
                  </div>
                )}

                <p className="drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] leading-relaxed font-medium italic">
                  {countryPreview === 'Portugal' ? (
                    activeDeviceConfig.customTextPt || (
                      <>
                        Compre, venda e alugue barcos, iates,<br />
                        equipamentos e serviços marítimos.
                      </>
                    )
                  ) : (
                    activeDeviceConfig.customTextEn || (
                      <>
                        Buy, sell and charter boats, yachts,<br />
                        gear & marine services across the United Kingdom.
                      </>
                    )
                  )}
                </p>
              </div>
            </div>
          </div>
          
          <p className="text-[11px] text-slate-400 mt-2 text-center">
            💡 Dica: Clique e mantenha pressionada a caixa de texto para arrastá-la diretamente no gráfico.
          </p>
        </div>

        {/* Right / Bottom: Sliders & Customization Controls Panel */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xl space-y-5">
            
            {/* Section Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders size={18} className="text-sky-500" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                  Parâmetros de Layout ({deviceMode.toUpperCase()})
                </h3>
              </div>
              <span className="text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 rounded-xl">
                {deviceMode === 'desktop' ? '💻 Modo PC' : '📱 Modo Mobile'}
              </span>
            </div>

            {/* 1. Posicionamento X & Y */}
            <div className="space-y-4">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Move size={14} className="text-sky-500" />
                <span>Posicionamento Livre (X e Y)</span>
              </span>

              {/* Slider Horizontal (X) */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <label>Posição Horizontal (X)</label>
                  <span className="text-sky-600 dark:text-sky-400 font-mono">{activeDeviceConfig.posX}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.5"
                  value={activeDeviceConfig.posX}
                  onChange={e => updateActiveDeviceConfig({ posX: parseFloat(e.target.value) })}
                  className="w-full accent-sky-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>0% (Esquerda)</span>
                  <span>50% (Centro)</span>
                  <span>100% (Direita)</span>
                </div>
              </div>

              {/* Slider Vertical (Y) */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <label>Posição Vertical (Y)</label>
                  <span className="text-sky-600 dark:text-sky-400 font-mono">{activeDeviceConfig.posY}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.5"
                  value={activeDeviceConfig.posY}
                  onChange={e => updateActiveDeviceConfig({ posY: parseFloat(e.target.value) })}
                  className="w-full accent-sky-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>0% (Topo)</span>
                  <span>50% (Centro)</span>
                  <span>100% (Fundo)</span>
                </div>
              </div>
            </div>

            {/* 2. Dimensões (Largura e Altura) */}
            <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Maximize2 size={14} className="text-indigo-500" />
                <span>Dimensões da Caixa</span>
              </span>

              {/* Slider Largura (Width %) */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <label>Largura da Caixa (%)</label>
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono">{activeDeviceConfig.width}%</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="100"
                  step="1"
                  value={activeDeviceConfig.width}
                  onChange={e => updateActiveDeviceConfig({ width: parseInt(e.target.value, 10) })}
                  className="w-full accent-indigo-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider Altura (Height px - 0 = Auto) */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <label>Altura da Caixa</label>
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                    {activeDeviceConfig.height && activeDeviceConfig.height > 0 ? `${activeDeviceConfig.height}px` : 'Automática (Auto)'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="300"
                  step="5"
                  value={activeDeviceConfig.height || 0}
                  onChange={e => updateActiveDeviceConfig({ height: parseInt(e.target.value, 10) })}
                  className="w-full accent-indigo-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* 3. Estilização & Espaçamento */}
            <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Palette size={14} className="text-amber-500" />
                <span>Espaçamento e Aspeto</span>
              </span>

              {/* Slider Padding Vertical */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <label>Padding Vertical</label>
                  <span className="text-amber-600 dark:text-amber-400 font-mono">{activeDeviceConfig.paddingVertical}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="1"
                  value={activeDeviceConfig.paddingVertical}
                  onChange={e => updateActiveDeviceConfig({ paddingVertical: parseInt(e.target.value, 10) })}
                  className="w-full accent-amber-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider Padding Horizontal */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <label>Padding Horizontal</label>
                  <span className="text-amber-600 dark:text-amber-400 font-mono">{activeDeviceConfig.paddingHorizontal}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="1"
                  value={activeDeviceConfig.paddingHorizontal}
                  onChange={e => updateActiveDeviceConfig({ paddingHorizontal: parseInt(e.target.value, 10) })}
                  className="w-full accent-amber-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider Border Radius */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <label>Raio dos Cantos (Border Radius)</label>
                  <span className="text-amber-600 dark:text-amber-400 font-mono">{activeDeviceConfig.borderRadius}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="1"
                  value={activeDeviceConfig.borderRadius}
                  onChange={e => updateActiveDeviceConfig({ borderRadius: parseInt(e.target.value, 10) })}
                  className="w-full accent-amber-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider Opacidade do Fundo */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <label>Opacidade do Fundo</label>
                  <span className="text-amber-600 dark:text-amber-400 font-mono">{activeDeviceConfig.bgOpacity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={activeDeviceConfig.bgOpacity}
                  onChange={e => updateActiveDeviceConfig({ bgOpacity: parseInt(e.target.value, 10) })}
                  className="w-full accent-amber-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* 4. Tipografia & Texto */}
            <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Type size={14} className="text-emerald-500" />
                <span>Tipografia e Alinhamento</span>
              </span>

              {/* Slider Tamanho da Fonte */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <label>Tamanho da Fonte</label>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono">{activeDeviceConfig.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="32"
                  step="0.5"
                  value={activeDeviceConfig.fontSize}
                  onChange={e => updateActiveDeviceConfig({ fontSize: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Alinhamento de Texto */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Alinhamento do Texto</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => updateActiveDeviceConfig({ textAlign: 'left' })}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                      activeDeviceConfig.textAlign === 'left'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <AlignLeft size={14} />
                    <span>Esquerda</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateActiveDeviceConfig({ textAlign: 'center' })}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                      activeDeviceConfig.textAlign === 'center'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <AlignCenter size={14} />
                    <span>Centro</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateActiveDeviceConfig({ textAlign: 'right' })}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                      activeDeviceConfig.textAlign === 'right'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <AlignRight size={14} />
                    <span>Direita</span>
                  </button>
                </div>
              </div>

              {/* Custom Text Override inputs (Optional) */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Texto Personalizado (Opcional - Portugal)
                </label>
                <input
                  type="text"
                  placeholder="Deixar em branco para texto padrão PT..."
                  value={activeDeviceConfig.customTextPt || ''}
                  onChange={e => updateActiveDeviceConfig({ customTextPt: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />

                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Texto Personalizado (Opcional - United Kingdom)
                </label>
                <input
                  type="text"
                  placeholder="Deixar em branco para texto padrão UK..."
                  value={activeDeviceConfig.customTextEn || ''}
                  onChange={e => updateActiveDeviceConfig({ customTextEn: e.target.value })}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminBannerEditor;
