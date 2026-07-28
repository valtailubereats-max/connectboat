import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { MessageSquare, Send, CheckCircle2, Sparkles, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { manualAddPoints } from '../utils/rewards';

const Suggestions = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    if (!name && (profile?.name || user?.displayName)) {
      setName(profile?.name || user?.displayName || '');
    }
    if (!email && user?.email) {
      setEmail(user.email);
    }
  }, [user, profile, name, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setSubmitError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      // Gerar ID de documento único na coleção 'suggestions'
      const suggestionCollectionRef = collection(db, 'suggestions');
      const newDocRef = doc(suggestionCollectionRef);

      const suggestionData = {
        id: newDocRef.id,
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        status: 'new' as const,
        createdAt: serverTimestamp(),
        userId: user?.uid || null
      };

      await setDoc(newDocRef, suggestionData);

      // Award 5 points for sending a suggestion if logged in!
      if (user?.uid) {
        await manualAddPoints(user.uid, 5);
        if (refreshProfile) {
          await refreshProfile();
        }
      }

      setIsSubmitted(true);
      setName('');
      setEmail('');
      setMessage('');
    } catch (error: any) {
      console.error('Erro ao enviar sugestão:', error);
      setSubmitError('Houve um problema de conexão. Por favor, tente novamente mais tarde.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12" id="suggestions-page">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2rem] p-8 md:p-12 shadow-xl border border-slate-100 relative"
      >
        {/* Botão de Fechar / Voltar */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all cursor-pointer z-10"
          aria-label="Voltar"
          title="Voltar"
          id="close-suggestions-btn"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-[#e8f7ee] rounded-2xl flex items-center justify-center text-pt-green">
            <MessageSquare size={28} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Sugestões
              <Sparkles size={24} className="text-amber-500 animate-pulse" />
            </h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">
              Help us improve your experience on ConnectBoat
            </p>
          </div>
        </div>

        {isSubmitted ? (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-12 bg-[#e8f7ee]/50 rounded-[2rem] p-8 max-w-lg mx-auto border border-[#bfead0]"
            id="suggestion-success-msg"
          >
            <div className="w-16 h-16 bg-[#bfead0] rounded-full flex items-center justify-center text-pt-green mx-auto mb-6 shadow-sm">
              <CheckCircle2 size={36} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Muito Obrigado!</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              Obrigado! A sua sugestão foi enviada com sucesso e será analisada com muito carinho pela nossa equipa de desenvolvimento.
            </p>

            {user ? (
              <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center gap-2 max-w-sm mx-auto shadow-sm">
                <span className="text-xl">✨</span>
                <span className="text-xs font-black text-indigo-700 uppercase tracking-wider">
                  Ganhou +5 pontos de Destaque!
                </span>
              </div>
            ) : (
              <p className="text-slate-500 text-xs mb-6">
                Inicie sessão no ConnectBoat para receber pontos ao enviar sugestões.
              </p>
            )}

            <button
              onClick={() => setIsSubmitted(false)}
              className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl shadow-md border border-slate-200 transition-all text-sm cursor-pointer"
            >
              Enviar outra sugestão
            </button>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-12 gap-8 md:gap-12">
            {/* Informações da Esquerda */}
            <div className="md:col-span-5 space-y-6">
              <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3 text-sm">
                  💡 Tem uma Ideia?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Have an idea to improve ConnectBoat? Send us your suggestion. We want to hear your feedback on new features, design, ease of use, or any improvement that makes our marine marketplace better for everyone!
                </p>
              </div>

              <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3 text-sm">
                  🤝 Built for the Boating Community
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  ConnectBoat is built on user feedback. Many of our features come directly from ideas submitted by boaters like you.
                </p>
              </div>
            </div>

            {/* Formulário da Direita */}
            <form onSubmit={handleSubmit} className="md:col-span-7 space-y-5" id="suggestion-form">
              {submitError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 p-4 rounded-xl text-xs font-semibold">
                  ⚠️ {submitError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Seu Nome *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-pt-green/20 focus:border-pt-green outline-none text-sm transition-all"
                  id="suggestion-name-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Seu E-mail *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex: exemplo@gmail.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-pt-green/20 focus:border-pt-green outline-none text-sm transition-all"
                  id="suggestion-email-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Mensagem/Sugestão *</label>
                <textarea
                  required
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Descreva detalhadamente a sua ideia ou melhoria..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-pt-green/20 focus:border-pt-green outline-none text-sm transition-all resize-none"
                  id="suggestion-message-textarea"
                />
              </div>

              {user ? (
                <div className="p-3.5 bg-indigo-50 border border-indigo-100/50 rounded-xl flex items-center gap-2 text-xs text-indigo-700 font-bold uppercase tracking-wider">
                  <span>✨</span>
                  <span>As a ConnectBoat member, you earn +5 Feature points upon submission!</span>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-2 text-xs text-slate-500 font-bold uppercase tracking-wider">
                  <span>💡</span>
                  <span>Inicie sessão para ganhar +5 pontos de Destaque ao submeter!</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-xl shadow-md hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer ${
                  isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                }`}
                id="suggestion-submit-button"
              >
                <Send size={16} />
                {isSubmitting ? 'A enviar...' : 'Enviar sugestão'}
              </button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Suggestions;
