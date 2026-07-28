import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Share2, 
  Copy, 
  Check, 
  Megaphone, 
  Image as ImageIcon, 
  MessageSquare, 
  Facebook, 
  Instagram, 
  Send, 
  Plus, 
  Trash2, 
  Edit, 
  FileText, 
  Video, 
  Link2, 
  User, 
  Calendar, 
  Clock, 
  X,
  Tag,
  Save,
  Undo,
  Download,
  Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { storage } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { 
  MarketingMaterial, 
  MarketingCategory,
  getLocalMaterials, 
  saveLocalMaterial, 
  deleteLocalMaterial, 
  syncToFirestore, 
  deleteFromFirestore,
  getLocalCategories,
  saveLocalCategory,
  deleteLocalCategory,
  syncCategoryToFirestore,
  deleteCategoryFromFirestore
} from '../utils/marketingService';

const AdminMarketing = () => {
  const { isAdmin, isModerator, user } = useAuth();
  const navigate = useNavigate();
  
  const [materials, setMaterials] = useState<MarketingMaterial[]>([]);
  const [categories, setCategories] = useState<MarketingCategory[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Modal State for Materials
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MarketingMaterial | null>(null);
  
  // Modal State for Categories
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  
  // Form fields for Materials
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('Geral');
  const [formType, setFormType] = useState<'Texto' | 'Imagem/Banner' | 'Vídeo' | 'Link'>('Texto');
  const [formDescription, setFormDescription] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formMediaUrl, setFormMediaUrl] = useState('');
  const [formVisualValue, setFormVisualValue] = useState('from-indigo-600 to-indigo-400');
  
  // File Upload and Lightbox State
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<{ type: 'Texto' | 'Imagem/Banner' | 'Vídeo' | 'Link'; url: string; title: string } | null>(null);
  
  const baseUrl = window.location.origin;

  const handleDownload = async (url: string, title: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      let filename = title.replace(/\s+/g, '_').toLowerCase();
      if (url.includes('.mp4')) filename += '.mp4';
      else if (url.includes('.png')) filename += '.png';
      else if (url.includes('.webp')) filename += '.webp';
      else if (url.includes('.jpg') || url.includes('.jpeg')) filename += '.jpg';
      else filename += '_media';

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.warn('Download error, opening in new tab instead:', err);
      window.open(url, '_blank');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedVideoTypes = ['video/mp4'];

    const isImage = formType === 'Imagem/Banner';
    const isVideo = formType === 'Vídeo';

    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (isImage) {
      const isValidImageExtension = ['jpg', 'jpeg', 'png', 'webp'].includes(extension || '');
      const isValidImageType = allowedImageTypes.includes(file.type);
      if (!isValidImageExtension && !isValidImageType) {
        setUploadError('Formato de imagem não suportado. Use apenas JPG, JPEG, PNG ou WEBP.');
        return;
      }
    }

    if (isVideo) {
      const isValidVideoExtension = extension === 'mp4';
      const isValidVideoType = allowedVideoTypes.includes(file.type);
      if (!isValidVideoExtension && !isValidVideoType) {
        setUploadError('Formato de vídeo não suportado. Use apenas MP4.');
        return;
      }
    }

    setUploadError(null);
    setUploadSuccess(false);

    let folder = 'imagens';
    if (isVideo) {
      folder = 'videos';
    } else if (formCategory.toLowerCase().includes('banner') || formCategory === 'Banners') {
      folder = 'banners';
    }

    const timestamp = Date.now();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const storagePath = `marketing/${folder}/${timestamp}_${cleanFileName}`;

    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    setUploadProgress(0);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setUploadProgress(progress);
      },
      (error) => {
        console.error('[Marketing Upload] Failed:', error);
        setUploadError('Erro no envio: ' + (error.message || 'Tente novamente.'));
        setUploadProgress(null);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          setFormMediaUrl(downloadUrl);
          setUploadProgress(null);
          setUploadSuccess(true);
        } catch (downloadErr) {
          console.error('[Marketing Upload] Error getting download URL:', downloadErr);
          setUploadError('Falha ao obter URL pública do Storage.');
          setUploadProgress(null);
        }
      }
    );
  };

  // Load materials and categories from storage
  useEffect(() => {
    const loadedMaterials = getLocalMaterials();
    setMaterials(loadedMaterials);
    
    const loadedCategories = getLocalCategories();
    setCategories(loadedCategories);
  }, []);

  const hasWritePermission = isAdmin || isModerator;
  const hasDeletePermission = isAdmin;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShare = async (material: MarketingMaterial) => {
    const hasMedia = !!material.mediaUrl && (material.type === 'Imagem/Banner' || material.type === 'Vídeo' || material.type === 'Link');
    
    if (hasMedia) {
      const mediaUrl = material.mediaUrl!;
      if (navigator.share) {
        try {
          await navigator.share({
            title: material.title,
            url: mediaUrl,
          });
        } catch (err) {
          if ((err as Error).name !== 'AbortError') {
            handleCopy(mediaUrl, material.id);
          }
        }
      } else {
        handleCopy(mediaUrl, material.id);
      }
    } else {
      const shareText = material.content;
      if (navigator.share) {
        try {
          await navigator.share({
            title: material.title,
            text: shareText,
            url: baseUrl,
          });
        } catch (err) {
          if ((err as Error).name !== 'AbortError') {
            handleCopy(shareText, material.id);
          }
        }
      } else {
        handleCopy(shareText, material.id);
      }
    }
  };

  const openCreateModal = () => {
    setEditingMaterial(null);
    setFormTitle('');
    // Safely default to 'Geral' or first existing category
    const defaultCat = categories.length > 0 ? categories[0].name : 'Geral';
    setFormCategory(defaultCat);
    setFormType('Texto');
    setFormDescription('');
    setFormContent('');
    setFormMediaUrl('');
    setFormVisualValue('from-indigo-600 to-indigo-400');
    setIsModalOpen(true);
  };

  const openEditModal = (material: MarketingMaterial) => {
    setEditingMaterial(material);
    setFormTitle(material.title);
    setFormCategory(material.category);
    setFormType(material.type);
    setFormDescription(material.description);
    setFormContent(material.content);
    setFormMediaUrl(material.mediaUrl || '');
    setFormVisualValue(material.visualValue || 'from-indigo-600 to-indigo-400');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!hasDeletePermission) {
      alert('Apenas administradores podem eliminar materiais de marketing.');
      return;
    }
    if (!window.confirm(`Tem a certeza que deseja eliminar o material de marketing "${name}"?`)) {
      return;
    }
    
    // Update local state and storage
    const updated = deleteLocalMaterial(id);
    setMaterials(updated);
    
    // Attempt background Firestore sync
    await deleteFromFirestore(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasWritePermission) {
      alert('Não possui permissão para editar ou criar materiais.');
      return;
    }

    if (!formTitle.trim() || !formDescription.trim() || !formContent.trim()) {
      alert('Preencha todos os campos obrigatórios (Título, Descrição e Conteúdo).');
      return;
    }

    const materialId = editingMaterial ? editingMaterial.id : `marketing_${Date.now()}`;
    const newMaterial: MarketingMaterial = {
      id: materialId,
      title: formTitle.trim(),
      category: formCategory,
      type: formType,
      description: formDescription.trim(),
      content: formContent.trim(),
      mediaUrl: formMediaUrl.trim() || undefined,
      createdAt: editingMaterial ? editingMaterial.createdAt : new Date().toISOString(),
      createdBy: editingMaterial ? editingMaterial.createdBy : (user?.email || 'Administração'),
      visualType: 'gradient',
      visualValue: formVisualValue
    };

    // Save locally
    const updated = saveLocalMaterial(newMaterial);
    setMaterials(updated);
    setIsModalOpen(false);

    // Attempt background Firestore sync
    await syncToFirestore(newMaterial);
  };

  // Category Actions
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasWritePermission) {
      alert('Sem permissões para gerir categorias.');
      return;
    }
    if (!newCategoryName.trim()) return;
    
    const exists = categories.some(
      c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase()
    );
    if (exists) {
      alert('Esta categoria já existe!');
      return;
    }
    
    const newCat: MarketingCategory = {
      id: `cat_${Date.now()}`,
      name: newCategoryName.trim()
    };
    
    const updated = saveLocalCategory(newCat);
    setCategories(updated);
    setNewCategoryName('');
    
    await syncCategoryToFirestore(newCat);
  };

  const handleStartEditCategory = (cat: MarketingCategory) => {
    setEditingCategoryId(cat.id);
    setEditingCategoryName(cat.name);
  };

  const handleSaveCategoryEdit = async (id: string) => {
    if (!hasWritePermission) {
      alert('Sem permissões para gerir categorias.');
      return;
    }
    if (!editingCategoryName.trim()) return;
    
    const exists = categories.some(
      c => c.id !== id && c.name.toLowerCase() === editingCategoryName.trim().toLowerCase()
    );
    if (exists) {
      alert('Já existe outra categoria com este nome!');
      return;
    }
    
    const oldCategory = categories.find(c => c.id === id);
    const updatedCat = { id, name: editingCategoryName.trim() };
    
    const updatedList = saveLocalCategory(updatedCat);
    setCategories(updatedList);
    setEditingCategoryId(null);
    
    // Transparently update any materials carrying the old category name for continuity
    if (oldCategory && oldCategory.name !== updatedCat.name) {
      const updatedMaterials = materials.map(m => {
        if (m.category === oldCategory.name) {
          const materialCopy = { ...m, category: updatedCat.name };
          syncToFirestore(materialCopy); // Sync behind scenes
          return materialCopy;
        }
        return m;
      });
      setMaterials(updatedMaterials);
      localStorage.setItem('mercado_luso_marketing_materials', JSON.stringify(updatedMaterials));
    }
    
    await syncCategoryToFirestore(updatedCat);
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!hasWritePermission) {
      alert('Sem permissões para gerir categorias.');
      return;
    }
    if (!window.confirm(`Tem a certeza que deseja eliminar a categoria "${name}"? Os materiais desta categoria NÃO serão eliminados, mas serão re-atribuídos à categoria "Geral".`)) {
      return;
    }
    
    const updatedList = deleteLocalCategory(id);
    setCategories(updatedList);
    
    // Move any materials of this category to fallback category 'Geral'
    const updatedMaterials = materials.map(m => {
      if (m.category === name) {
        const materialCopy = { ...m, category: 'Geral' };
        syncToFirestore(materialCopy);
        return materialCopy;
      }
      return m;
    });
    setMaterials(updatedMaterials);
    localStorage.setItem('mercado_luso_marketing_materials', JSON.stringify(updatedMaterials));
    
    await deleteCategoryFromFirestore(id);
  };

  // Filter materials based on category
  const filteredMaterials = selectedCategory === 'all'
    ? materials
    : materials.filter(m => m.category.toLowerCase() === selectedCategory.toLowerCase());

  // Dynamic filter lists
  const categoriesList = ['all', ...categories.map(c => c.name)];

  const gradientsList = [
    { value: 'from-violet-600 to-indigo-500', name: 'Roxo Elétrico' },
    { value: 'from-indigo-600 to-indigo-400', name: 'Indigo Noite' },
    { value: 'from-emerald-600 to-emerald-400', name: 'Verde Esmeralda' },
    { value: 'from-blue-600 to-blue-400', name: 'Azul Elétrico' },
    { value: 'from-amber-600 to-amber-400', name: 'Dourado Quente' },
    { value: 'from-rose-600 to-rose-400', name: 'Rosa Suave' },
    { value: 'from-red-600 to-orange-500', name: 'Fogo Energizante' },
  ];

  const getTypeIcon = (type: 'Texto' | 'Imagem/Banner' | 'Vídeo' | 'Link') => {
    switch (type) {
      case 'Imagem/Banner':
        return <ImageIcon size={20} />;
      case 'Vídeo':
        return <Video size={20} />;
      case 'Link':
        return <Link2 size={20} />;
      default:
        return <FileText size={20} />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Kit de Marketing Dinâmico</h1>
          <p className="text-slate-500 font-medium">Library of promotional assets and copy templates to promote ConnectBoat.</p>
        </div>
        
        {hasWritePermission && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="bg-slate-100 text-slate-700 font-bold text-sm px-6 py-3.5 rounded-2xl hover:bg-slate-200 transition-all flex items-center gap-2 border border-slate-200"
            >
              <Tag size={18} className="text-indigo-600" />
              Categorias
            </button>
            <button
              onClick={openCreateModal}
              className="bg-indigo-600 text-white font-bold text-sm px-6 py-3.5 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
            >
              <Plus size={18} />
              Novo Material
            </button>
          </div>
        )}
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap items-center gap-2">
        {categoriesList.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
              selectedCategory === cat
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat === 'all' ? 'Ver Todos' : cat}
          </button>
        ))}
      </div>

      {/* Grid of Materials */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredMaterials.map((material) => (
          <motion.div
            key={material.id}
            layoutId={material.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] overflow-hidden shadow-xl border border-slate-100 flex flex-col group relative"
          >
            {/* Visual Preview */}
            <div className="aspect-video relative overflow-hidden flex flex-col justify-center items-center text-center">
              {/* Media Preview Backdrop */}
              {material.mediaUrl && material.type === 'Imagem/Banner' ? (
                <>
                  <img 
                    src={material.mediaUrl} 
                    alt={material.title} 
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-slate-900/40" />
                </>
              ) : material.mediaUrl && material.type === 'Vídeo' ? (
                <>
                  <video 
                    src={material.mediaUrl} 
                    muted 
                    loop 
                    playsInline 
                    className="absolute inset-0 w-full h-full object-cover"
                    onMouseOver={(e) => {
                      e.currentTarget.play().catch(() => {});
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.pause();
                    }}
                  />
                  <div className="absolute inset-0 bg-slate-900/50 group-hover:bg-slate-900/30 transition-all duration-300" />
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[9px] font-black text-white/95 uppercase tracking-wide">
                    Passar p/ Reproduzir
                  </div>
                </>
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${material.visualValue || 'from-indigo-600 to-indigo-400'}`} />
              )}
              
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl pointer-events-none" />
              
              <div className="relative z-10 flex flex-col items-center">
                <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl mb-3 inline-block text-white">
                  {getTypeIcon(material.type)}
                </div>
                <h3 className="text-white font-black text-xl leading-tight px-4 line-clamp-2">
                  {material.title}
                </h3>
                <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
                  <span>ConnectBoat 🇬🇧</span>
                  <span className="opacity-70">•</span>
                  <span>{material.type}</span>
                </p>
              </div>

              {/* Action Buttons Overlay for Staff */}
              {hasWritePermission && (
                <div className="absolute top-4 right-4 z-20 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => openEditModal(material)}
                    className="p-2 bg-white/90 backdrop-blur-sm rounded-xl text-slate-700 hover:text-indigo-600 transition-all shadow-md"
                    title="Editar Material"
                  >
                    <Edit size={14} />
                  </button>
                  {hasDeletePermission && (
                    <button
                      onClick={() => handleDelete(material.id, material.title)}
                      className="p-2 bg-white/90 backdrop-blur-sm rounded-xl text-slate-700 hover:text-red-600 transition-all shadow-md"
                      title="Eliminar Material"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Content Body */}
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                  {material.category}
                </span>
                
                {material.createdAt && (
                  <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(material.createdAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                  </span>
                )}
              </div>
              
              <h4 className="font-bold text-slate-900 mb-2 leading-tight">{material.title}</h4>
              <p className="text-slate-500 text-sm mb-4 line-clamp-2">{material.description}</p>

              {/* Enhanced Media Control Block for Images and Videos */}
              {material.mediaUrl && (
                <div className="mb-4 space-y-2">
                  <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-2xl flex items-center gap-2">
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                      Mídia
                    </span>
                    <span className="text-xs text-slate-500 font-semibold truncate flex-1 font-mono">
                      {material.mediaUrl.split('/').pop()?.split('?')[0] || 'ficheiro'}
                    </span>
                  </div>
                  
                  {(material.type === 'Imagem/Banner' || material.type === 'Vídeo') ? (
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => setLightboxMedia({ type: material.type, url: material.mediaUrl!, title: material.title })}
                        className="py-2.5 bg-slate-50 hover:bg-indigo-50 border border-slate-100 text-slate-600 hover:text-indigo-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        title="Visualizar mídia em tamanho maior"
                      >
                        <Eye size={12} className="shrink-0" />
                        Ver
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(material.mediaUrl!);
                          alert('Link do ficheiro copiado para a área de transferência!');
                        }}
                        className="py-2.5 bg-slate-50 hover:bg-indigo-50 border border-slate-100 text-slate-600 hover:text-indigo-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        title="Copiar link direto"
                      >
                        <Copy size={12} className="shrink-0" />
                        Link
                      </button>
                      <button
                        onClick={() => handleDownload(material.mediaUrl!, material.title)}
                        className="py-2.5 bg-slate-50 hover:bg-indigo-50 border border-slate-100 text-slate-600 hover:text-indigo-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        title="Descarregar ficheiro"
                      >
                        <Download size={12} className="shrink-0" />
                        Baixar
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <a 
                        href={material.mediaUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-all"
                      >
                        <Link2 size={12} />
                        Abrir Link Externo
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Created By badge */}
              <div className="mb-4 flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                <User size={10} />
                <span>Criado por: {material.createdBy}</span>
              </div>

              {/* Copy Block & Action Buttons */}
              <div className="mt-auto space-y-3">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 relative group/copy">
                  <p className="text-slate-600 text-xs leading-relaxed line-clamp-3 italic whitespace-pre-line">
                    "{material.content}"
                  </p>
                  <button 
                    onClick={() => handleCopy(material.content, material.id)}
                    className="absolute top-2 right-2 p-2 bg-white shadow-sm border border-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 transition-all opacity-0 group-hover/copy:opacity-100"
                    title="Copiar Texto"
                  >
                    {copiedId === material.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleShare(material)}
                    className={`flex-1 ${copiedId === material.id ? 'bg-emerald-600 shadow-emerald-150' : 'bg-indigo-600 shadow-indigo-100'} text-white py-3 rounded-2xl font-bold text-sm hover:opacity-95 transition-all shadow-lg flex items-center justify-center gap-2`}
                  >
                    {copiedId === material.id ? (
                      <>
                        <Check size={16} />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Share2 size={16} />
                        Partilhar / Copiar
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleCopy(material.content, material.id)}
                    className="p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all flex items-center justify-center"
                    title="Copiar Texto"
                  >
                    {copiedId === material.id ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Empty state or Add New Button placeholder */}
        {hasWritePermission && (
          <motion.button
            onClick={openCreateModal}
            className="bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center group hover:border-indigo-300 hover:bg-slate-100/50 transition-all h-full min-h-[380px]"
          >
            <div className="w-16 h-16 bg-white rounded-3xl shadow-sm flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-all mb-4">
              <Plus size={32} />
            </div>
            <h4 className="font-bold text-slate-500 group-hover:text-indigo-600 transition-all">Adicionar Material</h4>
            <p className="text-slate-400 text-xs mt-2 max-w-[200px]">
              Crie um novo template promocional com copy, banners, vídeos ou links importantes.
            </p>
          </motion.button>
        )}
      </div>

      {/* Quick Sharing Tips */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <MessageSquare className="text-indigo-600" size={24} />
          Dicas de Divulgação para a Equipa
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Facebook size={20} />
            </div>
            <h4 className="font-bold text-slate-900">Grupos Segmentados</h4>
            <p className="text-slate-500 text-sm">Partilhe materiais específicos nos grupos certos. Templates de carros funcionam maravilhosamente em grupos automóveis do Facebook.</p>
          </div>
          <div className="space-y-3">
            <div className="w-10 h-10 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center">
              <Instagram size={20} />
            </div>
            <h4 className="font-bold text-slate-900">Instagram Stories & Reels</h4>
            <p className="text-slate-500 text-sm">Create engaging stories using card graphics and include a link sticker pointing directly to ConnectBoat.</p>
          </div>
          <div className="space-y-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <Send size={20} />
            </div>
            <h4 className="font-bold text-slate-900">Mensagens & Status</h4>
            <p className="text-slate-500 text-sm font-medium">Copie o convite de testes rápido e partilhe no Status do WhatsApp ou envie aos seus contactos principais para trazer feedback valioso.</p>
          </div>
        </div>
      </div>

      {/* Categories Management Modal */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsCategoryModalOpen(false);
                setEditingCategoryId(null);
              }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden p-6 sm:p-8 z-10 space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="text-indigo-600 animate-pulse" size={24} />
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Gerir Categorias</h2>
                  </div>
                  <button 
                    onClick={() => {
                      setIsCategoryModalOpen(false);
                      setEditingCategoryId(null);
                    }}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Add Category Form */}
                <form onSubmit={handleAddCategory} className="flex gap-2">
                  <input 
                    type="text"
                    required
                    placeholder="Adicionar nova categoria..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 font-medium transition-all"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 text-white font-bold p-3 px-5 rounded-2xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-1 text-sm"
                  >
                    <Plus size={16} />
                    Adicionar
                  </button>
                </form>

                <div className="border-t border-slate-100 pt-4 space-y-3 max-h-[300px] overflow-y-auto">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categorias Ativas</p>
                  
                  {categories.length === 0 ? (
                    <p className="text-sm text-slate-400 font-medium py-4 text-center">Nenhuma categoria criada.</p>
                  ) : (
                    <div className="space-y-2">
                      {categories.map((cat) => (
                        <div 
                          key={cat.id}
                          className="flex items-center justify-between border border-slate-100 bg-slate-50/50 p-3 rounded-2xl transition-all hover:bg-slate-50"
                        >
                          {editingCategoryId === cat.id ? (
                            <div className="flex items-center gap-2 flex-1 mr-2">
                              <input 
                                type="text"
                                value={editingCategoryName}
                                onChange={(e) => setEditingCategoryName(e.target.value)}
                                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveCategoryEdit(cat.id)}
                                className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg"
                                title="Gravar"
                              >
                                <Save size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCategoryId(null)}
                                className="p-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg"
                                title="Cancelar"
                              >
                                <Undo size={14} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="text-xs font-black text-slate-700 bg-white border border-slate-100 px-3 py-1.5 rounded-xl shadow-sm">
                                {cat.name}
                              </span>
                              
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditCategory(cat)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                                  title="Editar categoria"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-lg transition-all"
                                  title="Eliminar categoria"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCategoryModalOpen(false);
                      setEditingCategoryId(null);
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-2.5 rounded-2xl text-sm transition-all text-center"
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Modal Container */}
            <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden p-6 sm:p-10 z-10 space-y-6"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                      {editingMaterial ? 'Editar Material de Marketing' : 'Criar Novo Material de Marketing'}
                    </h2>
                    <p className="text-sm font-medium text-slate-400">
                      Preencha o formulário para expandir a biblioteca oficial da equipa.
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Title */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Título do Material *</label>
                      <input 
                        type="text" 
                        required
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="Ex: Novo Canal de Empregos"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 font-medium transition-all"
                      />
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Categoria</label>
                      <select 
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 font-semibold transition-all"
                      >
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                        {/* Compatibility fallback for custom categories of currently active edit items */}
                        {formCategory && !categories.some(c => c.name === formCategory) && (
                          <option value={formCategory}>{formCategory}</option>
                        )}
                      </select>
                    </div>

                    {/* Type selection */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tipo de Material</label>
                      <select 
                        value={formType}
                        onChange={(e) => setFormType(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 font-semibold transition-all"
                      >
                        <option value="Texto">Texto / Mensagem</option>
                        <option value="Imagem/Banner">Imagem / Banner</option>
                        <option value="Vídeo">Vídeo</option>
                        <option value="Link">Link Externo</option>
                      </select>
                    </div>

                    {/* Background Visual Design Choice */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Estilo de Gradiente (Preview)</label>
                      <select 
                        value={formVisualValue}
                        onChange={(e) => setFormVisualValue(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 font-semibold transition-all"
                      >
                        {gradientsList.map(g => (
                          <option key={g.value} value={g.value}>{g.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Short Description */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Breve Descrição *</label>
                    <input 
                      type="text" 
                      required
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Ex: Resumo sobre onde partilhar este material."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 font-medium transition-all"
                    />
                  </div>

                  {/* Attachment/Media File link */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                      Ficheiro / Link de Mídia (Opcional)
                    </label>
                    <input 
                      type="text" 
                      value={formMediaUrl}
                      onChange={(e) => setFormMediaUrl(e.target.value)}
                      placeholder="Ex: https://assets.mercadoluso.com/flyer.png"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 font-medium transition-all font-mono"
                    />
                    <p className="text-[10px] text-slate-400 font-semibold">Anexe o link do design no Canva, vídeo explicativo ou imagem promocional.</p>
                  </div>

                  {/* Interactive Firebase Drag-and-Drop / File Upload Zone depending on Type */}
                  {(formType === 'Imagem/Banner' || formType === 'Vídeo') && (
                    <div className="space-y-2 mt-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">
                        Enviar Ficheiro (Firebase Storage)
                      </label>
                      <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50/50 hover:bg-slate-50 transition-all relative">
                        {uploadProgress !== null ? (
                          <div className="w-full text-center space-y-2 py-2">
                            <div className="flex items-center justify-center gap-2">
                              <span className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></span>
                              <span className="text-sm font-bold text-slate-700 font-sans mt-0.5">A carregar ficheiro... {uploadProgress}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3 text-center">
                            <div className="flex flex-wrap gap-2 justify-center items-center">
                              {formMediaUrl ? (
                                <div className="flex flex-col items-center">
                                  {formType === 'Imagem/Banner' ? (
                                    <img src={formMediaUrl} alt="Preview" className="h-16 w-32 object-cover rounded-xl border border-slate-200 shadow-sm mb-2" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="h-16 w-32 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 mb-2">
                                      <Video size={24} />
                                    </div>
                                  )}
                                  <div className="flex gap-2">
                                    <button 
                                      type="button" 
                                      onClick={() => setFormMediaUrl('')}
                                      className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-all"
                                    >
                                      Remover/Limpar
                                    </button>
                                    <label className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-all cursor-pointer">
                                      Substituir Ficheiro
                                      <input 
                                        type="file" 
                                        accept={formType === 'Imagem/Banner' ? '.jpg,.jpeg,.png,.webp' : '.mp4'} 
                                        onChange={handleFileChange} 
                                        className="hidden" 
                                      />
                                    </label>
                                  </div>
                                </div>
                              ) : (
                                <label className="flex flex-col items-center cursor-pointer">
                                  <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-slate-400 hover:text-indigo-500 transition-all mb-2">
                                    {formType === 'Imagem/Banner' ? <ImageIcon size={24} /> : <Video size={24} />}
                                  </div>
                                  <span className="text-xs font-bold text-indigo-600 hover:text-indigo-700">Selecionar ficheiro</span>
                                  <span className="text-[10px] text-slate-400 font-medium mt-1">
                                    {formType === 'Imagem/Banner' 
                                      ? 'Imagens suportadas: JPG, JPEG, PNG, WEBP' 
                                      : 'Vídeos suportados: MP4'}
                                  </span>
                                  <input 
                                    type="file" 
                                    accept={formType === 'Imagem/Banner' ? '.jpg,.jpeg,.png,.webp' : '.mp4'} 
                                    onChange={handleFileChange} 
                                    className="hidden" 
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                        )}
                        {uploadSuccess && (
                          <div className="absolute top-2 right-2 bg-emerald-50 text-emerald-600 rounded-xl px-2.5 py-1 text-[10px] font-bold flex items-center gap-1">
                            <Check size={12} />
                            Sucesso!
                          </div>
                        )}
                        {uploadError && (
                          <div className="mt-2 text-xs font-bold text-red-500 text-center font-sans">
                            {uploadError}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Main Content (Text / Template copy) */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Conteúdo / Texto de Copy para Cópia *</label>
                    <textarea 
                      required
                      rows={5}
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      placeholder={`Escreva aqui o copy do anúncio.\nDica: Use emojis e mencione o link de forma natural.`}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 font-medium transition-all font-sans leading-relaxed"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="w-full sm:w-auto bg-slate-100 text-slate-600 font-bold px-6 py-3 rounded-2xl hover:bg-slate-200 transition-all text-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="w-full sm:w-auto bg-indigo-600 text-white font-bold px-8 py-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 text-sm sm:ml-auto"
                    >
                      {editingMaterial ? 'Atualizar Material' : 'Gravar Material'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Lightbox / Media Viewer Modal */}
      <AnimatePresence>
        {lightboxMedia && (
          <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLightboxMedia(null)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl max-w-4xl w-full overflow-hidden p-6 z-10 flex flex-col items-center"
            >
              <div className="w-full flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-900 tracking-tight font-sans">
                  {lightboxMedia.title}
                </h3>
                <button 
                  onClick={() => setLightboxMedia(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="w-full flex justify-center bg-slate-900/5 rounded-2xl overflow-hidden p-2 max-h-[70vh]">
                {lightboxMedia.type === 'Imagem/Banner' ? (
                  <img 
                    src={lightboxMedia.url} 
                    alt={lightboxMedia.title} 
                    className="max-h-[60vh] object-contain rounded-xl shadow-md" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <video 
                    src={lightboxMedia.url} 
                    controls 
                    autoPlay
                    className="max-h-[60vh] object-contain rounded-xl shadow-md w-full"
                  />
                )}
              </div>

              <div className="w-full flex flex-col sm:flex-row gap-3 mt-6 justify-end">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(lightboxMedia.url);
                    alert('Link do ficheiro copiado para a área de transferência!');
                  }}
                  className="bg-slate-100 text-slate-700 font-bold px-6 py-3 rounded-2xl text-sm hover:bg-slate-200 transition-all flex items-center justify-center gap-2 font-sans"
                >
                  <Copy size={16} />
                  Copiar Link do Ficheiro
                </button>
                <button
                  onClick={() => handleDownload(lightboxMedia.url, lightboxMedia.title)}
                  className="bg-indigo-600 text-white font-bold px-8 py-3 rounded-2xl text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 font-sans"
                >
                  <Download size={16} />
                  Descarregar Ficheiro
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminMarketing;
