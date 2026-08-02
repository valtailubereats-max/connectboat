import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { LogOut, PlusCircle, Plus, User as UserIcon, ShieldCheck, ShoppingBag, Menu, X, Share2, Bell, AlertTriangle, QrCode, Copy, Check, Mail } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { auth, db, getDocsWithCacheFallback } from './firebase';
import { signOut } from 'firebase/auth';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { collection, query, where, orderBy, doc, updateDoc, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import Home from './pages/Home';
import Login from './pages/Login';
import Precos from './pages/Precos';
import Profile from './pages/Profile';
import Campanhas from './pages/Campanhas';
import CreateAd from './pages/CreateAd';
import AdminDashboard from './pages/AdminDashboard';
import AdminImport from './pages/AdminImport';
import AdminBulkImport from './pages/AdminBulkImport';
import AdminDemoListings from './pages/AdminDemoListings';
import AdminMarketing from './pages/AdminMarketing';
import AdminAds from './pages/AdminAds';
import AdminSettings from './pages/AdminSettings';
import AdminUsers from './pages/AdminUsers';
import AdminTeam from './pages/AdminTeam';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Cookies from './pages/Cookies';
import Report from './pages/Report';
import AdDetails from './pages/AdDetails';
import Suggestions from './pages/Suggestions';
import FAQ from './pages/FAQ';
import AdminSuggestions from './pages/AdminSuggestions';
import AdminClaims from './pages/AdminClaims';
import Fotos from './pages/Fotos';
import AdminFotos from './pages/AdminFotos';
import AdminSystemHealth from './pages/AdminSystemHealth';
import Convite from './pages/Convite';
import AdminInvitations from './pages/AdminInvitations';
import { PWAInstallButton } from './components/PWAInstallButton';
import { InstallButton } from './components/InstallButton';
import AdminManualTecnico from './pages/AdminManualTecnico';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import AdminLayout from './components/AdminLayout';
import OptimizedImage from './components/OptimizedImage';
import { motion, AnimatePresence } from 'motion/react';
import Links from './pages/Links';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ShareModal } from './components/ShareModal';
import { triggerShare } from './utils/shareUtils';

import { Ad } from './types';
import { formatDistanceToNow } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { useClickOutside } from './hooks/useClickOutside';

