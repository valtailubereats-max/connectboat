import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import { Shield, Info, Database, Target, Lock, Scale, Cookie, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const Privacy = () => {
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Helmet>
        <title>Privacy Policy | ConnectBoat</title>
        <meta name="description" content="ConnectBoat Privacy Policy outlining how personal data and account details are managed securely." />
        <link rel="canonical" href="https://connectboat.co.uk/privacy" />
        <meta property="og:url" content="https://connectboat.co.uk/privacy" />
        <meta property="og:title" content="Privacy Policy | ConnectBoat" />
        <meta property="og:image" content="https://connectboat.co.uk/connectboat-og.png" />
        <meta name="twitter:image" content="https://connectboat.co.uk/connectboat-og.png" />
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2rem] p-8 md:p-12 shadow-xl border border-slate-100 relative"
      >
        {/* Close button at top */}
        <Link
          to="/"
          className="absolute top-6 right-6 md:top-8 md:right-8 text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-50 rounded-full border border-slate-100 shadow-sm"
          title="Close and return to home page"
        >
          <X size={20} />
        </Link>

        <div className="flex items-center gap-4 mb-8 pr-12">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
            <Shield size={28} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900">Privacy Policy</h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">ConnectBoat</p>
          </div>
        </div>

        <div className="prose prose-slate max-w-none space-y-8">
          <p className="text-sm font-semibold text-sky-600">Last updated: May 2026</p>

          <section>
            <div className="flex items-center gap-2 text-sky-600 mb-3">
              <Info size={20} />
              <h2 className="text-xl font-bold m-0">1. Introduction</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              ConnectBoat values your privacy. This policy describes how we collect, use, and safeguard your data when using our marine marketplace platform.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Database size={20} />
              <h2 className="text-xl font-bold m-0">2. Collected Data</h2>
            </div>
            <div className="space-y-3">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800 text-sm mb-1">Account:</p>
                <p className="text-slate-600 text-sm leading-relaxed">Name, email address, and profile photo (via Google Auth or registration).</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800 text-sm mb-1">Listings:</p>
                <p className="text-slate-600 text-sm leading-relaxed">Photos, descriptions, prices, and approximate location (City/Region).</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800 text-sm mb-1">Communication:</p>
                <p className="text-slate-600 text-sm leading-relaxed">Phone numbers are only displayed if the user explicitly chooses to include them in their listing.</p>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Target size={20} />
              <h2 className="text-xl font-bold m-0">3. Purpose of Data Usage</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Data is used exclusively to enable listing publication, account management, and direct communication between buyers and sellers on the ConnectBoat platform.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Lock size={20} />
              <h2 className="text-xl font-bold m-0">4. Storage & Security</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              We utilise Google Firebase infrastructure with secure data encryption. We never sell user data to third parties. Data is stored while your account remains active.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Scale size={20} />
              <h2 className="text-xl font-bold m-0">5. User Rights (GDPR)</h2>
            </div>
            <p className="text-slate-600 leading-relaxed mb-3">
              In compliance with the General Data Protection Regulation (GDPR), users hold the right to:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 text-sm leading-relaxed">
              <li>Access and update their personal data.</li>
              <li>Request complete deletion of their account and associated listings via the profile dashboard.</li>
              <li>Export their user data.</li>
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Cookie size={20} />
              <h2 className="text-xl font-bold m-0">6. Cookies</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              We use essential technical cookies solely to maintain session state and ensure secure browsing across the platform.
            </p>
          </section>

          <section className="pt-8 border-t border-slate-100">
            <p className="text-xs text-slate-400 leading-relaxed">
              This Privacy Policy is grounded in transparency, lawfulness, and security. If you have any questions regarding your data, please contact official support through the channels in the footer.
            </p>
          </section>

          <div className="pt-6 border-t border-slate-100 flex justify-center">
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

export default Privacy;
