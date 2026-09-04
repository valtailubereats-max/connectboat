import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Star, CheckCircle, AlertCircle } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, runTransaction, collection, query, getDocs, limit, orderBy, startAt, endAt, where } from 'firebase/firestore';
import { Review, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { sendEmailGeneric, getSellerEmail } from '../utils/emailService';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  adId: string;
  adTitle: string;
  adCategory?: string;
  sellerId: string;
  sellerName: string;
  onSuccess: () => void;
  isBuyerRating?: boolean;
}

const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  adId,
  adTitle,
  adCategory = '',
  sellerId,
  sellerName,
  onSuccess,
  isBuyerRating = false
}) => {
  const { user, profile: currentUserProfile } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [success, setSuccess] = useState<boolean | null>(null);
  const [buyerName, setBuyerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  // States for selecting buyer
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>('');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Clear states when the modal is closed
  useEffect(() => {
    if (!isOpen) {
      setRating(0);
      setComment('');
      setSuccess(null);
      setBuyerName('');
      setSelectedBuyerId('');
      setUsersList([]);
      setShowDropdown(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (user && isBuyerRating) {
      setBuyerName(currentUserProfile?.name || '');
      setSelectedBuyerId(user.uid);
    }
  }, [user, isBuyerRating, currentUserProfile]);

  // Fetch interested users from adInterests when seller is marking ad as sold
  useEffect(() => {
    if (!isOpen || isBuyerRating || !adId || !sellerId) {
      return;
    }

    setLoadingUsers(true);

    const getInterestedUsers = async () => {
      try {
        const q0 = query(
          collection(db, 'adInterests'),
          where('adId', '==', adId),
          where('sellerId', '==', sellerId),
          limit(50)
        );
        const querySnapshot = await getDocs(q0);
        const list = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setUsersList(list);
      } catch (err) {
        console.error('[ReviewModal] Erro ao carregar interessados:', err);
      } finally {
        setLoadingUsers(false);
      }
    };

    getInterestedUsers();
  }, [isOpen, isBuyerRating, adId, sellerId]);

  // Helper to format standard dates / timestamp
  const getFormattedDate = (createdAt: any) => {
    if (!createdAt) return 'Recentemente';
    try {
      const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
      return date.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      try {
        if (createdAt.seconds) {
          const d = new Date(createdAt.seconds * 1000);
          return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
      } catch (err2) {}
      return 'Recentemente';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0 || success === null || !buyerName) {
      alert('Please fill in all required fields.');
      return;
    }

    if (!isBuyerRating && !selectedBuyerId) {
      alert('Please select a buyer from the list of registered enquiries.');
      return;
    }

    if (isBuyerRating) {
      if (!sellerId) {
        alert('Error: Seller ID is missing.');
        return;
      }
      if (sellerId === user?.uid) {
        alert('Error: You cannot review yourself.');
        return;
      }
    }

    setLoading(true);
    try {
      const reviewId = `rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      let determinedSellerId = sellerId;
      let determinedBuyerId = '';
      let reviewerId = '';
      let revieweeId = '';

      if (isBuyerRating) {
        // Buyer is reviewing Seller
        determinedSellerId = sellerId;
        determinedBuyerId = user?.uid || '';
        reviewerId = user?.uid || '';
        revieweeId = sellerId;
      } else {
        // Seller is reviewing Buyer
        determinedSellerId = user?.uid || sellerId;
        determinedBuyerId = selectedBuyerId;
        reviewerId = user?.uid || '';
        revieweeId = selectedBuyerId;
      }

      const reviewData: Review = {
        id: reviewId,
        adId,
        adTitle,
        adCategory: adCategory || '',
        sellerId: determinedSellerId,
        buyerId: determinedBuyerId,
        buyerName,
        rating,
        comment: comment || '',
        success,
        reviewerId,
        revieweeId,
        createdAt: serverTimestamp()
      };

      await runTransaction(db, async (transaction) => {

  if (isBuyerRating) {
    const sellerRef = doc(db, 'users', sellerId);
    const sellerDoc = await transaction.get(sellerRef);

    const reviewRef = doc(db, 'reviews', reviewId);

    transaction.set(reviewRef, reviewData);

    if (sellerDoc.exists()) {
      const data = sellerDoc.data() as UserProfile;
      const currentAvg = data.ratingAverage || 0;
      const currentCount = data.ratingCount || 0;

      const newCount = currentCount + 1;
      const newAvg = (currentAvg * currentCount + rating) / newCount;
      const finalAvg = parseFloat(newAvg.toFixed(1));

      transaction.update(sellerRef, {
        ratingCount: newCount,
        ratingAverage: finalAvg
      });
    }

  } else {

    const reviewRef = doc(db, 'reviews', reviewId);

    transaction.set(reviewRef, reviewData);

    const adRef = doc(db, 'ads', adId);

    transaction.update(adRef, {
      status: 'approved',
      adStatus: 'sold',
      buyerId: determinedBuyerId,
      buyerName: buyerName,
      soldAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
});

      // Disparar o e-mail correspondente de forma assíncrona pós-transação de sucesso
      try {
        if (isBuyerRating) {
          // O comprador avaliou o vendedor. Enviar para o vendedor (sellerId)
          getSellerEmail(sellerId).then((sellerEmail) => {
            if (sellerEmail) {
              sendEmailGeneric('review_recebida', sellerEmail, {
                sellerName: sellerName || 'Vendedor',
                reviewerName: currentUserProfile?.name || user?.displayName || 'Comprador',
                rating: rating,
                comment: comment,
                adTitle: adTitle,
                adId: adId
              }).catch(e => console.warn('[ReviewModal] Falha ao enviar email de review:', e));
            }
          }).catch(err => console.warn('[ReviewModal] Falha ao obter email do vendedor para review:', err));
        } else {
          // O vendedor marcou a venda como concluída. Enviar para o vendedor (user.email)
          const sellerEmail = user?.email;
          if (sellerEmail) {
            sendEmailGeneric('compra_concluida', sellerEmail, {
              sellerName: currentUserProfile?.name || user?.displayName || 'Vendedor',
              buyerName: buyerName || 'Comprador',
              adTitle: adTitle
            }).catch(e => console.warn('[ReviewModal] Falha ao enviar email de compra concluída:', e));
          }
        }
      } catch (emailTriggerErr) {
        console.warn('[ReviewModal] Erro não impeditivo no disparo de emails:', emailTriggerErr);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      const isPermissionDenied = err?.code === 'permission-denied' || String(err).includes('PERMISSION_DENIED') || String(err).includes('permission-denied');
      if (isPermissionDenied) {
        console.error('[ReviewModal] Firestore Permission Error (PERMISSION_DENIED):', err);
        alert('Error submitting feedback: Insufficient permissions to record this review.');
      } else {
        console.error('Error submitting review:', err);
        alert('Error submitting feedback: ' + (err?.message || err || 'Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-900">
                {isBuyerRating ? 'Review Seller' : 'Complete Sale'}
              </h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <p className="text-sm text-slate-600 mb-4 font-medium">
                  {isBuyerRating 
                    ? `How was your experience dealing with ${sellerName} for "${adTitle}"?`
                    : `Congratulations on selling "${adTitle}"! How was your experience dealing with the buyer?`
                  }
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 text-center">
                  Star Rating
                </label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={`star-${star}`}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className="p-1 transition-transform active:scale-125"
                    >
                      <Star
                        size={36}
                        className={`transition-colors ${
                          (hoverRating || rating) >= star ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Did the transaction go smoothly?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSuccess(true)}
                    className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-bold border-2 transition-all ${
                      success === true 
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-600' 
                        : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    <CheckCircle size={18} /> Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuccess(false)}
                    className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-bold border-2 transition-all ${
                      success === false 
                        ? 'bg-red-50 border-red-500 text-red-600' 
                        : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    <AlertCircle size={18} /> No
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  {isBuyerRating ? 'Your Name' : 'Select Buyer from Enquiries'}
                </label>
                {isBuyerRating ? (
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-medium mb-3 focus:border-indigo-500 outline-none transition-all"
                    required
                  />
                ) : (
                  <div className="relative mb-3">
                    {loadingUsers ? (
                      <div className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-center text-xs text-slate-400 font-medium flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent"></div>
                        <span>Searching for interested buyers...</span>
                      </div>
                    ) : usersList.length === 0 ? (
                      <div className="bg-amber-50 border-2 border-amber-200 text-amber-800 p-4 rounded-2xl flex flex-col gap-2">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                          <p className="text-xs font-bold leading-relaxed">
                            No registered enquiries found for this listing yet. Buyers need to use one of the available contact options while logged in before you can mark it as sold.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowDropdown(!showDropdown)}
                          className={`w-full text-left bg-slate-50 border-2 rounded-2xl px-4 py-3 font-medium outline-none transition-all flex justify-between items-center ${
                            selectedBuyerId ? 'border-emerald-500 bg-emerald-50/10 text-slate-800' : 'border-slate-100 hover:border-slate-200 text-slate-500'
                          }`}
                        >
                          <div>
                            {selectedBuyerId ? (
                              <span className="font-bold text-emerald-800">{buyerName}</span>
                            ) : (
                              <span>Select buyer...</span>
                            )}
                          </div>
                          <span className="text-slate-400 text-xs">▼</span>
                        </button>

                        {showDropdown && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                            <div className="absolute left-0 right-0 top-full mt-2 bg-white border-2 border-slate-100 rounded-2xl shadow-xl max-h-56 overflow-y-auto z-50 p-2 space-y-1 font-sans">
                              {usersList.map((interest: any) => {
                                const isSelected = interest.interestedUserId === selectedBuyerId;
                                const dateStr = getFormattedDate(interest.createdAt);
                                return (
                                  <button
                                    key={`interest-${interest.id}`}
                                    type="button"
                                    onClick={() => {
                                      setBuyerName(interest.interestedUserName);
                                      setSelectedBuyerId(interest.interestedUserId);
                                      setShowDropdown(false);
                                    }}
                                    className={`w-full text-left px-4 py-3 rounded-xl transition-all flex flex-col gap-1 hover:bg-slate-50 ${
                                      isSelected ? 'bg-indigo-50/50 border border-indigo-100' : 'border border-transparent'
                                    }`}
                                  >
                                    <div className="flex justify-between items-center w-full">
                                      <span className="font-bold text-slate-900 text-sm">{interest.interestedUserName}</span>
                                      {isSelected && <CheckCircle size={14} className="text-emerald-500 shrink-0" />}
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-medium">Enquired on: {dateStr}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share a short summary of your experience..."
                  rows={3}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 font-medium focus:border-indigo-500 outline-none transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || rating === 0 || success === null || (!isBuyerRating && !selectedBuyerId)}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:shadow-none"
              >
                {loading ? 'Processing...' : isBuyerRating ? 'Submit Review' : 'Complete Listing'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ReviewModal;
