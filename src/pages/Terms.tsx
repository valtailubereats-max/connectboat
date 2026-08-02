import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import { Shield, Info, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const Terms = () => {
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Helmet>
        <title>Terms of Use | ConnectBoat</title>
        <meta name="description" content="Read the ConnectBoat Terms of Use for buyers, sellers, brokers, and marine service providers." />
        <link rel="canonical" href="https://connectboat.co.uk/terms" />
        <meta property="og:url" content="https://connectboat.co.uk/terms" />
        <meta property="og:title" content="Terms of Use | ConnectBoat" />
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
          <h1 className="text-3xl md:text-4xl font-black text-slate-900">Terms of Use</h1>
        </div>

        <div className="prose prose-slate max-w-none space-y-8">
          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Info size={20} />
              <h2 className="text-xl font-bold m-0">1. Nature of the Platform</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              ConnectBoat is an online marine marketplace acting exclusively as a venue connecting boat buyers, sellers, charters, and marine service providers. We are not an e-commerce platform, auction house, or financial institution.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <AlertTriangle size={20} />
              <h2 className="text-xl font-bold m-0">2. Disclaimer & Exemption of Liability</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              The platform <strong>does not participate</strong> in any way in negotiations, payments, deliveries, or guarantees for advertised products or services. All communication and transactions occur directly between users, often outside our platform (e.g. via WhatsApp or in-person meetings).
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <CheckCircle size={20} />
              <h2 className="text-xl font-bold m-0">3. User Responsibilities</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Users are solely responsible for:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Verifying the accuracy and condition of advertised items.</li>
              <li>Ensuring the security of their own financial transactions.</li>
              <li>Complying with tax and legal obligations arising from sales or purchases.</li>
              <li>Maintaining courtesy and respect in all communications.</li>
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Shield size={20} />
              <h2 className="text-xl font-bold m-0">4. Security Recommendations</h2>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 text-amber-900">
              <p className="font-bold mb-2">For your safety, we recommend:</p>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li>Never make advance payments or deposits without verified guarantees.</li>
                <li>Prefer meeting in safe, public places to inspect items in person.</li>
                <li>Be cautious of unrealistically cheap offers or urgent demands.</li>
                <li>Inspect products thoroughly before completing any payment.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Moderation and Content</h2>
            <p className="text-slate-600 leading-relaxed">
              We reserve the right to remove any listing that violates our policies, contains inappropriate or fraudulent content, or is subject to substantiated reports, without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">6. Limitation of Liability</h2>
            <p className="text-slate-600 leading-relaxed">
              ConnectBoat is not liable for any direct or indirect damages, financial losses, fraud, or disputes arising from user interactions. Use of the platform is at the user's sole risk.
            </p>
          </section>

          <section className="pt-8 border-t border-slate-100">
            <p className="text-sm text-slate-400">
              These terms may be updated at any time to reflect platform enhancements or legal requirements. Continued use of the service constitutes acceptance of the current terms.
            </p>
            <p className="text-sm text-slate-400 mt-2">
              Last updated: 23 March 2026.
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

export default Terms;
