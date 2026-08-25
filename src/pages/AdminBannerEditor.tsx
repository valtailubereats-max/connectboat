import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../firebase';
import { doc, setDoc, getDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  Sliders, 
  Save, 
  RotateCcw, 
  Monitor, 
  Smartphone, 
  Check, 
  Sparkles, 
  Type, 
  Palette, 
  Move, 
  Eye,
  Info,
  ArrowUpDown,
  Megaphone,
  ExternalLink,
  Upload
} from 'lucide-react';
import { BannerConfig, DEFAULT_BANNER_CONFIG, BannerDeviceConfig } from '../types';

const boatBannerBg = "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&w=1600&q=80";

export default function AdminBannerEditor() {
  const { bannerConfig: initialBannerConfig } = useSettings();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'desktop' | 'mobile'>('desktop');
  const [config, setConfig] = useState<BannerConfig>(DEFAULT_BANNER_CONFIG);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [listingCampaigns, setListingCampaigns] = useState<any[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [listingAdSaving, setListingAdSaving] = useState(false);
  const [listingAdSaved, setListingAdSaved] = useState(false);
  const [listingAdUploading, setListingAdUploading] = useState(false);
  const listingAdFileInputRef = useRef<HTMLInputElement | null>(null);

  const [campaignId, setCampaignId] = useState('');
  const [listingAdEnabled, setListingAdEnabled] = useState(true);
  const [listingAdAdvertiser, setListingAdAdvertiser] = useState('');
  const [listingAdImageUrl, setListingAdImageUrl] = useState('');
  const [listingAdTargetUrl, setListingAdTargetUrl] = useState('');
  const [listingAdAltText, setListingAdAltText] = useState('ConnectBoat advertising banner');
  const [listingAdDisplaySeconds, setListingAdDisplaySeconds] = useState('4');
  const [listingAdStartDate, setListingAdStartDate] = useState('');
  const [listingAdEndDate, setListingAdEndDate] = useState('');
  const [listingAdAmountPaid, setListingAdAmountPaid] = useState('');
  const [listingAdPaymentStatus, setListingAdPaymentStatus] = useState<'paid' | 'pending'>('pending');
  const [listingAdPaidDate, setListingAdPaidDate] = useState('');

  const [advertisingSalesEnabled, setAdvertisingSalesEnabled] = useState(false);
  const [price4s30d, setPrice4s30d] = useState('');
  const [price6s30d, setPrice6s30d] = useState('');
  const [price8s30d, setPrice8s30d] = useState('');
  const [price10s30d, setPrice10s30d] = useState('');
  const [aiGenerationsIncluded, setAiGenerationsIncluded] = useState('3');
  const [salesSettingsSaving, setSalesSettingsSaving] = useState(false);

  const [pendingAdvertisingOrders, setPendingAdvertisingOrders] = useState<any[]>([]);
  const [pendingOrdersLoading, setPendingOrdersLoading] = useState(false);
  const [approvingOrderId, setApprovingOrderId] = useState('');

  useEffect(() => {
    if (initialBannerConfig) {
      setConfig({
        id: 'bannerConfig',
        enabled: initialBannerConfig.enabled !== undefined ? initialBannerConfig.enabled : true,
        desktop: {
          ...DEFAULT_BANNER_CONFIG.desktop,
          ...(initialBannerConfig.desktop || {})
        },
        mobile: {
          ...DEFAULT_BANNER_CONFIG.mobile,
          ...(initialBannerConfig.mobile || {})
        }
      });
    }
  }, [initialBannerConfig]);

  const loadAdvertisingSalesSettings = async () => {
    try {
      const snapshot = await getDoc(doc(db, 'settings', 'advertisingSales'));
      if (!snapshot.exists()) return;
      const data = snapshot.data() || {};
      setAdvertisingSalesEnabled(data.enabled === true);
      setPrice4s30d(typeof data.price4s30d === 'number' ? String(data.price4s30d) : '');
      setPrice6s30d(typeof data.price6s30d === 'number' ? String(data.price6s30d) : '');
      setPrice8s30d(typeof data.price8s30d === 'number' ? String(data.price8s30d) : '');
      setPrice10s30d(typeof data.price10s30d === 'number' ? String(data.price10s30d) : '');
      setAiGenerationsIncluded(String(data.aiGenerationsIncluded || 3));
    } catch (error) {
      console.warn('Unable to load advertising sales settings:', error);
    }
  };

  const saveAdvertisingSalesSettings = async () => {
    const values = [price4s30d, price6s30d, price8s30d, price10s30d].map((value) => Number(value || 0));
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      alert('Advertising prices must be valid positive numbers.');
      return;
    }

    try {
      setSalesSettingsSaving(true);
      await setDoc(doc(db, 'settings', 'advertisingSales'), {
        enabled: advertisingSalesEnabled,
        price4s30d: values[0],
        price6s30d: values[1],
        price8s30d: values[2],
        price10s30d: values[3],
        aiGenerationsIncluded: Math.max(1, Math.min(5, Number(aiGenerationsIncluded || 3))),
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'admin',
      }, { merge: true });
      alert('Advertising sales settings saved.');
    } catch (error) {
      console.error('Unable to save advertising sales settings:', error);
      alert('Failed to save advertising sales settings.');
    } finally {
      setSalesSettingsSaving(false);
    }
  };

  const loadPendingAdvertisingOrders = async () => {
    try {
      setPendingOrdersLoading(true);
      const snapshot = await getDocs(collection(db, 'advertisingOrders'));
      const orders = snapshot.docs
        .map((orderDoc) => ({ id: orderDoc.id, ...orderDoc.data() } as any))
        .filter((order) =>
          order.paymentStatus === 'paid' &&
          ['pending_approval', 'changes_requested'].includes(order.workflowStatus)
        )
        .sort((a, b) => {
          const aTime = a.submittedForApprovalAt?.toMillis ? a.submittedForApprovalAt.toMillis() : 0;
          const bTime = b.submittedForApprovalAt?.toMillis ? b.submittedForApprovalAt.toMillis() : 0;
          return bTime - aTime;
        });
      setPendingAdvertisingOrders(orders);
    } catch (error) {
      console.warn('Unable to load pending advertising orders:', error);
    } finally {
      setPendingOrdersLoading(false);
    }
  };

  const approveAdvertisingOrder = async (order: any) => {
    if (!order?.id || !order?.selectedBannerUrl) return;

    try {
      setApprovingOrderId(order.id);

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + Math.max(1, Number(order.durationDays || 30)) - 1);

      const startDate = start.toISOString().slice(0, 10);
      const endDate = end.toISOString().slice(0, 10);

      const amountPaid = Number(order.amountPaid || 0);
      const paidDate =
        order.paidDate ||
        (order.paidAt?.toDate
          ? order.paidAt.toDate().toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10));

      const campaignRef = await addDoc(collection(db, 'advertisingCampaigns'), {
        enabled: true,
        advertiserName: order.advertiserName || 'Advertiser',
        imageUrl: order.selectedBannerUrl,
        targetUrl: order.targetUrl || '',
        altText: `${order.advertiserName || 'Advertiser'} sponsored banner`,
        displaySeconds: Number(order.displaySeconds || 4),
        startDate,
        endDate,

        // Preserve the confirmed checkout payment on the published campaign.
        amountPaid: Number.isFinite(amountPaid) ? Math.round(amountPaid * 100) / 100 : 0,
        currency: order.currency || 'GBP',
        paymentStatus: 'paid',
        paidDate,
        stripeFee:
          typeof order.stripeFee === 'number' && Number.isFinite(order.stripeFee)
            ? order.stripeFee
            : 0,
        stripeNetReceived:
          typeof order.stripeNetReceived === 'number' && Number.isFinite(order.stripeNetReceived)
            ? order.stripeNetReceived
            : null,
        stripeCheckoutSessionId: order.stripeCheckoutSessionId || '',
        stripePaymentIntentId: order.stripePaymentIntentId || '',

        orderId: order.id,
        source: 'customer_checkout',
        impressions: 0,
        clicks: 0,
        createdAt: serverTimestamp(),
        createdBy: user?.email || 'admin',
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'advertisingOrders', order.id), {
        workflowStatus: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: user?.email || 'admin',
        campaignId: campaignRef.id,
        campaignStartDate: startDate,
        campaignEndDate: endDate,
        adminNote: '',
        updatedAt: serverTimestamp(),
      });

      await Promise.all([
        loadPendingAdvertisingOrders(),
        loadListingCampaigns(),
      ]);
    } catch (error) {
      console.error('Unable to approve advertising order:', error);
      alert('Failed to approve advertising campaign.');
    } finally {
      setApprovingOrderId('');
    }
  };

  const requestAdvertisingChanges = async (order: any) => {
    if (!order?.id) return;
    const note = window.prompt(
      'Tell the advertiser what should be changed:',
      order.adminNote || 'Please choose or generate a clearer banner with larger text.'
    );
    if (note === null) return;

    try {
      await updateDoc(doc(db, 'advertisingOrders', order.id), {
        workflowStatus: 'changes_requested',
        adminNote: note.trim(),
        updatedAt: serverTimestamp(),
      });
      await loadPendingAdvertisingOrders();
    } catch (error) {
      console.error('Unable to request banner changes:', error);
      alert('Failed to request changes.');
    }
  };

  const resetListingCampaignForm = () => {
    setCampaignId('');
    setListingAdEnabled(true);
    setListingAdAdvertiser('');
    setListingAdImageUrl('');
    setListingAdTargetUrl('');
    setListingAdAltText('ConnectBoat advertising banner');
    setListingAdDisplaySeconds('4');
    setListingAdStartDate('');
    setListingAdEndDate('');
    setListingAdAmountPaid('');
    setListingAdPaymentStatus('pending');
    setListingAdPaidDate('');
  };

  const loadListingCampaigns = async () => {
    try {
      setCampaignsLoading(true);

      const [campaignSnapshot, orderSnapshot] = await Promise.all([
        getDocs(collection(db, 'advertisingCampaigns')),
        getDocs(collection(db, 'advertisingOrders')),
      ]);

      const ordersById = new Map(
        orderSnapshot.docs.map((orderDoc) => [
          orderDoc.id,
          { id: orderDoc.id, ...orderDoc.data() } as any,
        ])
      );

      const campaigns = campaignSnapshot.docs
        .map((campaignDoc) => {
          const campaign = {
            id: campaignDoc.id,
            ...campaignDoc.data(),
          } as any;

          // Backward compatibility:
          // older checkout-created campaigns may not have copied the payment fields.
          // If an orderId exists, recover payment information from advertisingOrders.
          if (
            campaign.orderId &&
            (campaign.paymentStatus !== 'paid' ||
              typeof campaign.amountPaid !== 'number')
          ) {
            const order = ordersById.get(campaign.orderId);

            if (order?.paymentStatus === 'paid') {
              const recoveredAmountPaid = Number(order.amountPaid || 0);

              campaign.paymentStatus = 'paid';
              campaign.amountPaid = Number.isFinite(recoveredAmountPaid)
                ? Math.round(recoveredAmountPaid * 100) / 100
                : 0;
              campaign.currency = order.currency || campaign.currency || 'GBP';
              campaign.paidDate =
                order.paidDate ||
                (order.paidAt?.toDate
                  ? order.paidAt.toDate().toISOString().slice(0, 10)
                  : campaign.paidDate || '');
              campaign.stripeFee =
                typeof order.stripeFee === 'number' && Number.isFinite(order.stripeFee)
                  ? order.stripeFee
                  : campaign.stripeFee || 0;
              campaign.stripeNetReceived =
                typeof order.stripeNetReceived === 'number' &&
                Number.isFinite(order.stripeNetReceived)
                  ? order.stripeNetReceived
                  : campaign.stripeNetReceived ?? null;
              campaign.stripeCheckoutSessionId =
                order.stripeCheckoutSessionId ||
                campaign.stripeCheckoutSessionId ||
                '';
              campaign.stripePaymentIntentId =
                order.stripePaymentIntentId ||
                campaign.stripePaymentIntentId ||
                '';

              // Persist the recovered values once, so future reads no longer
              // depend on the fallback and Finance also sees the corrected data.
              updateDoc(doc(db, 'advertisingCampaigns', campaign.id), {
                paymentStatus: 'paid',
                amountPaid: campaign.amountPaid,
                currency: campaign.currency,
                paidDate: campaign.paidDate,
                stripeFee: campaign.stripeFee,
                stripeNetReceived: campaign.stripeNetReceived,
                stripeCheckoutSessionId: campaign.stripeCheckoutSessionId,
                stripePaymentIntentId: campaign.stripePaymentIntentId,
                updatedAt: serverTimestamp(),
                updatedBy: user?.email || 'admin',
              }).catch((syncError) => {
                console.warn(
                  `Unable to sync recovered payment data for campaign ${campaign.id}:`,
                  syncError
                );
              });
            }
          }

          return campaign;
        })
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return bTime - aTime;
        });

      setListingCampaigns(campaigns);
    } catch (error) {
      console.warn('Unable to load listing advertising campaigns:', error);
    } finally {
      setCampaignsLoading(false);
    }
  };

  useEffect(() => {
    loadListingCampaigns();
    loadAdvertisingSalesSettings();
    loadPendingAdvertisingOrders();
  }, []);

  const handleListingAdImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      event.target.value = '';
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert('The banner image must be 8MB or smaller.');
      event.target.value = '';
      return;
    }

    try {
      setListingAdUploading(true);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const imageRef = ref(storage, `advertising/listing-page/${Date.now()}_${safeName}`);
      const uploadResult = await uploadBytes(imageRef, file, { contentType: file.type });
      const downloadUrl = await getDownloadURL(uploadResult.ref);
      setListingAdImageUrl(downloadUrl);
    } catch (error) {
      console.error('Error uploading listing advertising banner:', error);
      alert(`Failed to upload banner image: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setListingAdUploading(false);
      event.target.value = '';
    }
  };

  const editListingCampaign = (campaign: any) => {
    setCampaignId(campaign.id);
    setListingAdEnabled(campaign.enabled === true);
    setListingAdAdvertiser(campaign.advertiserName || '');
    setListingAdImageUrl(campaign.imageUrl || '');
    setListingAdTargetUrl(campaign.targetUrl || '');
    setListingAdAltText(campaign.altText || 'ConnectBoat advertising banner');
    setListingAdDisplaySeconds(String(campaign.displaySeconds || 4));
    setListingAdStartDate(campaign.startDate || '');
    setListingAdEndDate(campaign.endDate || '');
    setListingAdAmountPaid(typeof campaign.amountPaid === 'number' ? String(campaign.amountPaid) : '');
    setListingAdPaymentStatus(campaign.paymentStatus === 'paid' ? 'paid' : 'pending');
    setListingAdPaidDate(campaign.paidDate || '');
  };

  const handleSaveListingAdvertising = async () => {
    const displaySeconds = Number(listingAdDisplaySeconds);
    const amountPaid = Number(listingAdAmountPaid || 0);

    if (!listingAdAdvertiser.trim()) {
      alert('Enter the advertiser or campaign name.');
      return;
    }
    if (!listingAdImageUrl.trim()) {
      alert('Upload a banner image.');
      return;
    }
    if (!Number.isFinite(displaySeconds) || displaySeconds < 2 || displaySeconds > 60) {
      alert('Display time must be between 2 and 60 seconds.');
      return;
    }
    if (!Number.isFinite(amountPaid) || amountPaid < 0) {
      alert('Enter a valid advertising revenue amount.');
      return;
    }

    try {
      setListingAdSaving(true);
      setListingAdSaved(false);

      const payload = {
        enabled: listingAdEnabled,
        advertiserName: listingAdAdvertiser.trim(),
        imageUrl: listingAdImageUrl.trim(),
        targetUrl: listingAdTargetUrl.trim(),
        altText: listingAdAltText.trim() || `${listingAdAdvertiser.trim()} advertising banner`,
        displaySeconds,
        startDate: listingAdStartDate,
        endDate: listingAdEndDate,
        amountPaid: Math.round(amountPaid * 100) / 100,
        currency: 'GBP',
        paymentStatus: listingAdPaymentStatus,
        paidDate: listingAdPaymentStatus === 'paid'
          ? (listingAdPaidDate || new Date().toISOString().slice(0, 10))
          : '',
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'admin',
      };

      if (campaignId) {
        await updateDoc(doc(db, 'advertisingCampaigns', campaignId), payload);
      } else {
        await addDoc(collection(db, 'advertisingCampaigns'), {
          ...payload,
          impressions: 0,
          clicks: 0,
          createdAt: serverTimestamp(),
          createdBy: user?.email || 'admin',
        });
      }

      setListingAdSaved(true);
      setTimeout(() => setListingAdSaved(false), 3000);
      resetListingCampaignForm();
      await loadListingCampaigns();
    } catch (error) {
      console.error('Error saving listing advertising campaign:', error);
      alert('Failed to save listing advertising campaign.');
    } finally {
      setListingAdSaving(false);
    }
  };

  const handleDeleteListingCampaign = async (campaign: any) => {
    if (!campaign?.id) return;
    if (!confirm(`Delete advertising campaign "${campaign.advertiserName || campaign.id}"?`)) return;

    try {
      await deleteDoc(doc(db, 'advertisingCampaigns', campaign.id));
      if (campaignId === campaign.id) resetListingCampaignForm();
      await loadListingCampaigns();
    } catch (error) {
      console.error('Error deleting advertising campaign:', error);
      alert('Failed to delete advertising campaign.');
    }
  };

  const currentDeviceConfig = config[activeTab];

  const getPosY = (val?: number) => (val === 90 ? 0 : (val ?? 0));

  const updateDeviceConfig = (key: keyof BannerDeviceConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [key]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSavedSuccess(false);

      const docRef = doc(db, 'settings', 'bannerConfig');
      const payload: BannerConfig = {
        ...config,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || 'admin'
      };

      await setDoc(docRef, payload, { merge: true });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving banner configuration:", err);
      alert("Failed to save banner configuration. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset the banner configuration to defaults?")) {
      setConfig(DEFAULT_BANNER_CONFIG);
    }
  };

  const textEn = currentDeviceConfig.customTextEn || 'Buy, sell and hire boats, yachts, gear & marine services across the United Kingdom.';
  const textPt = currentDeviceConfig.customTextPt || 'Compre, venda e alugue barcos, iates, equipamentos e serviços marítimos.';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 rounded-2xl">
              <Sliders size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Editor do Banner Principal
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                Customize em tempo real as frases, estilo, cores e posicionamento da caixa de texto do banner principal.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all cursor-pointer"
          >
            <RotateCcw size={15} />
            Restaurar Padrão
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : savedSuccess ? (
              <>
                <Check size={16} className="text-emerald-300" />
                Guardado com Sucesso!
              </>
            ) : (
              <>
                <Save size={16} />
                Guardar Alterações
              </>
            )}
          </button>
        </div>
      </div>

      {/* Selector Desktop vs Mobile */}
      <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl max-w-md mx-auto">
        <button
          onClick={() => setActiveTab('desktop')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'desktop'
              ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Monitor size={16} />
          <span>Computador (Desktop)</span>
        </button>
        <button
          onClick={() => setActiveTab('mobile')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'mobile'
              ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Smartphone size={16} />
          <span>Telemóvel (Mobile)</span>
        </button>
      </div>

      {/* ADVERTISING SALES AUTOMATION */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] font-black text-indigo-600">Automated Sales</div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1">Advertising Checkout & AI Pricing</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Customers pay first, create three AI banner options, then submit the selected design for your approval.
            </p>
          </div>
          <button
            type="button"
            onClick={saveAdvertisingSalesSettings}
            disabled={salesSettingsSaving}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black disabled:opacity-50"
          >
            {salesSettingsSaving ? 'Saving...' : 'Save Sales Settings'}
          </button>
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={advertisingSalesEnabled}
            onChange={(event) => setAdvertisingSalesEnabled(event.target.checked)}
            className="w-5 h-5 rounded"
          />
          <div>
            <p className="text-sm font-black text-slate-900 dark:text-white">Enable online advertising sales</p>
            <p className="text-xs text-slate-500">When disabled, /advertise remains visible but Stripe checkout cannot start.</p>
          </div>
        </label>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            ['4 seconds / 30 days', price4s30d, setPrice4s30d],
            ['6 seconds / 30 days', price6s30d, setPrice6s30d],
            ['8 seconds / 30 days', price8s30d, setPrice8s30d],
            ['10 seconds / 30 days', price10s30d, setPrice10s30d],
          ].map(([label, value, setter]: any) => (
            <div key={label}>
              <label className="block text-[10px] font-black text-slate-500 mb-1.5">{label}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">£</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={value}
                  onChange={(event) => setter(event.target.value)}
                  className="w-full pl-7 pr-3 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>
          ))}

          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-1.5">AI generation rounds included</label>
            <input
              type="number"
              min="1"
              max="5"
              value={aiGenerationsIncluded}
              onChange={(event) => setAiGenerationsIncluded(event.target.value)}
              className="w-full px-3 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 p-4 text-xs text-indigo-800 dark:text-indigo-200">
          Prices above are for 30 days. The public checkout automatically prorates 7-day and 14-day campaigns. You keep full control of the price for each exposure time.
        </div>
      </div>

      {/* CUSTOMER BANNERS AWAITING APPROVAL */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] font-black text-amber-600">Approval Queue</div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1">Customer Advertising Banners</h2>
            <p className="text-xs text-slate-500 mt-1">Paid banners never go live until you approve them.</p>
          </div>
          <span className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-black text-amber-700">
            {pendingAdvertisingOrders.length} pending
          </span>
        </div>

        {pendingOrdersLoading ? (
          <div className="p-4 text-sm text-slate-500">Loading approval queue...</div>
        ) : pendingAdvertisingOrders.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 text-sm text-slate-500">No customer banners are waiting for approval.</div>
        ) : (
          <div className="space-y-4">
            {pendingAdvertisingOrders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <img
                  src={order.selectedBannerUrl}
                  alt={order.advertiserName || 'Submitted advertising banner'}
                  className="w-full h-auto bg-white"
                />
                <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <p className="font-black text-slate-900 dark:text-white">{order.advertiserName || 'Advertiser'}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {order.displaySeconds || 4}s · {order.durationDays || 30} days · Paid £{Number(order.amountPaid || 0).toFixed(2)}
                    </p>
                    {order.adminNote && (
                      <p className="text-xs text-amber-700 mt-1">Previous note: {order.adminNote}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => requestAdvertisingChanges(order)}
                      className="px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs font-black"
                    >
                      Request Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => approveAdvertisingOrder(order)}
                      disabled={approvingOrderId === order.id}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black disabled:opacity-50"
                    >
                      {approvingOrderId === order.id ? 'Approving...' : 'Approve & Publish'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LISTING DETAILS ADVERTISING */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <Megaphone size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">Listing Page Advertising</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Multiple rotating banners. Each campaign has its own exposure time, dates and revenue.
              </p>
            </div>
          </div>

          <button type="button" onClick={resetListingCampaignForm}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-300">
            + New Campaign
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-slate-950/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-white">{campaignId ? 'Edit Campaign' : 'Add Campaign'}</p>
              <p className="text-[10px] text-slate-500">Rotation respects each banner's individual display time.</p>
            </div>
            {campaignId && <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Editing</span>}
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3 cursor-pointer bg-white dark:bg-slate-900">
            <input type="checkbox" checked={listingAdEnabled} onChange={(e) => setListingAdEnabled(e.target.checked)} className="w-5 h-5 rounded" />
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-white">Campaign active</p>
              <p className="text-xs text-slate-500">Inactive campaigns stay saved but do not rotate.</p>
            </div>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-2">Advertiser / campaign</label>
              <input type="text" value={listingAdAdvertiser} onChange={(e) => setListingAdAdvertiser(e.target.value)}
                placeholder="ShowBoat Detailing"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-2">Display time (seconds)</label>
              <input type="number" min="2" max="60" step="1" value={listingAdDisplaySeconds} onChange={(e) => setListingAdDisplaySeconds(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-2">Advertising revenue (£)</label>
              <input type="number" min="0" step="0.01" value={listingAdAmountPaid} onChange={(e) => setListingAdAmountPaid(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-2">Start date</label>
              <input type="date" value={listingAdStartDate} onChange={(e) => setListingAdStartDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-2">End date</label>
              <input type="date" value={listingAdEndDate} onChange={(e) => setListingAdEndDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-2">Payment status</label>
              <select value={listingAdPaymentStatus} onChange={(e) => setListingAdPaymentStatus(e.target.value === 'paid' ? 'paid' : 'pending')}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            {listingAdPaymentStatus === 'paid' && (
              <div>
                <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-2">Paid date</label>
                <input type="date" value={listingAdPaidDate} onChange={(e) => setListingAdPaidDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-2">Banner image</label>
              <input ref={listingAdFileInputRef} type="file" accept="image/*" onChange={handleListingAdImageUpload} className="hidden" />
              <button type="button" onClick={() => listingAdFileInputRef.current?.click()} disabled={listingAdUploading}
                className="w-full px-4 py-3 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50">
                <Upload size={16} />
                {listingAdUploading ? 'Uploading...' : listingAdImageUrl ? 'Replace Image' : 'Upload Image'}
              </button>
              {listingAdImageUrl && <p className="mt-2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Image uploaded to Firebase Storage.</p>}
            </div>

            <div>
              <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-2">Click destination URL</label>
              <input type="url" value={listingAdTargetUrl} onChange={(e) => setListingAdTargetUrl(e.target.value)}
                placeholder="https://advertiser.co.uk"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-2">Alternative text</label>
            <input type="text" value={listingAdAltText} onChange={(e) => setListingAdAltText(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {listingAdImageUrl.trim() && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-950">
              <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Preview</span>
                {listingAdTargetUrl.trim() && (
                  <a href={listingAdTargetUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                    Test link <ExternalLink size={12} />
                  </a>
                )}
              </div>
              <img src={listingAdImageUrl} alt={listingAdAltText || 'Advertising preview'} className="w-full max-h-[180px] object-contain bg-white" />
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 justify-end">
            {campaignId && (
              <button type="button" onClick={resetListingCampaignForm}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-300">
                Cancel Edit
              </button>
            )}
            <button type="button" onClick={handleSaveListingAdvertising} disabled={listingAdSaving || listingAdUploading}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50">
              <Save size={15} />
              {listingAdSaving ? 'Saving...' : listingAdSaved ? 'Saved!' : campaignId ? 'Update Campaign' : 'Add Campaign'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-white">Advertising Campaigns</p>
              <p className="text-[10px] text-slate-500">Each banner rotates according to its own display time.</p>
            </div>
            <span className="text-xs font-black text-slate-500">{listingCampaigns.length}</span>
          </div>

          {campaignsLoading ? (
            <div className="p-5 text-sm text-slate-500">Loading campaigns...</div>
          ) : listingCampaigns.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">No advertising campaigns yet.</div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {listingCampaigns.map((campaign) => (
                <div key={campaign.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {campaign.imageUrl ? (
                      <img src={campaign.imageUrl} alt={campaign.altText || campaign.advertiserName || 'Campaign'}
                        className="w-28 h-12 object-contain rounded-lg border border-slate-200 bg-white shrink-0" />
                    ) : <div className="w-28 h-12 rounded-lg bg-slate-100 shrink-0" />}

                    <div className="min-w-0">
                      <p className="font-black text-sm text-slate-900 dark:text-white truncate">{campaign.advertiserName || 'Unnamed campaign'}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {campaign.displaySeconds || 4}s · {campaign.enabled ? 'Active' : 'Inactive'} · {campaign.paymentStatus === 'paid' ? `Paid £${Number(campaign.amountPaid || 0).toFixed(2)}` : 'Payment pending'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{campaign.impressions || 0} impressions · {campaign.clicks || 0} clicks</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => editListingCampaign(campaign)}
                      className="px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-black">Edit</button>
                    <button type="button" onClick={() => handleDeleteListingCampaign(campaign)}
                      className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-black">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* LIVE PREVIEW BANNER */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-sm">
            <Eye size={16} className="text-sky-500" />
            <span>Pré-visualização em Tempo Real ({activeTab === 'desktop' ? 'Computador' : 'Telemóvel'})</span>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input 
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig(prev => ({ ...prev, enabled: e.target.checked }))}
              className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
            />
            <span>Exibir Caixa do Banner</span>
          </label>
        </div>

        <div className="flex justify-center bg-slate-950 p-4 sm:p-6 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
          <div 
            className={`relative overflow-hidden rounded-2xl bg-slate-950 transition-all duration-300 w-full ${
              activeTab === 'mobile' ? 'max-w-[360px] min-h-[280px]' : 'max-w-full min-h-[380px]'
            }`}
          >
            {/* Background Image */}
            <img 
              src={boatBannerBg} 
              alt="Banner Preview" 
              className="w-full h-full object-cover absolute inset-0"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-black/20 to-slate-950/90" />

            <div className="relative z-10 p-5 h-full flex flex-col justify-between min-h-[280px] sm:min-h-[380px]">
              {/* Top Banner Row */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight">ConnectBoat</h2>
                <div className="flex items-center gap-2">
                  <div className="bg-black/50 backdrop-blur-md border border-white/20 text-white font-bold text-xs px-2.5 py-1 rounded-lg">
                    Active Listings
                  </div>
                </div>
              </div>

              {/* Dynamic Subtitle Overlay Box */}
              {config.enabled && (
                <div 
                  className={`mt-auto pt-6 w-full flex ${
                    currentDeviceConfig.textAlign === 'left' ? 'justify-start' : 
                    currentDeviceConfig.textAlign === 'center' ? 'justify-center' : 'justify-end'
                  }`}
                  style={{
                    transform: `translateY(${-1 * getPosY(currentDeviceConfig.posY)}px)`,
                    transition: 'transform 0.15s ease-out'
                  }}
                >
                  <div 
                    className="inline-flex items-center shadow-2xl max-w-full transition-all"
                    style={{
                      backgroundColor: `${currentDeviceConfig.bgColor || '#0f172a'}${Math.round(((currentDeviceConfig.bgOpacity ?? 80) / 100) * 255).toString(16).padStart(2, '0')}`,
                      backdropFilter: `blur(${currentDeviceConfig.backdropBlur ?? 12}px)`,
                      borderRadius: `${currentDeviceConfig.borderRadius ?? 16}px`,
                      paddingTop: `${currentDeviceConfig.paddingVertical ?? 12}px`,
                      paddingBottom: `${currentDeviceConfig.paddingVertical ?? 12}px`,
                      paddingLeft: `${currentDeviceConfig.paddingHorizontal ?? 20}px`,
                      paddingRight: `${currentDeviceConfig.paddingHorizontal ?? 20}px`,
                    }}
                  >
                    <p 
                      className="font-medium italic tracking-wide leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
                      style={{
                        color: currentDeviceConfig.textColor || '#ffffff',
                        fontSize: `${currentDeviceConfig.fontSize || 14}px`,
                        textAlign: currentDeviceConfig.textAlign || 'right',
                      }}
                    >
                      {textEn}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* EDITING FORM PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* PANEL 1: MESSAGES / TEXT */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <Type size={18} className="text-sky-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Frases do Banner ({activeTab === 'desktop' ? 'Desktop' : 'Mobile'})
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                🇬🇧 Reino Unido / Inglês (UK Text)
              </label>
              <textarea
                rows={3}
                value={currentDeviceConfig.customTextEn || ''}
                onChange={(e) => updateDeviceConfig('customTextEn', e.target.value)}
                placeholder="Buy, sell and hire boats, yachts, gear & marine services across the United Kingdom."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                🇵🇹 Portugal / Português (PT Text)
              </label>
              <textarea
                rows={3}
                value={currentDeviceConfig.customTextPt || ''}
                onChange={(e) => updateDeviceConfig('customTextPt', e.target.value)}
                placeholder="Compre, venda e alugue barcos, iates, equipamentos e serviços marítimos."
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>

        {/* PANEL 2: STYLING & COLORS */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
            <Palette size={18} className="text-sky-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Cores, Fundo & Tipografia ({activeTab === 'desktop' ? 'Desktop' : 'Mobile'})
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Color Pickers */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Cor do Texto
              </label>
              <div className="flex items-center gap-2">
                <input 
                  type="color"
                  value={currentDeviceConfig.textColor || '#ffffff'}
                  onChange={(e) => updateDeviceConfig('textColor', e.target.value)}
                  className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5 bg-transparent"
                />
                <input 
                  type="text"
                  value={currentDeviceConfig.textColor || '#ffffff'}
                  onChange={(e) => updateDeviceConfig('textColor', e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Cor de Fundo da Caixa
              </label>
              <div className="flex items-center gap-2">
                <input 
                  type="color"
                  value={currentDeviceConfig.bgColor || '#0f172a'}
                  onChange={(e) => updateDeviceConfig('bgColor', e.target.value)}
                  className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5 bg-transparent"
                />
                <input 
                  type="text"
                  value={currentDeviceConfig.bgColor || '#0f172a'}
                  onChange={(e) => updateDeviceConfig('bgColor', e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Opacidade de Fundo */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                <span>Opacidade do Fundo</span>
                <span>{currentDeviceConfig.bgOpacity ?? 80}%</span>
              </div>
              <input 
                type="range"
                min="0"
                max="100"
                value={currentDeviceConfig.bgOpacity ?? 80}
                onChange={(e) => updateDeviceConfig('bgOpacity', Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>

            {/* Blur de Fundo */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                <span>Efeito Vidro (Blur)</span>
                <span>{currentDeviceConfig.backdropBlur ?? 12}px</span>
              </div>
              <input 
                type="range"
                min="0"
                max="24"
                value={currentDeviceConfig.backdropBlur ?? 12}
                onChange={(e) => updateDeviceConfig('backdropBlur', Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>

            {/* Posição Vertical (Cima / Baixo) */}
            <div className="sm:col-span-2 bg-sky-50/60 dark:bg-sky-950/40 p-3.5 rounded-2xl border border-sky-100 dark:border-sky-900/60 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <ArrowUpDown size={15} className="text-sky-600 dark:text-sky-400" />
                  Posição Vertical da Caixa (Cima / Baixo)
                </span>
                <span className="px-2 py-0.5 bg-sky-100 dark:bg-sky-900/80 text-sky-700 dark:text-sky-300 rounded-md font-mono text-[11px]">
                  {getPosY(currentDeviceConfig.posY)}px
                </span>
              </div>
              <input 
                type="range"
                min="-80"
                max="140"
                value={getPosY(currentDeviceConfig.posY)}
                onChange={(e) => updateDeviceConfig('posY', Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium pt-0.5">
                <span>⬇️ Mais para Baixo (-80px)</span>
                <span>Padrão (0px)</span>
                <span>⬆️ Mais para Cima (+140px)</span>
              </div>
            </div>

            {/* Tamanho da Fonte */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                <span>Tamanho da Fonte</span>
                <span>{currentDeviceConfig.fontSize || 14}px</span>
              </div>
              <input 
                type="range"
                min="8"
                max="32"
                value={currentDeviceConfig.fontSize || 14}
                onChange={(e) => updateDeviceConfig('fontSize', Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>

            {/* Alinhamento do Texto */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Alinhamento do Texto
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => updateDeviceConfig('textAlign', align)}
                    className={`py-1.5 text-xs font-bold capitalize rounded-lg transition-all ${
                      currentDeviceConfig.textAlign === align
                        ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {align === 'left' ? 'Esquerda' : align === 'center' ? 'Centro' : 'Direita'}
                  </button>
                ))}
              </div>
            </div>

            {/* Padding Vertical */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                <span>Espaçamento Vertical</span>
                <span>{currentDeviceConfig.paddingVertical ?? 12}px</span>
              </div>
              <input 
                type="range"
                min="0"
                max="40"
                value={currentDeviceConfig.paddingVertical ?? 12}
                onChange={(e) => updateDeviceConfig('paddingVertical', Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>

            {/* Border Radius */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                <span>Arredondamento Bordas</span>
                <span>{currentDeviceConfig.borderRadius ?? 16}px</span>
              </div>
              <input 
                type="range"
                min="0"
                max="40"
                value={currentDeviceConfig.borderRadius ?? 16}
                onChange={(e) => updateDeviceConfig('borderRadius', Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
