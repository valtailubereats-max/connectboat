import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
  containerClassName?: string;
}

const OptimizedImage: React.FC<OptimizedImageProps & any> = ({ 
  src, 
  alt, 
  className = '', 
  containerClassName = '',
  as: Component = 'img',
  ...props 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // If containerClassName doesn't define width/height sizing, default them to w-full h-full to avoid collapsing to zero
  const defaultSizing = `${containerClassName.includes('w-') ? '' : 'w-full'} ${containerClassName.includes('h-') ? '' : 'h-full'}`;

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <div className={`relative overflow-hidden ${defaultSizing} ${containerClassName} bg-slate-50 flex items-center justify-center`}>
      {isLoading && (
        <div className="absolute inset-0 bg-slate-200 animate-pulse rounded-[inherit]" />
      )}
      {hasError ? (
        <div className="flex flex-col items-center justify-center text-slate-300 gap-1 p-4 text-center">
          <ImageIcon size={32} strokeWidth={1.5} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sem foto</span>
        </div>
      ) : (
        <Component
          src={src && src.trim() !== '' ? src : null}
          alt={alt}
          loading="lazy"
          onLoad={() => setIsLoading(false)}
          onError={handleError}
          className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          {...props}
        />
      )}
    </div>
  );
};

export default OptimizedImage;
