import React from 'react';
import { motion } from 'motion/react';
import { Shield, Info, Database, Target, Lock, Scale, Cookie, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const Privacy = () => {
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2rem] p-8 md:p-12 shadow-xl border border-slate-100 relative"
      >
        {/* Botão fechar no topo */}
        <Link
          to="/"
          className="absolute top-6 right-6 md:top-8 md:right-8 text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-50 rounded-full border border-slate-100 shadow-sm"
          title="Fechar e voltar à página principal"
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
              <h2 className="text-xl font-bold m-0">2. Dados Recolhidos</h2>
            </div>
            <div className="space-y-3">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800 text-sm mb-1">Conta:</p>
                <p className="text-slate-600 text-sm leading-relaxed">Nome, e-mail e foto de perfil (via Google Auth ou registo).</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800 text-sm mb-1">Anúncios:</p>
                <p className="text-slate-600 text-sm leading-relaxed">Fotos, descrições, preços e localização aproximada (Distrito/Concelho).</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800 text-sm mb-1">Comunicação:</p>
                <p className="text-slate-600 text-sm leading-relaxed">O número de telefone apenas é exibido se o utilizador o decidir incluir no anúncio.</p>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Target size={20} />
              <h2 className="text-xl font-bold m-0">3. Finalidade dos Dados</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Os dados servem exclusivamente para permitir a publicação de anúncios, a gestão da sua conta e a comunicação entre compradores e vendedores dentro do território português.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Lock size={20} />
              <h2 className="text-xl font-bold m-0">4. Armazenamento e Segurança</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Utilizamos a infraestrutura Google Firebase com encriptação de dados. Não vendemos os seus dados a terceiros. Os dados são armazenados enquanto a sua conta estiver ativa.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Scale size={20} />
              <h2 className="text-xl font-bold m-0">5. Direitos do Utilizador (RGPD)</h2>
            </div>
            <p className="text-slate-600 leading-relaxed mb-3">
              Em conformidade com o Regulamento Geral sobre a Proteção de Dados (RGPD), o utilizador tem o direito de:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 text-sm leading-relaxed">
              <li>Aceder e retificar os seus dados.</li>
              <li>Solicitar a eliminação definitiva da sua conta e todos os anúncios associados através do painel de perfil.</li>
              <li>Exportar os seus dados de utilizador.</li>
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Cookie size={20} />
              <h2 className="text-xl font-bold m-0">6. Cookies</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Utilizamos cookies técnicos essenciais apenas para manter a sua sessão iniciada e garantir a segurança da navegação.
            </p>
          </section>

          <section className="pt-8 border-t border-slate-100">
            <p className="text-xs text-slate-400 leading-relaxed">
              Esta Política de Privacidade foi estruturada sob os princípios de transparência, licitude e segurança. Caso possua alguma dúvida referente aos seus dados, contacte o suporte oficial da plataforma através dos canais de contacto disponibilizados no rodapé.
            </p>
          </section>

          <div className="pt-6 border-t border-slate-100 flex justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center bg-[#52b64d] hover:bg-[#459d41] text-white font-extrabold px-8 py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all gap-2"
            >
              <X size={18} />
              Fechar e Voltar ao Início
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Privacy;
