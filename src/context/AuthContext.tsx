import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, deleteDoc, updateDoc, serverTimestamp, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { auth, db, withTimeout, getDocWithCacheFallback, getDocsWithCacheFallback } from '../firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  favorites: string[]; // Novo: Lista global de IDs favoritos
  refreshProfile: () => Promise<void>;
  toggleFavoriteGlobal: (adId: string) => Promise<void>; // Novo: Função para atualizar a lista localmente
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isModerator: false,
  favorites: [],
  refreshProfile: async () => {},
  toggleFavoriteGlobal: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    // Inicialização síncrona para evitar delays visuais
    const localRaw = localStorage.getItem('connectboat_favorites') || localStorage.getItem('mercado_luso_favorites');
    try {
      return localRaw ? JSON.parse(localRaw) : [];
    } catch {
      return [];
    }
  }); 
  const [loading, setLoading] = useState(true);

  // Sincroniza favoritos locais pré-existentes (quando logava sem conta)
  const syncLocalFavoritesToFirestore = async (uid: string) => {
    const localRaw = localStorage.getItem('connectboat_favorites') || localStorage.getItem('mercado_luso_favorites');
    if (!localRaw) return;
    try {
      const localIds = JSON.parse(localRaw);
      if (Array.isArray(localIds) && localIds.length > 0) {
        // Busca favoritos existentes no Firestore para evitar duplicados
        const q = query(collection(db, 'favorites'), where('userId', '==', uid), limit(5));
        const snap = await getDocsWithCacheFallback(q, `favorites/sync-${uid}`);
        const existingAdIds = new Set(snap.docs.map(doc => doc.data().adId));

        const promises = localIds
          .filter(id => !existingAdIds.has(id))
          .map(async (adId) => {
            const newFavId = `fav_${Date.now()}_${uid}_${Math.random().toString(36).substring(2, 7)}`;
            await setDoc(doc(db, 'favorites', newFavId), {
              id: newFavId,
              userId: uid,
              adId: adId,
              createdAt: new Date()
            });
          });

        if (promises.length > 0) {
          await Promise.all(promises);
        }
        localStorage.removeItem('connectboat_favorites');
        localStorage.removeItem('mercado_luso_favorites');
      }
    } catch (e) {
      console.error("Erro ao sincronizar favoritos locais:", e);
    }
  };

  const fetchFavorites = async (uid: string) => {
    try {
      const q = query(collection(db, 'favorites'), where('userId', '==', uid), limit(5));
      const snap = await getDocsWithCacheFallback(q, `favorites/userId-${uid}`);
      const favIds = snap.docs.map(doc => doc.data().adId);
      setFavorites(favIds);
    } catch (err) {
      console.error("Error fetching favorites:", err);
    }
  };

  const registerReferralIfNeeded = async (uid: string, userProfile: UserProfile) => {
    const refCode = localStorage.getItem('referred_by_code');
    if (!refCode) return;

    if (userProfile.referredBy) {
      localStorage.removeItem('referred_by_code');
      return;
    }

    if (userProfile.referralCode === refCode) {
      localStorage.removeItem('referred_by_code');
      return;
    }

    try {
      const q = query(collection(db, 'users'), where('referralCode', '==', refCode), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const inviterDoc = snap.docs[0];
        const inviterId = inviterDoc.id;

        const referralId = uid;
        await setDoc(doc(db, 'referrals', referralId), {
          id: referralId,
          inviterId: inviterId,
          inviterCode: refCode,
          referredUserId: uid,
          referredName: userProfile.name || 'Utilizador',
          createdAt: new Date()
        });

        await updateDoc(doc(db, 'users', uid), {
          referredBy: refCode
        });

        localStorage.removeItem('referred_by_code');
        await fetchProfile(uid, true);
      }
    } catch (err) {
      console.error("Error registering referral:", err);
    }
  };

  // Carrega e atualiza o Cache de Perfil no sessionStorage
  const fetchProfile = async (uid: string, forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        const cached = sessionStorage.getItem(`profile_cache_${uid}`);
        if (cached) {
          const parsed = JSON.parse(cached) as UserProfile;
          setProfile(parsed);
          return;
        }
      }

      const docRef = doc(db, 'users', uid);
      const docSnap = await withTimeout(getDocWithCacheFallback(docRef, `users/${uid}`), 45000);
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        
        if (!data.referralCode) {
          const generatedCode = `REF${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          const updatedFields = {
            referralCode: generatedCode,
            referredUsersCount: data.referredUsersCount || 0,
            referralCredits: data.referralCredits || 0
          };
          
          await updateDoc(docRef, updatedFields).catch(err => {
            console.error("Error setting initial referral code:", err);
          });
          
          const enrichedProfile = { ...data, ...updatedFields };
          setProfile(enrichedProfile);
          sessionStorage.setItem(`profile_cache_${uid}`, JSON.stringify(enrichedProfile));
          registerReferralIfNeeded(uid, enrichedProfile);
        } else {
          setProfile(data);
          sessionStorage.setItem(`profile_cache_${uid}`, JSON.stringify(data));
          registerReferralIfNeeded(uid, data);
        }
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  };

  // Função híbrida para favoritar/desfavoritar
  const toggleFavoriteGlobal = async (adId: string) => {
    if (!user) {
      // Guardar local no localStorage
      const localRaw = localStorage.getItem('mercado_luso_favorites');
      let localFavs: string[] = [];
      try {
        localFavs = localRaw ? JSON.parse(localRaw) : [];
      } catch {
        localFavs = [];
      }
      if (!Array.isArray(localFavs)) localFavs = [];

      let updated: string[];
      if (localFavs.includes(adId)) {
        updated = localFavs.filter(id => id !== adId);
      } else {
        updated = [...localFavs, adId];
      }
      localStorage.setItem('mercado_luso_favorites', JSON.stringify(updated));
      setFavorites(updated);
    } else {
      // Sincronizado com o Firestore
      const isFav = favorites.includes(adId);
      
      // Resposta otimista instantânea na UI
      setFavorites(prev => 
        prev.includes(adId) ? prev.filter(id => id !== adId) : [...prev, adId]
      );

      try {
        if (isFav) {
          const q = query(
            collection(db, 'favorites'), 
            where('userId', '==', user.uid), 
            where('adId', '==', adId),
            limit(5)
          );
          const snap = await getDocsWithCacheFallback(q, `favorites/delete-${user.uid}-${adId}`);
          const deletePromises = snap.docs.map(docSnapshot => deleteDoc(docSnapshot.ref));
          await Promise.all(deletePromises);
        } else {
          const newFavId = `fav_${Date.now()}_${user.uid}`;
          await setDoc(doc(db, 'favorites', newFavId), {
            id: newFavId,
            userId: user.uid,
            adId: adId,
            createdAt: new Date()
          });
        }
      } catch (err) {
        console.error("Erro ao favoritar/desfavoritar:", err);
        // Reverte estado local se falhar
        setFavorites(prev => 
          prev.includes(adId) ? prev.filter(id => id !== adId) : [...prev, adId]
        );
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      if (u) {
        setUser(u);
        try {
          await syncLocalFavoritesToFirestore(u.uid);
        } catch (e) {
          console.error("Erro no fluxo do sync:", e);
        }
        
        // Carrega Perfil e Favoritos (o fetchProfile utilizará cache)
        await Promise.all([
          fetchProfile(u.uid),
          fetchFavorites(u.uid)
        ]);
        setLoading(false);

        updateDoc(doc(db, 'users', u.uid), {
          lastLoginAt: serverTimestamp()
        }).catch(() => {});
      } else {
        setUser(null);
        setProfile(null);
        // Restaura favoritos do LocalStorage offline
        const localRaw = localStorage.getItem('mercado_luso_favorites');
        try {
          const localFavs = localRaw ? JSON.parse(localRaw) : [];
          setFavorites(Array.isArray(localFavs) ? localFavs : []);
        } catch {
          setFavorites([]);
        }
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const refreshProfile = async () => {
    if (user) {
      await Promise.all([
        fetchProfile(user.uid, true), // forceRefresh = true
        fetchFavorites(user.uid)
      ]);
    }
  };

  const isAdmin = profile?.role === 'admin' || 
    user?.email === 'valtailubereats@gmail.com' || 
    user?.email === 'valtail@gmail.com' || 
    user?.email === 'generalsales2021@gmail.com';

  const isModerator = profile?.role === 'moderator';


  const value = React.useMemo(() => ({
    user,
    profile,
    loading,
    isAdmin,
    isModerator,
    favorites,
    refreshProfile,
    toggleFavoriteGlobal
  }), [user, profile, loading, isAdmin, isModerator, favorites]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);