const Navbar = () => {
  const { user, profile, isAdmin, isModerator, loading } = useAuth();
  
  const getUserSignature = () => {
    if (profile?.name) {
      const raw = profile.name.trim();
      if (raw.length >= 4) {
        return raw.substring(0, 4).toUpperCase();
      }
      if (user?.email) {
        const emailPrefix = user.email.split('@')[0].toUpperCase();
        if (emailPrefix.startsWith(raw.toUpperCase()) && emailPrefix.length >= 4) {
          return emailPrefix.substring(0, 4);
        }
      }
      return raw.toUpperCase().padEnd(4, 'T');
    }
    if (user?.email) {
      return user.email.split('@')[0].substring(0, 4).toUpperCase();
    }
    return 'VALT';
  };
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = React.useState(false);
  const [adminNotificationCount, setAdminNotificationCount] = React.useState(0);
  const [adminPendingAds, setAdminPendingAds] = React.useState<any[]>([]);
  const [showAdminNotifications, setShowAdminNotifications] = React.useState(false);
  const [userNotificationCount, setUserNotificationCount] = React.useState(0);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showUserDropdown, setShowUserDropdown] = React.useState(false);
  const [showQrModal, setShowQrModal] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleCopyLink = () => {
    if (!user) return;
    const inviteUrl = `${window.location.origin}/login?mode=register&ref=${user.uid}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const userDropdownRef = React.useRef<HTMLDivElement>(null);
  const adminNotificationsRef = React.useRef<HTMLDivElement>(null);
  const notificationsRef = React.useRef<HTMLDivElement>(null);
  const navRef = React.useRef<HTMLElement>(null);

  useClickOutside(userDropdownRef, () => {
    setShowUserDropdown(false);
  });

  useClickOutside(adminNotificationsRef, () => {
    setShowAdminNotifications(false);
  });

  useClickOutside(notificationsRef, () => {
    setShowNotifications(false);
  });

  useClickOutside(navRef, () => {
    setIsOpen(false);
  });

  const groupedNotifications = React.useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    notifications.forEach((notif) => {
      const type = notif.type || 'unknown';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(notif);
    });

    const result: any[] = [];

    Object.keys(groups).forEach((type) => {
      const list = groups[type];
      if (list.length === 1) {
        result.push({
          ...list[0],
          isGrouped: false,
          ids: [list[0].id]
        });
      } else {
        const representative = list[0];
        let title = '';
        let message = '';

        if (type === 'ad_pending') {
          title = 'PENDING LISTINGS';
          message = `🔔 ${list.length} listings awaiting approval`;
        } else if (type === 'review' || type === 'rating' || representative.title?.toLowerCase().includes('avaliação')) {
          title = 'REVIEWS';
          message = `⭐ You received ${list.length} new reviews`;
        } else if (type === 'whatsapp_interest' || representative.title?.toLowerCase().includes('interesse')) {
          title = 'LISTING INTEREST';
          message = `💬 ${list.length} people expressed interest in your listings`;
        } else {
          const rawTitle = representative.title || 'NOTIFICATION';
          title = rawTitle.toUpperCase();
          message = `🔔 You have ${list.length} new notifications from: ${rawTitle}`;
        }

        result.push({
          id: `grouped-${type}`,
          isGrouped: true,
          type,
          count: list.length,
          title,
          message,
          createdAt: representative.createdAt,
          adId: representative.adId,
          representative,
          ids: list.map(n => n.id)
        });
      }
    });

    return result.sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return timeB - timeA;
    });
  }, [notifications]);

  const handleNotificationClick = async (notif: any) => {
    const idsToMark = notif.ids || [notif.id];
    setNotifications(prev => prev.filter(n => !idsToMark.includes(n.id)));
    setUserNotificationCount(prev => Math.max(0, prev - idsToMark.length));

    const type = notif.type || notif.representative?.type;
    const adId = notif.adId || notif.representative?.adId;

    if (type === 'ad_pending') {
      navigate('/admin/ads');
    } else if (adId) {
      navigate(`/profile?tab=anuncios&highlight=${adId}`);
    }
    setShowNotifications(false);

    try {
      const promises = idsToMark.map((id: string) => 
        updateDoc(doc(db, 'notifications', id), { read: true })
      );
      await Promise.all(promises);
    } catch (err) {
      console.error('Error marking notification(s) as read in Firestore:', err);
    }
  };

  React.useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUserNotificationCount(0);
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      // Ordena por criação decrescente (já estão filtradas por read == false)
      const unreadList = list.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });
      setNotifications(unreadList);
      setUserNotificationCount(unreadList.length);
    }, (err) => {
      console.error('Error listening to notifications:', err);
    });
    return () => unsubscribe();
  }, [user]);

  // Notificações do usuário, pending ads do admin e contagem de ads desativados do Firestore globais
  // para blindagem total contra consumo excessivo de leituras. O Navbar agora é 100% estático.

  const handleLogout = async () => {
    localStorage.removeItem('demo_user');
    await signOut(auth);
    navigate('/');
    window.location.reload();
  };

  const handleShare = async () => {
    let wasHandled = false;
    
    // Dispatch custom event to see if the active page wants to provide custom data
    const requestEvent = new CustomEvent('request-share-current-page', {
      detail: {
        onHandled: () => {
          wasHandled = true;
        }
      }
    });
    window.dispatchEvent(requestEvent);

    // Give synchronous listeners a chance to respond immediately
    if (wasHandled) {
      return;
    }

    // Default fallbacks based on the route path
    const path = location.pathname;
    if (path === '/links') {
      triggerShare({
        type: 'links',
        title: 'Useful Links - Guide & Resources',
        description: 'An official collection of UK marine, harbour, and public resources selected for our boating community.',
        url: `${window.location.origin}/links`
      });
    } else {
      triggerShare({ type: 'home' });
    }
  };

  const handlePublishClick = () => {
    if (user) {
      navigate('/create-ad');
    } else {
      navigate('/login?mode=register');
    }
  };

  const handleLogoClick = () => {
    window.dispatchEvent(new CustomEvent('reset-category'));
  };

  return (
    <nav ref={navRef} className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 shadow-md text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" onClick={handleLogoClick} className="flex items-center gap-2.5 sm:gap-3 group">
            <div className="w-[42px] h-[42px] bg-gradient-to-br from-sky-500 to-blue-700 rounded-xl flex items-center justify-center text-white group-hover:from-sky-400 group-hover:to-blue-600 transition-all shadow-md shadow-sky-500/20 shrink-0">
              <ShoppingBag size={23} />
            </div>
            <span className="text-[23px] sm:text-[28px] font-black tracking-tight leading-none text-white select-none">
              ConnectBoat
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            {!user && (
              <button onClick={handlePublishClick} className="text-slate-300 hover:text-sky-400 font-medium flex items-center gap-1 cursor-pointer transition-colors text-sm">
                <Plus size={18} /> <span>Post Listing</span>
              </button>
            )}
            <button onClick={handleShare} className="text-slate-300 hover:text-sky-400 font-medium flex items-center gap-1 text-sm cursor-pointer transition-colors">
              <Share2 size={18} /> <span>Share</span>
            </button>

            {user ? <>
              <Link to="/create-ad" className="flex items-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white px-4 py-2 rounded-xl hover:from-sky-400 hover:to-blue-500 transition-all shadow-md shadow-sky-500/20 font-bold text-sm">
                <PlusCircle size={18} /> <span>List Boat / Item</span>
              </Link>

              <Link to="/profile" className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-sky-400 font-bold text-xs tracking-wider rounded-xl transition-all uppercase select-none cursor-pointer">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                <span className="text-slate-200 font-extrabold">{getUserSignature()}</span>
              </Link>

              <div className="relative" ref={notificationsRef}>
                <button onClick={() => setShowNotifications(!showNotifications)} className="relative text-slate-300 hover:text-sky-400 font-medium flex items-center gap-1 p-2 cursor-pointer transition-colors">
                  <Bell size={20}/>
                  {notifications.length > 0 && <span className="absolute top-1 right-1 bg-sky-500 text-white text-[10px] font-black w-4 h-4 flex items-center justify-center rounded-full border-2 border-slate-900">{notifications.length}</span>}
                </button>
                <AnimatePresence>
                  {showNotifications && (
                    <motion.div initial={{ opacity:0,y:10,scale:0.95 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,y:10,scale:0.95 }} className="absolute right-0 mt-2 w-80 bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50">
                      <div className="p-4 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-bold text-slate-900">Notifications</h3>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {groupedNotifications.length === 0 ? <div className="p-8 text-center text-slate-400 text-sm">No new notifications.</div> :
                          groupedNotifications.map((notif, idx) => (
                            <div key={`nav-notif-${notif.id || idx}-${idx}`} onClick={() => handleNotificationClick(notif)} className="p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer">
                              <div className="flex justify-between items-start gap-2 mb-1">
                                <p className="text-xs font-bold text-sky-600 uppercase tracking-wider">{notif.title}</p>
                                {notif.isGrouped && (
                                  <span className="bg-sky-100 text-sky-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md leading-none shrink-0">
                                    {notif.count}x
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-700 leading-relaxed">{notif.message}</p>
                              <p className="text-[10px] text-slate-400 mt-2">{notif.createdAt?.toDate ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true, locale: enGB }) : 'Recently'}</p>
                            </div>
                          ))
                        }
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* User Account Dropdown */}
              <div className="relative" ref={userDropdownRef}>
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="relative text-slate-300 hover:text-sky-400 font-medium flex items-center gap-1.5 p-2 cursor-pointer outline-none transition-all"
                  id="user-account-dropdown-toggle"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 shrink-0 select-none shadow-sm">
                    <UserIcon size={16} />
                  </div>
                  <span className="hidden sm:inline text-sm">Account</span>
                  {userNotificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-sky-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-slate-900 animate-pulse">
                      {userNotificationCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {showUserDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2.5 z-[100] text-slate-800"
                      id="desktop-account-menu"
                    >
                      <Link
                        to="/"
                        onClick={() => setShowUserDropdown(false)}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 transition-colors text-sm font-bold text-sky-600"
                      >
                        🧭 Home
                      </Link>
                      {(settings?.enableFotosFeature !== false || isAdmin || isModerator) && (
                        <Link
                          to="/fotos"
                          onClick={() => setShowUserDropdown(false)}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 transition-colors text-sm font-bold text-sky-600"
                          id="nav-fotos-link"
                        >
                          📸 Marine Gallery
                        </Link>
                      )}
                      <Link
                        to="/precos"
                        onClick={() => setShowUserDropdown(false)}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 transition-colors text-sm font-bold text-sky-600"
                        id="nav-precos-link"
                      >
                        🏷️ Pricing Plans
                      </Link>

                      <div className="border-t border-slate-100 my-2" />

                      <Link
                        to="/profile"
                        onClick={() => setShowUserDropdown(false)}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700"
                        id="menu-meu-perfil"
                      >
                        👤 My Profile
                      </Link>

                      <Link
                        to="/campanhas"
                        onClick={() => setShowUserDropdown(false)}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700"
                        id="menu-minhas-campanhas"
                      >
                        🎁 Campaigns
                      </Link>

                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          setShowQrModal(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700 w-full text-left cursor-pointer outline-none"
                        id="menu-qrcode"
                      >
                        📱 Invite QR Code
                      </button>

                      {isModerator && !isAdmin && (
                        <Link
                          to="/admin/ads"
                          onClick={() => setShowUserDropdown(false)}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700"
                          id="menu-gerir-anuncios"
                        >
                          Manage Listings
                        </Link>
                      )}

                      {isAdmin && (
                        <Link
                          to="/admin"
                          onClick={() => setShowUserDropdown(false)}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700"
                          id="menu-admin-painel-direct"
                        >
                          Admin Panel
                        </Link>
                      )}

                      <Link
                        to="/profile?tab=favorites"
                        onClick={() => setShowUserDropdown(false)}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700"
                        id="menu-favoritos"
                      >
                        Favorites
                      </Link>

                      <Link
                        to="/profile?tab=anuncios"
                        onClick={() => setShowUserDropdown(false)}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700"
                        id="menu-meus-anuncios"
                      >
                        My Listings
                      </Link>

                      <Link
                        to="/create-ad"
                        onClick={() => setShowUserDropdown(false)}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700"
                        id="menu-criar-anuncio"
                      >
                        Post Listing
                      </Link>

                      <Link
                        to="/sugestoes"
                        onClick={() => setShowUserDropdown(false)}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-700"
                        id="menu-sugestoes"
                      >
                        Suggestions
                      </Link>

                      <div className="border-t border-slate-100 my-2" />

                      <InstallButton variant="dropdown-item" onClickAction={() => setShowUserDropdown(false)} />

                      <Link
                        to="/links"
                        onClick={() => setShowUserDropdown(false)}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-sky-50 text-sky-700 transition-colors text-sm font-black"
                        id="menu-links-uteis"
                      >
                        <span>🔗 Useful Links</span>
                      </Link>

                      <div className="border-t border-slate-100 my-2" />

                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          handleLogout();
                        }}
                        className="flex items-center gap-2 w-full text-left px-4 py-2 hover:bg-rose-50 text-rose-600 transition-colors text-sm font-bold"
                        id="menu-sair"
                      >
                        <LogOut size={16} />
                        <span>Sign Out</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </> : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="bg-sky-600 text-white px-5 py-2 rounded-xl hover:bg-sky-500 transition-all shadow-md font-bold text-sm">Sign In</Link>
                
                <div className="relative" ref={userDropdownRef}>
                  <button
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="relative text-slate-300 hover:text-sky-400 font-medium flex items-center gap-1.5 p-2 cursor-pointer outline-none transition-all hover:bg-slate-800 rounded-xl text-sm"
                    id="guest-menu-toggle"
                  >
                    <Menu size={20} />
                    <span>Menu</span>
                  </button>

                  <AnimatePresence>
                    {showUserDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2.5 z-[100] text-slate-800"
                        id="desktop-guest-menu"
                      >
                        <Link
                          to="/"
                          onClick={() => setShowUserDropdown(false)}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 transition-colors text-sm font-bold text-sky-600"
                        >
                          🧭 Home
                        </Link>
                        {(settings?.enableFotosFeature !== false || isAdmin || isModerator) && (
                          <Link
                            to="/fotos"
                            onClick={() => setShowUserDropdown(false)}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 transition-colors text-sm font-bold text-sky-600"
                            id="nav-fotos-link"
                          >
                            📸 Marine Gallery
                          </Link>
                        )}
                        <Link
                          to="/precos"
                          onClick={() => setShowUserDropdown(false)}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 transition-colors text-sm font-bold text-sky-600"
                          id="nav-precos-link-guest"
                        >
                          🏷️ Pricing Plans
                        </Link>

                        <div className="border-t border-slate-100 my-2" />

                        <Link
                          to="/links"
                          onClick={() => setShowUserDropdown(false)}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-sky-50 text-sky-700 transition-colors text-sm font-black"
                        >
                          <span>🔗 Useful Links</span>
                        </Link>

                        <InstallButton variant="dropdown-item" onClickAction={() => setShowUserDropdown(false)} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden flex items-center gap-3">
            <button 
              onClick={handlePublishClick} 
              title="Post Listing" 
              className="text-slate-300 hover:text-sky-400 transition-colors flex flex-col items-center justify-center p-1.5 cursor-pointer hover:bg-slate-800 rounded-xl"
            >
              <Plus size={20}/>
              <span className="text-[9px] font-bold tracking-tight mt-0.5 leading-none">Post</span>
            </button>
            <button 
              onClick={handleShare} 
              title="Share"
              className="text-slate-300 hover:text-sky-400 transition-colors flex flex-col items-center justify-center p-1.5 cursor-pointer hover:bg-slate-800 rounded-xl"
            >
              <Share2 size={20}/>
              <span className="text-[9px] font-bold tracking-tight mt-0.5 leading-none">Share</span>
            </button>
            <button 
              onClick={() => setIsOpen(!isOpen)} 
              title="Menu"
              className="text-slate-300 hover:text-sky-400 transition-colors flex flex-col items-center justify-center p-1.5 cursor-pointer hover:bg-slate-800 rounded-xl"
            >
              {isOpen ? <X size={20}/> : <Menu size={20}/>}
              <span className="text-[9px] font-bold tracking-tight mt-0.5 leading-none">Menu</span>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="md:hidden bg-slate-900 border-t border-slate-800 overflow-hidden text-slate-100">
            <div className="px-4 py-6 space-y-4 flex flex-col">
              <Link to="/" onClick={() => setIsOpen(false)} className="text-lg font-black text-sky-400">Home</Link>
              {(settings?.enableFotosFeature !== false || isAdmin || isModerator) && (
                <Link to="/fotos" onClick={() => setIsOpen(false)} className="text-lg font-black text-slate-200">Marine Gallery</Link>
              )}
              <Link to="/precos" onClick={() => setIsOpen(false)} className="text-lg font-black text-slate-200">Pricing Plans</Link>
              
              {user ? <>
                {isAdmin && (
                  <Link to="/admin" onClick={() => setIsOpen(false)} className="text-lg font-medium text-slate-200 flex items-center gap-2">
                    Admin {adminNotificationCount > 0 && <span className="bg-sky-500 text-white text-xs px-2 py-0.5 rounded-full">{adminNotificationCount}</span>}
                  </Link>
                )}

                {isModerator && !isAdmin && (
                  <Link to="/admin/ads" onClick={() => setIsOpen(false)} className="text-lg font-medium text-slate-200 flex items-center gap-2">
                    Manage Listings
                  </Link>
                )}

                <div className="border-t border-slate-800 pt-4 space-y-3.5 flex flex-col">
                  <Link to="/profile" onClick={() => setIsOpen(false)} className="text-md font-bold text-slate-200">
                    👤 My Profile
                  </Link>
                  <Link to="/campanhas" onClick={() => setIsOpen(false)} className="text-md font-bold text-slate-200">
                    🎁 Campaigns
                  </Link>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setShowQrModal(true);
                    }}
                    className="text-md font-bold text-slate-200 text-left cursor-pointer outline-none flex items-center gap-2"
                  >
                    📱 Invite QR Code
                  </button>
                  <Link to="/profile?tab=favorites" onClick={() => setIsOpen(false)} className="text-md font-bold text-slate-200">
                    Favorites
                  </Link>
                  <Link to="/profile?tab=anuncios" onClick={() => setIsOpen(false)} className="text-md font-bold text-slate-200">
                    My Listings
                  </Link>
                  <Link to="/create-ad" onClick={() => setIsOpen(false)} className="text-md font-bold text-slate-200">
                    Post Listing
                  </Link>
                  <Link to="/sugestoes" onClick={() => setIsOpen(false)} className="text-md font-bold text-slate-200">
                    Suggestions
                  </Link>
                  
                  <div className="border-t border-slate-800 pt-4" />
                  
                  <InstallButton variant="menu-item" onClickAction={() => setIsOpen(false)} />
                  
                  <Link to="/links" onClick={() => setIsOpen(false)} className="text-md font-black text-sky-400 flex items-center gap-1">
                    🔗 Useful Links
                  </Link>
                  
                  <div className="border-t border-slate-800 pt-4" />
                  
                  <button onClick={() => { handleLogout(); setIsOpen(false); }} className="text-md font-bold text-rose-400 text-left">
                    Sign Out
                  </button>
                </div>
              </> : (
                <div className="pt-4 border-t border-slate-800 flex flex-col gap-4">
                  <InstallButton variant="menu-item" onClickAction={() => setIsOpen(false)} />
                  <Link to="/login" onClick={() => setIsOpen(false)} className="text-lg font-black text-sky-400">Sign In</Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQrModal && user && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm text-slate-900">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-6 border border-slate-100 flex flex-col items-center"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowQrModal(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-50 rounded-full cursor-pointer outline-none"
                title="Close"
              >
                <X size={20} />
              </button>

              {/* Title & Description */}
              <div className="text-center mt-3 mb-6">
                <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <QrCode size={24} />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Invite QR Code</h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">Invite your friends to ConnectBoat</p>
              </div>

              {/* QR Code Container */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col items-center justify-center gap-4 w-full">
                <div className="relative p-4 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center">
                  <QRCodeSVG
                    value={`${window.location.origin}/login?mode=register&ref=${user.uid}`}
                    size={180}
                    level="H"
                    fgColor="#0f172a"
                    includeMargin={false}
                  />
                  {/* Central boat logo */}
                  <div className="absolute w-10 h-10 bg-sky-600 rounded-xl border-4 border-white flex items-center justify-center text-white shadow-md">
                    <ShoppingBag size={18} className="stroke-[2.5]" />
                  </div>
                </div>

                {/* Instructions Text */}
                <p className="text-xs text-slate-600 text-center leading-relaxed font-semibold px-2">
                  Show this QR Code to a friend. Scanning it will direct them to register on ConnectBoat with your referral link.
                </p>
              </div>

              {/* Button "Copy Invite Link" */}
              <button
                onClick={handleCopyLink}
                className={`mt-5 w-full py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer outline-none ${
                  copied
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-100'
                    : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-100'
                }`}
              >
                {copied ? (
                  <>
                    <Check size={18} className="stroke-[3]" />
                    <span>Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={18} />
                    <span>Copy Invite Link</span>
                  </>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const ScrollToTop = () => {
  const { pathname } = useLocation();

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default function App() {
  const mainRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const refCode = searchParams.get('ref');
      if (refCode) {
        localStorage.setItem('referred_by_code', refCode.trim().toUpperCase());
        localStorage.setItem('referred_by_code_raw', refCode.trim());
        console.log('Saved referral code to localStorage:', refCode);
      }
    } catch (e) {
      console.error('Error parsing referral query:', e);
    }
  }, []);

  React.useEffect(() => {
    const slider = mainRef.current;
    if (!slider) return;

    let isDown = false;
    let startY: number;
    let scrollTop: number;

    const onMouseDown = (e: MouseEvent) => {
      isDown = true;
      slider.classList.add('active');
      startY = e.pageY - slider.offsetTop;
      scrollTop = window.scrollY;
    };

    const onMouseLeave = () => {
      isDown = false;
      slider.classList.remove('active');
    };

    const onMouseUp = () => {
      isDown = false;
      slider.classList.remove('active');
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const y = e.pageY - slider.offsetTop;
      const walk = (y - startY) * 2; // Scroll speed
      window.scrollTo(0, scrollTop - walk);
    };

    slider.addEventListener('mousedown', onMouseDown);
    slider.addEventListener('mouseleave', onMouseLeave);
    slider.addEventListener('mouseup', onMouseUp);
    slider.addEventListener('mousemove', onMouseMove);

    return () => {
      slider.removeEventListener('mousedown', onMouseDown);
      slider.removeEventListener('mouseleave', onMouseLeave);
      slider.removeEventListener('mouseup', onMouseUp);
      slider.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return (
    <HelmetProvider>
      <Helmet>
        <title>ConnectBoat - UK Marine & Boat Marketplace</title>
        <meta name="description" content="ConnectBoat is the UK's premier boat and marine marketplace to buy, sell, and charter boats, yachts, outboard engines, gear, and marine services." />
        <link rel="canonical" href="https://www.connectboat.co.uk" />
        <meta property="og:url" content="https://www.connectboat.co.uk" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="ConnectBoat - UK Marine & Boat Marketplace" />
        <meta property="og:description" content="ConnectBoat is the UK's premier boat and marine marketplace to buy, sell, and charter boats, yachts, outboard engines, gear, and marine services." />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>
      <SettingsProvider>
        <AuthProvider>
          <Router>
            <ScrollToTop />
            <div className="min-h-screen font-sans text-slate-900 selection:bg-pt-green/10 max-w-full overflow-x-hidden">
            <Navbar />
            <ShareModal />

            <main ref={mainRef} className="max-w-7xl mx-auto px-1.5 xs:px-2 sm:px-6 lg:px-8 py-4 sm:py-8 cursor-grab active:cursor-grabbing">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/precos" element={<Precos />} />
                <Route path="/login" element={<Login />} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/campanhas" element={<ProtectedRoute><Campanhas /></ProtectedRoute>} />
                <Route path="/create-ad" element={<ProtectedRoute><CreateAd /></ProtectedRoute>} />
                <Route path="/edit-ad/:id" element={<ProtectedRoute><CreateAd /></ProtectedRoute>} />
                <Route path="/anuncio/:id" element={<AdDetails />} />
                <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
                <Route path="/admin/dashboard" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
                <Route path="/admin/health" element={<AdminLayout><AdminSystemHealth /></AdminLayout>} />
                <Route path="/admin/import" element={<AdminLayout><AdminImport /></AdminLayout>} />
                <Route path="/admin/bulk-import" element={<AdminLayout><AdminBulkImport /></AdminLayout>} />
                <Route path="/admin/demo-content" element={<AdminLayout><AdminDemoListings /></AdminLayout>} />
                <Route path="/admin/marketing" element={<AdminLayout><AdminMarketing /></AdminLayout>} />
                <Route path="/admin/ads" element={<AdminLayout><AdminAds /></AdminLayout>} />
                <Route path="/admin/settings" element={<AdminLayout><AdminSettings /></AdminLayout>} />
                <Route path="/admin/users" element={<AdminLayout><AdminUsers /></AdminLayout>} />
                <Route path="/admin/claims" element={<AdminLayout><AdminClaims /></AdminLayout>} />
                <Route path="/admin/team" element={<AdminLayout><AdminTeam /></AdminLayout>} />
                <Route path="/fotos" element={<Fotos />} />
                <Route path="/admin/fotos" element={<AdminLayout><AdminFotos /></AdminLayout>} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/cookies" element={<Cookies />} />
                <Route path="/denuncia" element={<Report />} />
                <Route path="/sugestoes" element={<Suggestions />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/links" element={<Links />} />
                <Route path="/convite" element={<Convite />} />
                <Route path="/admin/invitations" element={<AdminLayout><AdminInvitations /></AdminLayout>} />
                <Route path="/admin/suggestions" element={<AdminLayout><AdminSuggestions /></AdminLayout>} />
                <Route path="/admin/manual-tecnico" element={<AdminLayout><AdminManualTecnico /></AdminLayout>} />
              </Routes>
            </main>
            <footer className="bg-slate-50 border-t border-slate-200 pt-16 pb-12 mt-20 font-sans">
              <div className="max-w-7xl mx-auto px-6 md:px-8">
                
                {/* Main 4-column Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-12 text-left">
                  
                  {/* Coluna 1: ConnectBoat Brand */}
                  <div className="md:col-span-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        ⛵ ConnectBoat 🇬🇧
                      </span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-black uppercase tracking-widest text-sky-600">
                        Buy, Sell & Charter Boats
                      </p>
                      <p className="text-xs text-slate-500 leading-relaxed max-w-sm font-semibold">
                        The UK's dedicated boat & marine marketplace for vessels, equipment, charters and nautical services.
                      </p>
                    </div>
                  </div>

                  {/* Coluna 2: Informações */}
                  <div className="md:col-span-2 space-y-4">
                    <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5 select-none">
                      📋 Explore
                    </h4>
                    <ul className="space-y-3 text-xs font-bold text-slate-600">
                      <li>
                        <Link to="/faq" className="hover:text-sky-600 hover:underline transition-all">FAQ</Link>
                      </li>
                      <li>
                        <Link to="/precos" className="hover:text-sky-600 hover:underline transition-all font-extrabold flex items-center gap-1">
                          Pricing Plans <span className="text-[10px]">🏷️</span>
                        </Link>
                      </li>
                      <li>
                        <Link to="/sugestoes" className="hover:text-sky-600 hover:underline transition-all">Suggestions</Link>
                      </li>
                    </ul>
                  </div>

                  {/* Coluna 3: Legal */}
                  <div className="md:col-span-3 space-y-4">
                    <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5 select-none">
                      ⚖️ Legal
                    </h4>
                    <ul className="space-y-3 text-xs font-bold text-slate-600">
                      <li>
                        <Link to="/terms" className="hover:text-sky-600 hover:underline transition-all">Terms of Service</Link>
                      </li>
                      <li>
                        <Link to="/privacy" className="hover:text-sky-600 hover:underline transition-all">Privacy Policy</Link>
                      </li>
                      <li>
                        <Link to="/cookies" className="hover:text-sky-600 hover:underline transition-all">Cookie Policy</Link>
                      </li>
                      <li>
                        <Link to="/denuncia" className="text-rose-500 hover:text-rose-600 hover:underline transition-all font-extrabold">Report Listing</Link>
                      </li>
                    </ul>
                  </div>

                  {/* Coluna 4: Suporte e Comunidade */}
                  <div className="md:col-span-3 space-y-4">
                    <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5 select-none">
                      📧 Support
                    </h4>
                    <ul className="space-y-3.5 text-xs font-bold text-slate-600">
                      <li>
                        <a 
                          href="mailto:connectboatuk@gmail.com" 
                          className="bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-100 px-3.5 py-2 rounded-xl transition-all inline-flex items-center gap-1.5 shadow-2xs font-extrabold cursor-pointer active:scale-95"
                        >
                          <Mail size={14} className="text-sky-600 shrink-0" />
                          <span>connectboatuk@gmail.com</span>
                        </a>
                      </li>
                      <li>
                        <a 
                          href="https://wa.me/4407508309536" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100 px-3.5 py-2 rounded-xl transition-all inline-flex items-center gap-1.5 shadow-2xs font-extrabold cursor-pointer"
                        >
                          <span>💬</span> WhatsApp Support
                        </a>
                      </li>
                      
                      {/* Premium PWA Install option */}
                      <li className="pt-0.5">
                        <InstallButton variant="footer-link" />
                      </li>

                      {/* Geographic badges */}
                      <li className="pt-2 border-t border-slate-200/50">
                        <span className="uppercase text-[9px] text-slate-450 tracking-wider font-bold block mb-2 select-none">Coverage</span>
                        <div className="flex flex-wrap gap-2">
                          <span className="flex items-center gap-1 bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-xl text-[10px] select-none hover:shadow-2xs transition-all pointer-events-none">
                            🇬🇧 United Kingdom
                          </span>
                        </div>
                      </li>
                    </ul>
                  </div>

                </div>

                {/* Sub-footer discrete divider */}
                <hr className="border-slate-200/60 my-0" />

                {/* Bottom Bar Info */}
                <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left select-none">
                  <p className="text-xs font-black transition-colors text-sky-700">
                    © 2026 ConnectBoat
                  </p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
                    United Kingdom Marine Marketplace
                  </p>
                </div>

              </div>
            </footer>
          </div>
        </Router>
      </AuthProvider>
    </SettingsProvider>
  </HelmetProvider>
);
}
