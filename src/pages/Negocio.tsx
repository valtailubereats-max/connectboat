import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, deleteDoc, collection, query, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { motion, AnimatePresence } from 'motion/react';
import { Edit, Trash2, CheckCircle, RefreshCcw, X, Plus, CreditCard, Shield, Sliders, Briefcase, Store } from 'lucide-react';
import { formatPrice } from '../utils';
import ShowcaseStats from '../components/ShowcaseStats';
import ShowcaseInterests from '../components/ShowcaseInterests';

const Negocio = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { settings } = useSettings();
  const isPromoActive = settings?.launchPromoActive !== false;
  const navigate = useNavigate();

  // Showcase state fields
  const [showcaseActive, setShowcaseActive] = useState(false);
  const [showcaseName, setShowcaseName] = useState('');
  const [showcaseCategory, setShowcaseCategory] = useState('');
  const [showcaseLogo, setShowcaseLogo] = useState('');
  const [showcaseCover, setShowcaseCover] = useState('');
  const [showcaseDescription, setShowcaseDescription] = useState('');
  const [showcaseWhatsapp, setShowcaseWhatsapp] = useState('');
  const [showcaseFacebook, setShowcaseFacebook] = useState('');
  const [showcaseInstagram, setShowcaseInstagram] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [showcasePlan, setShowcasePlan] = useState<'basic' | 'premium'>('premium');
  const [showShowcasePaymentModal, setShowShowcasePaymentModal] = useState(false);
  const [showcasePaymentLoading, setShowcasePaymentLoading] = useState(false);
  const [showcaseCardNumber, setShowcaseCardNumber] = useState('4242 •••• •••• 4242');
  const [showcaseCardExpiry, setShowcaseCardExpiry] = useState('12/29');
  const [showcaseCardCVC, setShowcaseCardCVC] = useState('789');
  const [showcaseCardName, setShowcaseCardName] = useState('');
  const [showcaseProducts, setShowcaseProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPrice, setProductPrice] = useState<string>('');
  const [productActive, setProductActive] = useState(true);
  const [productOrder, setProductOrder] = useState(0);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isUploadingProductImg, setIsUploadingProductImg] = useState<boolean[]>([false, false]);
  const [isUploading, setIsUploading] = useState(false);
  const [businessSaved, setBusinessSaved] = useState(false);
  const [productSavedSuccess, setProductSavedSuccess] = useState(false);

  // Sync state from profile on load
  useEffect(() => {
    if (profile) {
      setShowcaseActive(profile.showcaseActive || false);
      setShowcaseName(profile.showcaseName || '');
      setShowcaseCategory(profile.showcaseCategory || '');
      setShowcaseLogo(profile.showcaseLogo || '');
      setShowcaseCover(profile.showcaseCover || '');
      setShowcaseDescription(profile.showcaseDescription || '');
      setShowcaseWhatsapp(profile.showcaseWhatsapp || '');
      setShowcaseFacebook(profile.showcaseFacebook || '');
      setShowcaseInstagram(profile.showcaseInstagram || '');
      setShowcasePlan(profile.showcasePlan || 'basic');
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      fetchShowcaseProducts();
    }
  }, [user]);

  const fetchShowcaseProducts = async () => {
    if (!user) return;
    setProductsLoading(true);
    try {
      const q = query(collection(db, 'sellerPublicProfiles', user.uid, 'products'));
      const snap = await getDocs(q);
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      items.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      setShowcaseProducts(items);

      // Heal active limits and counts
      const activeCount = items.filter((p: any) => p.active !== false).length;
      const profileRef = doc(db, 'sellerPublicProfiles', user.uid);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        const dbCount = profileSnap.data().productsCount;
        if (dbCount !== activeCount) {
          await setDoc(profileRef, { productsCount: activeCount }, { merge: true });
        }
      } else {
        await setDoc(profileRef, { productsCount: activeCount }, { merge: true });
      }
    } catch (err) {
      console.error('Error fetching showcase products:', err);
    } finally {
      setProductsLoading(false);
    }
  };

  const handleAddProductClick = () => {
    const limitMax = 6;
    if (showcaseProducts.length >= limitMax) {
      alert(`Atingiu o limite de ${limitMax} produtos/serviços ativos.`);
      return;
    }
    const newDocRef = doc(collection(db, 'sellerPublicProfiles', user!.uid, 'products'));
    setEditingProduct({
      id: newDocRef.id,
      userId: user!.uid,
      name: '',
      description: '',
      price: null,
      images: [],
      active: true,
      order: showcaseProducts.length,
      createdAt: null
    });
    setProductName('');
    setProductDescription('');
    setProductPrice('');
    setProductActive(true);
    setProductOrder(showcaseProducts.length);
    setProductImages([]);
    setShowProductModal(true);
  };

  const handleEditProductClick = (product: any) => {
    setEditingProduct(product);
    setProductName(product.name || '');
    setProductDescription(product.description || '');
    setProductPrice(product.price != null ? String(product.price) : '');
    setProductActive(product.active !== false);
    setProductOrder(product.order || 0);
    setProductImages(product.images || []);
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!user) return;
    if (!window.confirm('Tem a certeza que deseja eliminar este item?')) return;
    try {
      const existingProd = showcaseProducts.find(p => p.id === productId);
      const wasActive = existingProd ? existingProd.active !== false : false;

      if (wasActive) {
        const profileRef = doc(db, 'sellerPublicProfiles', user.uid);
        const profileSnap = await getDoc(profileRef);
        let currentCount = 0;
        if (profileSnap.exists()) {
          currentCount = profileSnap.data().productsCount || 0;
        }
        const nextCount = Math.max(0, currentCount - 1);
        await setDoc(profileRef, { productsCount: nextCount }, { merge: true });
      }

      await deleteDoc(doc(db, 'sellerPublicProfiles', user.uid, 'products', productId));
      alert('Item eliminado com sucesso!');
      fetchShowcaseProducts();
    } catch (err) {
      console.error('Error deleting product:', err);
      handleFirestoreError(err, OperationType.DELETE, `sellerPublicProfiles/${user.uid}/products/${productId}`);
    }
  };

  const uploadProductImage = async (file: File, index: number, targetProductId: string) => {
    if (!user) return;
    const updatedUploading = [...isUploadingProductImg];
    updatedUploading[index] = true;
    setIsUploadingProductImg(updatedUploading);

    try {
      const fileName = `image_${index}_${Date.now()}__${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const fileRef = ref(storage, `showcases/${user.uid}/products/${targetProductId}/${fileName}`);
      const uploadSnapshot = await uploadBytes(fileRef, file);
      const url = await getDownloadURL(uploadSnapshot.ref);

      const newImages = [...productImages];
      newImages[index] = url;
      const cleanedImages = newImages.filter(val => val);
      setProductImages(cleanedImages);
    } catch (err) {
      console.error('Error uploading product image:', err);
      alert('Erro ao carregar imagem: ' + err);
    } finally {
      const updatedUploading = [...isUploadingProductImg];
      updatedUploading[index] = false;
      setIsUploadingProductImg(updatedUploading);
    }
  };

  const removeProductImage = (index: number) => {
    const newImages = [...productImages];
    newImages.splice(index, 1);
    setProductImages(newImages);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingProduct) return;
    setIsSavingProduct(true);
    setProductSavedSuccess(false);

    try {
      const productRef = doc(db, 'sellerPublicProfiles', user.uid, 'products', editingProduct.id);
      const parsedPrice = productPrice.trim() !== '' ? parseFloat(productPrice) : null;

      const updatedFields = {
        id: editingProduct.id,
        userId: user.uid,
        name: productName,
        description: productDescription,
        price: parsedPrice,
        active: productActive,
        order: productOrder,
        images: productImages,
        updatedAt: serverTimestamp()
      };

      await setDoc(productRef, updatedFields, { merge: true });

      // Update total counts
      const updatedList = showcaseProducts.map(p => p.id === editingProduct.id ? { ...p, ...updatedFields } : p);
      if (!showcaseProducts.some(p => p.id === editingProduct.id)) {
        updatedList.push({ ...updatedFields, createdAt: new Date() });
      }

      const activeCount = updatedList.filter((p: any) => p.active !== false).length;
      const profileRef = doc(db, 'sellerPublicProfiles', user.uid);
      await setDoc(profileRef, { productsCount: activeCount }, { merge: true });

      setProductSavedSuccess(true);
      setTimeout(() => {
        setShowProductModal(false);
        setEditingProduct(null);
        setProductSavedSuccess(false);
        fetchShowcaseProducts();
      }, 1000);

    } catch (err) {
      console.error('Error saving product:', err);
      handleFirestoreError(err, OperationType.WRITE, `sellerPublicProfiles/${user.uid}/products/${editingProduct.id}`);
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Upload Showcase logo & cover
  const uploadShowcaseFile = async (file: File, type: 'logo' | 'cover') => {
    if (!user) throw new Error('No logged in athlete!');
    if (type === 'logo') setUploadingLogo(true);
    else setUploadingCover(true);

    try {
      const extension = file.name.split('.').pop() || 'jpg';
      const fileRef = ref(storage, `showcases/${user.uid}/${type}_${Date.now()}.${extension}`);
      const uploadSnapshot = await uploadBytes(fileRef, file);
      const url = await getDownloadURL(uploadSnapshot.ref);
      return url;
    } catch (err) {
      console.error(err);
      alert('Erro ao fazer upload do ficheiro!');
      throw err;
    } finally {
      if (type === 'logo') setUploadingLogo(false);
      else setUploadingCover(false);
    }
  };

  const handleMockShowcasePaymentSuccess = async () => {
    if (!user) return;
    setShowcasePaymentLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        showcaseActive: true,
        showcasePlan: 'premium',
        showcasePaid: true,
        showcaseApproved: true
      }, { merge: true });

      // Build or seed profile
      const publicRef = doc(db, 'sellerPublicProfiles', user.uid);
      await setDoc(publicRef, {
        id: user.uid,
        name: showcaseName || profile?.name || user.email?.split('@')[0] || '',
        logo: showcaseLogo || '',
        cover: showcaseCover || '',
        category: showcaseCategory || 'Outros',
        description: showcaseDescription || '',
        whatsapp: showcaseWhatsapp || '',
        facebook: showcaseFacebook || '',
        instagram: showcaseInstagram || '',
        active: true,
        approved: true,
        country: profile?.country || 'Portugal',
        rating: profile?.sellerRating || 5.0,
        reviewsCount: profile?.sellerReviewsCount || 0,
        viewsCount: 0,
        clicksCount: 0,
        productsCount: showcaseProducts.filter(p => p.active !== false).length,
        createdAt: serverTimestamp()
      }, { merge: true });

      await refreshProfile();
      setShowcaseActive(true);
      setShowcasePlan('premium');
      setShowShowcasePaymentModal(false);
      alert('Parabéns! A sua Vitrine Digital está agora ativada e pronta a usar!');
    } catch (err) {
      console.error(err);
      alert('Erro ao processar ativação.');
    } finally {
      setShowcasePaymentLoading(false);
    }
  };

  const serverTimestamp = () => new Date();

  // Save general storefront details
  const handleUpdateStorefront = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusinessSaved(false);

    try {
      const docRef = doc(db, 'users', user.uid);
      const generatedSlug = showcaseName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

      const showcasePayload = {
        showcaseActive,
        showcaseApproved: profile && profile.showcaseApproved !== undefined ? profile.showcaseApproved : false,
        showcaseName: showcaseActive ? showcaseName : '',
        showcaseSlug: showcaseActive ? `${generatedSlug}-${user.uid.substring(0, 5)}` : '',
        showcaseCategory: showcaseActive ? showcaseCategory : '',
        showcaseLogo: showcaseActive ? showcaseLogo : '',
        showcaseCover: showcaseActive ? showcaseCover : '',
        showcaseDescription: showcaseActive ? showcaseDescription : '',
        showcaseWhatsapp: showcaseActive ? showcaseWhatsapp : '',
        showcaseFacebook: showcaseActive ? (showcaseFacebook || '') : '',
        showcaseInstagram: showcaseActive ? (showcaseInstagram || '') : '',
        showcasePlan: showcaseActive ? showcasePlan : 'basic',
      };

      await setDoc(docRef, showcasePayload, { merge: true });

      if (showcaseActive) {
        const publicRef = doc(db, 'sellerPublicProfiles', user.uid);
        await setDoc(publicRef, {
          id: user.uid,
          name: showcaseName,
          logo: showcaseLogo,
          cover: showcaseCover,
          category: showcaseCategory,
          description: showcaseDescription,
          whatsapp: showcaseWhatsapp,
          facebook: showcaseFacebook,
          instagram: showcaseInstagram,
          active: true,
          slug: `${generatedSlug}-${user.uid.substring(0, 5)}`,
          approved: profile && profile.showcaseApproved !== undefined ? profile.showcaseApproved : false,
          country: profile?.country || 'Portugal',
          rating: profile?.sellerRating || 5.0,
          reviewsCount: profile?.sellerReviewsCount || 0,
          productsCount: showcaseProducts.filter(p => p.active !== false).length,
        }, { merge: true });
      } else {
        // Mark inactive
        const publicRef = doc(db, 'sellerPublicProfiles', user.uid);
        await setDoc(publicRef, { active: false }, { merge: true });
      }

      await refreshProfile();
      setBusinessSaved(true);
      setTimeout(() => setBusinessSaved(false), 3000);
      alert('Informações do Negócio guardadas com sucesso!');
    } catch (err) {
      console.error('Error updating business showcase:', err);
      alert('Erro ao guardar alterações.');
    }
  };

  const isStoreActivated = profile?.showcaseActive === true;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
            <Store size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">🏪 Meu Negócio</h1>
            <p className="text-xs text-slate-500 font-medium">Gerir a sua Vitrine Digital, catálogo de produtos, plano comercial e estatísticas.</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/profile')}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
        >
          ← Voltar ao Perfil
        </button>
      </div>

      {/* Subscription banner if showcase is not paid/active */}
      {!isStoreActivated && (
        <div className="relative p-6 rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white shadow-xl overflow-hidden border border-indigo-800">
          <div className="absolute top-0 right-0 bg-yellow-400 text-slate-900 font-black text-[9px] px-3 py-1 uppercase tracking-widest rounded-bl-xl">
            Profissional
          </div>
          <div>
            <h4 className="font-extrabold text-base text-yellow-300 flex items-center gap-1.5 flex-wrap">
              <span>🌟 Aderir à Vitrine Digital</span>
              <span className={isPromoActive ? "line-through text-slate-400 font-bold ml-1 text-sm" : ""}>
                (£8.99 / €8.99 por mês)
              </span>
              {isPromoActive && (
                <span className="text-emerald-400 font-black text-xs bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30 animate-pulse">
                  Grátis no Lançamento 🎁
                </span>
              )}
            </h4>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              Marine Showcase is a professional subscription allowing you to create a dedicated web presence inside ConnectBoat. Promote your marine brand, gain qualified leads, and display your services professionally!
            </p>
            {isPromoActive && (
              <div className="mt-3 p-3 rounded-xl bg-sky-950/40 border border-sky-500/30 text-sky-300 text-xs font-bold flex items-center gap-2">
                <span>🎁</span>
                <span>Marine Showcases are free during the ConnectBoat launch period.</span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 text-[11px] text-slate-300 border-t border-indigo-800/50 pt-3 mt-4">
            <div className="flex items-center gap-1.5">⭐ Página própria (/empreendedores/seu-slug)</div>
            <div className="flex items-center gap-1.5">⭐ Logótipo e capa customizados</div>
            <div className="flex items-center gap-1.5">⭐ Catálogo profissional de até 6 serviços</div>
            <div className="flex items-center gap-1.5">⭐ Link de WhatsApp + contactos integrados</div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-3">
            <button
              type="button"
              onClick={isPromoActive ? handleMockShowcasePaymentSuccess : () => setShowShowcasePaymentModal(true)}
              className={`px-5 py-3 rounded-xl ${isPromoActive ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'} font-extrabold text-xs text-center text-white transition-all flex-1`}
            >
              {isPromoActive ? "🎁 Ativar Vitrine Digital Grátis" : "🚀 Ativar Vitrine Digital (Stripe Simulator)"}
            </button>
          </div>
        </div>
      )}

      {/* Activated Showcase Management form */}
      {(isStoreActivated || showcaseActive) && (
        <form onSubmit={handleUpdateStorefront} className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                🏠 Configurações da Minha Vitrine
              </h2>
              <p className="text-xs text-slate-500 mt-1">Preencha os detalhes comerciais da sua página de negócios de forma apelativa.</p>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center justify-between gap-4">
              <div>
                <span className="text-base font-bold text-slate-800 block">Ativar Minha Vitrine Digital</span>
                <span className="text-xs text-slate-500 block">Apenas negócios ativos serão listados na página pública de Empreendedores.</span>
              </div>
              <button
                type="button"
                onClick={() => setShowcaseActive(!showcaseActive)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  showcaseActive ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    showcaseActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Approval info */}
            {showcaseActive && (
              <div className={`p-5 rounded-2xl border flex items-start gap-3.5 text-xs font-bold leading-relaxed ${
                profile?.showcaseApproved === true 
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                {profile?.showcaseApproved === true ? (
                  <>
                    <span className="text-lg shrink-0 mt-0.5">💚</span>
                    <div className="space-y-1">
                      <p className="font-extrabold text-emerald-950 text-sm">A sua vitrine está APROVADA!</p>
                      <p className="font-medium text-emerald-700 leading-relaxed text-xs">Ela está ativa e totalmente visível para o público em geral na página de Empreendedores.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-lg shrink-0 mt-0.5 animate-pulse">⏳</span>
                    <div className="space-y-1">
                      <p className="font-extrabold text-amber-950 text-sm">Vitrine em análise da Moderação</p>
                      <p className="font-medium text-amber-700 leading-relaxed text-xs">A sua vitrine digital e produtos e serviços associados só ficarão visíveis publicamente após a equipa de Moderação ou Administração aprovar as informações.</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Edit Fields */}
            {showcaseActive && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">Nome do Negócio *</label>
                  <input
                    type="text"
                    value={showcaseName}
                    onChange={(e) => setShowcaseName(e.target.value)}
                    required
                    className="w-full px-4 py-3.5 bg-slate-55 border border-slate-200 rounded-2xl focus:border-indigo-600 outline-none transition-all font-semibold"
                    placeholder="Nome comercial do negócio"
                  />
                  {showcaseName && (
                    <p className="text-[11px] text-indigo-500 font-mono">
                      Link público: /empreendedores/{showcaseName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()}-{user?.uid.substring(0, 5)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">Categoria Principal *</label>
                  <select
                    value={showcaseCategory}
                    onChange={(e) => setShowcaseCategory(e.target.value)}
                    required
                    className="w-full px-4 py-3.5 bg-slate-55 border border-slate-200 rounded-2xl focus:border-indigo-600 outline-none transition-all font-bold cursor-pointer"
                  >
                    <option value="">Selecione categoria</option>
                    <option value="Restauração & Alimentos">🍕 Restauração & Alimentos</option>
                    <option value="Beleza & Estética">💄 Beleza & Estética</option>
                    <option value="Serviços Profissionais">💼 Serviços Profissionais</option>
                    <option value="Construção & Reformas">🛠️ Construção & Reformas</option>
                    <option value="Comércio & Lojas">🛍️ Comércio & Lojas</option>
                    <option value="Tecnologia & Digital">💻 Tecnologia & Digital</option>
                    <option value="Turismo & Lazer">✈️ Turismo & Lazer</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">WhatsApp do Negócio *</label>
                  <input
                    type="text"
                    value={showcaseWhatsapp}
                    onChange={(e) => setShowcaseWhatsapp(e.target.value)}
                    required
                    className="w-full px-4 py-3.5 bg-slate-55 border border-slate-200 rounded-2xl focus:border-indigo-600 outline-none transition-all font-semibold block"
                    placeholder="Ex: +351 912 345 678"
                  />
                  <p className="text-[10px] text-slate-400">Insira sempre com o indicativo do país.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">Instagram (Opcional)</label>
                  <input
                    type="text"
                    value={showcaseInstagram}
                    onChange={(e) => setShowcaseInstagram(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-55 border border-slate-200 rounded-2xl focus:border-indigo-600 outline-none transition-all font-semibold block"
                    placeholder="Link do seu perfil do Instagram"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">Facebook (Opcional)</label>
                  <input
                    type="text"
                    value={showcaseFacebook}
                    onChange={(e) => setShowcaseFacebook(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-55 border border-slate-200 rounded-2xl focus:border-indigo-600 outline-none transition-all font-semibold block"
                    placeholder="Link da sua página Facebook"
                  />
                </div>

                <div className="hidden md:block"></div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">Capa da Vitrine 🖼️</label>
                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="w-14 h-14 bg-slate-200 rounded-xl overflow-hidden shrink-0">
                      {showcaseCover ? <img src={showcaseCover} className="w-full h-full object-cover" /> : <div className="text-sm text-center pt-4">🖼️</div>}
                    </div>
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="showcase-cover-loader"
                        onChange={async (e) => {
                          if (e.target.files && e.target.files[0]) {
                            const url = await uploadShowcaseFile(e.target.files[0], 'cover');
                            setShowcaseCover(url);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById('showcase-cover-loader')?.click()}
                        disabled={uploadingCover}
                        className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-100 transition-all"
                      >
                        {uploadingCover ? "A carregar..." : "Carregar Capa"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">Logotipo do Negócio 🏬</label>
                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="w-14 h-14 bg-slate-200 rounded-xl overflow-hidden shrink-0">
                      {showcaseLogo ? <img src={showcaseLogo} className="w-full h-full object-cover" /> : <div className="text-sm text-center pt-4">🏬</div>}
                    </div>
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="showcase-logo-loader"
                        onChange={async (e) => {
                          if (e.target.files && e.target.files[0]) {
                            const url = await uploadShowcaseFile(e.target.files[0], 'logo');
                            setShowcaseLogo(url);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById('showcase-logo-loader')?.click()}
                        disabled={uploadingLogo}
                        className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-100 transition-all"
                      >
                        {uploadingLogo ? "A carregar..." : "Carregar Logo"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">Descrição Detalhada do Negócio</label>
                  <textarea
                    value={showcaseDescription}
                    onChange={(e) => setShowcaseDescription(e.target.value)}
                    rows={4}
                    required
                    className="w-full px-4 py-3.5 bg-slate-55 border border-slate-200 rounded-2xl focus:border-indigo-600 outline-none transition-all font-medium text-slate-700 text-xs"
                    placeholder="Breve resumo da sua empresa, valores, horários e especialidades comerciais..."
                  />
                </div>
              </div>
            )}
            
            <button
              type="submit"
              disabled={businessSaved || uploadingCover || uploadingLogo}
              className={`w-full py-4 text-xs font-black tracking-widest uppercase transition-all shadow-md rounded-2xl ${
                businessSaved ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {businessSaved ? '✓ Gravação Concluída!' : 'Guardar Dados da Vitrine'}
            </button>
          </div>
        </form>
      )}

      {/* Showcase products list */}
      {(isStoreActivated || showcaseActive) && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-50 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                📦 Catálogo de Produtos e Serviços
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {showcaseProducts.length} / 6
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">Gerencie itens exibidos na vitrine pública (máximo 6 ativos simultâneos).</p>
            </div>
            <button
              onClick={handleAddProductClick}
              className="px-4 py-2 bg-indigo-600 text-white font-extrabold text-xs rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-1 shadow-sm"
            >
              <Plus size={16} /> Adicionar Item
            </button>
          </div>

          {productsLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">A carregar produtos...</div>
          ) : showcaseProducts.length === 0 ? (
            <div className="py-12 border-2 border-dashed border-slate-150 rounded-2xl text-center text-slate-400 text-sm font-semibold">
              Sem itens de catálogo adicionados. Clique em "Adicionar Item" para iniciar.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {showcaseProducts.map((p) => (
                <div key={p.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-slate-200 border border-slate-100 overflow-hidden rounded-xl">
                      {p.images && p.images[0] ? <img src={p.images[0]} className="w-full h-full object-cover" /> : <div className="text-center pt-4">📦</div>}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm truncate max-w-[200px]">{p.name}</h4>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{p.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {p.price && <span className="text-xs font-bold text-indigo-600">{formatPrice(p.price)}</span>}
                        <span className={`text-[9px] px-1.5 py-0.5 font-bold rounded-md ${p.active ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {p.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleEditProductClick(p)}
                      className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-lg"
                      title="Editar"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(p.id)}
                      className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-lg"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Analytics statistics if showcase is active */}
      {showcaseActive && user && (
        <div className="border-t border-slate-100 pt-8 space-y-6">
          <ShowcaseStats sellerId={user.uid} products={showcaseProducts} />
          <ShowcaseInterests sellerId={user.uid} />
        </div>
      )}

      {/* PRODUCT MODAL */}
      {showProductModal && editingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
          >
            <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 text-white shrink-0 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black">{editingProduct.createdAt ? 'Editar Item do Catálogo' : 'Adicionar Novo Item'}</h3>
                <p className="text-[10px] text-slate-300">Exiba serviços ou produtos de alta qualidade na sua vitrine.</p>
              </div>
              <button
                onClick={() => {
                  setShowProductModal(false);
                  setEditingProduct(null);
                }}
                className="p-1.5 hover:bg-white/10 rounded-full transition-all text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">Nome do Item *</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none"
                  placeholder="Ex: Consultoria Online 1h"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">Descrição Detalhada *</label>
                <textarea
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  rows={3}
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none text-xs"
                  placeholder="Descreva o que o cliente recebe, termos, prazos e entregáveis..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">Preço (Opcional)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none"
                    placeholder="€ ou £"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">Estado de Exibição</label>
                  <div className="flex items-center gap-2 pt-3">
                    <input
                      type="checkbox"
                      checked={productActive}
                      onChange={(e) => setProductActive(e.target.checked)}
                      className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                      id="item-chk-active"
                    />
                    <label htmlFor="item-chk-active" className="text-xs font-bold text-slate-700 cursor-pointer">Item Ativo e visível</label>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 border-t border-slate-50 pt-3">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">Fotografias (Max 2)</label>
                <div className="grid grid-cols-2 gap-4">
                  {[0, 1].map((idx) => {
                    const currentImg = productImages[idx];
                    const isUploading = isUploadingProductImg[idx];
                    return (
                      <div key={idx} className="border border-dashed border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center min-h-[120px] bg-slate-50 relative">
                        {currentImg ? (
                          <>
                            <img src={currentImg} className="w-20 h-20 object-cover rounded-lg mb-2" />
                            <button
                              type="button"
                              onClick={() => removeProductImage(idx)}
                              className="text-[9px] text-rose-600 hover:text-rose-700 font-extrabold uppercase"
                            >
                              Remover
                            </button>
                          </>
                        ) : (
                          <div className="text-center">
                            <span className="text-lg">📸</span>
                            <input
                              type="file"
                              accept="image/*"
                              id={`img-uploader-tag-${idx}`}
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  uploadProductImage(e.target.files[0], idx, editingProduct.id);
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => document.getElementById(`img-uploader-tag-${idx}`)?.click()}
                              disabled={isUploading}
                              className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold px-2.5 py-1 rounded-md block mt-1"
                            >
                              {isUploading ? 'A carregar...' : 'Fazer Upload'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowProductModal(false);
                    setEditingProduct(null);
                  }}
                  className="w-1/2 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct || isUploadingProductImg.some(Boolean)}
                  className="w-1/2 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
                >
                  {isSavingProduct ? 'A guardar...' : 'Guardar Item'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* STRIPE SECURE SHOWCASE MODAL */}
      <AnimatePresence>
        {showShowcasePaymentModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className="p-6 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white relative">
                <button
                  onClick={() => setShowShowcasePaymentModal(false)}
                  className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 p-1.5 rounded-full"
                >
                  <X size={16} />
                </button>
                <div className="flex items-center gap-1 text-[10px] text-indigo-400 font-black uppercase tracking-wider">
                  <Shield size={12} /> Stripe Secure Payment
                </div>
                <h3 className="text-lg font-bold mt-2">Ativar Subscrição Vitrine</h3>
                <p className="text-xs text-slate-300 mt-1">Elevate your marine business on ConnectBoat for only €8.99/month.</p>
              </div>

              <div className="p-6 space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span>Subscrição Vitrine (Mensal)</span>
                    <span>€8.99/mês</span>
                  </div>
                  <div className="border-t border-slate-200/50 pt-2 flex justify-between font-bold text-sm text-indigo-600 mt-2">
                    <span>Total Debitável</span>
                    <span>€8.99</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Informações de Pagamento</label>
                  <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                    <input
                      type="text"
                      value={showcaseCardNumber}
                      onChange={(e) => setShowcaseCardNumber(e.target.value)}
                      className="w-full bg-transparent border-none outline-none text-xs font-semibold"
                      placeholder="Número do Cartão"
                    />
                    <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-2 text-xs">
                      <input
                        type="text"
                        value={showcaseCardExpiry}
                        onChange={(e) => setShowcaseCardExpiry(e.target.value)}
                        className="w-full bg-transparent border-none outline-none font-semibold text-center"
                        placeholder="MM/AA"
                      />
                      <input
                        type="password"
                        value={showcaseCardCVC}
                        onChange={(e) => setShowcaseCardCVC(e.target.value)}
                        className="w-full bg-transparent border-none outline-none font-semibold text-center"
                        placeholder="CVC"
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    value={showcaseCardName}
                    onChange={(e) => setShowcaseCardName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-xs font-semibold"
                    placeholder="Nome no Cartão"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleMockShowcasePaymentSuccess}
                  disabled={showcasePaymentLoading}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {showcasePaymentLoading ? <RefreshCcw size={14} className="animate-spin" /> : <CreditCard size={14} />}
                  <span>Pagar €8.99/mês (Simulador)</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Negocio;
