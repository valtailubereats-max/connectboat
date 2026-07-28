import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Eye, 
  MessageSquare, 
  TrendingUp, 
  Award, 
  Calendar,
  Sparkles,
  ChevronRight,
  ShoppingBag
} from 'lucide-react';
import { getShowcaseStats, AggregatedStatsResult } from '../services/showcaseStatsService';

interface ShowcaseStatsProps {
  sellerId: string;
  products: any[]; // Lista de produtos cadastrados do vendedor
}

export const ShowcaseStats: React.FC<ShowcaseStatsProps> = ({ sellerId, products }) => {
  const [timePeriod, setTimePeriod] = useState<'all' | '7days' | '30days'>('all');
  const [stats, setStats] = useState<AggregatedStatsResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!sellerId) return;
      setLoading(true);
      try {
        const result = await getShowcaseStats(sellerId);
        setStats(result);
      } catch (err) {
        console.error('Erro ao buscar estatísticas da vitrine:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [sellerId]);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs animate-pulse space-y-4">
        <div className="h-6 w-48 bg-slate-200 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-24 bg-slate-100 rounded-xl" />
          <div className="h-24 bg-slate-100 rounded-xl" />
          <div className="h-24 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  // Se não existem dados recolhidos ainda
  if (!stats || !stats.hasData) {
    return (
      <div className="bg-slate-50/50 p-6 rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
        <span className="text-3xl block">📊</span>
        <h4 className="font-bold text-slate-800 text-sm">Dashboard de Estatísticas da Vitrine</h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          As estatísticas de visitas, cliques no WhatsApp e visualizações de produtos da sua vitrine serão mostradas aqui em tempo real assim que começar a receber tráfego público.
        </p>
      </div>
    );
  }

  // Filtragem consoante o período de tempo selecionado
  let activePeriodStats = stats.lifetime;
  if (timePeriod === '7days') {
    activePeriodStats = stats.last7Days;
  } else if (timePeriod === '30days') {
    activePeriodStats = stats.last30Days;
  }

  const views = activePeriodStats.views;
  const clicks = activePeriodStats.whatsappClicks;
  
  // Taxa de conversão estimada (Clicks WhatsApp / Visualizações)
  const conversionRate = views > 0 ? ((clicks / views) * 100).toFixed(1) : '0.0';

  // Somatório das visualizações de todos os produtos do período
  const totalProductViews = (Object.values(activePeriodStats.productViews) as number[]).reduce((a: number, b: number) => a + b, 0);

  // Encontrar o produto mais visitado no período selecionado
  let mostVisitedProductId = '';
  let mostVisitedCount = 0;
  
  Object.entries(activePeriodStats.productViews).forEach(([pid, count]) => {
    const val = count as number;
    if (val > mostVisitedCount) {
      mostVisitedCount = val;
      mostVisitedProductId = pid;
    }
  });

  const mostVisitedProductObj = products.find(p => p.id === mostVisitedProductId);
  const mostVisitedName = mostVisitedProductObj ? mostVisitedProductObj.name : 'Nenhum produto view';

  // Ordenar produtos para o ranking
  const productsRank = products
    .map(p => {
      const pViews = activePeriodStats.productViews[p.id] || 0;
      return { ...p, views: pViews };
    })
    .filter(p => p.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 5); // top 5

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-6" id="showcase-analytics-dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-100">
            <BarChart3 size={20} />
          </div>
          <div>
            <h4 className="text-base font-black text-slate-900 leading-tight"> ESTATÍSTICAS DA VITRINE</h4>
            <p className="text-xs text-slate-550 font-medium">Desempenho real do seu perfil e produtos</p>
          </div>
        </div>

        {/* Time filters */}
        <div className="inline-flex bg-white border border-slate-200 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setTimePeriod('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              timePeriod === 'all' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Histórico Geral
          </button>
          <button
            type="button"
            onClick={() => setTimePeriod('7days')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              timePeriod === '7days' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Últimos 7 dias
          </button>
          <button
            type="button"
            onClick={() => setTimePeriod('30days')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              timePeriod === '30days' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Últimos 30 dias
          </button>
        </div>
      </div>

      {/* Main bento stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card: Views */}
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Visitas à Vitrine</span>
            <span className="text-2xl font-black text-slate-900 block">{views}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Eye size={18} />
          </div>
        </div>

        {/* Card: WhatsApp Clicks */}
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Cliques no WhatsApp</span>
            <span className="text-2xl font-black text-slate-900 block">{clicks}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <MessageSquare size={18} />
          </div>
        </div>

        {/* Card: Product Views */}
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Cliques de Catálogo</span>
            <span className="text-2xl font-black text-slate-900 block">{totalProductViews}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <ShoppingBag size={18} />
          </div>
        </div>

        {/* Card: Conversion Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Taxa de Conversão</span>
            <span className="text-2xl font-black text-slate-900 block">{conversionRate}%</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
            <TrendingUp size={18} />
          </div>
        </div>
      </div>

      {/* Detail Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Visited Product Widget */}
        <div className="bg-white rounded-2xl p-5 border border-slate-150 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">🏆 O Mais Procurado</span>
              <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">Produto Estrela</span>
            </div>
            {mostVisitedCount > 0 ? (
              <div className="space-y-1 pt-1">
                <h5 className="font-extrabold text-slate-800 text-sm leading-tight line-clamp-2">{mostVisitedName}</h5>
                <p className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                  <Eye size={12} />
                  <span>{mostVisitedCount} visualizações no período</span>
                </p>
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-3">Sem visualizações individuais registradas neste período.</div>
            )}
          </div>

          {mostVisitedProductObj && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="w-11 h-11 bg-slate-200 rounded-lg overflow-hidden shrink-0">
                {mostVisitedProductObj.images && mostVisitedProductObj.images[0] ? (
                  <img src={mostVisitedProductObj.images[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">📦</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-bold text-xs text-slate-800 block truncate">{mostVisitedProductObj.name}</span>
                <span className="text-[10px] text-indigo-600 font-bold block">{mostVisitedProductObj.price ? `${mostVisitedProductObj.price} €` : 'Consulta'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Popularity Ranking top list */}
        <div className="bg-white rounded-2xl p-5 border border-slate-150 shadow-xs space-y-4">
          <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">🔥 Ranking de Visualizações</span>
          
          {productsRank.length > 0 ? (
            <div className="space-y-2.5 pt-1">
              {productsRank.map((p, index) => {
                const maxViews = Math.max(...productsRank.map(item => item.views), 1);
                const widthPercent = Math.min((p.views / maxViews) * 100, 100);
                
                return (
                  <div key={`rank-${p.id}`} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-800 flex items-center gap-1.5 truncate">
                        <span className="text-[10px] font-black w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">{index + 1}</span>
                        <span className="truncate">{p.name}</span>
                      </span>
                      <span className="text-slate-900 font-bold shrink-0">{p.views} views</span>
                    </div>
                    {/* Progress Bar bar rendering */}
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-slate-400 py-6 text-center">Nenhum produto obteve visualizações no período atual.</div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ShowcaseStats;
