import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { isExcludedPath, sendGAPageView, initGA } from '../utils/analytics';

export const AnalyticsTracker: React.FC = () => {
  const location = useLocation();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    initGA();
  }, []);

  useEffect(() => {
    const currentPath = location.pathname + location.search;

    if (isExcludedPath(location.pathname)) {
      return;
    }

    if (lastPathRef.current === currentPath) {
      return;
    }

    lastPathRef.current = currentPath;

    // Small delay so react-helmet-async updates page title first
    const timer = setTimeout(() => {
      sendGAPageView(currentPath, document.title);
    }, 120);

    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);

  return null;
};
