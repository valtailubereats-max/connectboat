export type ManualItemType = 
  | 'Página' 
  | 'Botão' 
  | 'Formulário' 
  | 'Fluxo' 
  | 'Admin' 
  | 'Firestore' 
  | 'Monetização' 
  | 'Vitrine' 
  | 'Anúncios';

export interface ManualItem {
  id: string;
  title: string;
  type: ManualItemType;
  description: string;
  route: string;
  mainFile: string;
  relatedComponents: string[];
  relatedFunctions: string[];
  firestoreCollections: string[];
  access: string;
  buttons: string[];
  actions: string[];
  technicalNotes: string;
  failurePoints: string[];
  tags: string[];
}

export interface TechnicalFlow {
  id: string;
  title: string;
  description: string;
  startPoint: string;
  buttonsInvolved: string[];
  pagesInvolved: string[];
  mainFiles: string[];
  firestoreCollections: string[];
  expectedResult: string;
}

export const manualItems: ManualItem[] = [
  {
    id: 'home',
    title: 'Home (Página Inicial)',
    type: 'Página',
    description: 'Página principal e de entrada do ConnectBoat. Apresenta o banner dinâmico, canais de destaque, anúncios em destaque e grid ou carrossel de vitrines.',
    route: '/',
    mainFile: 'src/pages/Home.tsx',
    relatedComponents: ['src/components/AdCard.tsx', 'src/components/ShowcaseStats.tsx'],
    relatedFunctions: ['fetchAds', 'fetchShowcases', 'setCountry', 'handleSearch'],
    firestoreCollections: ['ads', 'showcases', 'settings'],
    access: 'Público (Qualquer visitante)',
    buttons: ['Alternar País (Bandeiras)', 'Campo de Pesquisa', 'Botão Anunciar', 'Ver Todas as Vitrines', 'Ver Mais Anúncios'],
    actions: ['Redirecionar para criação de anúncios', 'Filtrar anúncios por país selecionado (PT/UK)', 'Realizar pesquisa textual por título ou tags'],
    technicalNotes: 'A home carrega os dados com base no país selecionado no AuthContext ou localStorage. Se as vitrines estiverem aprovadas, elas são listadas no carrossel de empreendedores.',
    failurePoints: [
      'Falha na API flagcdn.com ao renderizar bandeiras.',
      'Excesso de leituras no Firestore se não houver paginação/limite na listagem de anúncios.',
      'Imagens pesadas de capa afetando o First Contentful Paint.'
    ],
    tags: ['home', 'página inicial', 'vitrines', 'anúncios', 'lisboa', 'londres', 'busca']
  },
  {
    id: 'navbar-menu',
    title: 'Navbar & Menu de Utilizador',
    type: 'Botão',
    description: 'Barra de navegação persistente presente em todas as páginas. Permite ir para Home, Preços, Criar Anúncio, Notificações e aceder ao Menu do Utilizador com o avatar exibindo o nome/sigla de 4 letras do usuário.',
    route: 'Todas as rotas (Global)',
    mainFile: 'src/App.tsx',
    relatedComponents: ['src/hooks/useClickOutside.ts'],
    relatedFunctions: ['getUserSignature', 'logout', 'toggleNotifications'],
    firestoreCollections: ['users', 'notifications', 'ads'],
    access: 'Botões públicos; painéis de perfil e admin restritos',
    buttons: ['Anunciar (+)', 'Sino de Notificações', 'Sigla de Utilizador (ex: VALT)', 'Sair/Logout', 'Painel Admin'],
    actions: ['Navegar para /create-ad', 'Navegar para /admin (se admin)', 'Terminar sessão', 'Ver notificações não lidas'],
    technicalNotes: 'A sigla do usuário no menu exibe as 4 primeiras letras do nome do perfil ou iniciais derivadas do email da pessoa logged in (ex: VALT). Substitui o antigo botão Admin na barra principal.',
    failurePoints: [
      'Dropdown do menu cortado em telas de telemóvel muito pequenas.',
      'Sino de notificações não atualizar em tempo real se a query snapshot falhar.',
      'Desalinhamento da sigla circular.'
    ],
    tags: ['navbar', 'menu', 'cabeçalho', 'navegação', 'assinar', 'anunciar', 'admin']
  },
  {
    id: 'criar-anuncio',
    title: 'Criar / Editar Anúncio',
    type: 'Formulário',
    description: 'Interface de formulário multi-etapas para criação de anúncios de produtos, serviços ou empregos. Permite seleção de categoria, upload de múltiplas imagens, definição de preço, localização e escolha de plano de destaque.',
    route: '/create-ad, /edit-ad/:id',
    mainFile: 'src/pages/CreateAd.tsx',
    relatedComponents: ['src/components/SearchableCitySelect.tsx'],
    relatedFunctions: ['handleSubmitAd', 'uploadImagesToStorage', 'handlePlanSelection'],
    firestoreCollections: ['ads', 'users', 'settings'],
    access: 'Utilizador Autenticado',
    buttons: ['Submeter Imagens', 'Escolher Plano (Grátis, Local, Nacional)', 'Publicar Anúncio', 'Guardar Alterações'],
    actions: ['Upload de ficheiros para o Firebase Storage', 'Escrever documento na coleção "ads"', 'Enviar notificação ao Admin para aprovação'],
    technicalNotes: 'Para planos pagos, o status do anúncio inicia como "pending" e necessita de moderação por um Admin. Imagens são compactadas ou validadas conforme o limite do plano associado nas Definições globais.',
    failurePoints: [
      'Upload de arquivos muito grandes excedendo cotas do Storage.',
      'Formulário quebrar se o utilizador não tiver preenchido telefone ou cidade do Perfil.',
      'Erros ao carregar cidades remotamente.'
    ],
    tags: ['criar', 'anunciar', 'anúncio', 'formulário', 'imagens', 'plano', 'upload']
  },
  {
    id: 'detalhes-anuncio',
    title: 'Detalhes do Anúncio',
    type: 'Página',
    description: 'Página detalhada de visualização de um anúncio específico. Mostra carrossel de imagens, preço, localização com mapa embutido do Google Maps, descrição formatada, botão de contato via WhatsApp direto e ficha técnica do anunciante.',
    route: '/anuncio/:id',
    mainFile: 'src/pages/AdDetails.tsx',
    relatedComponents: ['src/components/ReviewModal.tsx'],
    relatedFunctions: ['toggleFavoriteGlobal', 'incrementViewCount', 'sendWhatsAppMessage'],
    firestoreCollections: ['ads', 'users', 'reviews'],
    access: 'Público',
    buttons: ['Contactar via WhatsApp', 'Favoritar (Coração)', 'Ver Detalhes do Vendedor', 'Denunciar Anúncio', 'Escrever Avaliação'],
    actions: ['Incrementar visualizações no Firestore', 'Adicionar/Remover ID do anúncio dos favoritos do utilizador', 'Carregar avaliações do vendedor'],
    technicalNotes: 'O mapa do Google é embutido dinamicamente com um iframe seguro baseado na cidade e país do anúncio. Caso as imagens estejam corrompidas ou limpas, fallbacks do Unsplash são carregados.',
    failurePoints: [
      'Iframe do Google Maps bloquear devido a caracteres especiais na query.',
      'Botão do WhatsApp formatado sem o código internacional do país (ex: +351 ou +44).'
    ],
    tags: ['anúncio', 'detalhes', 'visualização', 'mapa', 'vendedor', 'whatsapp']
  },
  {
    id: 'perfil',
    title: 'Perfil / Meu Painel',
    type: 'Página',
    description: 'Área pessoal do utilizador autenticado onde ele pode gerir os seus dados pessoais (Nome, Telefone, Região), ver os seus anúncios ativos e pendentes, gerir a sua Vitrine Digital, ver avaliações recebidas e configurar dados de faturação.',
    route: '/profile',
    mainFile: 'src/pages/Profile.tsx',
    relatedComponents: ['src/components/ShowcaseInterests.tsx', 'src/components/ShowcaseStats.tsx'],
    relatedFunctions: ['updateProfile', 'saveShowcaseSettings', 'handleUserDeletion'],
    firestoreCollections: ['users', 'ads', 'showcaseProducts', 'purchases'],
    access: 'Utilizador Autenticado (Dono da conta)',
    buttons: ['Guardar Alterações', 'Configurar Minha Vitrine', 'Histórico de Faturação', 'Eliminar Conta', 'Adicionar Produto à Vitrine'],
    actions: ['Atualizar documento "users" correspondente ao uid', 'Submeter dados da vitrine comercial (logo, capa, WhatsApp)'],
    technicalNotes: 'Utiliza abas na URL para manter o estado da navegação (ex: ?tab=profile, ?tab=ads, ?tab=showcase). Se o utilizador ativar a Vitrine Digital, a coleção "users" ativa as flags "showcaseActive" e "showcasePlan".',
    failurePoints: [
      'Campos obrigatórios vazios impedindo a submissão de alterações no Perfil.',
      'Logo ou capa da Vitrine com links quebrados.',
      'Sincronização de plano de destaque expirado.'
    ],
    tags: ['perfil', 'dados', 'editar', 'utilizador', 'conta', 'vitrine']
  },
  {
    id: 'meus-anuncios',
    title: 'Meus Anúncios',
    type: 'Anúncios',
    description: 'Secção secundária dentro do Perfil do utilizador contendo todos os anúncios criados por ele. Permite visualizar o status (Aprovado, Pendente, Rejeitado, Expirado), renovar planos e enviar avisos de venda.',
    route: '/profile?tab=ads',
    mainFile: 'src/pages/Profile.tsx',
    relatedComponents: ['src/components/AdCard.tsx'],
    relatedFunctions: ['deleteAd', 'renewAdPlan', 'markAsSold'],
    firestoreCollections: ['ads'],
    access: 'Utilizador Autenticado',
    buttons: ['Editar', 'Eliminar', 'Marcar como Vendido', 'Promover Plano', 'Renovar Anúncio'],
    actions: ['Mudar "status" do anúncio para "sold" ou "archived"', 'Restaurar anúncios expirados para pendente após pagamento'],
    technicalNotes: 'Os anúncios são filtrados localmente por `where("userId", "==", user.uid)`. Ao marcar como vendido, o anúncio sai da listagem pública mas permanece no histórico.',
    failurePoints: [
      'Inexistência do índice composto no Firestore para filtrar anúncios por userId e orderby.',
      'Múltiplas requisições ao apagar anúncios consecutivamente.'
    ],
    tags: ['anúncios', 'gerir', 'renovar', 'destacar', 'apagar']
  },
  {
    id: 'favoritos',
    title: 'Favoritos',
    type: 'Anúncios',
    description: 'Secção na conta do utilizador que lista todos os anúncios que ele curtiu ou guardou para monitorar alterações de preço e disponibilidade.',
    route: '/profile?tab=favorites',
    mainFile: 'src/pages/Profile.tsx',
    relatedComponents: ['src/components/AdCard.tsx'],
    relatedFunctions: ['toggleFavoriteGlobal', 'fetchFavoriteAds'],
    firestoreCollections: ['users', 'ads'],
    access: 'Utilizador Autenticado',
    buttons: ['Remover dos Favoritos (Coração)', 'Ver Detalhes do Anúncio', 'Contactar Vendedor'],
    actions: ['Remover o ID do anúncio do array "favorites" no documento "users"'],
    technicalNotes: 'Os favoritos são guardados como um array de strings contendo IDs de anúncios no documento do usuário. Se um anúncio for apagado pelo dono original, o ID órfão deve ser filtrado ou ignorado.',
    failurePoints: [
      'Falha de renderização ao tentar carregar dados de um anúncio favoritado que já foi completamente eliminado do banco.'
    ],
    tags: ['favoritos', 'salvar', 'anúncios', 'interesse']
  },
  {
    id: 'compras',
    title: 'Compras (Histórico)',
    type: 'Monetização',
    description: 'Controle de transações e histórico de faturas geradas pelos planos de destaque ou taxa de ativação da vitrine digital. Contém recibos virtuais e datas das operações.',
    route: '/profile?tab=purchases',
    mainFile: 'src/pages/Profile.tsx',
    relatedComponents: [],
    relatedFunctions: ['fetchUserPurchases'],
    firestoreCollections: ['purchases'],
    access: 'Utilizador Autenticado',
    buttons: ['Ver Recibo', 'Exportar Fatura', 'Contactar Suporte'],
    actions: ['Aceder e listar documentos da subcoleção ou coleção global de compras filtrada por comprador'],
    technicalNotes: 'Mostra todos os pagamentos virtuais simulados ou reais efetuados na plataforma por meio do checkout interno.',
    failurePoints: [
      'Diferença de fuso horário na formatação de datas de compras.'
    ],
    tags: ['compras', 'faturas', 'pagamentos', 'planos', 'recibo']
  },
  {
    id: 'avaliacoes',
    title: 'Avaliações de Vendedores',
    type: 'Página',
    description: 'Sistema de reputação que exibe depoimentos e pontuações de compradores com estrelas (1 a 5) sobre vendedores. Ajuda a dar credibilidade formal aos negócios do ConnectBoat.',
    route: '/profile?tab=reviews',
    mainFile: 'src/pages/Profile.tsx',
    relatedComponents: ['src/components/ReviewModal.tsx'],
    relatedFunctions: ['submitReview', 'calculateAverageRating'],
    firestoreCollections: ['reviews', 'users'],
    access: 'Qualquer utilizador autenticado pode avaliar; visualização é pública',
    buttons: ['Escrever FeedBack', 'Submeter Avaliação', 'Classificar com Estrelas'],
    actions: ['Escrever depoimento na coleção "reviews" e atualizar "ratingAverage" no documento "users" do vendedor'],
    technicalNotes: 'A média de avaliação é guardada de forma denormalizada no perfil do usuário ("ratingAverage" e "ratingCount") para acelerar a renderização da home e detalhes do anúncio.',
    failurePoints: [
      'Usuários avaliando a si mesmos.',
      'Divisão por zero ao recalcular média de pontuações vazias.'
    ],
    tags: ['avaliações', 'feedback', 'estrelas', 'reputação', 'vendedor']
  },
  {
    id: 'empreendedores',
    title: 'Empreendedores (Diretório)',
    type: 'Vitrine',
    description: 'Catálogo que agrega todos os negócios e empreendedores ativos no ConnectBoat. Exibe cards elegantes das vitrines contendo foto de capa grande, logotipo centralizado, cidade e contagem de itens de cada vitrine comercial.',
    route: '/empreendedores',
    mainFile: 'src/pages/Empreendedores.tsx',
    relatedComponents: [],
    relatedFunctions: ['fetchShowcasesList'],
    firestoreCollections: ['users'],
    access: 'Público',
    buttons: ['Visitar Vitrine ("Meu Negócio")', 'Filtros de Categoria', 'Pesquisa de Empreendedor'],
    actions: ['Carregar utilizadores que têm "showcaseActive" como verdadeiro e estão com a vitrina aprovada ("showcaseApproved" == true)'],
    technicalNotes: 'A exibição do cartão de vitrina foi remodelada recentemente para focar 80% na foto de capa de alta qualidade, com logotipo centralizado, e barra de CTA verde escura embaixo.',
    failurePoints: [
      'Capas desalinhadas devido a dimensões não recomendadas de imagem.',
      'Vitrines sem nenhum produto listado aparecendo com 0 itens.'
    ],
    tags: ['empreendedores', 'negócios', 'vitrines', 'luso', 'diretório']
  },
  {
    id: 'vitrine-digital',
    title: 'Vitrine Digital (Negócio Individual)',
    type: 'Vitrine',
    description: 'Página bio dedicada ao negócio do empreendedor. Exibe banner de marca, logotipo circular, biografia corporativa, link de contacto prioritário por WhatsApp e grelha de produtos/serviços disponíveis.',
    route: '/empreendedores/:slug',
    mainFile: 'src/pages/EmpreendedorDetalhes.tsx',
    relatedComponents: ['src/components/ShowcaseStats.tsx'],
    relatedFunctions: ['incrementShowcaseVisit', 'loadShowcaseProducts', 'shareShowcase'],
    firestoreCollections: ['users', 'showcaseProducts', 'showcaseVisits'],
    access: 'Público',
    buttons: ['Contactar no WhatsApp', 'Partilhar Vitrine', 'Explorar Produto', 'Ver no Mapa'],
    actions: ['Registar entrada de visitantes únicos nas estatísticas da vitrina', 'Carregar todos os itens da subcoleção de produtos'],
    technicalNotes: 'O layout foi otimizado recentemente para expandir a foto de capa do negócio a 100% da largura, cobrindo o ecrã com gradiente elegante, garantindo visualização imersiva para restauro e pastelarias.',
    failurePoints: [
      'Carregamento demorado ao buscar catálogo de produtos grandes.',
      'Sincronização de fuso horário nas visitas.'
    ],
    tags: ['vitrine', 'negócio', 'página', 'bio', 'logo', 'capa', 'luso']
  },
  {
    id: 'produtos-vitrine',
    title: 'Produtos da Vitrine',
    type: 'Vitrine',
    description: 'Visualização de um produto específico de uma Vitrine Digital de Empreendedor. Mostra imagens ampliadas de alta definição, descrição detalhada do produto, preço e botão de pedido imediato via WhatsApp.',
    route: '/empreendedores/:slug/produto/:productId',
    mainFile: 'src/pages/EmpreendedorProduto.tsx',
    relatedComponents: [],
    relatedFunctions: ['loadProductDetails', 'generateWhatsAppProductOrder'],
    firestoreCollections: ['showcaseProducts', 'users'],
    access: 'Público',
    buttons: ['Encomendar no WhatsApp', 'Voltar à Vitrine', 'Ver Mais Imagens', 'Partilhar Link'],
    actions: ['Gerar link do WhatsApp pré-formatado com o nome do produto e do negócio do empreendedor para fechar venda instantânea'],
    technicalNotes: 'A submissão e o clique estruturam uma frase automática no WhatsApp (ex: Hello, I am interested in this item on ConnectBoat!).',
    failurePoints: [
      'Erro no link do WhatsApp se o número do telefone tiver símbolos de parênteses ou espaços.',
      'Imagens indisponíveis caindo no fallback padrão.'
    ],
    tags: ['produto', 'vitrine', 'itens', 'preço', 'whatsapp']
  },
  {
    id: 'whatsapp-vitrine',
    title: 'WhatsApp da Vitrine (Conexão Direta)',
    type: 'Vitrine',
    description: 'Funcionalidade central de integração que redireciona de imediato os interessados em produtos ou serviços direto para o chat restrito do telemóvel do empreendedor.',
    route: 'Redirecionamento Externo',
    mainFile: 'src/pages/EmpreendedorDetalhes.tsx',
    relatedComponents: [],
    relatedFunctions: ['formatWhatsAppNumber', 'buildWhatsAppLink'],
    firestoreCollections: ['users'],
    access: 'Público',
    buttons: ['Contactar via WhatsApp', 'Falar com Empreendedor'],
    actions: ['Abrir aba externa no telemóvel ou desktop para https://wa.me/num'],
    technicalNotes: 'O número de telemóvel é filtrado de antemão para conter apenas algarismos numéricos e precedido do código de área do país (+351 PT ou +44 UK).',
    failurePoints: [
      'Número de telefone digitado sem indicativo de país.'
    ],
    tags: ['whatsapp', 'contacto', 'mensagem', 'clique', 'redireccionar']
  },
  {
    id: 'leads-interesses',
    title: 'Leads / Interesses de Produtos',
    type: 'Fluxo',
    description: 'Painel onde o empreendedor consegue monitorizar quem clicou nos seus produtos da vitrina, quais os itens mais requisitados, registando a intenção de compra ou mensagens enviadas.',
    route: '/profile?tab=interests',
    mainFile: 'src/components/ShowcaseInterests.tsx',
    relatedComponents: [],
    relatedFunctions: ['fetchShowcaseInterests', 'resolveInterestState'],
    firestoreCollections: ['showcaseInterests', 'showcaseProducts'],
    access: 'Empreendedor Logado (Dono da vitrine)',
    buttons: ['Ver Detalhes do Lead', 'Marcar como Resolvido', 'Exportar Lista'],
    actions: ['Carrega interessados e propostas submetidas por formulário alternativo nos produtos da vitrina para acompanhamento pós-venda'],
    technicalNotes: 'As leads são salvas toda vez que um cliente autenticado clica para fazer uma encomenda, assegurando que o empreendedor tenha métricas confiáveis de clientes potenciais.',
    failurePoints: [
      'Demora na sincronização de novos cliques se a coleção estiver crescendo rápido sem paginação.'
    ],
    tags: ['leads', 'interesses', 'contactos', 'propostas', 'interações']
  },
  {
    id: 'anuncios-destaque',
    title: 'Canais de Anúncios em Destaque',
    type: 'Anúncios',
    description: 'Secções estrategicamente posicionadas na Home que rotacionam anúncios que adquiriram planos pagos. Conferem destaque nacional ou local com banners dinâmicos e cores exclusivas.',
    route: '/',
    mainFile: 'src/pages/Home.tsx',
    relatedComponents: ['src/components/AdCard.tsx'],
    relatedFunctions: ['fetchFeaturedAds'],
    firestoreCollections: ['ads'],
    access: 'Público',
    buttons: ['Clique de Visualização', 'Setas de Navegação do Carrossel'],
    actions: ['Filtrar anúncios cujo status seja "approved" de forma decrescente pela prioridade do plano (national > local > free)'],
    technicalNotes: 'O backend ou a query do Firestore puxa os anúncios ativos e ordena por nível de plano. Anúncios em Destaque Nacional são visualizados em todo o site.',
    failurePoints: [
      'Falta de rotação dinâmica se poucos anúncios assinarem planos, exibindo sempre os mesmos.'
    ],
    tags: ['destaque', 'carrossel', 'principal', 'visibilidade']
  },
  {
    id: 'destaque-local',
    title: 'Plano de Destaque Local',
    type: 'Monetização',
    description: 'Plano que permite ao anunciante promover o seu anúncio especificamente dentro da sua cidade/região declarada no ConnectBoat, aparecendo listado nas pesquisas locais e no topo do feed citadino.',
    route: '/create-ad, /profile?tab=ads',
    mainFile: 'src/pages/CreateAd.tsx',
    relatedComponents: [],
    relatedFunctions: ['selectLocalPlan', 'processPlanSubscription'],
    firestoreCollections: ['ads', 'purchases', 'settings'],
    access: 'Utilizador Autenticado',
    buttons: ['Selecionar Plano Local', 'Simular Pagamento'],
    actions: ['Definir campo "plan" como "local" no documento do anúncio', 'Escrever relatório de compra'],
    technicalNotes: 'Os dias de expiração correspondem à configuração "planDurations.local" presente no Firestore settings.',
    failurePoints: [
      'Cidade do anúncio não coincidir com a do filtro, omitindo-o da pesquisa local.'
    ],
    tags: ['destaque', 'local', 'plano', 'pagamento', 'cidade']
  },
  {
    id: 'destaque-nacional',
    title: 'Plano de Destaque Nacional',
    type: 'Monetização',
    description: 'Plano de prioridade máxima que eleva o anúncio ao topo nacional. O anúncio é exibido em destaque geral em toda a plataforma para o país selecionado, multiplicando o engajamento e cliques de compra.',
    route: '/create-ad, /profile?tab=ads',
    mainFile: 'src/pages/CreateAd.tsx',
    relatedComponents: [],
    relatedFunctions: ['selectNationalPlan', 'processPlanSubscription'],
    firestoreCollections: ['ads', 'purchases', 'settings'],
    access: 'Utilizador Autenticado',
    buttons: ['Selecionar Destaque Nacional', 'Pagar Assinatura'],
    actions: ['Definir o campo "plan" como "national" no Firestore e estender prazo de validade'],
    technicalNotes: 'Submete o status inicial de destaque nacional. Anúncios nacionais recebem uma fita decorativa "Nacional" no cartão de anúncios.',
    failurePoints: [
      'Inexistência ou indisponibilidade de planos nacionais no settings global.'
    ],
    tags: ['destaque', 'nacional', 'plano', 'pagamento', 'país', 'topo']
  },
  {
    id: 'pagina-precos',
    title: 'Página de Preços',
    type: 'Página',
    description: 'Página informativa e comercial que detalha todos os planos disponíveis para anunciar e ativar vitrines no ConnectBoat. Apresenta o custo, duração de exibição e os recursos habilitados em cada modalidade (Grátis, Local, Nacional, Vitrine Premium).',
    route: '/precos',
    mainFile: 'src/pages/Precos.tsx',
    relatedComponents: [],
    relatedFunctions: [],
    firestoreCollections: ['settings'],
    access: 'Público',
    buttons: ['Anunciar Agora', 'Ativar Minha Vitrina', 'Contactar Suporte Comercial'],
    actions: ['Redirecionar para criação ou perfil de acordo com a seleção de plano feita pelo utilizador'],
    technicalNotes: 'Os preços listados são carregados remotamente do documento global de definições ("settings") para evitar discrepâncias estruturais.',
    failurePoints: [
      'Valores de preços exibidos em euros para o Reino Unido se não forem adaptados conforme o país ativo.'
    ],
    tags: ['preços', 'planos', 'local', 'nacional', 'vitrine', 'subscrição']
  },
  {
    id: 'convites-qrcode',
    title: 'Sistema de Convites & QR Code',
    type: 'Fluxo',
    description: 'Recurso de atração de novos membros. Utilizadores conseguem partilhar o seu código de convite ou descarregar um QR Code dinâmico. O padrinho recebe créditos por indicação que podem ser gastos em planos.',
    route: '/convite, /admin/invitations',
    mainFile: 'src/pages/Convite.tsx',
    relatedComponents: [],
    relatedFunctions: ['generateInvitationCode', 'renderDynamicQRCode', 'addReferralCredits'],
    firestoreCollections: ['users', 'invitations'],
    access: 'Utilizadores Autenticados para partilhar; Admin para gerir',
    buttons: ['Copiar Link de Convite', 'Descarregar Imagem QR Code', 'Validar Código Administrador'],
    actions: ['Registar novos convites na coleção "invitations" vinculando utilizador padrinho e afilhado'],
    technicalNotes: 'O QR Code é renderizado utilizando bibliotecas padrão baseadas em tela ou SVG e contém o link direto de login integrado com o código de referência (ex: /login?ref=VALT12).',
    failurePoints: [
      'QR Code ilegível em telas de brilho excessivamente baixo.',
      'Ciclos de referência infinitos (utilizador tentando convidar a si mesmo ou registos duplicados).'
    ],
    tags: ['convites', 'qr code', 'código', 'convidar', 'registo', 'indicar']
  },
  {
    id: 'marketing',
    title: 'Kit de Marketing',
    type: 'Admin',
    description: 'Ferramenta administrativa para divulgar canais de marketing e descarregar banners prontos. Admins podem carregar posters promocionais, cartazes, panfletos digitais para partilhar nas redes sociais.',
    route: '/admin/marketing',
    mainFile: 'src/pages/AdminMarketing.tsx',
    relatedComponents: [],
    relatedFunctions: ['fetchMaterials', 'addMarketingMaterial', 'deleteMarketingMaterial'],
    firestoreCollections: ['marketingMaterials'],
    access: 'Admin ou Moderador',
    buttons: ['Adicionar Material', 'Descarregar Banner', 'Eliminar Material', 'Copiar Link de Partilha'],
    actions: ['Escrever material promocional no Firestore e arquivar imagem do design de marketing correspondente'],
    technicalNotes: 'Suporta categorias de marketing (Social, Impresso, Story) estruturadas para partilhas de alta resolução.',
    failurePoints: [
      'Formato de arquivo não suportado (ex: .tiff ou ficheiros de design não web).'
    ],
    tags: ['marketing', 'banners, kit, partilha, redes sociais']
  },
  {
    id: 'importacao-olx',
    title: 'Importador OLX / Gumtree com IA',
    type: 'Admin',
    description: 'Funcionalidade mágica com Inteligência Artificial que simplifica a inserção de anúncios. O Administrador pode submeter links externos e a IA interpreta, extrai e redige o anúncio no ConnectBoat de forma autónoma.',
    route: '/admin/import',
    mainFile: 'src/pages/AdminImport.tsx',
    relatedComponents: [],
    relatedFunctions: ['scrapeMetadataLink', 'processWithGemini', 'confirmAutomationImport'],
    firestoreCollections: ['ads', 'settings'],
    access: 'Admin (Apenas)',
    buttons: ['Colar Link', 'Iniciar Análise por IA', 'Submeter para Sistema', 'Limpar Campos'],
    actions: ['Invocar chamada de API do servidor para extração de dados e conversão textual via IA (Gemini)'],
    technicalNotes: 'Integra-se ao motor de IA para preencher imagens, preços, títulos e categorias encontradas no link externo, diminuindo o atrito para novos anunciantes.',
    failurePoints: [
      'Mudança na infraestrutura HTML do OLX ou Gumtree bloqueando extração.',
      'Limite de Tokens ou falha de chave da API do Gemini.'
    ],
    tags: ['olx', 'gumtree', 'importação', 'ia', 'scraper', 'criar']
  },
  {
    id: 'sistema-saude',
    title: 'Monitor de Saúde do Sistema',
    type: 'Admin',
    description: 'Sistema automático de monitorização de integridade técnica e de conteúdo da plataforma. Mede o percentual de saúde total (100% de base) e alerta por e-mail a equipa de Staff sobre incidentes não resolvidos.',
    route: '/admin/health',
    mainFile: 'src/pages/AdminSystemHealth.tsx',
    relatedComponents: ['src/utils/healthService.ts'],
    relatedFunctions: ['runHealthChecks', 'logHealthEvent', 'handleHealthLevelChangeEmails'],
    firestoreCollections: ['system_health_alerts', 'system_health_events', 'settings'],
    access: 'Admin (Apenas)',
    buttons: ['Carregar Verificações', 'Limpar Resolvidos', 'Marcar como Resolvido', 'Simular Incidentes (E-mail, Importação, Permissão)', 'Repor Tudo Saudável'],
    actions: ['Efetuar 8 verificações automáticas na base de dados', 'Escrever alertas em "system_health_alerts"', 'Disparar notificações de e-mail ao Staff quando a saúde cai', 'Permitir que admins limpem e marquem incidentes como resolvidos'],
    technicalNotes: 'Ficheiros envolvidos: 1. src/pages/AdminSystemHealth.tsx (Dashboard visual); 2. src/utils/healthService.ts (Verificação e envio de e-mails); 3. src/firebase.ts (Interceção silenciosa de erros de permissão do Firestore); 4. src/utils/emailService.ts (Interceção de falhas de envio de e-mail); 5. src/pages/AdminImport.tsx (Registo de falha de extração do Gemini).\n\nRegras de Dedução de Saúde:\nComeça em 100%. Cada alerta ativo aberto deduz pontos:\n- severidade info: reduz 3%\n- severidade warning: reduz 8%\n- severidade alert: reduz 15%\n- severidade critical: reduz 25%\n\nEstados de Alerta:\n- 🟢 Saudável: 85% a 100% (nenhum problema grave)\n- 🟡 Atenção: 65% a 84% (incidentes leves)\n- 🟠 Alerta: 40% a 64% (falhas moderadas)\n- 🔴 Crítico: 0% a 39% (interrupção crítica de fluxo)\n\nFluxo de E-mail:\nQuando o nível se altera para Amarelo, Laranja ou Vermelho, um e-mail é enviado a todos os admins registados. Um mecanismo de anti-spam limita disparos repetidos do mesmo estado a um período mínimo de 30 minutos.\n\nComo Adicionar Novas Verificações:\nDesenvolvedores futuros podem facilmente adicionar novos testes adicionando um bloco try-catch dentro da função "runHealthChecks()" em "src/utils/healthService.ts". Conclua a verificação computando os dados sob as condições desejadas e adicione as informações úteis ao array "alertsToCreate" usando "alertsToCreate.push({ title, description, severity, source, recommendedAction, relatedLink })". A pontuação vital e o fluxo de e-mails se adaptarão automaticamente!',
    failurePoints: [
      'Ciclos de envio de e-mail infinitos resolvidos pelo tracker com mínimo de 30 minutos.',
      'Recursão infinita de escrita se um erro do Firestore for gerado pela própria escrita no log (tratado com catches silenciosos).'
    ],
    tags: ['saúde', 'monitor', 'alerta', 'correção', 'erros', 'status', 'verificação']
  },
  {
    id: 'admin-dashboard',
    title: 'Painel Geral do Admin (Dashboard)',
    type: 'Admin',
    description: 'Interface de controlo operacional para gerentes. Exibe estatísticas de desempenho consolidadas, número de anúncios ativos, faturação acumulada, novos utilizadores, e o feed central de anúncios pendentes para revisão rápida.',
    route: '/admin/dashboard, /admin',
    mainFile: 'src/pages/AdminDashboard.tsx',
    relatedComponents: ['src/components/ShowcaseStats.tsx'],
    relatedFunctions: ['loadDashboardMetrics', 'fetchRecentActivities'],
    firestoreCollections: ['ads', 'users', 'purchases', 'settings'],
    access: 'Admin (Apenas)',
    buttons: ['Mais Estatísticas', 'Ver Compras', 'Filtrar por Período'],
    actions: ['Agregação e leitura de métricas financeiras e cadastrais brutas no Firestore'],
    technicalNotes: 'Permite monitorar a saúde global do sistema com visões rápidas de uso por região (Portugal vs UK).',
    failurePoints: [
      'Sobrecarga de consulta ao contar muitos documentos sem coleção de agregação secundária.'
    ],
    tags: ['dashboard', 'estatísticas', 'admin', 'resumo', 'gráficos']
  },
  {
    id: 'gerir-anuncios',
    title: 'Gerir e Moderar Anúncios',
    type: 'Admin',
    description: 'Secção administrativa onde o time do site modera novos anúncios enviados. Permite aprovar, recusar e suspender anúncios suspeitos de burla ou fora do escopo europeu.',
    route: '/admin/ads',
    mainFile: 'src/pages/AdminAds.tsx',
    relatedComponents: [],
    relatedFunctions: ['approveAdState', 'rejectAdState', 'archiveExpiredAds'],
    firestoreCollections: ['ads', 'notifications'],
    access: 'Admin ou Moderador',
    buttons: ['Aprovar Anúncio', 'Rejeitar Anúncio', 'Adicionar Justificativa', 'Pesquisar Anúncio'],
    actions: ['Atualizar "status" do anúncio para "approved" ou "rejected" no Firestore e instanciar notificação automática ao anunciante'],
    technicalNotes: 'Filtra anúncios por status (pending, approved, rejected, expired) e envia relatórios estruturados ao utilizador.',
    failurePoints: [
      'Inexistência do feedback de justificação do motivo da recusa, gerando frustração ao usuário.'
    ],
    tags: ['anúncios', 'aprovar', 'rejeitar', 'moderar', 'gerir']
  },
  {
    id: 'utilizadores',
    title: 'Gerir Utilizadores',
    type: 'Admin',
    description: 'Ficha de controle de todos os membros do ConnectBoat. Permite alterar o papel hierárquico (utilizador comum, moderador, administrador) e aplicar suspensões ou redefinições cadastrais.',
    route: '/admin/users',
    mainFile: 'src/pages/AdminUsers.tsx',
    relatedComponents: [],
    relatedFunctions: ['changeUserRole', 'banUserAccount', 'adjustCreditsManually'],
    firestoreCollections: ['users'],
    access: 'Admin (Apenas)',
    buttons: ['Tornar Administrador', 'Tornar Moderador', 'Revogar Acesso', 'Ver Ficha do Usuário'],
    actions: ['Modificar atributo "role" do utilizador no Firestore, alterando imediatamente as suas capacidades de acesso no próximo login'],
    technicalNotes: 'Usa guards rígidos de segurança para impedir que administradores revoguem o próprio privilégio de acesso de forma acidental.',
    failurePoints: [
      'Ação de banimento não deletar os anúncios ativos da pessoa de imediato.'
    ],
    tags: ['utilizadores', 'roles, admin, banir, moderador']
  },
  {
    id: 'definicoes',
    title: 'Definições do Sistema',
    type: 'Admin',
    description: 'Painel de configuração técnica das regras operacionais do ConnectBoat. Permite regular o número de dias que um anúncio dura, preços de destaques, limites de fotos grátis e ligar/desligar funcionalidades (como a Galeria de Fotos).',
    route: '/admin/settings',
    mainFile: 'src/pages/AdminSettings.tsx',
    relatedComponents: [],
    relatedFunctions: ['saveGlobalSettings', 'restoreDefaultSystemSettings'],
    firestoreCollections: ['settings'],
    access: 'Admin (Apenas)',
    buttons: ['Gravar Configurações', 'Limpar Parâmetros', 'Ativar Modo Compacto', 'Restaurar Padrão'],
    actions: ['Atualizar o documento global "global" da coleção "settings" com novos limites operacionais'],
    technicalNotes: 'Todos os componentes do site leem as durações e preços a partir desta coleção, garantindo maleabilidade absoluta da operação do portal.',
    failurePoints: [
      'Valores negativos salvos em limites numéricos provocando quebra na renderização de novos formulários.'
    ],
    tags: ['definições', 'configurações, prazos, preços, limites']
  },
  {
    id: 'notificacoes-sistema',
    title: 'Notificações Internas',
    type: 'Firestore',
    description: 'Mecanismo de informação que armazena mensagens, updates de aprovação, expirações de anúncios e relatórios no perfil de cada utilizador.',
    route: 'Todas (Notificação em Sino)',
    mainFile: 'src/App.tsx',
    relatedComponents: [],
    relatedFunctions: ['addNotificationSystem', 'markNotificationAsRead', 'deleteNotification'],
    firestoreCollections: ['notifications'],
    access: 'Dono da notificação ou Admin',
    buttons: ['Marcar como Lida', 'Limpar Histórico', 'Clicar na Notificação de Encaminhamento'],
    actions: ['Modificar "read" para true no documento da notificação e atualizar contador da interface'],
    technicalNotes: 'Usa sub-snapshots ou escuta contínua indexada por userId para acender o alerta de sino vermelho piscando no cabeçalho.',
    failurePoints: [
      'Contagens de não lidas desalinhadas do banco devido a falhas de rede ao ler e transitar abas.'
    ],
    tags: ['notificações', 'alerta', 'aviso', 'sino', 'e-mail']
  },
  {
    id: 'firestore-rules',
    title: 'Regras de Segurança do Firestore (Rules)',
    type: 'Firestore',
    description: 'Protocolo de proteção a nível de servidor que dita quem pode ler ou escrever em cada coleção do banco de dados Cloud Firestore.',
    route: 'N/A (Nível de Segurança)',
    mainFile: 'firestore.rules',
    relatedComponents: [],
    relatedFunctions: [],
    firestoreCollections: ['Todas as coleções listadas acima'],
    access: 'Servidor Firebase (Invisível no Cliente)',
    buttons: [],
    actions: ['Validar token JWT, analisar uid, examinar roles para bloquear escritas maliciosas feitas de terminais externos'],
    technicalNotes: 'Configurada na raiz do projeto. Garante que utilizadores normais não consigam alterar "role" no seu perfil ou subscrever destaque de graça.',
    failurePoints: [
      'Erros silenciosos na leitura se o utilizador autenticado não bater exatamente com o caminho esperado nos paths da regra.'
    ],
    tags: ['rules', 'firestore', 'segurança', 'regras, bases de dados']
  },
  {
    id: 'storage-rules',
    title: 'Regras Cloud Storage (Rules)',
    type: 'Firestore',
    description: 'Protocolo de segurança para upload e descarga de arquivos estáticos, fotos de anúncios e logotipos no Bucket do Firebase Cloud Storage.',
    route: 'N/A',
    mainFile: 'storage.rules',
    relatedComponents: [],
    relatedFunctions: [],
    firestoreCollections: ['Não aplicável (Storage)'],
    access: 'Servidor Storage',
    buttons: [],
    actions: ['Garantir que apenas utilizadores login consigam subir imagens para a pasta coletiva de anúncios de acordo com extensões JPG, PNG, WEBP'],
    technicalNotes: 'Filtra os uploads por peso máximo do documento (ex: menor que 5MB) para mitigar uso danoso do provedor de infraestrutura cloud.',
    failurePoints: [
      'Uploads rejeitados imediatamente no frontend por conflito de cabeçalhos no tipo Mime do ficheiro.'
    ],
    tags: ['storage', 'regras', 'bucket, segurança, upload']
  },
  {
    id: 'destaques-permanentes',
    title: 'Destaques Permanentes Administrativos (Fallback Inteligente)',
    type: 'Admin',
    description: 'Gestão exclusiva de anúncios que permanecem destacados indefinidamente na Home para preenchimento de carrosséis e manutenção de volume estético, funcionando como um fallback automático e inteligente na ausência de destaques pagos ativos.',
    route: '/create-ad, /edit-ad/:id',
    mainFile: 'src/pages/CreateAd.tsx',
    relatedComponents: ['src/pages/Home.tsx', 'src/components/SearchableCitySelect.tsx'],
    relatedFunctions: ['fetchFeatured', 'filteredFeaturedAds', 'handleSubmit', 'handleCountryChange'],
    firestoreCollections: ['ads', 'users', 'settings'],
    access: 'Apenas Administradores e Moderadores (Gestão no painel do formulário)',
    buttons: ['Ativar como Destaque Permanente (Toggle)', 'Nível do Destaque Permanente (Local/Nacional)', 'Alternar País de Exibição Permanente (Portugal/Reino Unido/Ambos)'],
    actions: [
      'Bypassar o fluxo de faturamento do Stripe se for um Destaque Permanente ativo',
      'Configurar a exibição regional ("Ambos") para anúncios que cruzam Portugal ou Reino Unido',
      'Excluir a verificação de expiração temporal ao filtrar destaques na página inicial'
    ],
    technicalNotes: 'Os Destaques Permanentes configuram "isPermanentFeatured" como true, setam "isFeatured" como true, e definem uma data de expiração fixa simulando longos períodos (100 anos no futuro). Isso dispensa cronjobs e garante visibilidade ilimitada, ordenando-se abaixo de anúncios pagos legítimos.',
    failurePoints: [
      'Conflitos ao tentar faturar anúncios reclassificados manualmente para Destaque Permanente.',
      'Falha na busca pela home ao filtrar países "Ambos" se a computação reativa local ignorar esse valor no seletor de localização padrão.'
    ],
    tags: ['destaques', 'permanentes', 'carrossel', 'fallback', 'admin', 'moderadores', 'ambos']
  },
  {
    id: 'pwa-install',
    title: 'PWA (Progressive Web App) - Instalação e Configuração',
    type: 'Página',
    description: 'Transformação do ConnectBoat num PWA instalável de forma instantânea em dispositivos móveis e desktop, dispensando lojas oficiais como Google Play Store e Apple App Store.',
    route: 'Todas as rotas (Global)',
    mainFile: 'public/manifest.json',
    relatedComponents: ['src/hooks/usePWA.ts', 'src/components/PWAInstallButton.tsx', 'public/sw.js'],
    relatedFunctions: ['installApp', 'dismissInstall', 'registerServiceWorker', 'caches.match'],
    firestoreCollections: [],
    access: 'Público (Qualquer visitante)',
    buttons: ['"📱 Instalar App" (Dropdown Contas Desktop)', '"📱 Instalar App" (Dropdown Visitantes Desktop)', '"📱 Instalar App" (Menu Mobile)', '"📱 Instalar App" (Perfil e Rodapé)'],
    actions: [
      'Executar as regras de exibição recomendadas: Ocultar automaticamente se em standalone mode (window.matchMedia e navigator.standalone), senão exibir a opção.',
      'No Android/Chromium, o clique despoleta imediatamente o prompt de instalação nativo capturado por beforeinstallprompt.',
      'No iPhone (Safari iOS), o clique exibe o modal elegante de instruções passo-a-passo (Toque em Partilhar, selecione Adicionar ao Ecrã Principal, confirme).',
      'Em navegadores normais/desktop onde o prompt automático não está ativo, exibe um modal flutuante com passos manuais alternativos.'
    ],
    technicalNotes: 'Usa um Service worker de ciclo de ativação imediata (skipWaiting/clients.claim) e cache dinâmico com estratégia Network-First para evitar problemas de asset bloqueado ou travamento de updates na plataforma. Isento de requisitos de firestore.rules. Ícones PWA derivados diretamente da identidade visual original do ConnectBoat, gerados programaticamente em formato PNG real (assinatura binária 89504e470d0a1a0a) para evitar a rejeição do Chrome Android e habilitar o WebAPK nativo.',
    failurePoints: [
      'Uso de arquivos JPEG renomeados incorretamente como .png causará rejeição silenciosa de geração do WebAPK no Chrome Android.',
      'Bloqueio do prompt nativo se a ligação não for HTTPS (permitido somente em localhost para testes).',
      'Registo do Service Worker ignorado pelo navegador caso já exista uma sessão com service worker travado em cache.'
    ],
    tags: ['pwa', 'instalação', 'offline', 'safari', 'chrome', 'android', 'iphone', 'service-worker']
  },
  {
    id: 'footer-system',
    title: 'Rodapé Universal (Footer Structure)',
    type: 'Página',
    description: 'Apresentação do rodapé unificado e responsivo do ConnectBoat (vertical em telemóveis e grade de 4 colunas em desktop), organizando e distribuindo os links comerciais, de ajuda judicial, suporte direto e micro-crachás.',
    route: 'Todas as rotas (Global)',
    mainFile: 'src/App.tsx',
    relatedComponents: ['src/components/PWAInstallButton.tsx'],
    relatedFunctions: [],
    firestoreCollections: [],
    access: 'Público (Qualquer visitante)',
    buttons: ['Suporte via WhatsApp', 'Instalar ConnectBoat (PWA)', 'Vitrines Digitais'],
    actions: [
      'Redirecionar para mailto:contact@connectboat.co.uk para contacto geral por email',
      'Encaminhar para o WhatsApp em nova aba para suporte direto',
      'Navegar de forma reativa para as páginas informativas e legais'
    ],
    technicalNotes: 'Para adicionar novos links futuramente no rodapé, aceda a src/App.tsx, localize a correspondente coluna de links na marcação JSX do footer e adicione um novo elemento "<li><Link to=\\"/sua-rota\\">Seu Link</Link></li>". Certifique-se de que a nova rota está associada a uma página funcional sob o bloco de rotas principal.',
    failurePoints: [
      'Declarar uma rota inexistente na aplicação gerando erro de link quebrado.',
      'Vazamento ou transbordo visual de itens se forem inseridos demasiados links em ecrãs verticais.'
    ],
    tags: ['footer', 'rodapé', 'estrutura', 'suporte', 'legal', 'informações', 'comunidade', 'portugal', 'reino-unido']
  },
  {
    id: 'partilha-dinamica',
    title: 'Sistema de Partilha Dinâmica e Coesiva',
    type: 'Fluxo',
    description: 'Motor unificado de partilha institucional que adapta as informações partilhadas de acordo com o contexto lido da página atual. Centraliza a formatação e visualização dinâmica para canais de redes sociais e garante suporte total a toda a comunidade lusófona mundial.',
    route: 'Global (Controlado via triggerShare e ShareModal)',
    mainFile: 'src/utils/shareUtils.ts',
    relatedComponents: ['src/components/ShareModal.tsx', 'src/App.tsx', 'src/pages/AdDetails.tsx', 'src/pages/EmpreendedorDetalhes.tsx'],
    relatedFunctions: ['triggerShare', 'generateShareText', 'request-share-current-page'],
    firestoreCollections: ['shares'],
    access: 'Público (Qualquer utilizador)',
    buttons: ['Partilhar (Navbar)', 'Partilhar Anúncio (AdCard / AdDetails)', 'Partilhar Vitrine (EmpreendedorDetalhes)'],
    actions: [
      'Geração de textos de partilha dinâmicos com base nos dados do anúncio, vitrine ou sorteio ativo.',
      'Sincronização global de eventos para identificar se uma página aberta quer injetar dados customizados no botão de partilha do menu principal.',
      'Abertura de URLs externas parametrizadas para WhatsApp, Telegram, Facebook e cópia alternativa para área de transferência.'
    ],
    technicalNotes: 'A mensagem padrão institucional removedora de referências exclusivas a Portugal é centralizada em shareUtils.ts. As páginas dinamizáveis subscrevem o evento customizado "request-share-current-page" para responder em milissegundos com as variáveis ativas.',
    failurePoints: [
      'Incompatibilidade do navigator.share em navegadores legados (mitigado pelo modal de partilha nativo e fallback de cópia automático).',
      'Problemas de codificação (URI encode) em caracteres especiais dos títulos ao partilhar via WhatsApp/Telegram.',
      'Tentativa de partilhar conteúdo prematuro ou nulo caso os dados do anúncio ou vitrine ainda estejam em carregamento.'
    ],
    tags: ['partilha', 'whatsapp', 'telegram', 'facebook', 'modal', 'dinâmico', 'copiar link']
  },
  {
    id: 'doacoes-solidariedade',
    title: '💚 Doações & Solidariedade',
    type: 'Anúncios',
    description: 'Categoria benéfica solidária especial do ConnectBoat. Anúncios nesta categoria têm preço fixado em 0 (Grátis), são isentos de taxas e cobres de destaque pago, e recebem destaque local gratuito de 30 dias automaticamente para ampliar a visibilidade dos bens essenciais doados à comunidade.',
    route: '/create-ad, /anuncio/:id',
    mainFile: 'src/pages/CreateAd.tsx',
    relatedComponents: ['src/components/AdCard.tsx', 'src/pages/AdDetails.tsx'],
    relatedFunctions: ['handleSubmitAd', 'formatPrice'],
    firestoreCollections: ['ads'],
    access: 'Utilizador Autenticado para criar, Público para visualizar',
    buttons: ['Preço Grátis Coagido', 'Destaque de Doação Solidária Coagido'],
    actions: ['Ativar flags de destaque automático ("donationBoost", "donationBadge")', 'Garantir bypass de pagamentos', 'Injetar preço grátis de forma forçada nas visualizações'],
    technicalNotes: 'Na criação de anúncios, selecionar esta categoria força o plano como "local" e o preço como "0", além de renderizar um aviso de consentimento e termos éticos solidários contra vendas camufladas. O documento adData é marcado com "isFeatured: true", "featuredLevel: local", "featuredReason: donation", e "donationBadge: true".',
    failurePoints: [
      'Utilizador tentar burlar as regras tentando publicar anúncios comerciais disfarçados de doação (mitigado pelo aviso jurídico no editor e moderação por admin antes da publicação).',
      'Problemas visuais em listagens históricas ou faturas.'
    ],
    tags: ['doação', 'solidariedade', 'grátis', 'benefício', 'destaque local', 'ajuda']
  },
  {
    id: 'configuracao-arquitetura-email',
    title: 'Arquitetura e Configurações de E-mail',
    type: 'Admin',
    description: 'Registo detalhado da arquitetura de comunicação por e-mail no ConnectBoat. Define o e-mail oficial de contacto público exibido aos utilizadores e as diferenças funcionais em relação aos canais técnicos automatizados de envio do sistema.',
    route: 'Global (Todas as notificações e páginas de suporte)',
    mainFile: 'api/email/send.ts',
    relatedComponents: ['src/App.tsx', 'src/pages/FAQ.tsx'],
    relatedFunctions: ['sendEmailGeneric', 'renderEmail'],
    firestoreCollections: ['system_health_events'],
    access: 'Público para envio de alertas, Restrito para credenciais SMTP/API privadas',
    buttons: ['Enviar E-mail (FAQ / Suporte)'],
    actions: [
      'Exibir o e-mail oficial contato@mercado-luso.com em canais e páginas públicas de suporte.',
      'Utilizar credenciais SMTP ou serviços serverless (Resend/SendGrid) do lado do servidor para enviar notificações automatizadas.',
      'Registrar falhas de entrega ou de envio de forma resiliente para monitorização de saúde.'
    ],
    technicalNotes: '1. E-mail de Contacto Oficial Público:\nDeve ser estritamente contato@mercado-luso.com para todas as interações e suporte visíveis ao utilizador (no rodapé, páginas de FAQ, políticas ou termos de utilização, etc.).\n\n2. E-mail Técnico de Envio (Remetente / API):\nPara as notificações automáticas e comunicações eletrónicas geradas pelo sistema (como aprovação/rejeição de anúncios), o remetente oficial técnico utilizado é no-reply@mercadoluso.com (configurável através da variável de ambiente process.env.EMAIL_FROM).\n\n3. Segurança de Credenciais SMTP/API:\nAs chaves secretas de envio de email (como RESEND_API_KEY ou SENDGRID_API_KEY) são guardadas exclusivamente do lado do servidor e geridas pelas definições do ambiente. O frontend faz chamadas para o endpoint proxy seguro /api/email/send sem nunca expor qualquer segredo ao browser.',
    failurePoints: [
      'Ausência de credenciais válidas do fornecedor de e-mails (Resend ou SendGrid) despoletando falhas registadas no monitor de saúde.',
      'Bloqueio ou atraso na entrega devido a reputação IP ou falta de DNS SPF/DKIM do domínio mercado-luso.com.'
    ],
    tags: ['email', 'suporte', 'comunicação', 'contacto', 'resend', 'sendgrid', 'arquitetura', 'segurança']
  }
];

