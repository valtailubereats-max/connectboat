import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Search, Ship } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-2xl text-center">
        <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
          <Ship className="w-10 h-10 text-sky-600" />
        </div>

        <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-600 mb-3">
          Error 404
        </p>

        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-4">
          Page not found
        </h1>

        <p className="text-slate-600 dark:text-slate-300 mb-8 max-w-lg mx-auto">
          The page you are looking for may have been moved, removed or the address may be incorrect.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold transition-colors"
          >
            <Home size={18} />
            Back to Home
          </Link>

          <Link
            to="/?search="
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Search size={18} />
            Browse Listings
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
