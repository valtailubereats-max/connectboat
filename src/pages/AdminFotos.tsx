import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, storage, handleFirestoreError, OperationType, getDocsWithCacheFallback } from '../firebase';
import { collection, query, orderBy, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { PhotoStoreItem } from '../types';
import { 
  Camera, Plus, Edit, Trash2, Check, X, ShieldAlert, 
  UploadCloud, Loader2, AlertCircle, ShoppingBag, Eye, EyeOff 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function compressImage(file: File, maxWidth: number = 1000, quality: number = 0.85): Promise<Blob | File> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file);
            }
          }, 'image/jpeg', quality);
        } else {
          resolve(file);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function AdminFotos() {
  const { isAdmin, isModerator, user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<PhotoStoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PhotoStoreItem | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [active, setActive] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  
  // File Upload State
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Alert banner State
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  
  const colPath = 'photoStoreItems';

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ type, text });
    setTimeout(() => {
      setAlertMsg(null);
    }, 4500);
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, colPath), orderBy('createdAt', 'desc'));
      const snapshot = await getDocsWithCacheFallback(q, colPath);
      const list: PhotoStoreItem[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as PhotoStoreItem);
      });
      setItems(list);
    } catch (err) {
      console.error('Error fetching admin photos:', err);
      showToast('Erro ao carregar o catálogo de fotos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchItems();
    }
  }, [isAdmin]);

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 min-h-[50vh]">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
        <p className="text-sm font-bold text-slate-500">A verificar credenciais...</p>
      </div>
    );
  }

  // Prevent Non-Admins & Moderators from accessing
  if (!user || !isAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white rounded-3xl border border-slate-200 p-8 text-center shadow-sm" id="admin-fotos-acesso-negado">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={36} />
        </div>
        <h1 className="text-2xl font-brand font-black text-slate-900 mb-2">Acesso Restrito</h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          Apenas administradores do Mercado Luso possuem permissão para aceder e moderar a loja de fotos. Moderadores ou utilizadores comuns não possuem acesso.
        </p>
        <button 
          onClick={() => window.location.href = '/'}
          className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-2xl max-w-xs mx-auto hover:bg-slate-800 transition-all cursor-pointer"
        >
          Voltar ao Início
        </button>
      </div>
    );
  }

  // File drag & drop helpers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > 8 * 1024 * 1024) {
        showToast('A imagem excede o limite de 8MB.', 'error');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 8 * 1024 * 1024) {
        showToast('A imagem excede o limite de 8MB.', 'error');
        return;
      }
      setSelectedFile(file);
    }
  };

  const clearForm = () => {
    setEditingItem(null);
    setTitle('');
    setDescription('');
    setPrice('');
    setActive(true);
    setImageUrl('');
    setSelectedFile(null);
    setIsFormOpen(false);
  };

  const handleEditClick = (item: PhotoStoreItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setDescription(item.description);
    setPrice(item.price);
    setActive(item.active);
    setImageUrl(item.imageUrl);
    setSelectedFile(null);
    setIsFormOpen(true);
  };

  const uploadPhotoFile = async (file: File): Promise<string> => {
    setUploading(true);
    try {
      const compressedImage = await compressImage(file, 1500, 0.85);
      const uniqueFileName = `photo_store/${Date.now()}__${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const fileRef = ref(storage, uniqueFileName);
      
      const uploadSnapshot = await uploadBytes(fileRef, compressedImage);
      const downloadUrl = await getDownloadURL(uploadSnapshot.ref);
      return downloadUrl;
    } catch (uploadErr) {
      console.error('Erro no upload de ficheiro:', uploadErr);
      throw new Error('Falha no upload do arquivo para o Firebase Storage.');
    } finally {
      setUploading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      showToast('Por favor, defina um título válido.', 'error');
      return;
    }
    if (price === '' || isNaN(Number(price)) || Number(price) < 0) {
      showToast('Por favor, informe um preço maior ou igual a zero.', 'error');
      return;
    }
    if (!selectedFile && !imageUrl.trim()) {
      showToast('Por favor, envie um ficheiro ou cole o URL da imagem.', 'error');
      return;
    }

    setLoading(true);

    try {
      let finalUrl = imageUrl;
      
      // Upload file to firebase storage if selected
      if (selectedFile) {
        finalUrl = await uploadPhotoFile(selectedFile);
      }

      if (editingItem) {
        // Edit flow
        const updatePayload = {
          title: title.trim(),
          description: description.trim(),
          price: Number(price),
          imageUrl: finalUrl,
          active,
          updatedAt: serverTimestamp(),
        };

        const itemRef = doc(db, colPath, editingItem.id);
        await updateDoc(itemRef, updatePayload);
        showToast('Foto editada com sucesso!');
      } else {
        // Create flow
        const createPayload = {
          title: title.trim(),
          description: description.trim(),
          price: Number(price),
          imageUrl: finalUrl,
          active,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        };

        await addDoc(collection(db, colPath), createPayload);
        showToast('Nova foto adicionada à loja pública!');
      }

      clearForm();
      await fetchItems();
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Erro ao salvar item da loja:', err);
      showToast('Erro ao gravar dados no Firestore.', 'error');
      try {
        handleFirestoreError(err, OperationType.WRITE, colPath);
      } catch (_) {}
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm('Tem a certeza absoluta de que deseja remover permanentemente esta foto do catálogo?')) {
      return;
    }

    setLoading(true);
    try {
      await deleteDoc(doc(db, colPath, itemId));
      showToast('Foto deletada da base de dados!');
      await fetchItems();
    } catch (err) {
      console.error('Erro ao deletar:', err);
      showToast('Erro ao remover o item no Firestore.', 'error');
      try {
        handleFirestoreError(err, OperationType.DELETE, `${colPath}/${itemId}`);
      } catch (_) {}
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8" id="admin-loja-fotos-panel">
      {/* Toast Alert Banner */}
      <AnimatePresence>
        {alertMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 border ${
              alertMsg.type === 'success'
                ? 'bg-[#e8f7ee] border-[#bfead0] text-pt-green'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            {alertMsg.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
            <span className="text-sm font-bold">{alertMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-brand font-black text-slate-900 tracking-tight flex items-center gap-2">
            📸 Gestão da Loja de Fotos
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            Painel Administrativo para cadastrar e moderar fotos digitais
          </p>
        </div>
        
        {!isFormOpen && (
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex items-center justify-center gap-2 bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-3 rounded-2xl text-sm transition-all shadow-md shadow-indigo-100 cursor-pointer"
          >
            <Plus size={18} />
            <span>Adicionar Foto</span>
          </button>
        )}
      </div>

      {/* Main Admin Content Grid */}
      <div className="grid grid-cols-1 gap-8">
        
        {/* Form Modal / Drawer */}
        <AnimatePresence>
          {isFormOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white rounded-3xl border border-slate-250 p-6 md:p-8 shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <h3 className="text-lg font-brand font-black text-slate-900">
                  {editingItem ? '✏️ Editar Item da Loja' : '✨ Adicionar Nova Foto'}
                </h3>
                <button
                  onClick={clearForm}
                  className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column Fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Título da Foto</label>
                      <input
                        type="text"
                        placeholder="Ex: Pôr do Sol na Praia da Luz"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-3 px-4 text-sm font-semibold outline-none transition-all"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Preço (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Ex: 19.99"
                          value={price}
                          onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-3 px-4 text-sm font-semibold outline-none transition-all"
                          required
                        />
                      </div>

                      <div className="flex flex-col justify-end">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Visibilidade Pública</label>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            checked={active} 
                            onChange={(e) => setActive(e.target.checked)}
                            className="sr-only peer" 
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#52b64d]"></div>
                          <span className="ml-3 text-sm font-bold text-slate-700">
                            {active ? 'Ativo' : 'Inativo'}
                          </span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Descrição Curta</label>
                      <textarea
                        rows={4}
                        placeholder="Uma breve descrição sobre a composição, câmera, localização ou significado desta foto."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-3 px-4 text-sm font-semibold outline-none transition-all resize-none"
                      />
                    </div>
                  </div>

                  {/* Right Column Fields (Image upload picker & preview) */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Enviar Foto para Firebase Storage</label>
                      
                      <div 
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                          dragActive 
                            ? 'border-indigo-500 bg-indigo-50/20' 
                            : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <UploadCloud className="mx-auto text-slate-400 mb-2" size={32} />
                        <p className="text-sm font-bold text-slate-700">Arraste ou clique para selecionar ficheiro</p>
                        <p className="text-xs text-slate-400 mt-1">Limite recomendado de 8MB. Ficheiro será comprimido.</p>
                        
                        {selectedFile && (
                          <div className="mt-3 bg-emerald-50 text-pt-green text-xs font-bold px-3 py-1.5 rounded-xl inline-flex items-center gap-1 border border-emerald-100">
                            <Check size={14} />
                            Ficheiro: {selectedFile.name}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">Ou URL Externo Alternativo</label>
                      <input
                        type="url"
                        placeholder="https://exemplo.com/fabulosa-foto.jpg"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-3 px-4 text-sm font-semibold outline-none transition-all"
                      />
                    </div>

                    {((selectedFile) || imageUrl) && (
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col items-center">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 w-full text-left">Pré-visualização</label>
                        <div className="aspect-[4/3] w-full max-w-[200px] rounded-lg overflow-hidden border border-slate-200 bg-slate-200 select-none relative">
                          <img
                            src={(selectedFile ? URL.createObjectURL(selectedFile) : imageUrl) || null}
                            alt="Visualização"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={clearForm}
                    className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-bold transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || loading || savedSuccess}
                    className={`px-6 py-3 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 ${
                      savedSuccess 
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100' 
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'
                    }`}
                  >
                    {(uploading || loading) ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        <span>A gravar...</span>
                      </>
                    ) : savedSuccess ? (
                      <span>✓ Guardado com Sucesso!</span>
                    ) : (
                      <span>Gravar Foto</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Existing Items Catalog List */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <ShoppingBag size={20} className="text-indigo-600" />
            <h3 className="text-lg font-brand font-black text-slate-900">Ficheiro de Fotografias do Mercado Luso</h3>
            <span className="ml-2 bg-slate-100 text-slate-600 text-xs font-extrabold px-2 py-0.5 rounded-full leading-none">
              {items.length}
            </span>
          </div>

          {loading && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
              <p className="text-slate-500 font-semibold text-xs mt-3">A ler base de dados...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <Camera size={28} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-bold">Nenhuma foto cadastrada ainda.</p>
              <p className="text-xs text-slate-400 mt-1">Clique em "Adicionar Foto" no canto superior direito do ecrã para começar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4 w-24">Miniatura</th>
                    <th className="py-3.5 px-4">Informação do Item</th>
                    <th className="py-3.5 px-4 w-32 text-right">Preço</th>
                    <th className="py-3.5 px-4 w-32 text-center">Status</th>
                    <th className="py-3.5 px-4 w-32 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-4 px-4">
                        <div className="w-14 h-14 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 select-none shrink-0">
                          <img
                            src={item.imageUrl && item.imageUrl.trim() !== '' ? item.imageUrl : null}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-extrabold text-slate-900 line-clamp-1">{item.title}</p>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 max-w-sm">{item.description || 'Sem descrição.'}</p>
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-bold text-slate-800">
                        {item.price.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {item.active ? (
                          <span className="inline-flex items-center gap-1 bg-[#e8f7ee] border border-[#bfead0] text-pt-green text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                            <Eye size={12} />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                            <EyeOff size={12} />
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEditClick(item)}
                            title="Editar Item"
                            className="p-2 border border-slate-150 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            title="Remover Item"
                            className="p-2 border border-red-100 text-red-500 hover:text-red-700 hover:bg-red-50/50 rounded-xl transition-all cursor-pointer"
                          >
                            <Trash2 size={15} />
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
      </div>
    </div>
  );
}
