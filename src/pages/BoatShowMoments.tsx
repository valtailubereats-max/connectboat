import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Camera, ExternalLink, Loader2, Maximize2 } from 'lucide-react';
import { db } from '../firebase';
import ImageLightboxModal from '../components/ImageLightboxModal';

type GalleryPhoto = {
  id: string;
  title?: string;
  caption?: string;
  imageUrl: string;
  linkUrl?: string;
  linkEnabled?: boolean;
  published: boolean;
  displayOrder?: number;
  createdAt?: { seconds?: number };
};

export default function BoatShowMoments() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'Boat Show Moments | ConnectBoat';
    const loadPhotos = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'boatShowMoments'), where('published', '==', true)));
        const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as GalleryPhoto));
        items.sort((a, b) => (a.displayOrder ?? 9999) - (b.displayOrder ?? 9999) ||
          (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setPhotos(items);
      } catch (error) {
        console.error('Error loading Boat Show Moments:', error);
      } finally {
        setLoading(false);
      }
    };
    loadPhotos();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_top_right,_#38bdf8,_transparent_42%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="inline-flex items-center gap-2 text-sky-300 text-xs font-black uppercase tracking-[0.2em]">
            <Camera size={17} /> ConnectBoat Gallery
          </div>
          <h1 className="mt-4 text-4xl sm:text-6xl font-black tracking-tight">Boat Show Moments</h1>
          <p className="mt-5 max-w-2xl text-base sm:text-lg text-slate-300 leading-relaxed">
            Highlights from the Southampton International Boat Show 2026 — people, boats and memorable moments from the heart of the marine community.
          </p>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {loading ? (
          <div className="min-h-[340px] flex flex-col items-center justify-center">
            <Loader2 size={38} className="animate-spin text-sky-600" />
            <p className="mt-4 text-sm font-bold text-slate-500">Loading gallery...</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl py-20 px-6 text-center shadow-sm">
            <Camera size={44} className="mx-auto text-slate-300" />
            <h2 className="mt-5 text-2xl font-black text-slate-900">More moments coming soon</h2>
            <p className="mt-2 text-sm text-slate-500">We are preparing highlights from the show. Please visit again soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {photos.map((photo, index) => (
              <article key={photo.id} className="overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-sm">
                <button
                  type="button"
                  onClick={() => setLightboxIndex(index)}
                  className="group relative block w-full aspect-[4/3] overflow-hidden bg-slate-100 text-left cursor-zoom-in"
                  aria-label={`Enlarge ${photo.title || 'event photo'}`}
                >
                  <img src={photo.imageUrl} alt={photo.title || 'Southampton International Boat Show 2026'} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  <span className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full bg-slate-950/75 px-3 py-2 text-xs font-black text-white backdrop-blur-sm opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <Maximize2 size={15} /> Zoom
                  </span>
                </button>
                {(photo.title || photo.caption || (photo.linkEnabled && photo.linkUrl)) && (
                  <div className="p-5 sm:p-6">
                    {photo.title && <h2 className="text-xl font-black text-slate-900">{photo.title}</h2>}
                    {photo.caption && <p className="mt-2 text-sm text-slate-600 leading-relaxed">{photo.caption}</p>}
                    {photo.linkEnabled && photo.linkUrl && (
                      <a href={photo.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800">
                        Visit link <ExternalLink size={15} />
                      </a>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </main>

      <ImageLightboxModal
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        images={photos.map((photo) => photo.imageUrl)}
        currentIndex={lightboxIndex ?? 0}
        onIndexChange={setLightboxIndex}
        title="Southampton International Boat Show 2026"
      />
    </div>
  );
}
