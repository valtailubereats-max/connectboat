import React from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

const SHEETS_WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbzSSNVxSMpK49FS-uGfdcIOdW_h9M1CbVbdGu77ZJl9hK1RDh9Ya4MG0Dunran77ShX/exec';

type Status = 'loading' | 'success' | 'error';

export default function Unsubscribe() {
  const [status, setStatus] = React.useState<Status>('loading');
  const [message, setMessage] = React.useState(
    'Processing your request...'
  );

  React.useEffect(() => {
    let active = true;

    const unsubscribe = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const email = (params.get('email') || '').trim().toLowerCase();

        if (!email || !email.includes('@')) {
          if (!active) return;

          setStatus('error');
          setMessage(
            'We could not identify the email address for this unsubscribe request.'
          );
          return;
        }

        const unsubscribeUrl =
          `${SHEETS_WEB_APP_URL}` +
          `?action=unsubscribe` +
          `&email=${encodeURIComponent(email)}`;

        /*
         * We deliberately use fetch instead of navigating the visitor
         * to script.google.com.
         *
         * The visitor remains on connectboat.co.uk/unsubscribe while
         * Google Apps Script records the suppression request.
         */
        await fetch(unsubscribeUrl, {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-store',
        });

        if (!active) return;

        setStatus('success');
        setMessage(
          'You have been successfully unsubscribed from ConnectBoat emails.'
        );
      } catch (error) {
        console.error('Unsubscribe error:', error);

        if (!active) return;

        setStatus('error');
        setMessage(
          'We could not process your unsubscribe request. Please contact ConnectBoat.'
        );
      }
    };

    unsubscribe();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-[65vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-xl p-8 sm:p-10 text-center">

        {status === 'loading' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-sky-50 flex items-center justify-center">
              <Loader2
                size={34}
                className="text-sky-600 animate-spin"
              />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              Unsubscribing
            </h1>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2
                size={36}
                className="text-emerald-600"
              />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              Unsubscribed
            </h1>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-rose-50 flex items-center justify-center">
              <AlertCircle
                size={36}
                className="text-rose-600"
              />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              Unable to unsubscribe
            </h1>
          </>
        )}

        <p className="mt-4 text-slate-600 leading-relaxed">
          {message}
        </p>

        {status === 'success' && (
          <p className="mt-3 text-sm text-slate-500">
            You will not receive further marketing emails from ConnectBoat at this address.
          </p>
        )}

        <a
          href="/"
          className="mt-8 inline-flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-3 rounded-xl transition-colors"
        >
          Visit ConnectBoat
        </a>

        <div className="mt-8 pt-6 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-400">
            ConnectBoat — The UK Boating Marketplace
          </p>
        </div>
      </div>
    </div>
  );
}
