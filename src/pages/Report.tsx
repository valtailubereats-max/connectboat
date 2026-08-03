import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, Send, Phone, MessageSquare, Info, FileText, X } from 'lucide-react';

const Report = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [adLink, setAdLink] = useState('');
  const [reason, setReason] = useState('Fraude');
  const [details, setDetails] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !details) {
      alert('Please fill in all required fields.');
      return;
    }

    // Create pre-formatted WhatsApp message
    const text = encodeURIComponent(
      `*REPORT - CONNECTBOAT*\n\n` +
      `*Name:* ${name}\n` +
      `*Email:* ${email}\n` +
      `*Listing Link:* ${adLink || 'Not provided'}\n` +
      `*Reason:* ${reason}\n` +
      `*Details:* ${details}`
    );
    const whatsappUrl = `https://wa.me/4407508309536?text=${text}`;

    // Open WhatsApp
    window.open(whatsappUrl, '_blank');
    setIsSubmitted(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Helmet>
        <title>Report Listing | ConnectBoat</title>
        <meta name="description" content="Report suspicious or abusive listings on ConnectBoat to keep our UK boat marketplace safe." />
        <link rel="canonical" href="https://connectboat.co.uk/report" />
        <meta property="og:url" content="https://connectboat.co.uk/report" />
        <meta property="og:title" content="Report Listing | ConnectBoat" />
        <meta property="og:image" content="https://connectboat.co.uk/api/og-image" />
        <meta name="twitter:image" content="https://connectboat.co.uk/api/og-image" />
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2rem] p-8 md:p-12 shadow-xl border border-slate-100 relative"
      >
        {/* Close / Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all cursor-pointer z-10"
          aria-label="Back"
          title="Back"
          id="close-report-btn"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500">
            <AlertTriangle size={28} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900">Report Centre</h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">Help us keep ConnectBoat safe and trusted</p>
          </div>
        </div>

        {isSubmitted ? (
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-12 bg-emerald-50 rounded-[2rem] p-8 max-w-lg mx-auto border border-emerald-100"
          >
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-6">
              <ShieldCheck size={36} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Report Submitted!</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              Your report has been forwarded to our moderation team. Thank you for helping keep our community safe.
            </p>
            <button 
              onClick={() => setIsSubmitted(false)}
              className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl shadow-md border border-slate-200 transition-all text-sm cursor-pointer"
            >
              Submit another report
            </button>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-12 gap-8 md:gap-12">
            {/* Left Column */}
            <div className="md:col-span-5 space-y-6">
              <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                  <Info size={16} className="text-rose-500" />
                  Safety Commitment
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  We evaluate every report promptly. If a listing contains fraudulent activity or violates our Terms of Use, it will be removed immediately and the user permanently banned.
                </p>
              </div>

              <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                  <FileText size={16} className="text-indigo-500" />
                  What to report?
                </h3>
                <ul className="text-xs text-slate-500 space-y-2 list-disc pl-4 leading-relaxed">
                  <li>Fraudulent, deceptive, or misleading listings.</li>
                  <li>Inappropriate or abusive use of ConnectBoat communication channels.</li>
                  <li>Unauthorised use of copyrighted photos or content.</li>
                  <li>Prohibited, illegal, or counterfeit items.</li>
                </ul>
              </div>
            </div>

            {/* Right Form */}
            <form onSubmit={handleSubmit} className="md:col-span-7 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Your Name *</label>
                <input 
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Your Email *</label>
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. example@gmail.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 font-bold">Listing Link (optional)</label>
                <input 
                  type="text"
                  value={adLink}
                  onChange={(e) => setAdLink(e.target.value)}
                  placeholder="Paste the link of the listing here"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Primary Reason *</label>
                <select 
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-sm transition-all bg-white"
                >
                  <option value="Fraude">Fraud / Scam</option>
                  <option value="Preço">Unrealistic or misleading price</option>
                  <option value="Produto">Prohibited or illegal item</option>
                  <option value="Spam">Spam or duplicate listing</option>
                  <option value="Utilizador">Offensive or abusive user</option>
                  <option value="Outro">Other reason</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Details of the Issue *</label>
                <textarea 
                  required
                  rows={4}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Please briefly describe the issue, contact details, or seller information."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-sm transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-rose-500/20 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send size={16} /> Submit Report
              </button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Report;
