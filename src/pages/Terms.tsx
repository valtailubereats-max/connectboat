import React from 'react';
import { motion } from 'motion/react';
import { Shield, Info, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const Terms = () => {
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
          <h1 className="text-3xl md:text-4xl font-black text-slate-900">Termos de Uso</h1>
        </div>

        <div className="prose prose-slate max-w-none space-y-8">
          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Info size={20} />
              <h2 className="text-xl font-bold m-0">1. Natureza da Plataforma</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              ConnectBoat is an online marine marketplace acting exclusively as a venue connecting boat buyers, sellers, charters, and marine service providers. We are not an e-commerce, auction, or financial institution.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <AlertTriangle size={20} />
              <h2 className="text-xl font-bold m-0">2. Isenção de Responsabilidade</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              A plataforma <strong>não participa</strong>, de qualquer forma, das negociações, pagamentos, entregas ou garantias dos produtos e serviços anunciados. Toda a comunicação e transação ocorre diretamente entre os utilizadores, muitas vezes fora da nossa plataforma (ex: via WhatsApp ou encontros presenciais).
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <CheckCircle size={20} />
              <h2 className="text-xl font-bold m-0">3. Responsabilidade do Utilizador</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Os utilizadores são os únicos responsáveis por:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Verificar a veracidade e as condições dos itens anunciados.</li>
              <li>Garantir a segurança da sua própria transação financeira.</li>
              <li>Cumprir com as obrigações fiscais e legais decorrentes da venda.</li>
              <li>Manter a cordialidade e o respeito nas comunicações.</li>
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Shield size={20} />
              <h2 className="text-xl font-bold m-0">4. Recomendações de Segurança</h2>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 text-amber-900">
              <p className="font-bold mb-2">Para sua proteção, recomendamos:</p>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li>Nunca faça pagamentos antecipados (reservas, sinal) sem garantias reais.</li>
                <li>Dê preferência a encontros em locais públicos e movimentados para ver o produto.</li>
                <li>Desconfie de ofertas excessivamente baratas ou propostas urgentes.</li>
                <li>Verifique o produto minuciosamente antes de concluir o pagamento.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Moderação e Conteúdo</h2>
            <p className="text-slate-600 leading-relaxed">
              Reservamo-nos o direito de remover qualquer anúncio que viole as nossas políticas, contenha conteúdo impróprio, fraudulento ou que recebamos denúncias fundamentadas, sem aviso prévio.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">6. Limitação de Responsabilidade</h2>
            <p className="text-slate-600 leading-relaxed">
              ConnectBoat is not liable for any direct or indirect damages, financial losses, frauds, or disputes arising from user interactions. Use of the platform is at the user's sole risk.
            </p>
          </section>

          <section className="pt-8 border-t border-slate-100">
            <p className="text-sm text-slate-400">
              Estes termos podem ser alterados a qualquer momento para refletir melhorias na plataforma ou mudanças legislativas. O uso continuado do serviço implica a aceitação dos termos vigentes.
            </p>
            <p className="text-sm text-slate-400 mt-2">
              Última atualização: 23 de Março de 2026.
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

export default Terms;
