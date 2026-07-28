import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CommunityVideo } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Film, Plus, Edit, Trash2, CheckCircle2, XCircle, Search, 
  Youtube, Globe, Save, X, ExternalLink, Loader2 
} from 'lucide-react';
import { fetchYoutubeMetadata } from '../utils/youtube';

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

export default function MeusVideos() {
  const { user, isContentCreator, isAdmin, loading: authLoading } = useAuth();
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
  const [channelId, setChannelId] = useState<string | null>(null);
  const [channelUrl, setChannelUrl] = useState('');
  const [youtubeId, setYoutubeId] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [active, setActive] = useState(true);

  // States for fetching YouTube metadata
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [extractionMessage, setExtractionMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // Protection: only content_creator or admin can access /meus-videos
  useEffect(() => {
    if (!authLoading) {
      if (!user || (!isContentCreator && !isAdmin)) {
        navigate('/', { replace: true });
      }
    }
  }, [authLoading, user, isContentCreator, isAdmin, navigate]);

  // Load user's own videos
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'videos'),
      where('ownerId', '==', user.uid)
    );

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
      console.error('Erro ao ler meus vídeos:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Handle URL change - Auto extract metadata from YouTube oEmbed API
  const handleUrlBlur = async (url: string) => {
    if (!url) return;
    setFetchingMetadata(true);
    setExtractionMessage('⏳ Obtendo informações do YouTube...');
    try {
      const meta = await fetchYoutubeMetadata(url);
      setYoutubeId(meta.videoId);
      setThumbnailUrl(meta.thumbnailUrl);
      setTitle(meta.title);
      setChannelName(meta.channelName);
      setChannelUrl(meta.channelUrl);
      setChannelId(meta.channelId);
      setExtractionMessage('✅ Informações importadas com sucesso!');
    } catch (err: any) {
      console.error('Erro ao buscar metadados:', err);
      setExtractionMessage('❌ Erro ao ler metadados do YouTube. Verifique o link.');
    } finally {
      setFetchingMetadata(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingVideo(null);
    setYoutubeUrl('');
    setTitle('');
    setChannelName('');
    setChannelId(null);
    setChannelUrl('');
    setYoutubeId('');
    setCategory(CATEGORIES[0]);
    setCountry(COUNTRIES[0]);
    setDescription('');
    setThumbnailUrl('');
    setActive(true);
    setExtractionMessage('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (video: CommunityVideo) => {
    setEditingVideo(video);
    setYoutubeUrl(video.youtubeUrl);
    setTitle(video.title);
    setChannelName(video.channelName);
    setChannelId(video.channelId || null);
    setChannelUrl(video.channelUrl || '');
    setYoutubeId(video.youtubeId);
    setCategory(video.category);
    setCountry(video.country);
    setDescription(video.description || '');
    setThumbnailUrl(video.thumbnailUrl);
    setActive(video.active);
    setExtractionMessage('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!youtubeId || !title || !channelName || !thumbnailUrl) {
      alert('Por favor, introduza um link de YouTube válido e aguarde a extração automática.');
      return;
    }

    setSaving(true);
    const slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    const videoData: Partial<CommunityVideo> = {
      slug,
      youtubeUrl,
      youtubeId,
      title,
      channelName,
      category,
      country,
      description,
      thumbnailUrl,
      active,
      updatedAt: serverTimestamp(),
      
      // Architecture fields
      ownerId: user.uid,
      ownerName: user.displayName || user.email || 'Criador do Conteúdo',
      channelId,
      channelUrl,
      createdByRole: 'content_creator',
      status: 'approved' // Automatically published for content creator
    };

    try {
      if (editingVideo) {
        // Enforce security boundaries
        const docRef = doc(db, 'videos', editingVideo.id);
        await updateDoc(docRef, {
          category,
          country,
          description,
          active,
          updatedAt: serverTimestamp()
        });
      } else {
        const id = `video_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const docRef = doc(db, 'videos', id);
        
        await setDoc(docRef, {
          id,
          isFeatured: false, // Default is false, content creators cannot feature their own videos
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          ...videoData
        });
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Erro ao guardar vídeo:', err);
      alert('Erro ao guardar vídeo. Verifique as suas permissões.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (videoId: string) => {
    if (!window.confirm('Tem a certeza que deseja excluir este vídeo?')) return;

    try {
      await deleteDoc(doc(db, 'videos', videoId));
    } catch (err) {
      console.error('Erro ao excluir vídeo:', err);
      alert('Erro ao excluir vídeo. Certifique-se que o vídeo lhe pertence.');
    }
  };

  const toggleActive = async (video: CommunityVideo) => {
    try {
      const docRef = doc(db, 'videos', video.id);
      await updateDoc(docRef, {
        active: !video.active,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Erro ao alternar visibilidade:', err);
      alert('Erro ao atualizar visibilidade.');
    }
  };

  // Filter local videos
  const filteredVideos = React.useMemo(() => {
    return videos.filter(v => {
      const matchesSearch = v.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            v.channelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            v.category.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [videos, searchTerm]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <span className="text-sm font-semibold text-slate-500">A carregar os seus vídeos...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
              <Film size={28} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-brand font-black text-slate-950 leading-none">
                Meus Vídeos
              </h1>
              <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
                Gira e publique os seus vídeos da comunidade Mercado Luso.
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-2xl shadow-md shadow-red-200/50 hover:shadow-red-200/80 hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Adicionar Vídeo</span>
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3.5 shadow-xs max-w-md">
          <Search size={18} className="text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por título ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent border-none text-sm outline-none font-semibold text-slate-800"
          />
        </div>

        {/* Table / Grid */}
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xs overflow-hidden">
          {filteredVideos.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Film size={40} className="mx-auto text-slate-300" />
              <p className="text-sm font-black uppercase tracking-wider">Nenhum vídeo publicado</p>
              <p className="text-xs font-medium text-slate-450">Clique em "Adicionar Vídeo" para divulgar o seu primeiro conteúdo.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-extrabold text-[10px] uppercase tracking-wider">
                    <th className="py-4 px-6">Vídeo / Detalhes</th>
                    <th className="py-4 px-6">Canal</th>
                    <th className="py-4 px-6">Categoria / País</th>
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
                            onClick={() => handleOpenEditModal(video)}
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

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto" id="creator-video-modal">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={() => setIsModalOpen(false)} />

            <div className="flex min-h-full items-center justify-center p-4">
              <div className="relative bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
                
                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
                  <h2 className="text-lg font-brand font-black text-slate-900 flex items-center gap-2">
                    <Film size={20} className="text-red-600" />
                    <span>{editingVideo ? 'Editar Detalhes do Vídeo' : 'Publicar Novo Vídeo'}</span>
                  </h2>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-xl transition-all cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSave} className="p-6 overflow-y-auto max-h-[75vh] space-y-5">
                  
                  {/* URL - Only editable on create */}
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
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        onBlur={(e) => handleUrlBlur(e.target.value)}
                        disabled={!!editingVideo || fetchingMetadata}
                        className="w-full bg-slate-50 disabled:bg-slate-100 border border-slate-200 hover:border-slate-300 focus:border-red-500 focus:bg-white text-sm px-11 py-3.5 rounded-2xl outline-none font-semibold text-slate-800"
                        required
                      />
                    </div>
                    {extractionMessage && (
                      <p className={`text-[11px] font-bold px-1 ${extractionMessage.includes('❌') ? 'text-red-600' : 'text-emerald-600'}`}>
                        {extractionMessage}
                      </p>
                    )}
                  </div>

                  {/* Automatic Fields Preview (Read-only) */}
                  {youtubeId && (
                    <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 flex flex-col sm:flex-row gap-4">
                      <img 
                        src={thumbnailUrl} 
                        alt="Preview" 
                        referrerPolicy="no-referrer"
                        className="w-full sm:w-40 aspect-video object-cover rounded-xl border border-slate-200 bg-slate-100 self-start"
                      />
                      <div className="space-y-2 min-w-0 flex-1">
                        <div>
                          <span className="text-[9px] bg-red-50 border border-red-200 text-red-600 px-1.5 py-0.5 rounded uppercase tracking-wider font-extrabold block w-max mb-1">
                            Metadados do YouTube
                          </span>
                          <h4 className="font-brand font-black text-slate-900 text-sm line-clamp-2 leading-tight">
                            {title || 'Obtendo título...'}
                          </h4>
                          <p className="text-xs text-slate-500 font-bold mt-1">
                            Canal: {channelName || 'Obtendo canal...'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Category & Country */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                        Categoria *
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-red-500 focus:bg-white text-sm px-4 py-3.5 rounded-2xl outline-none font-semibold text-slate-800"
                        required
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                        País de Foco *
                      </label>
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-red-500 focus:bg-white text-sm px-4 py-3.5 rounded-2xl outline-none font-semibold text-slate-800"
                        required
                      >
                        {COUNTRIES.map((ct) => (
                          <option key={ct} value={ct}>{ct}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Custom Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                      Descrição Personalizada (Opcional)
                    </label>
                    <textarea
                      placeholder="Adicione um breve comentário ou explicação sobre este vídeo para os leitores do Mercado Luso..."
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-red-500 focus:bg-white text-sm px-4 py-3.5 rounded-2xl outline-none font-semibold text-slate-800 resize-none"
                    />
                  </div>

                  {/* Active / Inactive */}
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                    <input
                      type="checkbox"
                      id="active"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                      className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500"
                    />
                    <label htmlFor="active" className="text-xs sm:text-sm font-black text-slate-800 cursor-pointer select-none">
                      Vídeo Ativo (Visível na Plataforma)
                    </label>
                  </div>

                  {/* Footer buttons */}
                  <div className="border-t border-slate-100 pt-5 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-2xl transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving || fetchingMetadata || !youtubeId}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-55 disabled:cursor-not-allowed text-white font-bold text-sm rounded-2xl shadow-md transition-all cursor-pointer"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>A guardar...</span>
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          <span>{editingVideo ? 'Guardar Alterações' : 'Publicar Vídeo'}</span>
                        </>
                      )}
                    </button>
                  </div>

                </form>

              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
