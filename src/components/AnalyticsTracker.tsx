import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { initGA, initMetaPixel, isExcludedPath, sendGAPageView, sendMetaPageView } from '../utils/analytics';

export const AnalyticsTracker: React.FC = () => {
  const location = useLocation();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    initGA();
    initMetaPixel();
  }, []);

  useEffect(() => {
    const currentPath = location.pathname + location.search;

    if (lastPathRef.current === currentPath) {
      return;
    }

    lastPathRef.current = currentPath;

    // Small delay so react-helmet-async updates page title first
    const timer = setTimeout(() => {
      sendMetaPageView();
      if (!isExcludedPath(location.pathname)) {
        sendGAPageView(currentPath, document.title);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);

  return null;
};
