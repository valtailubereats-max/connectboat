import React from 'react';
import { motion } from 'motion/react';
import { Shield, Info, Cookie, Settings, ShieldAlert, CheckCircle, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const Cookies = () => {
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
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
            <Cookie size={28} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900">Política de Cookies</h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">Mercado Luso</p>
          </div>
        </div>

        <div className="prose prose-slate max-w-none space-y-8">
          <p className="text-sm font-semibold text-emerald-600">Última atualização: Junho de 2026</p>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <Info size={20} />
              <h2 className="text-xl font-bold m-0">1. O que são Cookies?</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Cookies são pequenos ficheiros de texto armazenados no seu computador ou dispositivo móvel quando visita um website. Estes ficheiros ajudam a melhorar a sua experiência ao guardar as suas preferências, autenticar o seu acesso e recolher estatísticas agregadas de utilização de forma anónima.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <Settings size={20} />
              <h2 className="text-xl font-bold m-0">2. Como utilizamos os Cookies?</h2>
            </div>
            <p className="text-slate-600 leading-relaxed font-semibold mb-3">
              No Mercado Luso, utilizamos diferentes tipos de cookies para garantir que a plataforma funciona corretamente e com a máxima segurança:
            </p>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-extrabold text-slate-800 text-sm mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Cookies Necessários:
                </p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Essenciais para o funcionamento básico do site, como autenticação de utilizadores, proteção contra bots e carregamento correto do conteúdo. Não podem ser desativados.
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-extrabold text-slate-800 text-sm mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Cookies de Preferências:
                </p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Permitem que o site se lembre das escolhas do utilizador (como os filtros de pesquisa ativa, preferências de visualização ou tema visual) para oferecer uma experiência personalizada nas próximas visitas.
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-extrabold text-slate-800 text-sm mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  Cookies de Desempenho e Estatísticas:
                </p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Ajudam-nos a compreender de que forma os utilizadores interagem com a nossa plataforma, medindo a velocidade da página, páginas visitadas e eventuais erros, permitindo melhorias constantes de performance.
                </p>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <ShieldAlert size={20} />
              <h2 className="text-xl font-bold m-0">3. Cookies de Terceiros</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Alguns cookies podem ser definidos por serviços parceiros de confiança que integramos no site. Por exemplo:
            </p>
            <ul className="list-disc pl-5 text-slate-600 text-sm space-y-1.5 mt-2">
              <li><strong>Firebase Authentication & Database:</strong> Geram cookies técnicos vitais para manter a sua sessão iniciada sem necessitar de nova autenticação frequente.</li>
              <li><strong>Serviço de Análises:</strong> Recolhe dados anónimos sobre cliques, visualizações e tráfego de forma a nos ajudar a policiar e prevenir abusos ou comportamentos fraudulentos.</li>
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <CheckCircle size={20} />
              <h2 className="text-xl font-bold m-0">4. Como gerir ou desativar Cookies?</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              A maioria dos navegadores de internet está configurada para aceitar cookies por defeito. No entanto, o utilizador pode remover ou rejeitar cookies alterando as definições do seu próprio navegador (Ex: Google Chrome, Mozilla Firefox, Safari, Microsoft Edge). No entanto, note que a desativação de cookies necessários pode afetar gravemente a sua experiência e impedir o correto início de sessão e a publicação de anúncios na nossa plataforma.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <Shield size={20} />
              <h2 className="text-xl font-bold m-0">5. Contacto e Informações Adicionais</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Esta Política de Cookies pode ser revista de tempos a tempos para refletir alterações regulamentares ou de funcionamento do Mercado Luso. Recomendamos a consulta regular desta página. Se desejar esclarecimentos adicionais sobre a nossa utilização de cookies e tecnologias semelhantes, pode entrar em contacto com o suporte oficial indicado no rodapé do site.
            </p>
          </section>

          <div className="pt-8 border-t border-slate-100 flex justify-center">
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

export default Cookies;
