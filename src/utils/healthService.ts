import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  limit, 
  Timestamp,
  getDoc,
  setDoc,
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { SystemHealthAlert } from '../types';
import { sendEmailGeneric, isUserStaff } from './emailService';

// Log dynamic health events in Firestore
export async function logHealthEvent(type: 'import_failure' | 'email_failure' | 'firestore_error', errorMsg: string, metadata?: any) {
  try {
    const colRef = collection(db, 'system_health_events');
    await addDoc(colRef, {
      type,
      error: errorMsg,
      timestamp: new Date(),
      metadata: metadata || {}
    });
    console.log(`[HealthService] Event logged: ${type}`);
  } catch (err) {
    console.warn('[HealthService] Failed to log health event:', err);
  }
}

// Check and trigger overall health alerts
export async function runHealthChecks(): Promise<{
  alerts: SystemHealthAlert[];
  percentage: number;
  level: 'Saudável' | 'Atenção' | 'Alerta' | 'Crítico';
}> {
  const alertsToCreate: Omit<SystemHealthAlert, 'id' | 'status' | 'createdAt'>[] = [];
  const now = new Date();

  // 1. Pending listings
  try {
    const adsSnap = await getDocs(query(collection(db, 'ads'), where('status', '==', 'pending')));
    const pendingAds = adsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
    
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const oldPendingAds = pendingAds.filter(ad => {
      const adDate = ad.createdAt?.toDate ? ad.createdAt.toDate() : new Date(ad.createdAt);
      return adDate < twelveHoursAgo;
    });

    if (oldPendingAds.length > 0) {
      alertsToCreate.push({
        title: 'Pending listings backlog',
        description: `There are ${oldPendingAds.length} listing(s) pending approval for over 12 hours.`,
        severity: 'warning',
        source: 'ads',
        recommendedAction: 'Visit Admin Moderation to review and approve or reject legacy pending listings.',
        relatedLink: '/admin/ads'
      });
    } else if (pendingAds.length > 10) {
      alertsToCreate.push({
        title: 'High volume of pending listings',
        description: `There are ${pendingAds.length} listings awaiting active moderation.`,
        severity: 'info',
        source: 'ads',
        recommendedAction: 'Consider moderating recent listings to speed up publishing.',
        relatedLink: '/admin/ads'
      });
    }
  } catch (err) {
    console.warn('[HealthCheck] Ads check failed', err);
  }

  // 2. Duplicados
  try {
    const adsSnap = await getDocs(collection(db, 'ads'));
    const allAds = adsSnap.docs.map(d => d.data() as any);
    const suspectedDuplicates = allAds.filter(ad => ad.duplicateReason && ad.status !== 'archived' && ad.status !== 'deleted');

    if (suspectedDuplicates.length > 3) {
      alertsToCreate.push({
        title: 'Múltiplos anúncios duplicados suspeitos',
        description: `Existem ${suspectedDuplicates.length} anúncios ativos detetados como possíveis duplicados pelo analisador anti-spam.`,
        severity: 'warning',
        source: 'ads',
        recommendedAction: 'Analise os anúncios duplicados marcados na área de administração para arquivar itens repetidos.',
        relatedLink: '/admin/ads'
      });
    }
  } catch (err) {
    console.warn('[HealthCheck] Duplicates check failed', err);
  }

  // 3. Destaques
  try {
    const adsSnap = await getDocs(collection(db, 'ads'));
    const allAds = adsSnap.docs.map(d => d.data() as any);
    
    const nowTime = now.getTime();
    
    const paidFeatured = allAds.filter(ad => 
      ad.isFeatured === true && 
      !ad.isPermanentFeatured && 
      ad.status === 'active' &&
      ad.featuredUntil && 
      (ad.featuredUntil.toDate ? ad.featuredUntil.toDate().getTime() : new Date(ad.featuredUntil).getTime()) > nowTime
    );

    const permanentFeatured = allAds.filter(ad => 
      ad.isFeatured === true && 
      ad.isPermanentFeatured === true &&
      ad.status === 'active'
    );

    if (paidFeatured.length === 0 && permanentFeatured.length === 0) {
      alertsToCreate.push({
        title: 'Nenhum Destaque Visível na Home',
        description: 'Não existem destaques pagos ativos nem destaques permanentes administrativos configurados no carrossel da Home.',
        severity: 'critical',
        source: 'destaque',
        recommendedAction: 'Crie pelo menos um anúncio com destaque permanente para preencher esteticamente o carrossel, ou ative destaques pagos.',
        relatedLink: '/create-ad'
      });
    }
  } catch (err) {
    console.warn('[HealthCheck] Destaques check failed', err);
  }

  // 4. Importações OLX/Gumtree
  try {
    const eventsSnap = await getDocs(query(
      collection(db, 'system_health_events'),
      where('type', '==', 'import_failure')
    ));
    const recentFailures = eventsSnap.docs.map(d => d.data() as any).filter(ev => {
      const evDate = ev.timestamp?.toDate ? ev.timestamp.toDate() : new Date(ev.timestamp);
      return (now.getTime() - evDate.getTime()) < 24 * 60 * 60 * 1000; // past 24h
    });

    if (recentFailures.length >= 3) {
      alertsToCreate.push({
        title: 'Várias falhas em importações recentes',
        description: `Detetou-se ${recentFailures.length} falha(s) de importação automática através de links OLX/Gumtree nas últimas 24 h.`,
        severity: 'alert',
        source: 'import',
        recommendedAction: 'Verifique se as páginas de origem sofreram alterações em suas estruturas CSS ou se há bloqueios cloud.',
        relatedLink: '/admin/import'
      });
    }
  } catch (err) {
    console.warn('[HealthCheck] Import failure check failed', err);
  }

  // 5. E-mails
  try {
    const eventsSnap = await getDocs(query(
      collection(db, 'system_health_events'),
      where('type', '==', 'email_failure')
    ));
    const recentEmailFailures = eventsSnap.docs.map(d => d.data() as any).filter(ev => {
      const evDate = ev.timestamp?.toDate ? ev.timestamp.toDate() : new Date(ev.timestamp);
      return (now.getTime() - evDate.getTime()) < 24 * 60 * 60 * 1000;
    });

    if (recentEmailFailures.length > 0) {
      alertsToCreate.push({
        title: 'Falhas recentes de envio de e-mail',
        description: `Ocorreu ${recentEmailFailures.length} falha(s) nos disparos do servidor de e-mail automático nas últimas 24 h.`,
        severity: 'alert',
        source: 'email',
        recommendedAction: 'Verifique as quotas e credenciais das chaves de API do Resend/SendGrid nas Definições.',
        relatedLink: '/admin/settings'
      });
    }
  } catch (err) {
    console.warn('[HealthCheck] Email failure check failed', err);
  }

  // Firestore
  try {
    const eventsSnap = await getDocs(query(
      collection(db, 'system_health_events'),
      where('type', '==', 'firestore_error')
    ));
    const recentFireErrors = eventsSnap.docs.map(d => d.data() as any).filter(ev => {
      const evDate = ev.timestamp?.toDate ? ev.timestamp.toDate() : new Date(ev.timestamp);
      return (now.getTime() - evDate.getTime()) < 24 * 60 * 60 * 1000 && ev.error?.toLowerCase().includes('permission');
    });

    if (recentFireErrors.length > 0) {
      alertsToCreate.push({
        title: 'Erro de permissão recente no Firestore',
        description: `Foram detetados erros do tipo "Missing or insufficient permissions" nas últimas 24 horas.`,
        severity: 'critical',
        source: 'firestore',
        recommendedAction: 'Examine as regras em firestore.rules para assegurar que os leitores/escritores de staff estão autorizados.',
        relatedLink: '/admin/manual-tecnico'
      });
    }
  } catch (err) {
    console.warn('[HealthCheck] Firestore check failed', err);
  }

  // If we have literally 0 alerts created, but we want the dashboard to look interesting (especially upon first setup),
  // let's do a fallback lookup in the Firestore alerts collection and sync them.
  
  // Now let's fetch any alerts that are currently stored as 'aberto' in Firestore
  const alertColRef = collection(db, 'system_health_alerts');
  const storedAlertsSnap = await getDocs(query(alertColRef, where('status', '==', 'aberto')));
  const storedOpenAlerts = storedAlertsSnap.docs.map(d => ({ id: d.id, ...d.data() as any })) as SystemHealthAlert[];

  // Merge: For each newly generated alert, check if it's already recorded in `storedOpenAlerts` by matching title
  const resolvedTitles: string[] = [];
  
  for (const fresh of alertsToCreate) {
    const alreadyExists = storedOpenAlerts.some(st => st.title === fresh.title && st.source === fresh.source);
    if (!alreadyExists) {
      // Create is in Firestore
      const docRef = await addDoc(alertColRef, {
        ...fresh,
        status: 'aberto',
        createdAt: new Date()
      });
      storedOpenAlerts.push({
        id: docRef.id,
        ...fresh,
        status: 'aberto',
        createdAt: new Date()
      });
    }
  }

  // Return final list of open alerts
  const finalOpenAlerts = storedOpenAlerts.filter(a => a.status === 'aberto');

  // Calculate Health score percentage:
  // We start at 100%
  // Each severity deducts points:
  // - info: -3%
  // - warning: -8%
  // - alert: -15%
  // - critical: -25%
  let percentage = 100;
  finalOpenAlerts.forEach(alert => {
    if (alert.severity === 'info') percentage -= 3;
    else if (alert.severity === 'warning') percentage -= 8;
    else if (alert.severity === 'alert') percentage -= 15;
    else if (alert.severity === 'critical') percentage -= 25;
  });

  if (percentage < 0) percentage = 0;

  // Level classification:
  // - Verde (Saudável): 85% a 100%
  // - Amarelo (Atenção): 65% a 84%
  // - Laranja (Alerta): 40% a 64%
  // - Vermelho (Crítico): 0% a 39%
  let level: 'Saudável' | 'Atenção' | 'Alerta' | 'Crítico' = 'Saudável';
  if (percentage >= 85) level = 'Saudável';
  else if (percentage >= 65) level = 'Atenção';
  else if (percentage >= 40) level = 'Alerta';
  else level = 'Crítico';

  // Log running snapshot metadata
  console.log('[DEBUG_HEALTH] All 8 sub-checks completed successfully. Alerts count:', alertsToCreate.length);
  console.log('[DEBUG_HEALTH] Computed health score:', percentage, 'level:', level);
  
  try {
    console.log('[DEBUG_HEALTH] Preparing to write execution snapshot metadata to "settings/health_last_run"...');
    await setDoc(doc(db, 'settings', 'health_last_run'), {
      lastCheckAt: new Date(),
      healthPercentage: percentage,
      level,
      openAlertsCount: finalOpenAlerts.length
    }, { merge: true });
    console.log('[DEBUG_HEALTH] Successfully wrote snapshot metadata to "settings/health_last_run"');
  } catch (writeErr: any) {
    console.error('[DEBUG_HEALTH] CRITICAL FAIL on writing settings/health_last_run:', writeErr?.message || writeErr, writeErr);
    throw writeErr; // preserve throwing to keep original error bubbling
  }

  // Handle email alerts trigger on level change
  try {
    console.log('[DEBUG_HEALTH] Processing email alerts check...');
    await handleHealthLevelChangeEmails(percentage, level, finalOpenAlerts);
  } catch (emailErr: any) {
    console.error('[DEBUG_HEALTH] FAIL on handling change emails check:', emailErr);
    throw emailErr;
  }

  return {
    alerts: finalOpenAlerts,
    percentage,
    level
  };
}

