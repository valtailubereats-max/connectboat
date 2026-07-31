import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Upload, 
  ShoppingBag, 
  Users, 
  Settings, 
  Menu, 
  X, 
  ChevronRight,
  LogOut,
  Bell,
  Megaphone,
  Briefcase,
  MessageSquare,
  Camera,
  Store,
  QrCode,
  BookOpen,
  Gift,
  Activity,
  UserCheck,
  Film,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { isAdmin, isModerator, loading, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isStaff = isAdmin || isModerator;

  React.useEffect(() => {
    if (!loading && !user) {
      const redirectPath = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?redirect=${redirectPath}`, { replace: true });
    }
  }, [loading, user, location.pathname, location.search, navigate]);

  React.useEffect(() => {
    const isAllowedPath = [
      '/admin/dashboard',
      '/admin/ads',
      '/admin/marketing',
      '/admin/invitations'
    ].includes(location.pathname);

    if (!loading && user && isStaff && isModerator && !isAllowedPath) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isModerator, isStaff, loading, location.pathname, navigate, user]);

  const [menuModel, setMenuModel] = useState<'classic' | 'grouped'>(() => {
    return (localStorage.getItem('admin_menu_model') as 'classic' | 'grouped') || 'grouped';
  });

  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
    marketing: location.pathname === '/admin/marketing' || location.pathname === '/admin/invitations'
  });

  const handleSetMenuModel = (model: 'classic' | 'grouped') => {
    setMenuModel(model);
    localStorage.setItem('admin_menu_model', model);
  };

  const toggleSubmenu = (key: string) => {
    setOpenSubmenus(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  React.useEffect(() => {
    if (location.pathname === '/admin/marketing' || location.pathname === '/admin/invitations') {
      setOpenSubmenus(prev => ({ ...prev, marketing: true }));
    }
  }, [location.pathname]);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
    { icon: Activity, label: 'System Health', path: '/admin/health' },
    { icon: Upload, label: 'Bulk Import Listings', path: '/admin/bulk-import' },
    { icon: Sparkles, label: 'Demo Content', path: '/admin/demo-content' },
    { icon: Upload, label: 'Import via AI', path: '/admin/import' },
    { icon: ShoppingBag, label: 'Manage Listings', path: '/admin/ads' },
    { icon: Users, label: 'Users', path: '/admin/users' },
    { icon: UserCheck, label: 'Claims', path: '/admin/claims' },
    { icon: Megaphone, label: 'Marketing', path: '/admin/marketing' },
    { icon: QrCode, label: 'Invites', path: '/admin/invitations' },
    { icon: MessageSquare, label: 'Suggestions', path: '/admin/suggestions' },
    { icon: Camera, label: 'Marine Gallery', path: '/admin/fotos' },
    { icon: Settings, label: 'Settings', path: '/admin/settings' },
    { icon: BookOpen, label: 'Technical Manual', path: '/admin/manual-tecnico' },
  ];

  const filterItem = (path: string) => {
    if (!isModerator) return true;
    return [
      '/admin/dashboard',
      '/admin/ads',
      '/admin/marketing',
      '/admin/invitations',
      '/admin/claims'
    ].includes(path);
  };

  const groupedSections = [
    {
      title: 'Main',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
        { icon: Activity, label: 'System Health', path: '/admin/health' },
      ]
    },
    {
      title: 'Operations',
      items: [
        { icon: ShoppingBag, label: 'Manage Listings', path: '/admin/ads' },
        { icon: Users, label: 'Users', path: '/admin/users' },
        { icon: UserCheck, label: 'Claims', path: '/admin/claims' },
      ]
    },
    {
      title: 'Marketing & Promotion',
      items: [
        {
          icon: Megaphone,
          label: 'Platform Marketing',
          path: '/admin/marketing',
          isSubmenuParent: true,
          submenuKey: 'marketing',
          submenuItems: [
            { icon: Megaphone, label: 'Campaigns', path: '/admin/marketing' },
            { icon: QrCode, label: 'Invites', path: '/admin/invitations' },
          ]
        },
        { icon: Upload, label: 'Import via AI', path: '/admin/import' },
      ]
    },
    {
      title: 'Utilities & Support',
      items: [
        { icon: MessageSquare, label: 'Suggestions', path: '/admin/suggestions' },
        { icon: Camera, label: 'Marine Gallery', path: '/admin/fotos' },
        { icon: Settings, label: 'Definições', path: '/admin/settings' },
        { icon: BookOpen, label: 'Manual Técnico', path: '/admin/manual-tecnico' },
      ]
    }
  ];

  const filteredSections = groupedSections.map(section => {
    const visibleItems = section.items.map(item => {
      if (item.isSubmenuParent && item.submenuItems) {
        const visibleSubitems = item.submenuItems.filter(sub => filterItem(sub.path));
        if (visibleSubitems.length === 0) return null;
        return { ...item, submenuItems: visibleSubitems };
      }
      return filterItem(item.path) ? item : null;
    }).filter(Boolean) as typeof section.items;

    return { ...section, items: visibleItems };
  }).filter(section => section.items.length > 0);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <X size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Acesso Negado</h1>
          <p className="text-slate-500 mb-6">Você não tem permissões suficientes para aceder a esta área.</p>
          <button 
            onClick={() => navigate('/')}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full py-6 px-4">
      <div className="flex items-center gap-3 px-2 mb-4 shrink-0">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
          <ShoppingBag size={24} />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900 leading-none">Admin</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">ConnectBoat</p>
        </div>
      </div>

      {/* Menu Model Switcher */}
      <div className="mb-4 px-1 shrink-0">
        <div className="flex bg-slate-100 p-1 rounded-xl text-[11px] relative border border-slate-200/50">
          <button
            onClick={() => handleSetMenuModel('grouped')}
            className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 ${
              menuModel === 'grouped' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full transition-all ${menuModel === 'grouped' ? 'bg-indigo-600' : 'bg-transparent'}`} />
            Agrupado
          </button>
          <button
            onClick={() => handleSetMenuModel('classic')}
            className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 ${
              menuModel === 'classic' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full transition-all ${menuModel === 'classic' ? 'bg-indigo-600' : 'bg-transparent'}`} />
            Clássico
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
        {menuModel === 'classic' ? (
          menuItems
            .filter((item) => !isModerator || [
              '/admin/dashboard',
              '/admin/ads',
              '/admin/marketing',
              '/admin/invitations'
            ].includes(item.path))
            .map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold transition-all group ${
                    isActive 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <item.icon size={20} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600'} />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight size={16} />}
                </Link>
              );
            })
        ) : (
          filteredSections.map((section, idx) => (
            <div key={idx} className="space-y-1 pt-2 first:pt-0">
              <h3 className="px-4 text-[9px] font-extrabold text-slate-400 uppercase tracking-wider leading-none mb-1">
                {section.title}
              </h3>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  if (item.isSubmenuParent && item.submenuItems) {
                    const isSubmenuOpen = !!openSubmenus[item.submenuKey || ''];
                    const isAnyChildActive = item.submenuItems.some(sub => location.pathname === sub.path);
                    
                    return (
                      <div key={item.path} className="space-y-0.5">
                        <button
                          onClick={() => toggleSubmenu(item.submenuKey || '')}
                          className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl font-bold transition-all group ${
                            isAnyChildActive 
                              ? 'bg-indigo-50 text-indigo-700' 
                              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <item.icon size={20} className={isAnyChildActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-600'} />
                          <span className="flex-1 text-left">{item.label}</span>
                          <ChevronRight 
                            size={14} 
                            className={`transform transition-transform duration-200 ${
                              isSubmenuOpen ? 'rotate-90 text-indigo-600' : 'text-slate-400'
                            }`} 
                          />
                        </button>
                        
                        <AnimatePresence initial={false}>
                          {isSubmenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.15 }}
                              className="overflow-hidden pl-4 ml-6 border-l-2 border-slate-100/80 space-y-0.5"
                            >
                              {item.submenuItems.map((subItem) => {
                                const isChildActive = location.pathname === subItem.path;
                                return (
                                  <Link
                                    key={subItem.path}
                                    to={subItem.path}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                      isChildActive
                                        ? 'bg-indigo-600 text-white shadow-sm font-bold'
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'
                                    }`}
                                  >
                                    <subItem.icon size={15} className={isChildActive ? 'text-white' : 'text-slate-400'} />
                                    <span>{subItem.label}</span>
                                  </Link>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  }

                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2 rounded-xl font-bold transition-all group ${
                        isActive 
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <item.icon size={20} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600'} />
                      <span className="flex-1">{item.label}</span>
                      {isActive && <ChevronRight size={16} />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </nav>

      <div className="mt-auto pt-4 border-t border-slate-100 shrink-0">
        <div className="flex items-center gap-3 px-2 mb-4">
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold">
            {user?.email?.[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{user?.email?.split('@')[0]}</p>
            <p className="text-[10px] text-slate-400 truncate">{isAdmin ? 'Administrador' : 'Moderador'}</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all group"
        >
          <LogOut size={20} className="text-slate-400 group-hover:text-red-600" />
          <span>Exit Admin Panel</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-72 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white z-50 lg:hidden shadow-2xl"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sticky top-0 z-30">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <ShoppingBag size={18} />
            </div>
            <span className="font-black text-slate-900">Admin</span>
          </div>
          <div className="w-10 h-10" /> {/* Spacer for centering */}
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