export const technicalFlows: TechnicalFlow[] = [
  {
    id: 'flow-criar-anuncio',
    title: 'Como criar um anúncio',
    description: 'Criação e registo básico de ofertas na plataforma por utilizadores comuns.',
    startPoint: 'Clicar no Botão "+" ou "Anunciar" no cabeçalho principal',
    buttonsInvolved: ['Anunciar', 'Escolher Imagens', 'Publicar Anúncio'],
    pagesInvolved: ['CreateAd.tsx', 'Home.tsx'],
    mainFiles: ['src/pages/CreateAd.tsx', 'src/components/SearchableCitySelect.tsx'],
    firestoreCollections: ['ads', 'users'],
    expectedResult: 'Novo anúncio gravado com plano "free" (entra como approved de imediato) ou plano pago (entra em moderação como pending).'
  },
  {
    id: 'flow-destaque-local',
    title: 'Como destacar anúncio local',
    description: 'Garantir prioridade superior ao anúncio dentro do âmbito de captação citadina da região correspondente.',
    startPoint: 'Pelo formulário CreateAd escolhendo plano "Local", ou no painel Meus Anúncios do Perfil clicando em "Promover"',
    buttonsInvolved: ['Selecionar Plano Local', 'Concluir Pagamento'],
    pagesInvolved: ['CreateAd.tsx', 'Profile.tsx', 'Precos.tsx'],
    mainFiles: ['src/pages/CreateAd.tsx', 'src/pages/Profile.tsx'],
    firestoreCollections: ['ads', 'purchases'],
    expectedResult: 'Campo "plan" alterado para "local", validade prorrogada segundo configurações do painel admin, e registo no histórico de compras.'
  },
  {
    id: 'flow-destaque-nacional',
    title: 'Como destacar anúncio nacional',
    description: 'Elevação máxima do anúncio para destaque em todas as pesquisas do país (Portugal ou Reino Unido).',
    startPoint: 'Formulário de criação ao escolher plano "Nacional" ou ao promover anúncio grátis a partir do menu Meus Anúncios',
    buttonsInvolved: ['Selecionar Plano Nacional', 'Efetuar Subscrição'],
    pagesInvolved: ['CreateAd.tsx', 'Profile.tsx', 'Precos.tsx'],
    mainFiles: ['src/pages/CreateAd.tsx', 'src/pages/Profile.tsx'],
    firestoreCollections: ['ads', 'purchases'],
    expectedResult: 'Campo "plan" redefinido para "national", habilitando o banner de topo e a fita azul de Destaque Nacional.'
  },
  {
    id: 'flow-criar-vitrine',
    title: 'Como criar uma Vitrine Digital',
    description: 'Registo e setup do diretório comercial do empreendedor no catálogo de negócios do ConnectBoat.',
    startPoint: 'Menu lateral do Perfil clicando na aba "Minha Vitrine" e ativando a chave "Ativar Vitrine"',
    buttonsInvolved: ['Ativar Minha Vitrina', 'Carregar Foto de Capa', 'Carregar Logo', 'Salvar Informações da Vitrina'],
    pagesInvolved: ['Profile.tsx', 'Empreendedores.tsx'],
    mainFiles: ['src/pages/Profile.tsx'],
    firestoreCollections: ['users'],
    expectedResult: 'Flag "showcaseActive" definida para true, acionando o fluxo de aprovação obrigatória do Admin para evitar spams.'
  },
  {
    id: 'flow-adicionar-produto-vitrine',
    title: 'Como adicionar produto na Vitrine',
    description: 'Criação do catálogo virtual de produtos vinculados diretamente ao negócio do empreendedor.',
    startPoint: 'Dentro da aba "Minha Vitrina" no perfil, clicando no botão "Adicionar Novo Produto"',
    buttonsInvolved: ['Adicionar Novo Produto', 'Fazer Upload do Produto', 'Gravar Produto'],
    pagesInvolved: ['Profile.tsx', 'EmpreendedorDetalhes.tsx'],
    mainFiles: ['src/pages/Profile.tsx', 'src/components/ShowcaseStats.tsx'],
    firestoreCollections: ['showcaseProducts', 'users'],
    expectedResult: 'Novo documento criado na coleção "showcaseProducts" vinculando o slug da vitrina e o uid proprietário.'
  },
  {
    id: 'flow-whatsapp-vitrine',
    title: 'Como funciona o WhatsApp da Vitrine',
    description: 'Processamento de checkout verbal direto, contornando canais excessivos de taxas e registando prospecção direta.',
    startPoint: 'Clicar num item no catálogo da Vitrina ou no botão "Falar Directo" no topo do negócio do Empreendedor',
    buttonsInvolved: ['Contactar no WhatsApp', 'Encomendar via WhatsApp'],
    pagesInvolved: ['EmpreendedorDetalhes.tsx', 'EmpreendedorProduto.tsx'],
    mainFiles: ['src/pages/EmpreendedorDetalhes.tsx', 'src/pages/EmpreendedorProduto.tsx'],
    firestoreCollections: ['users', 'showcaseInterests'],
    expectedResult: 'Abertura externa do link do WhatsApp acompanhado de mensagem formalizada facilitando o contato instantâneo.'
  },
  {
    id: 'flow-qrcode-convite',
    title: 'Como funciona o QR Code de convite',
    description: 'Promoção orgânica e captação de tráfego usando de gamificação e reciprocidade financeira.',
    startPoint: 'Na barra lateral ou perfil, clicando em "Partilhar e Convidar"',
    buttonsInvolved: ['Copiar Endereço de Convite', 'Obter QR Code PNG'],
    pagesInvolved: ['Convite.tsx'],
    mainFiles: ['src/pages/Convite.tsx'],
    firestoreCollections: ['invitations', 'users'],
    expectedResult: 'Exibição do código único. Caso o convidado se registre usando a URL, o padrinho adquire créditos automáticos.'
  },
  {
    id: 'flow-aprovar-anuncio',
    title: 'Como aprovar anúncio (Moderação)',
    description: 'Inspeção manual efetuada pelo gestor para conferir legitimidade e manter qualidade premium das listagens.',
    startPoint: 'Login como Administrador, acedendo ao Painel de "Moderar Anúncios" na barra de ferramentas lateral',
    buttonsInvolved: ['Aprovar Anúncio', 'Rejeitar Anúncio', 'Pesquisa Rápida por Pendência'],
    pagesInvolved: ['AdminAds.tsx', 'AdminDashboard.tsx'],
    mainFiles: ['src/pages/AdminAds.tsx'],
    firestoreCollections: ['ads', 'notifications'],
    expectedResult: '"status" do anúncio atualizado para "approved", inserindo o anúncio na home e disparando aviso no sino do utilizador.'
  },
  {
    id: 'flow-importador-ia',
    title: 'Como importar via OLX/Gumtree',
    description: 'Criação otimizada acelerada por rede neural artificial generativa integrada diretamente ao banco de dados.',
    startPoint: 'Aceder a funcionalidade "Importar Anúncio com IA" no menu do Painel de Admin',
    buttonsInvolved: ['Colar Link de Entrada', 'Iniciar Análise por IA', 'Publicar no Site'],
    pagesInvolved: ['AdminImport.tsx'],
    mainFiles: ['src/pages/AdminImport.tsx'],
    firestoreCollections: ['ads'],
    expectedResult: 'Preenchimento automatizado instantâneo de imagens, títulos, valores e categorias; criação veloz do anúncio.'
  },
  {
    id: 'flow-painel-precos',
    title: 'Como funciona o painel de preços',
    description: 'Atualização comercial dos custos vigentes praticados pelo portal para destaques.',
    startPoint: 'Painel Admin clicando na secção "Definições"',
    buttonsInvolved: ['Alterar Valores de Planos', 'Gravar Mudanças'],
    pagesInvolved: ['AdminSettings.tsx', 'Precos.tsx'],
    mainFiles: ['src/pages/AdminSettings.tsx', 'src/pages/Precos.tsx'],
    firestoreCollections: ['settings'],
    expectedResult: 'Novas métricas financeiras atualizadas na mesma hora em toda a plataforma.'
  },
  {
    id: 'flow-limites-fotos',
    title: 'Como funcionam os limites de fotos/produtos',
    description: 'Configuração restritiva de abuso para controlar custos com infraestrutura e incentivar upgrades de Destaques pagos.',
    startPoint: 'Criação de novos anúncios ou produtos, consultando definições guardadas no banco',
    buttonsInvolved: ['Submeter Novo Ficheiro'],
    pagesInvolved: ['CreateAd.tsx', 'Profile.tsx'],
    mainFiles: ['src/pages/AdminSettings.tsx', 'src/pages/CreateAd.tsx'],
    firestoreCollections: ['settings'],
    expectedResult: 'Impedir upload de fotos excedentes caso o limite do plano associado seja ultrapassado (ex: Máximo 3 imagens para Free).'
  },
  {
    id: 'flow-sorteio-participacao',
    title: 'Como funciona a participação nos sorteios',
    description: 'Fluxo seguro de participação, geração de bilhetes (máx. 3) e bloqueio temporário de 5 minutos entre partilhas extras.',
    startPoint: 'Aceder à página /sorteios estando autenticado e clicar em "Partilhar ConnectBoat"',
    buttonsInvolved: ['Partilhar ConnectBoat', 'Confirmar Partilha (WhatsApp, Facebook, Twitter, Copiar Link)', 'Partilhar novamente'],
    pagesInvolved: [],
    mainFiles: ['firestore.rules'],
    firestoreCollections: ['giveaways', 'participations', 'shares'],
    expectedResult: 'A 1ª partilha cria a participação garantida com 1 bilhete. Partilhas adicionais geram mais bilhetes (máx 3), respeitando o espaço mínimo de 5 minutos desde a última partilha.'
  },
  {
    id: 'flow-destaque-permanente-admin',
    title: 'Como gerir Destaques Permanentes (Staff)',
    description: 'Fluxo administrativo para configurar anúncios de preenchimento rotativo eterno de destaques na página principal.',
    startPoint: 'Aceder a criar ou editar anúncio como Admin ou Moderador, ativando "Destaque Permanente"',
    buttonsInvolved: ['Ativar como Destaque Permanente', 'Nível do Destaque Permanente', 'País de Exibição Permanente', 'Criar/Publicar Anúncio'],
    pagesInvolved: ['CreateAd.tsx', 'Home.tsx'],
    mainFiles: ['src/pages/CreateAd.tsx', 'src/pages/Home.tsx', 'src/types.ts'],
    firestoreCollections: ['ads'],
    expectedResult: 'Criação ou atualização instantânea sem pagamento obrigatório, com preenchimento garantido do carrossel em Portugal, Reino Unido ou Ambos, agindo como fallback ordenado inferiormente aos destaques pagos vigentes.'
  },
  {
    id: 'flow-monitor-saude',
    title: 'Monitor de Saúde do Sistema e Notificações de Alerta',
    description: 'Processo automatizado de deteção e tratamento de anomalias com fluxo de despacho de e-mails para Staff.',
    startPoint: 'Ocorrência de anomalias (erro do Firestore, falha SMTP, importação rejeitada pelo Gemini) ou abertura da página de Saúde por um Admin',
    buttonsInvolved: ['Carregar Verificações', 'Marcar como Resolvido', 'Limpar Resolvidos'],
    pagesInvolved: ['AdminSystemHealth.tsx'],
    mainFiles: ['src/pages/AdminSystemHealth.tsx', 'src/utils/healthService.ts', 'src/firebase.ts', 'src/utils/emailService.ts'],
    firestoreCollections: ['system_health_alerts', 'system_health_events', 'settings'],
    expectedResult: 'Sinalização visual imediata do percentual de integridade no dashboard admin, registo do alerta em estado "aberto", envio de e-mail automatizado de alerta ao Staff administrativo mantendo intervalos de 30 minutos anti-spam.'
  },
  {
    id: 'flow-instalacao-pwa',
    title: 'Fluxo de Instalação do PWA (Android / iPhone)',
    description: 'Processo robusto e discreto para permitir instalação nativa sem as lojas de aplicativos convencionais.',
    startPoint: 'Utilizador clica em "📱 Instalar App" de forma voluntária no menu principal (dropdown), mobile menu ou rodapé',
    buttonsInvolved: ['📱 Instalar App', 'Entendido'],
    pagesInvolved: ['Todas (PWA global via Navbar, Dropdowns e Rodapé)'],
    mainFiles: ['src/hooks/usePWA.ts', 'src/components/PWAInstallButton.tsx', 'public/sw.js', 'src/App.tsx'],
    firestoreCollections: [],
    expectedResult: 'No Android/Chrome, abre-se o prompt nativo do sistema para adicionar ao ecrã inicial. No iOS/Safari, exibe-se um modal dinâmico que ilustra as etapas: Partilhar -> Adicionar ao Ecrã Principal. Em navegadores normais/desktop onde o prompt não está ativo de imediato, exibe instruções passo-a-passo manuais.'
  },
  {
    id: 'flow-doacoes-solidariedade',
    title: 'Fluxo de Anúncio de Doações & Solidariedade',
    description: 'Processo completo de criação, destaque automático e exibição de artigos benevolentes e doações gratuitas.',
    startPoint: 'Aceder a funcionalidade "Criar Anúncio" no cabeçalho e selecionar a categoria "💚 Doações & Solidariedade"',
    buttonsInvolved: ['Criar Anúncio', 'Preenchimento do Form', 'Publicar Anúncio'],
    pagesInvolved: ['CreateAd.tsx', 'AdDetails.tsx', 'Home.tsx'],
    mainFiles: ['src/pages/CreateAd.tsx', 'src/components/AdCard.tsx', 'src/pages/AdDetails.tsx'],
    firestoreCollections: ['ads'],
    expectedResult: 'O anúncio é registado de forma 100% gratuita, as chaves "isFeatured" e "donationBadge" são auto-sinalizadas como verdadeiras, bypassando qualquer modal de cobrança e usufruindo de 30 dias de destaque local automático na página principal com estilização verde e selo solidário.'
  }
];