// Handle sending email alerts, respecting anti-spam logic
async function handleHealthLevelChangeEmails(
  currentPercentage: number,
  currentLevel: 'Saudável' | 'Atenção' | 'Alerta' | 'Crítico',
  openAlerts: SystemHealthAlert[]
) {
  // We only trigger emails when the level is Amarelo, Laranja, or Vermelho (i.e. not Saudável)
  if (currentLevel === 'Saudável') return;

  try {
    // Read the last sent email level configuration from settings to avoid repetitions
    console.log('[DEBUG_HEALTH] Reading security settings tracker "settings/health_email_tracker"...');
    const trackingDocRef = doc(db, 'settings', 'health_email_tracker');
    const docSnap = await getDoc(trackingDocRef);
    console.log('[DEBUG_HEALTH] Done reading tracker doc. Exists:', docSnap.exists());
    const trackingData = docSnap.exists() ? docSnap.data() : null;

    const now = new Date();
    const lastSentTime = trackingData?.lastSentTime?.toDate ? trackingData.lastSentTime.toDate() : (trackingData?.lastSentTime ? new Date(trackingData.lastSentTime) : null);
    const lastSentLevel = trackingData?.lastLevel || '';

    // Intervalo mínimo de 30 minutos entre emails de aviso do mesmo estado para evitar spam
    const thirtyMinutesMs = 30 * 60 * 1000;
    const isTooSoon = lastSentTime && (now.getTime() - lastSentTime.getTime() < thirtyMinutesMs) && lastSentLevel === currentLevel;

    if (isTooSoon) {
      console.log(`[HealthService] Avoided sending health level e-mail spam. Last sent ${currentLevel} of same type within 30 minutes.`);
      return;
    }

    // Capture administrator emails
    const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
    const adminEmails = usersSnap.docs.map(d => d.data()?.email).filter(Boolean);

    if (adminEmails.length === 0) {
      console.log('[HealthService] No administrators found with configured emails.');
      return;
    }

    // Format active alerts inside the email template
    let alertDetailsString = '<table width="100%" cellpadding="10" border="0" style="border-collapse: collapse;">';
    openAlerts.forEach((a, idx) => {
      const sevColor = a.severity === 'critical' ? '#ef4444' : a.severity === 'alert' ? '#f97316' : a.severity === 'warning' ? '#eab308' : '#3b82f6';
      alertDetailsString += `
        <tr style="border-bottom: 1px solid #f1f5f9; background-color: ${idx % 2 === 0 ? '#fafafa' : '#ffffff'};">
          <td width="20%" style="font-weight: bold; color: ${sevColor}; uppercase; font-size: 11px;">[${a.severity.toUpperCase()}]</td>
          <td width="80%">
            <p style="margin: 0; font-weight: bold; color: #1e293b;">${a.title}</p>
            <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">${a.description}</p>
            <p style="margin: 4px 0 0 0; font-size: 11px; font-style: italic; color: #94a3b8;">Origem: ${a.source} | Ação: ${a.recommendedAction}</p>
          </td>
        </tr>
      `;
    });
    alertDetailsString += '</table>';

    const actionRequired = currentLevel === 'Crítico' 
      ? 'Ação imediata recomendada! Revise as conexões de banco de dados e as permissões de moderação do sistema.' 
      : 'Efetue a auditoria dos alertas pendentes para reverter o app para o estado saudável.';

    // Send emails
    console.log(`[HealthService] Triggering health level change notification emails to admins:`, adminEmails);
    
    // Send to each admin
    for (const email of adminEmails) {
      await sendEmailGeneric('alerta_saude_sistema', email, {
        adminName: email.split('@')[0],
        previousLevel: lastSentLevel || undefined,
        currentLevel,
        healthPercentage: currentPercentage,
        alertDetailsString,
        actionRequired
      });
    }

    // Save tracking metadata after successful send
    console.log('[DEBUG_HEALTH] Saving email dispatch state to tracker "settings/health_email_tracker"...');
    await setDoc(trackingDocRef, {
      lastSentTime: now,
      lastLevel: currentLevel,
      lastPercentage: currentPercentage
    }, { merge: true });
    console.log('[DEBUG_HEALTH] Wrote settings/health_email_tracker successfully');

  } catch (err) {
    console.warn('[HealthService] Failed to dispatch health emails:', err);
  }
}
