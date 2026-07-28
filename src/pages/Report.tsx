import React, { useState } from 'react';
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
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    // Criar mensagem do WhatsApp pré-formatada para quem prefere agilidade
    const text = encodeURIComponent(
      `*DENÚNCIA - MERCADO LUSO*\n\n` +
      `*Nome:* ${name}\n` +
      `*E-mail:* ${email}\n` +
      `*Link do Anúncio (se houver):* ${adLink || 'Não informado'}\n` +
      `*Motivo:* ${reason}\n` +
      `*Detalhes:* ${details}`
    );
    const whatsappUrl = `https://wa.me/4407508309536?text=${text}`;

    // Abrir o WhatsApp
    window.open(whatsappUrl, '_blank');
    setIsSubmitted(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2rem] p-8 md:p-12 shadow-xl border border-slate-100 relative"
      >
        {/* Botão de Fechar / Voltar */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all cursor-pointer z-10"
          aria-label="Voltar"
          title="Voltar"
          id="close-report-btn"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500">
            <AlertTriangle size={28} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900">Centro de Denúncias</h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">Ajude-nos a manter o Mercado Luso seguro</p>
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
            <h2 className="text-2xl font-black text-slate-900 mb-2">Denúncia Encaminhada!</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              A sua denúncia foi pré-estruturada e redirecionada para a nossa equipa de moderação via canal oficial. Agradecemos muito a sua colaboração para manter a comunidade fidedigna.
            </p>
            <button 
              onClick={() => setIsSubmitted(false)}
              className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl shadow-md border border-slate-200 transition-all text-sm"
            >
              Fazer outra denúncia
            </button>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-12 gap-8 md:gap-12">
            {/* Informações da Esquerda */}
            <div className="md:col-span-5 space-y-6">
              <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                  <Info size={16} className="text-rose-500" />
                  Compromisso Segurança
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Avaliaremos cada denúncia com a maior presteza. Caso o anúncio contenha atividades fraudulentas ou que violem os nossos Termos de Uso, este será removido sem aviso prévio e o utilizador responsável será banido permanentemente.
                </p>
              </div>

              <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                  <FileText size={16} className="text-indigo-500" />
                  O que denunciar?
                </h3>
                <ul className="text-xs text-slate-500 space-y-2 list-disc pl-4 leading-relaxed">
                  <li>Anúncios fraudulentos, falsos ou com preços irrealistas.</li>
                  <li>Inappropriate or abusive use of ConnectBoat communication channels.</li>
                  <li>Plágio de conteúdo ou fotos sem autorização.</li>
                  <li>Artigos proibidos no território ou falsificações.</li>
                </ul>
              </div>
            </div>

            {/* Formulário da Direita */}
            <form onSubmit={handleSubmit} className="md:col-span-7 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Seu Nome *</label>
                <input 
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-sm transition-all"
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
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 font-bold">Link do Anúncio (opcional)</label>
                <input 
                  type="text"
                  value={adLink}
                  onChange={(e) => setAdLink(e.target.value)}
                  placeholder="Cole aqui o link do anúncio suspeito"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Motivo Principal *</label>
                <select 
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-sm transition-all bg-white"
                >
                  <option value="Fraude">Fraude / Golpe financeiro</option>
                  <option value="Preço">Preço irreal ou abusivo</option>
                  <option value="Produto">Produto proibido ou ilegal</option>
                  <option value="Spam">Spam ou anúncio repetitivo</option>
                  <option value="Utilizador">Utilizador ofensivo ou abusivo</option>
                  <option value="Outro">Outro motivo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Detalhes da Ocorrência *</label>
                <textarea 
                  required
                  rows={4}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Por favor, explique brevemente o problema, número de contacto ou dados do anunciante."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-sm transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-rose-500/20 transition-all text-sm flex items-center justify-center gap-2"
              >
                <Send size={16} /> Enviar Denúncia
              </button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Report;
