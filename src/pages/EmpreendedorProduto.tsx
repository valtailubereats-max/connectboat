import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import { Helmet } from 'react-helmet-async';
import { 
  ArrowLeft, 
  MapPin, 
  MessageSquare, 
  Phone, 
  Mail, 
  User as UserIcon, 
  ShoppingBag, 
  Tag, 
  Calendar,
  ChevronRight,
  Info,
  Clock,
  ExternalLink,
  Lock
} from 'lucide-react';
import { incrementProductView } from '../services/showcaseStatsService';

export default function EmpreendedorProduto() {
  const { slug, productId } = useParams<{ slug: string; productId: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, isModerator } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [product, setProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Interactive product images viewer
  const [activeImgIndex, setActiveImgIndex] = useState(0);

  // Form states for non-logged or logged visitors
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [message, setMessage] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successRedirecting, setSuccessRedirecting] = useState(false);

  // Auto-fill logged user details
  useEffect(() => {
    if (user) {
      setBuyerName(user.displayName || '');
      setBuyerEmail(user.email || '');
      setBuyerPhone(user.phoneNumber || '');
    }
  }, [user]);

  // Fetch product & profile detail
  useEffect(() => {
    const fetchPrAndProf = async () => {
      if (!slug || !productId) return;
      setLoading(true);
      try {
        const q = query(
          collection(db, 'sellerPublicProfiles'),
          where('showcaseSlug', '==', slug),
          limit(1)
        );
        const profileSnap = await getDocs(q);
        if (!profileSnap.empty) {
          const profileDoc = profileSnap.docs[0];
          const sellerUserId = profileDoc.id;
          const profileData = { uid: sellerUserId, ...profileDoc.data() } as unknown as UserProfile;
          setProfile(profileData);

          // Fetch the specific product directly from the subcollection
          const productRef = doc(db, 'sellerPublicProfiles', sellerUserId, 'products', productId);
          const productSnap = await getDoc(productRef);
          
          if (productSnap.exists() && productSnap.data().active !== false) {
            const prodData = { id: productSnap.id, ...productSnap.data() };
            setProduct(prodData);
            
            // Register an analytics view for the product
            incrementProductView(sellerUserId, productId);
          } else {
            setProduct(null);
          }
        } else {
          setProfile(null);
          setProduct(null);
        }
      } catch (err) {
        console.error('Erro ao buscar o produto e vitrine pública:', err);
        setErrorMsg('Ocorreu um erro ao carregar as informações do produto.');
      } finally {
        setLoading(false);
      }
    };
    fetchPrAndProf();
  }, [slug, productId]);

  const handleSendInterest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !product || !slug || !productId) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      // 1. WhatsApp link details
      const phoneClean = profile.showcaseWhatsapp ? profile.showcaseWhatsapp.replace(/\+/g, '').replace(/\D/g, '') : '';
      const productPageUrl = `https://www.mercado-luso.com/empreendedores/${slug}/produto/${productId}`;
      
      let whatsText = `Hello! I saw this item on your Marine Showcase "${profile.showcaseName}" on ConnectBoat:\n\n`;
      whatsText += `🛍️ *${product.name}*\n`;
      if (product.price != null && product.price !== '') {
        whatsText += `💰 Preço: ${product.price}€\n`;
      }
      whatsText += `🔗 Link do produto: ${productPageUrl}\n\n`;
      whatsText += `Gostaria de obter mais informações.`;

      if (message.trim()) {
        whatsText += `\n\n📝 *Observações do cliente:*\n${message.trim()}`;
      }

      const whatsappUrl = `https://wa.me/${phoneClean}?text=${encodeURIComponent(whatsText)}`;

      // 2. Anti-spam Check: Prevent duplicate interest documents within 5 minutes (300,000 ms)
      const antiSpamKey = `last_interest_${productId}`;
      const lastInterestTimestamp = localStorage.getItem(antiSpamKey);
      const now = Date.now();
      
      let shouldWriteToFirestore = true;
      if (lastInterestTimestamp) {
        const diff = now - parseInt(lastInterestTimestamp, 10);
        if (diff < 300000) {
          // Skip DB write but still allow the buyer to progress to WhatsApp
          shouldWriteToFirestore = false;
          console.log('[Anti-Spam] Ignorando salvamento de documento duplicado temporariamente.');
        }
      }

      if (shouldWriteToFirestore) {
        // Prepare interest document to write inside showcaseProductInterests collection
        const interestData = {
          sellerId: profile.uid,
          showcaseSlug: slug,
          productId: productId,
          productName: product.name,
          productPrice: product.price ? Number(product.price) : null,
          productImageUrl: product.images && product.images[0] ? product.images[0] : '',
          buyerId: user?.uid || null,
          buyerName: buyerName.trim() || (user?.displayName) || 'Visitante Anónimo',
          buyerEmail: buyerEmail.trim() || (user?.email) || null,
          buyerPhone: buyerPhone.trim() || null,
          message: message.trim() || '',
          source: 'whatsapp',
          createdAt: serverTimestamp(),
          country: profile.country || null,
          city: profile.city || null
        };

        try {
          await addDoc(collection(db, 'showcaseProductInterests'), interestData);
          // Store last submission timestamp to prevent duplicate abuse
          localStorage.setItem(antiSpamKey, String(now));
        } catch (dbErr) {
          // Conforming to required system error patterns for diagnostics
          console.error('[Base de Dados] Erro ao gravar registo de interesse:', dbErr);
          try {
            handleFirestoreError(dbErr, OperationType.WRITE, 'showcaseProductInterests');
          } catch (ruleErr) {
            console.warn('[Graceful Degradation] Falha de gravação capturada. Redirecionando comprador para o WhatsApp normalmente:', ruleErr);
          }
        }
      }

      // Success visual feedback
      setSuccessRedirecting(true);
      
      // Open WhatsApp in a new window/tab
      setTimeout(() => {
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
        setSubmitting(false);
        setSuccessRedirecting(false);
      }, 700);

    } catch (err: any) {
      console.error('Erro ao processar registo de interesse:', err);
      setErrorMsg('Não foi possível registrar o seu interesse. Por favor tente novamente.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-8 animate-pulse">
        <div className="h-6 w-32 bg-slate-200 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="aspect-[4/3] bg-slate-200 rounded-[2rem]" />
          <div className="space-y-4">
            <div className="h-8 w-3/4 bg-slate-200 rounded-xl" />
            <div className="h-4 w-1/4 bg-slate-200 rounded-lg" />
            <div className="h-24 bg-slate-200 rounded-2xl" />
            <div className="h-12 bg-slate-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile || !product) {
    return (
      <div className="max-w-md mx-auto py-16 px-6 text-center space-y-6">
        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 text-3xl mx-auto">⚠️</div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-800">Produto Não Encontrado</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            O produto da vitrine que procura não existe ou foi temporariamente ocultado pelo proprietário.
          </p>
        </div>
        <button
          onClick={() => navigate(`/empreendedores/${slug || ''}`)}
          className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all"
        >
          Voltar para a Vitrine
        </button>
      </div>
    );
  }

  const isOwner = user && user.uid === profile.uid;
  const isStaff = isAdmin || isModerator;
  const isPending = profile.showcaseApproved !== true;

  if (isPending && !isOwner && !isStaff) {
    return (
      <div className="max-w-md mx-auto py-16 px-6 text-center space-y-6" id="product-pending-showcase">
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 text-3xl mx-auto">⏳</div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-800">Vitrine em Moderação</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            Esta vitrine de negócios acabou de ser criada ou editada e está em análise pela equipe de moderação. 
            Os produtos estarão disponíveis ao público assim que a vitrine for aprovada!
          </p>
        </div>
        <button
          onClick={() => navigate('/empreendedores')}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all"
        >
          Voltar a Empreendedores
        </button>
      </div>
    );
  }

  const fallbackCover = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800";
  const showcaseLink = `/empreendedores/${slug}`;
  const hasPrice = product.price != null && product.price !== "";

  // Dynamic share meta information
  const ogTitle = `${product.name} - Vitrine Digital ${profile.showcaseName}`;
  const ogDesc = product.description ? product.description.substring(0, 160) : `Direct inquiry via ConnectBoat.`;
  const ogImage = product.images && product.images[0] ? product.images[0] : (profile.showcaseLogo || fallbackCover);
  const ogUrl = `https://www.mercado-luso.com/empreendedores/${slug}/produto/${productId}`;

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-8">
      {/* Dynamic SEO Metalinks & Meta keys for WhatsApp Crawler Previews */}
      <Helmet>
        <title>{product.name} | Vitrine Digital {profile.showcaseName}</title>
        <meta name="description" content={ogDesc} />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={ogUrl} />
        <meta property="og:type" content="product" />
        <meta property="product:price:amount" content={hasPrice ? String(product.price) : '0'} />
        <meta property="product:price:currency" content="EUR" />
      </Helmet>

      {/* Navegador anterior */}
      <div className="flex items-center justify-between">
        <Link 
          to={showcaseLink}
          className="inline-flex items-center gap-2 text-sm font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <ArrowLeft size={16} className="stroke-[2.5]" />
          <span>Voltar para a Vitrine</span>
        </Link>
        <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
          🛍️ Vitrine Digital / Produto
        </span>
      </div>

      {/* Main Container Layout split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Images Viewer Panel */}
        <div className="lg:col-span-7 bg-white p-4 sm:p-6 border border-slate-100 rounded-[2rem] shadow-sm space-y-4">
          <div className="aspect-[4/3] w-full bg-slate-50 overflow-hidden relative border border-slate-150 rounded-2xl flex items-center justify-center">
            {product.images && product.images[activeImgIndex] ? (
              <>
                <img 
                  src={product.images[activeImgIndex]} 
                  alt="" 
                  className="absolute inset-0 w-full h-full object-cover blur-md opacity-20 pointer-events-none scale-110" 
                />
                <img 
                  src={product.images[activeImgIndex]} 
                  alt={product.name} 
                  className="relative max-w-full max-h-full object-contain z-10"
                  referrerPolicy="no-referrer"
                />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-350">
                <span className="text-6xl">🏬</span>
              </div>
            )}

            {hasPrice && (
              <span className="absolute bottom-4 right-4 bg-indigo-600 text-white text-sm font-black px-4 py-2 rounded-xl shadow-lg z-25">
                {product.price} €
              </span>
            )}
          </div>

          {/* Sibling Thumbnails picker */}
          {product.images && product.images.length > 1 && (
            <div className="flex gap-2 flex-wrap justify-center pt-1">
              {product.images.map((img: string, idx: number) => (
                <button
                  key={`thumby-btn-${idx}`}
                  type="button"
                  onClick={() => setActiveImgIndex(idx)}
                  className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all relative shrink-0 ${
                    activeImgIndex === idx ? 'border-indigo-600 scale-102 shadow-sm' : 'border-slate-200'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Showcase Metadata and Request Contact Form */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Item details card */}
          <div className="bg-white p-6 border border-slate-100 rounded-[2rem] shadow-sm space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md uppercase tracking-wider block w-fit">
                {profile.showcaseCategory || 'Outros'}
              </span>
              <h1 className="text-2xl font-black text-slate-900 leading-tight tracking-tight">{product.name}</h1>
              {hasPrice ? (
                <p className="text-3xl font-black text-slate-900">{product.price} <span className="text-lg font-bold text-slate-400">€</span></p>
              ) : (
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2.5 py-1 rounded border border-slate-100 block w-fit">Preço sob consulta</span>
              )}
            </div>

            <p className="text-slate-650 text-sm leading-relaxed whitespace-pre-line border-t border-slate-100 pt-4 font-medium">{product.description}</p>
            
            {/* Publisher Box details */}
            <div className="border-t border-slate-150 pt-4 flex items-center gap-3 bg-indigo-50/25 p-3 rounded-2xl">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-150">
                {profile.showcaseLogo ? (
                  <img src={profile.showcaseLogo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">🏬</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-450 block">Vitrine Anunciante</span>
                <Link to={showcaseLink} className="font-extrabold text-sm text-slate-800 hover:text-indigo-600 transition-colors block truncate">{profile.showcaseName}</Link>
              </div>
              <Link to={showcaseLink} className="p-1.5 bg-white text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all border border-slate-200 shadow-xs shrink-0" title="Ver vitrine completa">
                <ChevronRight size={18} />
              </Link>
            </div>
          </div>

          {/* Interactive contact message form */}
          <div className="bg-white border-2 border-slate-100 rounded-[2.2rem] p-6 shadow-sm space-y-5">
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span className="text-xl">💬</span> Contactar Vendedor
              </h3>
              <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                Preencha as informações abaixo e clique para abrir o chat seguro do WhatsApp diretamente com o vendedor.
              </p>
            </div>

            <form onSubmit={handleSendInterest} className="space-y-4">
              
              {user ? (
                // If logged in display neat status label
                <div className="bg-emerald-50/40 border border-emerald-100 p-3.5 rounded-2xl flex items-center gap-3 text-xs text-emerald-800 font-bold mb-1">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white font-extrabold flex items-center justify-center shrink-0">✓</span>
                  <div className="min-w-0">
                    <p className="font-black">Sessão Autenticada</p>
                    <p className="font-semibold text-[10px] text-slate-500 truncate">Sessão ativa como {user.email}</p>
                  </div>
                </div>
              ) : (
                // Optionally request contact fields if non-logged
                <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Contacto Identificativo (Opcional)</span>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <div className="relative">
                      <UserIcon size={14} className="absolute left-3.5 top-3.5 text-slate-450" />
                      <input 
                        type="text" 
                        placeholder="O seu Nome"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        className="w-full text-xs font-bold pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-400 outline-none transition-colors"
                      />
                    </div>

                    <div className="relative">
                      <Phone size={14} className="absolute left-3.5 top-3.5 text-slate-450" />
                      <input 
                        type="tel" 
                        placeholder="Telemóvel / WhatsApp (Opcional)"
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value)}
                        className="w-full text-xs font-bold pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-400 outline-none transition-colors"
                      />
                    </div>

                    <div className="relative">
                      <Mail size={14} className="absolute left-3.5 top-3.5 text-slate-450" />
                      <input 
                        type="email" 
                        placeholder="E-mail (Opcional)"
                        value={buyerEmail}
                        onChange={(e) => setBuyerEmail(e.target.value)}
                        className="w-full text-xs font-bold pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-400 outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Message inputs */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wide block">Observações / Algum pedido especial?</label>
                <textarea 
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ex: Gostaria de saber disponibilidade para entrega, tamanhos, cores ou detalhes adicionais..."
                  className="w-full p-4 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-indigo-400 bg-white transition-colors resize-none placeholder-slate-400 leading-relaxed"
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-500 font-extrabold flex items-center gap-1.5 bg-rose-50 p-3 rounded-xl border border-rose-100">
                  <Info size={14} className="shrink-0" />
                  <span>{errorMsg}</span>
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-2xl text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-emerald-100"
              >
                {submitting ? (
                  <>
                    <Clock size={16} className="animate-spin" />
                    <span>{successRedirecting ? 'A abrir o WhatsApp...' : 'A validar contacto...'}</span>
                  </>
                ) : (
                  <>
                    <MessageSquare size={18} className="stroke-[2.5]" />
                    <span>Pedir pelo WhatsApp</span>
                  </>
                )}
              </button>
            </form>

            <span className="text-[10px] text-slate-400 font-bold block text-center flex items-center justify-center gap-1">
              <Lock size={10} /> Segurança garantida • Sem intermediação de taxas
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}
