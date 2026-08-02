import React from 'react';
import { motion } from 'motion/react';
import { BannerConfig, DEFAULT_BANNER_CONFIG, BannerDeviceConfig } from '../types';
import { Sliders } from 'lucide-react';

interface BannerTextBoxProps {
  country: string;
  isMobileScreen: boolean;
  bannerConfig: BannerConfig | null;
  isAdmin?: boolean;
  onOpenEditor?: () => void;
}

export const BannerTextBox: React.FC<BannerTextBoxProps> = ({
  country,
  isMobileScreen,
  bannerConfig,
  isAdmin,
  onOpenEditor
}) => {
  const defaultConfig = isMobileScreen ? DEFAULT_BANNER_CONFIG.mobile : DEFAULT_BANNER_CONFIG.desktop;
  const rawDeviceConfig = isMobileScreen ? bannerConfig?.mobile : bannerConfig?.desktop;

  const activeDeviceConfig: BannerDeviceConfig = {
    ...defaultConfig,
    ...(rawDeviceConfig || {})
  };

  const posX = activeDeviceConfig.posX ?? defaultConfig.posX;
  const posY = activeDeviceConfig.posY ?? defaultConfig.posY;
  const width = activeDeviceConfig.width ?? defaultConfig.width;

  const bgOpacityVal = (activeDeviceConfig.bgOpacity ?? 75) / 100;
  let bgStyle = activeDeviceConfig.bgColor || '#0f172a';
  if (bgStyle.startsWith('#') && bgStyle.length === 7) {
    const opacityHex = Math.round(bgOpacityVal * 255).toString(16).padStart(2, '0');
    bgStyle = `${bgStyle}${opacityHex}`;
  } else {
    bgStyle = `rgba(15, 23, 42, ${bgOpacityVal})`;
  }

  const boxStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${posX}%`,
    top: `${posY}%`,
    transform: `translate(-${posX}%, -${posY}%)`,
    width: `${width}%`,
    maxWidth: '100%',
    height: activeDeviceConfig.height && activeDeviceConfig.height > 0 ? `${activeDeviceConfig.height}px` : 'auto',
    paddingTop: `${activeDeviceConfig.paddingVertical ?? 14}px`,
    paddingBottom: `${activeDeviceConfig.paddingVertical ?? 14}px`,
    paddingLeft: `${activeDeviceConfig.paddingHorizontal ?? 22}px`,
    paddingRight: `${activeDeviceConfig.paddingHorizontal ?? 22}px`,
    borderRadius: `${activeDeviceConfig.borderRadius ?? 16}px`,
    backgroundColor: bgStyle,
    backdropFilter: `blur(${activeDeviceConfig.backdropBlur ?? 12}px)`,
    WebkitBackdropFilter: `blur(${activeDeviceConfig.backdropBlur ?? 12}px)`,
    fontSize: `${activeDeviceConfig.fontSize ?? 15}px`,
    textAlign: activeDeviceConfig.textAlign || 'right',
    color: activeDeviceConfig.textColor || '#ffffff',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    zIndex: 25,
    pointerEvents: 'auto'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={boxStyle}
      className="group transition-all duration-150 relative"
    >
      {/* Admin Edit Trigger Shortcut Button on Banner */}
      {isAdmin && onOpenEditor && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenEditor();
          }}
          className="absolute -top-3.5 right-2 bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-xl shadow-xl flex items-center gap-1.5 border border-white/20 opacity-90 hover:opacity-100 transition-all duration-200 z-40 cursor-pointer"
          title="Editar Posicionamento e Estilo do Banner"
        >
          <Sliders size={12} />
          <span>Editar Banner</span>
        </button>
      )}

      <p className="drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] leading-relaxed font-medium italic">
        {country === 'Portugal' ? (
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
    </motion.div>
  );
};
