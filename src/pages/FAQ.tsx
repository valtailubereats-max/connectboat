import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, ChevronDown, ChevronUp, Search, MessageCircle, Mail } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const faqData: FAQItem[] = [
    {
      question: 'What is ConnectBoat?',
      answer: 'ConnectBoat is a premier marine marketplace connecting boat buyers, sellers, brokers, and marine service providers. Our goal is to make buying, selling, and hiring boats simple, direct, and secure.'
    },
    {
      question: 'How do I post a listing?',
      answer: 'Click the "Post Listing" button in the menu. If you do not have an account, registration takes only seconds. Fill in details (title, price, category, photos, location) and submit for quick approval.'
    },
    {
      question: 'Is listing free on ConnectBoat?',
      answer: 'Yes! Basic listings on ConnectBoat are free. There are no seller commissions or hidden fees for basic posts.'
    },
    {
      question: 'How do I contact a seller?',
      answer: 'Each listing page features direct contact buttons for WhatsApp or phone inquiries, allowing you to get in touch with sellers instantly.'
    },
    {
      question: 'How does listing promotion work?',
      answer: 'Featured listings appear in priority carousel spots on the homepage, significantly boosting exposure for your boat, engine, or service.'
    },
    {
      question: 'How do I earn feature credits?',
      answer: 'Earn promo credits by inviting fellow boating enthusiasts to ConnectBoat! Share your referral link from your Profile tab.'
    },
    {
      question: 'How do I report a listing?',
      answer: 'If you encounter any suspicious or deceptive listing, click "Report" on the listing page or in the footer to notify our moderation team.'
    },
    {
      question: 'How do I contact support?',
      answer: 'Reach out to us via direct support or email contato@connectboat.co.uk. Our team is available to assist you with any questions.'
    }
  ];

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const filteredFaq = faqData.filter(item =>
    item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-12" id="faq-page">
      <Helmet>
        <title>Frequently Asked Questions (FAQ) | ConnectBoat</title>
        <meta name="description" content="Find answers to common questions about buying, selling, and chartering boats on ConnectBoat." />
        <link rel="canonical" href="https://connectboat.co.uk/faq" />
        <meta property="og:url" content="https://connectboat.co.uk/faq" />
        <meta property="og:title" content="FAQ | ConnectBoat" />
        <meta property="og:image" content="https://connectboat.co.uk/og-image.png" />
        <meta name="twitter:image" content="https://connectboat.co.uk/og-image.png" />
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto">
            <HelpCircle size={28} />
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Frequently Asked Questions</h1>
          <p className="text-slate-500 text-sm max-w-lg mx-auto">
            Find answers to common questions about buying, selling, and advertising on ConnectBoat.
          </p>
        </div>

        {/* Search tool */}
        <div className="relative max-w-lg mx-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for a question or topic..."
            className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-sm"
            id="faq-search-input"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        </div>

        {/* FAQ Items (Accordion) */}
        <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-xl border border-slate-100 divide-y divide-slate-100" id="faq-accordion-container">
          {filteredFaq.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm font-medium">
              No questions match your search query.
            </div>
          ) : (
            filteredFaq.map((item, index) => {
              const isOpen = openIndex === index;
              return (
                <div key={`faq-item-${index}`} className="py-4 first:pt-0 last:pb-0" id={`faq-item-${index}`}>
                  <button
                    onClick={() => toggleAccordion(index)}
                    className="w-full flex justify-between items-center py-2 text-left font-bold text-slate-800 hover:text-indigo-600 gap-4 transition-colors focus:outline-none text-base cursor-pointer"
                    aria-expanded={isOpen}
                    id={`faq-btn-${index}`}
                  >
                    <span>{item.question}</span>
                    <span className="shrink-0 text-slate-400">
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                        animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100" id={`faq-answer-${index}`}>
                          {item.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>

        {/* Still need help? */}
        <div className="bg-[#bfead0]/30 rounded-[2.5rem] p-8 border border-[#a8dec0]/40 text-center max-w-xl mx-auto mt-12">
          <h3 className="font-bold text-slate-800 mb-2">Still need assistance?</h3>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            If you couldn't find what you were looking for, our support team is always ready to assist you.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href="https://wa.me/4407508309536" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 shadow-sm transition-all uppercase tracking-wider cursor-pointer"
              id="faq-whatsapp-support-link"
            >
              <MessageCircle size={16} /> WhatsApp Support
            </a>
            <a
              href="mailto:contato@connectboat.co.uk"
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 shadow-sm transition-all uppercase tracking-wider cursor-pointer"
              id="faq-email-support-link"
            >
              <Mail size={16} /> Send Email
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default FAQ;
