import React, { useEffect, useRef, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Camera, Edit3, ExternalLink, ImagePlus, Loader2, Plus, Trash2, UploadCloud, X } from 'lucide-react';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';

type GalleryPhoto = {
  id: string;
  title?: string;
  caption?: string;
  imageUrl: string;
  storagePath: string;
  linkUrl?: string;
  linkEnabled: boolean;
  published: boolean;
  displayOrder: number;
  createdAt?: { seconds?: number };
};

const emptyForm = { title: '', caption: '', linkUrl: '', linkEnabled: false, published: true, displayOrder: 0 };

const normaliseUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

export default function AdminBoatShowMoments() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GalleryPhoto | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const toast = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage(null), 4000);
  };

  const loadPhotos = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'boatShowMoments'));
      const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as GalleryPhoto));
      items.sort((a, b) => (a.displayOrder ?? 9999) - (b.displayOrder ?? 9999) || (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setPhotos(items);
    } catch (error) {
      console.error(error);
      toast('Could not load the gallery.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) loadPhotos(); }, [isAdmin]);

  const closeForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setFiles([]);
    setFormOpen(false);
  };

  const startEdit = (photo: GalleryPhoto) => {
    setEditing(photo);
    setForm({
      title: photo.title || '', caption: photo.caption || '', linkUrl: photo.linkUrl || '',
      linkEnabled: photo.linkEnabled === true, published: photo.published === true,
      displayOrder: photo.displayOrder ?? 0,
    });
    setFiles([]);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const savePhoto = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing && files.length === 0) return toast('Choose one or more photos to upload.', 'error');
    if (editing && files.length > 1) return toast('Choose only one replacement photo while editing.', 'error');
    if (form.linkEnabled && !form.linkUrl.trim()) return toast('Add a link or disable the link button.', 'error');

    setSaving(true);
    let newStoragePath = '';
    try {
      let imageUrl = editing?.imageUrl || '';
      let storagePath = editing?.storagePath || '';

      if (files.length > 0) {
        if (editing) {
          const selectedFile = files[0];
          const documentRef = doc(db, 'boatShowMoments', editing.id);
          const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          newStoragePath = `boat-show-moments/${documentRef.id}/${Date.now()}_${safeName}`;
          const uploaded = await uploadBytes(ref(storage, newStoragePath), selectedFile, { contentType: selectedFile.type });
          imageUrl = await getDownloadURL(uploaded.ref);
          storagePath = newStoragePath;
          const payload = {
            title: form.title.trim(), caption: form.caption.trim(), imageUrl, storagePath,
            linkUrl: normaliseUrl(form.linkUrl), linkEnabled: form.linkEnabled,
            published: form.published, displayOrder: Number(form.displayOrder) || 0, updatedAt: serverTimestamp(),
          };
          await updateDoc(documentRef, payload);
          if (editing.storagePath && editing.storagePath !== storagePath) await deleteObject(ref(storage, editing.storagePath)).catch(() => undefined);
        } else {
          const baseOrder = Number(form.displayOrder) || 0;
          for (const [index, selectedFile] of files.entries()) {
            const documentRef = doc(collection(db, 'boatShowMoments'));
            const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            newStoragePath = `boat-show-moments/${documentRef.id}/${Date.now()}_${index}_${safeName}`;
            const uploaded = await uploadBytes(ref(storage, newStoragePath), selectedFile, { contentType: selectedFile.type });
            imageUrl = await getDownloadURL(uploaded.ref);
            storagePath = newStoragePath;
            await setDoc(documentRef, {
              title: form.title.trim(), caption: form.caption.trim(), imageUrl, storagePath,
              linkUrl: normaliseUrl(form.linkUrl), linkEnabled: form.linkEnabled,
              published: form.published, displayOrder: baseOrder + index,
              createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
            });
            newStoragePath = '';
          }
        }
      } else if (editing) {
        await updateDoc(doc(db, 'boatShowMoments', editing.id), {
          title: form.title.trim(), caption: form.caption.trim(), linkUrl: normaliseUrl(form.linkUrl),
          linkEnabled: form.linkEnabled, published: form.published,
          displayOrder: Number(form.displayOrder) || 0, updatedAt: serverTimestamp(),
        });
      }

      toast(editing ? 'Photo updated.' : `${files.length} ${files.length === 1 ? 'photo' : 'photos'} added.`);
      closeForm();
      await loadPhotos();
    } catch (error) {
      console.error(error);
      if (newStoragePath) await deleteObject(ref(storage, newStoragePath)).catch(() => undefined);
      toast('Could not save the photo.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removePhoto = async (photo: GalleryPhoto) => {
    if (!window.confirm('Delete this photo permanently? This will also remove it from Firebase Storage.')) return;
    try {
      if (photo.storagePath) await deleteObject(ref(storage, photo.storagePath));
      await deleteDoc(doc(db, 'boatShowMoments', photo.id));
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      toast('Photo deleted.');
    } catch (error) {
      console.error(error);
      toast('Could not delete the photo.', 'error');
    }
  };

  if (authLoading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;
  if (!isAdmin) return <div className="bg-white border border-red-100 rounded-2xl p-8 text-center"><h1 className="text-xl font-black text-slate-900">Admin access required</h1><p className="mt-2 text-slate-500">Only administrators can manage this gallery.</p></div>;

  return (
    <div className="space-y-6 pb-12">
      {message && <div className={`fixed top-5 right-5 z-[200] rounded-xl px-5 py-3 text-sm font-black shadow-xl ${message.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>{message.text}</div>}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-3xl font-black text-slate-900">Boat Show Moments</h1><p className="mt-1 text-sm text-slate-500">Manage the Southampton International Boat Show 2026 gallery.</p></div>
        <button onClick={() => { closeForm(); setFormOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white"><Plus size={18} /> Add Photo</button>
      </div>

      {formOpen && (
        <form onSubmit={savePhoto} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><h2 className="text-xl font-black text-slate-900">{editing ? 'Edit Photo' : 'Add Photo'}</h2><button type="button" onClick={closeForm} className="p-2 text-slate-500"><X size={20} /></button></div>
          <div className="grid gap-5 p-6 lg:grid-cols-2">
            <label className="lg:col-span-2"><span className="text-xs font-black text-slate-600">Photo{!editing ? 's' : ''} {!editing && '*'}</span><button type="button" onClick={() => fileInput.current?.click()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm font-black text-slate-600 hover:border-indigo-300"><UploadCloud size={22} /> {files.length > 0 ? `${files.length} ${files.length === 1 ? 'photo selected' : 'photos selected'}` : editing ? 'Choose a replacement photo' : 'Choose multiple photos'}</button><input ref={fileInput} type="file" multiple={!editing} accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []))} />{!editing && <span className="mt-2 block text-xs font-medium text-slate-400">All selected photos will use the details below. Display order increases automatically.</span>}</label>
            <label><span className="text-xs font-black text-slate-600">Title (optional)</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold" placeholder="A moment from the show" /></label>
            <label><span className="text-xs font-black text-slate-600">Display order</span><input type="number" min="0" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold" /></label>
            <label className="lg:col-span-2"><span className="text-xs font-black text-slate-600">Caption (optional)</span><textarea rows={3} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold" /></label>
            <label className="lg:col-span-2"><span className="text-xs font-black text-slate-600">External link (optional)</span><input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold" placeholder="https://..." /></label>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"><span className="text-sm font-black text-slate-700">Show link button</span><input type="checkbox" checked={form.linkEnabled} onChange={(e) => setForm({ ...form, linkEnabled: e.target.checked })} className="h-5 w-5" /></label>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"><span className="text-sm font-black text-slate-700">Published</span><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} className="h-5 w-5" /></label>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-5"><button type="button" onClick={closeForm} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600">Cancel</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-black text-white disabled:opacity-60">{saving && <Loader2 size={17} className="animate-spin" />}{editing ? 'Save Changes' : 'Publish Photo'}</button></div>
        </form>
      )}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5"><h2 className="font-black text-slate-900">Gallery Photos</h2><p className="mt-1 text-xs font-medium text-slate-500">{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</p></div>
        {loading ? <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-indigo-600" size={34} /></div> : photos.length === 0 ? <div className="py-16 text-center"><ImagePlus size={40} className="mx-auto text-slate-300" /><h3 className="mt-4 text-lg font-black text-slate-900">No photos yet</h3><p className="mt-2 text-sm text-slate-500">Add the first show moment to begin the gallery.</p></div> : <div className="divide-y divide-slate-100">{photos.map((photo) => <div key={photo.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><img src={photo.imageUrl} alt="" className="h-28 w-full rounded-2xl object-cover sm:w-40" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-slate-900">{photo.title || 'Untitled photo'}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${photo.published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{photo.published ? 'Published' : 'Draft'}</span></div>{photo.caption && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{photo.caption}</p>}<p className="mt-2 text-xs font-bold text-slate-400">Order: {photo.displayOrder ?? 0}</p></div><div className="flex gap-2">{photo.linkEnabled && photo.linkUrl && <a href={photo.linkUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-200 p-2.5 text-slate-500"><ExternalLink size={17} /></a>}<button onClick={() => startEdit(photo)} className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:text-indigo-600" title="Edit"><Edit3 size={17} /></button><button onClick={() => removePhoto(photo)} className="rounded-xl border border-red-100 bg-red-50 p-2.5 text-red-500" title="Delete"><Trash2 size={17} /></button></div></div>)}</div>}
      </div>
    </div>
  );
}
