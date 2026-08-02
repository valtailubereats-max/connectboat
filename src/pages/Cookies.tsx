import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import { Shield, Info, Cookie, Settings, ShieldAlert, CheckCircle, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const Cookies = () => {
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Helmet>
        <title>Cookie Policy | ConnectBoat</title>
        <meta name="description" content="ConnectBoat Cookie Policy explaining how we use essential cookies and browser storage." />
        <link rel="canonical" href="https://connectboat.co.uk/cookie-policy" />
        <meta property="og:url" content="https://connectboat.co.uk/cookie-policy" />
        <meta property="og:title" content="Cookie Policy | ConnectBoat" />
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2rem] p-8 md:p-12 shadow-xl border border-slate-100 relative"
      >
        {/* Botão fechar no topo */}
        <Link
          to="/"
          className="absolute top-6 right-6 md:top-8 md:right-8 text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-50 rounded-full border border-slate-100 shadow-sm"
          title="Close and return to home page"
        >
          <X size={20} />
        </Link>

        <div className="flex items-center gap-4 mb-8 pr-12">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
            <Cookie size={28} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900">Cookie Policy</h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">ConnectBoat</p>
          </div>
        </div>

        <div className="prose prose-slate max-w-none space-y-8">
          <p className="text-sm font-semibold text-emerald-600">Last updated: June 2026</p>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <Info size={20} />
              <h2 className="text-xl font-bold m-0">1. What are Cookies?</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Cookies are small text files stored on your computer or mobile device when you visit a website. These files help improve your experience by saving your preferences, authenticating your access, and collecting aggregated usage statistics anonymously.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <Settings size={20} />
              <h2 className="text-xl font-bold m-0">2. How we use Cookies</h2>
            </div>
            <p className="text-slate-600 leading-relaxed font-semibold mb-3">
              At ConnectBoat, we use different types of cookies to ensure the platform operates correctly and with maximum security:
            </p>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-extrabold text-slate-800 text-sm mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Necessary Cookies:
                </p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Essential for basic site operation, such as user authentication, bot protection, and correct content rendering. They cannot be disabled.
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-extrabold text-slate-800 text-sm mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Preference Cookies:
                </p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Allow the site to remember user choices (such as active search filters, view preferences, or visual theme) to offer a customized experience on future visits.
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-extrabold text-slate-800 text-sm mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  Performance and Analytics Cookies:
                </p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Help us understand how users interact with our platform by measuring page speed, visited pages, and any errors, allowing continuous performance improvements.
                </p>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <ShieldAlert size={20} />
              <h2 className="text-xl font-bold m-0">3. Third-Party Cookies</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Some cookies may be set by trusted partner services integrated into the site. For example:
            </p>
            <ul className="list-disc pl-5 text-slate-600 text-sm space-y-1.5 mt-2">
              <li><strong>Firebase Authentication & Database:</strong> Generate vital technical cookies to keep your session logged in without requiring frequent re-authentication.</li>
              <li><strong>Analytics Service:</strong> Collects anonymous data on clicks, views, and traffic to help us audit and prevent abuse or fraudulent behavior.</li>
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <CheckCircle size={20} />
              <h2 className="text-xl font-bold m-0">4. Managing or Disabling Cookies</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Most web browsers are configured to accept cookies by default. However, users can remove or reject cookies by changing their browser settings (e.g. Google Chrome, Mozilla Firefox, Safari, Microsoft Edge). Note that disabling necessary cookies may severely affect your experience and prevent proper login and listing publication on our platform.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <Shield size={20} />
              <h2 className="text-xl font-bold m-0">5. Contact and Additional Information</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              This Cookie Policy may be revised from time to time to reflect regulatory or operational changes at ConnectBoat. We recommend regularly consulting this page. If you require further clarification regarding our use of cookies and similar technologies, you may contact official support listed in the footer of the site.
            </p>
          </section>

          <div className="pt-8 border-t border-slate-100 flex justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center bg-[#52b64d] hover:bg-[#459d41] text-white font-extrabold px-8 py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all gap-2"
            >
              <X size={18} />
              Close and Return to Home
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Cookies;
