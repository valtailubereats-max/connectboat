import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db } from '../firebase';
import { CommunityVideo } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Film, Plus, Edit, Trash2, CheckCircle2, XCircle, Search, 
  Youtube, Globe, Upload, Save, X, ExternalLink, Star 
} from 'lucide-react';

const CATEGORIES = [
  'Notícias',
  'Empreendedorismo',
  'Reino Unido',
  'Portugal',
  'Imigração',
  'Turismo',
  'Gastronomia',
  'Música',
  'Humor',
  'Educação',
  'Tecnologia',
  'Comunidade'
];

const COUNTRIES = [
  '🇬🇧 Reino Unido',
  '🇵🇹 Portugal'
];

export default function AdminVideos() {
  const { isAdmin, isModerator, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();

  const [videos, setVideos] = useState<CommunityVideo[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<CommunityVideo | null>(null);

  // Form Fields State
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [title, setTitle] = useState('');
  const [channelName, setChannelName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [active, setActive] = useState(true);

  // Upload/Extraction states
  const [uploading, setUploading] = useState(false);
  const [extractionMessage, setExtractionMessage] = useState('');

  // Protect path: only admins can access (no moderators)
  useEffect(() => {
    if (!authLoading) {
      if (!user || !isAdmin) {
        navigate('/', { replace: true });
      }
    }
  }, [authLoading, user, isAdmin, navigate]);

  // Load videos
  useEffect(() => {
    const q = collection(db, 'videos');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CommunityVideo[];
      
      // Sort: recent first
      list.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      
      setVideos(list);
      setLoading(false);
    }, (err) => {
      console.error('Erro ao ler vídeos no admin:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Helper: Extract YouTube ID
  const extractYoutubeId = (url: string): string | null => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Auto-extract thumbnail and YouTube ID on URL change
  const handleUrlChange = (url: string) => {
    setYoutubeUrl(url);
    const ytId = extractYoutubeId(url);
    if (ytId) {
      // Set default high-quality thumbnail
      const thumb = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
      setThumbnailUrl(thumb);
      setExtractionMessage('✅ ID do YouTube extraído com sucesso!');
    } else {
      setExtractionMessage('❌ Link do YouTube inválido. Digite um link válido.');
    }
  };

  // File upload for manual thumbnail
  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const storage = getStorage();
      const storageRef = ref(storage, `community_videos_thumbnails/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        null,
        (err) => {
          console.error('Erro no upload:', err);
          alert('Erro ao enviar o ficheiro.');
          setUploading(false);
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          setThumbnailUrl(downloadUrl);
          setExtractionMessage('✅ Thumbnail manual enviada com sucesso!');
          setUploading(false);
        }
      );
    } catch (err) {
      console.error('Erro geral no upload:', err);
      alert('Erro ao processar ficheiro.');
      setUploading(false);
    }
  };

  // Helper: Slug generator
  const generateSlug = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  // Open creation modal
  const openCreateModal = () => {
    setEditingVideo(null);
    setYoutubeUrl('');
    setTitle('');
    setChannelName('');
    setCategory(CATEGORIES[0]);
    setCountry(COUNTRIES[0]);
    setDescription('');
    setThumbnailUrl('');
    setIsFeatured(false);
    setActive(true);
    setExtractionMessage('');
    setIsModalOpen(true);
  };

  // Open edit modal
  const openEditModal = (video: CommunityVideo) => {
    setEditingVideo(video);
    setYoutubeUrl(video.youtubeUrl);
    setTitle(video.title);
    setChannelName(video.channelName);
    setCategory(video.category);
    setCountry(video.country);
    setDescription(video.description || '');
    setThumbnailUrl(video.thumbnailUrl);
    setIsFeatured(video.isFeatured || false);
    setActive(video.active ?? true);
    setExtractionMessage('✏️ A editar vídeo existente.');
    setIsModalOpen(true);
  };

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const ytId = extractYoutubeId(youtubeUrl);
    if (!ytId) {
      alert('Por favor, informe uma URL válida do YouTube.');
      return;
    }

    if (!title.trim() || !channelName.trim() || !thumbnailUrl.trim()) {
      alert('Por favor, preencha os campos obrigatórios (Título, Canal, Thumbnail).');
      return;
    }

    const videoSlug = generateSlug(title);

    const videoPayload: any = {
      youtubeUrl,
      youtubeId: ytId,
      title: title.trim(),
      slug: videoSlug,
      channelName: channelName.trim(),
      category,
      country,
      description: description.trim(),
      thumbnailUrl,
      isFeatured,
      active,
      updatedAt: serverTimestamp(),
      
      // Content Creator Architecture preparation fields
      ownerId: editingVideo ? (editingVideo.ownerId || null) : null,
      ownerName: editingVideo ? (editingVideo.ownerName || null) : null,
      channelId: editingVideo ? (editingVideo.channelId || null) : null,
      channelUrl: editingVideo ? (editingVideo.channelUrl || null) : null,
      createdByRole: editingVideo ? (editingVideo.createdByRole || 'admin') : 'admin',
      status: editingVideo ? (editingVideo.status || 'approved') : 'approved'
    };

    try {
      if (editingVideo) {
        // Update
        const videoRef = doc(db, 'videos', editingVideo.id);
        await updateDoc(videoRef, videoPayload);
      } else {
        // Create
        videoPayload.createdAt = serverTimestamp();
        videoPayload.createdBy = user?.uid || 'admin';
        
        // Auto generate safe ID
        const newDocRef = doc(collection(db, 'videos'));
        videoPayload.id = newDocRef.id;
        await setDoc(newDocRef, videoPayload);
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Erro ao guardar vídeo:', err);
      alert('Erro ao guardar as informações. Tente novamente.');
    }
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem a certeza de que deseja eliminar permanentemente este vídeo?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'videos', id));
    } catch (err) {
      console.error('Erro ao eliminar vídeo:', err);
      alert('Não foi possível eliminar o vídeo.');
    }
  };

  // Toggle quick parameters
  const toggleFeatured = async (video: CommunityVideo) => {
    try {
      await updateDoc(doc(db, 'videos', video.id), {
        isFeatured: !video.isFeatured
      });
    } catch (err) {
      console.error('Erro ao alternar destaque:', err);
    }
  };

  const toggleActive = async (video: CommunityVideo) => {
    try {
      await updateDoc(doc(db, 'videos', video.id), {
        active: !video.active
      });
    } catch (err) {
      console.error('Erro ao alternar estado ativo:', err);
    }
  };

  // Filter list
  const filteredVideos = videos.filter(v => 
    v.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.channelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4" id="admin-videos-loader">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="text-slate-400 text-xs font-black uppercase tracking-widest">A validar credenciais...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="admin-videos-panel">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-brand font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Film className="text-indigo-600" size={28} />
            <span>Gerir Vídeos da Comunidade</span>
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1">
            Painel administrativo exclusivo para gestão da curadoria de vídeos lusófonos.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm px-5 py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
        >
          <Plus size={18} />
          <span>Adicionar Vídeo</span>
        </button>
      </div>

      {/* Control Search Bar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-250 shadow-sm flex items-center gap-3">
        <Search size={18} className="text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Pesquisar por título, canal ou categoria..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent border-none text-sm outline-none font-semibold text-slate-800"
        />
      </div>

      {/* Table/List Grid */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xs overflow-hidden">
        {filteredVideos.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Film size={40} className="mx-auto text-slate-300" />
            <p className="text-sm font-black uppercase tracking-wider">Nenhum vídeo registado</p>
            <p className="text-xs font-medium text-slate-450">Comece por adicionar o seu primeiro vídeo de curadoria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-extrabold text-[10px] uppercase tracking-wider">
                  <th className="py-4 px-6">Vídeo / Detalhes</th>
                  <th className="py-4 px-6">Canal</th>
                  <th className="py-4 px-6">Categoria / País</th>
                  <th className="py-4 px-6 text-center">Destaque</th>
                  <th className="py-4 px-6 text-center">Visibilidade</th>
                  <th className="py-4 px-6 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredVideos.map((video) => (
                  <tr key={video.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-4 min-w-[300px]">
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          referrerPolicy="no-referrer"
                          className="w-20 aspect-video rounded-lg object-cover bg-slate-100 border border-slate-200"
                        />
                        <div className="space-y-1 min-w-0">
                          <p className="font-brand font-black text-slate-950 text-xs sm:text-sm line-clamp-2 leading-tight">
                            {video.title}
                          </p>
                          <a
                            href={video.youtubeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 hover:underline"
                          >
                            <Youtube size={12} />
                            <span>Ver no YouTube</span>
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6 text-xs sm:text-sm font-bold text-slate-600">
                      {video.channelName}
                    </td>

                    <td className="py-4 px-6">
                      <div className="space-y-1.5">
                        <span className="inline-block bg-slate-100 border border-slate-200/50 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                          {video.category}
                        </span>
                        <div className="text-[10px] font-black text-slate-400">{video.country}</div>
                      </div>
                    </td>

                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => toggleFeatured(video)}
                        className={`inline-flex items-center justify-center p-2 rounded-xl transition-all cursor-pointer ${
                          video.isFeatured 
                            ? 'bg-amber-50 text-amber-500 border border-amber-200' 
                            : 'bg-slate-50 text-slate-350 border border-slate-200/50'
                        }`}
                        title={video.isFeatured ? 'Remover destaque' : 'Tornar destaque'}
                      >
                        <Star size={16} className={video.isFeatured ? 'fill-current' : ''} />
                      </button>
                    </td>

                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => toggleActive(video)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer ${
                          video.active 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        {video.active ? (
                          <>
                            <CheckCircle2 size={12} />
                            <span>Ativo</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={12} />
                            <span>Inativo</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(video)}
                          className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-100 transition-all cursor-pointer"
                          title="Editar Vídeo"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(video.id)}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl border border-red-100 transition-all cursor-pointer"
                          title="Eliminar Vídeo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Creation/Editing Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" id="video-modal">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={() => setIsModalOpen(false)} />

          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
              
              {/* Modal Header */}
              <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
                <h2 className="text-lg font-brand font-black text-slate-900 flex items-center gap-2">
                  <Film size={20} className="text-indigo-600" />
                  <span>{editingVideo ? 'Editar Vídeo' : 'Registar Novo Vídeo'}</span>
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-xl transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSave} className="p-6 overflow-y-auto max-h-[75vh] space-y-5">
                
                {/* 1. URL do YouTube */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                    URL do Vídeo (YouTube) *
                  </label>
                  <div className="relative">
                    <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 text-red-600" size={18} />
                    <input
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={youtubeUrl}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white text-sm px-11 py-3.5 rounded-2xl outline-none font-semibold text-slate-800"
                      required
                    />
                  </div>
                  {extractionMessage && (
                    <p className="text-[11px] font-bold text-slate-500 px-1">{extractionMessage}</p>
                  )}
                </div>

                {/* 2. Título & Canal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                      Título do Vídeo *
                    </label>
                    <input
                      type="text"
                      placeholder="Título amigável para SEO..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white text-sm px-4 py-3 rounded-2xl outline-none font-semibold text-slate-800"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                      Nome do Canal *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Diário de Londres..."
                      value={channelName}
                      onChange={(e) => setChannelName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white text-sm px-4 py-3 rounded-2xl outline-none font-semibold text-slate-800"
                      required
                    />
                  </div>
                </div>

                {/* 3. Categoria & País */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                      Categoria *
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-sm px-3.5 py-3 rounded-2xl outline-none font-semibold text-slate-800 cursor-pointer"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                      País Curado *
                    </label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-sm px-3.5 py-3 rounded-2xl outline-none font-semibold text-slate-800 cursor-pointer"
                    >
                      {COUNTRIES.map(ctry => (
                        <option key={ctry} value={ctry}>{ctry}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4. Descrição */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                    Descrição do Vídeo
                  </label>
                  <textarea
                    placeholder="Descrição para orientar os utilizadores sobre o conteúdo do vídeo..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white text-sm px-4 py-3 rounded-2xl outline-none font-semibold text-slate-800 resize-none"
                  />
                </div>

                {/* 5. Thumbnail & Custom File Upload */}
                <div className="space-y-3.5 p-4 bg-slate-50 rounded-2xl border border-slate-150">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                      Thumbnail Oficial (URL) *
                    </label>
                    <input
                      type="url"
                      placeholder="Auto extraído ou forneça manualmente..."
                      value={thumbnailUrl}
                      onChange={(e) => setThumbnailUrl(e.target.value)}
                      className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 text-sm px-4 py-3 rounded-2xl outline-none font-semibold text-slate-800"
                      required
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide">Fazer upload manual de Thumbnail</p>
                      <p className="text-[10px] font-semibold text-slate-450">Útil em caso de falha da API ou link externo.</p>
                    </div>

                    <label className="relative shrink-0 flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-750 font-extrabold text-xs px-4 py-2.5 rounded-xl cursor-pointer shadow-sm transition-all">
                      <Upload size={14} />
                      <span>{uploading ? 'A enviar...' : 'Escolher Ficheiro'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleThumbnailUpload}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                  </div>

                  {thumbnailUrl && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pré-visualização da Thumbnail:</p>
                      <img
                        src={thumbnailUrl}
                        alt="Preview Thumbnail"
                        referrerPolicy="no-referrer"
                        className="w-40 aspect-video rounded-lg object-cover border border-slate-200"
                      />
                    </div>
                  )}
                </div>

                {/* 6. Featured & Active Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                  <label className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/50 rounded-2xl cursor-pointer hover:bg-slate-100/50 transition-all">
                    <div className="space-y-0.5">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wide">Vídeo em Destaque</span>
                      <p className="text-[10px] font-semibold text-slate-450 leading-none">Exibir no topo principal</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isFeatured}
                      onChange={(e) => setIsFeatured(e.target.checked)}
                      className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 transition-all cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/50 rounded-2xl cursor-pointer hover:bg-slate-100/50 transition-all">
                    <div className="space-y-0.5">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wide">Vídeo Ativo</span>
                      <p className="text-[10px] font-semibold text-slate-450 leading-none">Visível publicamente no site</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                      className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 transition-all cursor-pointer"
                    />
                  </label>
                </div>

                {/* Form Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-3 text-sm font-extrabold text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm px-6 py-3 rounded-2xl flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all"
                  >
                    <Save size={16} />
                    <span>{editingVideo ? 'Guardar Alterações' : 'Adicionar Vídeo'}</span>
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
