// Serverless Email Service for ConnectBoat

const EMAIL_FLAG_ACTIVE = process.env.EMAIL_ACTIVE !== 'false';

// Helper to generate unified HTML email templates
function generateConnectBoatTemplate(title: string, bodyContent: string, ctaLink?: string, ctaText?: string): string {
  const ctaButton = ctaLink && ctaText ? `
    <div style="margin: 25px 0; text-align: center;">
      <a href="${ctaLink}" target="_blank" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; font-size: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        ${ctaText}
      </a>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f8fafc; padding: 20px 0;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              
              <!-- Header -->
              <tr style="background-color: #0f172a;">
                <td style="padding: 24px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.05em;">
                    ⛵ ConnectBoat
                  </h1>
                  <p style="margin: 4px 0 0 0; color: #38bdf8; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">
                    UK Boat & Marine Marketplace
                  </p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 40px 30px; color: #334155; font-size: 15px; line-height: 1.6;">
                  ${bodyContent}
                  ${ctaButton}
                  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                  <p style="font-size: 12px; color: #64748b; margin: 0;">
                    Need assistance or have questions? Contact us at <a href="mailto:contato@connectboat.co.uk" style="color: #0284c7; text-decoration: underline;">contato@connectboat.co.uk</a>.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr style="background-color: #f1f5f9;">
                <td style="padding: 20px; text-align: center; color: #64748b; font-size: 12px;">
                  <p style="margin: 0 0 6px 0; font-weight: 700;">ConnectBoat UK</p>
                  <p style="margin: 0;">United Kingdom Marine & Boat Marketplace</p>
                  <p style="margin: 12px 0 0 0; font-size: 10px; color: #94a3b8;">
                    This is an automated notification. Please write to contato@connectboat.co.uk for customer support.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// Render specific email templates
function renderEmail(template: string, data: any): { subject: string; html: string } {
  let subject = '';
  let bodyContent = '';
  let ctaLink: string | undefined;
  let ctaText: string | undefined;

  let resolvedUrl = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || process.env.APP_URL;

  if (!resolvedUrl) {
    if (process.env.NODE_ENV !== 'production' && process.env.VERCEL_URL) {
      resolvedUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      resolvedUrl = 'https://www.connectboat.co.uk';
    }
  }

  const baseUrl = resolvedUrl.replace(/\/$/, '');

  switch (template) {
    case 'anuncio_submetido':
      subject = `⛵ Listing Submitted Successfully: ${data.adTitle || 'Your Listing'}`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${data.sellerName || 'Valued Member'},</p>
        <p>Thank you for submitting your listing <strong>"${data.adTitle}"</strong> on ConnectBoat!</p>
        <p>Your listing has been received and is currently being reviewed by our moderation team to ensure compliance with our marine marketplace standards.</p>
        <p>You will receive an email update as soon as your listing is approved and published live.</p>
      `;
      ctaLink = `${baseUrl}/profile`;
      ctaText = 'View My Account';
      break;

    case 'anuncio_aprovado':
      subject = `✅ Your Listing is Now Live on ConnectBoat: ${data.adTitle || ''}`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${data.sellerName || 'Valued Member'},</p>
        <p>Great news! Your listing <strong>"${data.adTitle}"</strong> has been reviewed and <strong>approved</strong> by our moderation team.</p>
        <p>Your listing is now live on ConnectBoat and accessible to buyers across the UK marine community.</p>
        <p>We wish you smooth sailing and successful connections!</p>
      `;
      ctaLink = `${baseUrl}/anuncio/${data.adId}`;
      ctaText = 'View Live Listing';
      break;

    case 'anuncio_rejeitado':
      subject = `❌ Update Regarding Your Listing on ConnectBoat`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${data.sellerName || 'Valued Member'},</p>
        <p>Thank you for submitting your listing to ConnectBoat. Unfortunately, your listing <strong>"${data.adTitle}"</strong> could not be approved at this time.</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <strong style="color: #991b1b; display: block; margin-bottom: 5px;">Reason for Rejection:</strong>
          <span style="color: #7f1d1d;">${data.reason || 'The listing does not comply with our marketplace guidelines.'}</span>
        </div>
        <p>Please review our publishing guidelines and make the necessary edits from your profile to resubmit.</p>
      `;
      ctaLink = `${baseUrl}/profile`;
      ctaText = 'Go to My Profile';
      break;

    case 'anuncio_pendente_staff':
      subject = `⚠️ NEW PENDING LISTING MODERATION: ${data.adTitle || 'Listing'}`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello Staff / Moderator,</p>
        <p>A new listing has been submitted and is currently <strong>pending review</strong>.</p>
        <table border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 15px; border-radius: 6px; width: 100%; margin: 20px 0;">
          <tr>
            <td style="padding: 4px 0;"><strong>Title:</strong></td>
            <td style="padding: 4px 0;">${data.adTitle}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0;"><strong>Seller:</strong></td>
            <td style="padding: 4px 0;">${data.sellerName}</td>
          </tr>
        </table>
        <p>Please log in to the ConnectBoat administration panel to review and approve or reject this listing.</p>
      `;
      ctaLink = `${baseUrl}/admin/ads`;
      ctaText = 'Go to Moderation Panel';
      break;

    case 'interesse_contacto':
      subject = `👥 New Buyer Enquiry for Your Listing: ${data.adTitle}`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${data.sellerName || 'Valued Member'},</p>
        <p>You have a new buyer enquiry!</p>
        <p>A prospective buyer, <strong>${data.interestedName}</strong>, has initiated contact for your listing <strong>"${data.adTitle}"</strong>.</p>
        <p>Please check your WhatsApp or direct messages to respond promptly and secure your sale.</p>
      `;
      ctaLink = `${baseUrl}/anuncio/${data.adId}`;
      ctaText = 'View Listing';
      break;

    case 'review_recebida':
      subject = `⭐️ You Received a New Review on ConnectBoat!`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${data.sellerName || 'Valued Member'},</p>
        <p>User <strong>${data.reviewerName}</strong> left a public review for your listing <strong>"${data.adTitle}"</strong>.</p>
        <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
          <div style="font-size: 24px; color: #fbbf24; margin-bottom: 8px;">
            ${'★'.repeat(Math.min(5, Math.max(1, data.rating)))}
          </div>
          <p style="margin: 0; font-style: italic; color: #451a03; font-size: 16px;">
            "${data.comment || 'No comment provided.'}"
          </p>
        </div>
        <p>Positive reviews build trust across the ConnectBoat marine community. Keep up the great work!</p>
      `;
      ctaLink = `${baseUrl}/profile`;
      ctaText = 'View My Profile';
      break;

    case 'compra_concluida':
      subject = `🎉 Sale Marked as Completed!`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${data.sellerName || 'Valued Member'},</p>
        <p>Congratulations on completing your transaction!</p>
        <p>Your listing <strong>"${data.adTitle}"</strong> has been marked as successfully sold to buyer <strong>${data.buyerName}</strong>.</p>
        <p>Thank you for choosing ConnectBoat as your trusted marine marketplace platform.</p>
      `;
      ctaLink = `${baseUrl}/profile`;
      ctaText = 'Manage My Listings';
      break;

    case 'pagamento_confirmado':
      subject = `💳 Payment Confirmed: ${data.planName || 'ConnectBoat Service'}`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${data.userName || 'Valued Member'},</p>
        <p>We have successfully received your payment for <strong>${data.planName || 'Featured Listing / Digital Showcase'}</strong>.</p>
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <strong style="color: #166534; display: block; margin-bottom: 5px;">Order Summary:</strong>
          <span style="color: #15803d; font-size: 14px;">Plan: ${data.planName || 'Premium Plan'} • Amount: ${data.amount || 'Paid'}</span>
        </div>
        <p>Your upgraded feature status is now active on ConnectBoat.</p>
      `;
      ctaLink = `${baseUrl}/profile`;
      ctaText = 'View My Account';
      break;

    case 'boas_vindas':
      subject = `⛵ Welcome to ConnectBoat - UK Marine Marketplace!`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Welcome aboard, ${data.userName}!</p>
        <p>Your account has been successfully created on <strong>ConnectBoat</strong>, the UK's premier boat and marine classifieds platform.</p>
        <p>Here is what you can do on ConnectBoat:</p>
        <ul style="padding-left: 20px; margin: 15px 0;">
          <li>Publish listings for boats, marine equipment, parts, services, and charters.</li>
          <li>Browse listings across all regions in the UK.</li>
          <li>Connect directly with buyers and sellers via verified contact options.</li>
        </ul>
        <p>Please complete your profile details to start buying or selling with full confidence.</p>
      `;
      ctaLink = `${baseUrl}/profile`;
      ctaText = 'Complete Profile';
      break;

    case 'alerta_saude_sistema':
      const levelColors: Record<string, string> = {
        'Saudável': '#22c55e',
        'Atenção': '#eab308',
        'Alerta': '#f97316',
        'Crítico': '#ef4444'
      };
      const alertColor = levelColors[data.currentLevel] || '#6366f1';
      subject = `⚠️ System Health Alert: ${data.currentLevel} (${data.healthPercentage}%)`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Hello ${data.adminName || 'Administrator'},</p>
        <p>The ConnectBoat System Health Monitor has detected a status change.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 6px solid ${alertColor};">
          <p style="margin: 0 0 5px 0; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Current Status</p>
          <h2 style="margin: 0 0 10px 0; font-size: 28px; font-weight: 800; color: ${alertColor};">
            ${data.currentLevel} (${data.healthPercentage}%)
          </h2>
          ${data.previousLevel ? `<p style="margin: 0; font-size: 13px; color: #64748b;">Previous Level: <strong>${data.previousLevel}</strong></p>` : ''}
        </div>

        <h3 style="font-size: 14px; font-weight: bold; margin: 25px 0 10px 0; text-transform: uppercase; letter-spacing: 0.05em; color: #1e293b;">Active Health Alerts:</h3>
        <div style="background-color: #ffffff; border: 1px solid #f1f5f9; border-radius: 8px; font-size: 14px; line-height: 1.5; color: #475569;">
          ${data.alertDetailsString || '<p style="padding: 15px; margin: 0; color: #64748b;">No active alerts at this time.</p>'}
        </div>

        ${data.actionRequired ? `
          <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <strong style="color: #b45309; display: block; margin-bottom: 5px; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">Recommended Action</strong>
            <span style="color: #78350f;">${data.actionRequired}</span>
          </div>
        ` : ''}

        <p style="margin-top: 25px;">Please check the administration health dashboard for full details.</p>
      `;
      ctaLink = `${baseUrl}/admin/health`;
      ctaText = 'Open System Health Dashboard';
      break;

    default:
      subject = `ConnectBoat Notification`;
      bodyContent = `
        <p>You have received a notification from ConnectBoat.</p>
        <p>${JSON.stringify(data)}</p>
      `;
  }

  const html = generateConnectBoatTemplate(subject, bodyContent, ctaLink, ctaText);
  return { subject, html };
}

// Vercel Serverless Module Handler
export default async function handler(req: any, res: any) {
  // CORS setup
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!EMAIL_FLAG_ACTIVE) {
    console.log('[API Email] Automated emails disabled globally via EMAIL_ACTIVE=false.');
    return res.status(200).json({ success: true, message: "Emails disabled globally" });
  }

  try {
    const { template, to, data } = req.body;

    if (!to || !template) {
      return res.status(400).json({ error: "Required parameters 'to' and 'template' are missing." });
    }

    const { subject, html } = renderEmail(template, data);

    const emailFrom = process.env.EMAIL_FROM || 'ConnectBoat <no-reply@connectboat.co.uk>';
    const emailReplyTo = process.env.EMAIL_REPLY_TO || 'contato@connectboat.co.uk';
    const resendApiKey = process.env.RESEND_API_KEY;

    // Send via Resend (Single production email provider for ConnectBoat)
    if (resendApiKey) {
      console.log(`[API Email] Sending real email via Resend to: ${Array.isArray(to) ? to.join(', ') : to}`);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: emailFrom,
          to: Array.isArray(to) ? to : [to],
          subject: subject,
          html: html,
          reply_to: emailReplyTo
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[API Email ERROR] Resend API return error ${response.status}:`, errorText);
        throw new Error(`Resend API Error (${response.status}): ${errorText}`);
      }

      const responseJson = await response.json();
      return res.status(200).json({ success: true, provider: 'resend', id: responseJson.id });
    }

    // Fallback: Console Simulation for local development without API key
    console.log(' ');
    console.log('========================================================================');
    console.log(`✉️ [EMAIL SIMULATION] DISPATCH LOGGED FOR LOCAL DEVELOPMENT`);
    console.log(`   Recipient(s): ${Array.isArray(to) ? to.join(', ') : to}`);
    console.log(`   From:         ${emailFrom}`);
    console.log(`   Reply-To:     ${emailReplyTo}`);
    console.log(`   Subject:      ${subject}`);
    console.log(`   Template:     ${template}`);
    console.log('------------------------------------------------------------------------');
    console.log(`   Payload data:`, JSON.stringify(data, null, 2));
    console.log('========================================================================');
    console.log(' ');

    return res.status(200).json({ 
      success: true, 
      simulated: true, 
      info: "Email simulated successfully in dev environment (RESEND_API_KEY not configured)" 
    });

  } catch (err: any) {
    console.error("[API Email ERROR] Failed to send email:", err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
}

