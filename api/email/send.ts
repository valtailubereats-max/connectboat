// Serverless Email Service for ConnectBoat

const EMAIL_FLAG_ACTIVE = process.env.EMAIL_ACTIVE !== 'false';

// Helper para gerar o template HTML com design unificado
function generateLusoTemplate(title: string, bodyContent: string, ctaLink?: string, ctaText?: string): string {
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
                    Need help or have questions? Contact our customer support team through our official portal.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr style="background-color: #f1f5f9;">
                <td style="padding: 20px; text-align: center; color: #64748b; font-size: 12px;">
                  <p style="margin: 0 0 6px 0; font-weight: 700;"> ConnectBoat </p>
                  <p style="margin: 0;"> United Kingdom </p>
                  <p style="margin: 12px 0 0 0; font-size: 10px; color: #94a3b8;">
                    This is an automated notification email. Please do not reply directly to this message.
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

// Renderizador dos templates específicos
function renderEmail(template: string, data: any): { subject: string; html: string } {
  let subject = '';
  let bodyContent = '';
  let ctaLink: string | undefined;
  let ctaText: string | undefined;

  // Centralized URL resolve: prioritizes PUBLIC_SITE_URL, SITE_URL or APP_URL.
  // Never uses temporary Vercel URLs in production; only allows fallback to Vercel URLs in non-production.
  let resolvedUrl = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || process.env.APP_URL;

  if (!resolvedUrl) {
    if (process.env.NODE_ENV !== 'production' && process.env.VERCEL_URL) {
      resolvedUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      resolvedUrl = 'https://www.mercado-luso.com';
    }
  }

  // Strip trailing slash if present
  const baseUrl = resolvedUrl.replace(/\/$/, '');

  switch (template) {
    case 'anuncio_aprovado':
      subject = `✅ Seu anúncio no Mercado Luso foi aprovado!`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Olá ${data.sellerName || 'Utilizador'},</p>
        <p>Temos o prazer de informar que o seu anúncio <strong>"${data.adTitle}"</strong> foi revisto e <strong>aprovado</strong> pela nossa equipa de moderação!</p>
        <p>O anúncio já se encontra totalmente ativo e disponível para visualização e contacto de interessados no Mercado Luso.</p>
        <p>Desejamos-lhe ótimas vendas e excelentes negócios.</p>
      `;
      ctaLink = `${baseUrl}/anuncio/${data.adId}`;
      ctaText = 'Ver meu Anúncio';
      break;

    case 'anuncio_rejeitado':
      subject = `❌ Atualização sobre o seu anúncio no Mercado Luso`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Olá ${data.sellerName || 'Utilizador'},</p>
        <p>Agradecemos o envio do seu anúncio ao Mercado Luso. No entanto, o seu anúncio <strong>"${data.adTitle}"</strong> não pôde ser aprovado neste momento.</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <strong style="color: #991b1b; display: block; margin-bottom: 5px;">Motivo da Rejeição:</strong>
          <span style="color: #7f1d1d;">${data.reason || 'O anúncio não cumpre as nossas diretrizes gerais.'}</span>
        </div>
        <p>Recomendamos que reveja as nossas regras de publicação e efetue as edições necessárias para que o anúncio seja aprovado no futuro.</p>
      `;
      ctaLink = `${baseUrl}/profile`;
      ctaText = 'Ir para o meu Perfil';
      break;

    case 'anuncio_pendente_staff':
      subject = `⚠️ NOVO ANÚNCIO PENDENTE: ${data.adTitle || 'Classificado'}`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Olá Moderador,</p>
        <p>Um novo anúncio foi publicado com status de <strong>pendente</strong> e requer a sua revisão e moderação.</p>
        <table border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 15px; border-radius: 6px; width: 100%; margin: 20px 0;">
          <tr>
            <td style="padding: 4px 0;"><strong>Anúncio:</strong></td>
            <td style="padding: 4px 0;">${data.adTitle}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0;"><strong>Anunciante:</strong></td>
            <td style="padding: 4px 0;">${data.sellerName}</td>
          </tr>
        </table>
        <p>Por favor, aceda à secção de moderação no painel de administração o mais brevemente possível para validar este anúncio.</p>
      `;
      ctaLink = `${baseUrl}/admin/ads`;
      ctaText = 'Ir para Painel de Moderação';
      break;

    case 'interesse_contacto':
      subject = `👥 Novo clique de contacto no seu anúncio: ${data.adTitle}`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Olá ${data.sellerName || 'Utilizador'},</p>
        <p>Existem excelentes notícias!</p>
        <p>Um potencial comprador demonstrou vivo interesse no seu anúncio <strong>"${data.adTitle}"</strong>.</p>
        <p>O utilizador <strong>${data.interestedName}</strong> clicou no botão para estabelecer contacto de WhatsApp consigo.</p>
        <p>Se o comprador ainda não lhe enviou uma mensagem, mantenha-se atento à sua aplicação móvel para responder com prontidão!</p>
      `;
      ctaLink = `${baseUrl}/anuncio/${data.adId}`;
      ctaText = 'Visualizar o Anúncio';
      break;

    case 'review_recebida':
      subject = `⭐️ Recebeu uma nova avaliação no Mercado Luso!`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Olá ${data.sellerName || 'Utilizador'},</p>
        <p>O utilizador <strong>${data.reviewerName}</strong> deixou-lhe uma nova avaliação pública pelo negócio do seu anúncio <strong>"${data.adTitle}"</strong>.</p>
        <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
          <div style="font-size: 24px; color: #fbbf24; margin-bottom: 8px;">
            ${'★'.repeat(Math.min(5, Math.max(1, data.rating)))}
          </div>
          <p style="margin: 0; font-style: italic; color: #451a03; font-size: 16px;">
            "${data.comment || 'Sem comentário preenchido.'}"
          </p>
        </div>
        <p>Avaliações positivas ajudam a construir confiança de novos compradores. Continue o excelente trabalho!</p>
      `;
      ctaLink = `${baseUrl}/profile`;
      ctaText = 'Ir para a minha Conta';
      break;

    case 'compra_concluida':
      subject = `🎉 Venda marcada como concluída com sucesso!`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Olá ${data.sellerName || 'Utilizador'},</p>
        <p>Muitos parabéns pelo fecho do seu negócio!</p>
        <p>O seu anúncio <strong>"${data.adTitle}"</strong> foi marcado como vendido com sucesso para o comprador <strong>${data.buyerName}</strong>.</p>
        <p>Agradecemos sinceramente a escolha do Mercado Luso como plataforma oficial para publicar os seus classificados e apoiar a nossa comunidade.</p>
      `;
      ctaLink = `${baseUrl}/profile`;
      ctaText = 'Gerir outros Anúncios';
      break;

    case 'boas_vindas':
      subject = `👋 Bem-vindo ao Mercado Luso!`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Seja muito bem-vindo, ${data.userName}!</p>
        <p>A sua conta foi registada com sucesso no <strong>Mercado Luso</strong>, o portal preferido de anúncios classificados das comunidades lusófonas em Portugal e no Reino Unido.</p>
        <p>Aqui poderá:</p>
        <ul style="padding-left: 20px; margin: 15px 0;">
          <li>Publicar anúncios de forma totalmente rápida e gratuita.</li>
          <li>Consultar imóveis, vagas de emprego, automóveis, assistência legal/imigração e muito mais.</li>
          <li>Negociar segurança e diretamente pelo WhatsApp de outros utilizadores.</li>
        </ul>
        <p>Por favor, complete as informações do seu perfil para iniciar as suas publicações com segurança reforçada.</p>
      `;
      ctaLink = `${baseUrl}/profile`;
      ctaText = 'Configurar meu Perfil';
      break;

    case 'alerta_saude_sistema':
      const levelColors: Record<string, string> = {
        'Saudável': '#22c55e',
        'Atenção': '#eab308',
        'Alerta': '#f97316',
        'Crítico': '#ef4444'
      };
      const alertColor = levelColors[data.currentLevel] || '#6366f1';
      subject = `⚠️ Alerta de Saúde do Sistema: ${data.currentLevel} (${data.healthPercentage}%)`;
      bodyContent = `
        <p style="font-size: 16px; font-weight: bold; margin-top: 0;">Olá ${data.adminName || 'Administrador'},</p>
        <p>O Monitor de Saúde do Sistema detetou uma alteração nos sinais vitais da aplicação.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 6px solid ${alertColor};">
          <p style="margin: 0 0 5px 0; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">Estado Geral</p>
          <h2 style="margin: 0 0 10px 0; font-size: 28px; font-weight: 800; color: ${alertColor};">
            ${data.currentLevel} (${data.healthPercentage}%)
          </h2>
          ${data.previousLevel ? `<p style="margin: 0; font-size: 13px; color: #64748b;">Nível anterior: <strong>${data.previousLevel}</strong></p>` : ''}
        </div>

        <h3 style="font-size: 14px; font-weight: bold; margin: 25px 0 10px 0; text-transform: uppercase; letter-spacing: 0.05em; color: #1e293b;">Alertas Ativos Encontrados:</h3>
        <div style="background-color: #ffffff; border: 1px solid #f1f5f9; border-radius: 8px; font-size: 14px; line-height: 1.5; color: #475569;">
          ${data.alertDetailsString || '<p style="padding: 15px; margin: 0; color: #64748b;">Nenhum alerta ativo de momento.</p>'}
        </div>

        ${data.actionRequired ? `
          <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <strong style="color: #b45309; display: block; margin-bottom: 5px; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">Ação Recomendada</strong>
            <span style="color: #78350f;">${data.actionRequired}</span>
          </div>
        ` : ''}

        <p style="margin-top: 25px;">Por favor, examine o painel de saúde do sistema no painel administrativo para obter detalhes e resolver as ocorrências.</p>
      `;
      ctaLink = `${baseUrl}/admin/health`;
      ctaText = 'Abrir Monitor de Saúde';
      break;

    default:
      subject = `Notificação Automática Mercado Luso`;
      bodyContent = `
        <p>Recebeu uma nova notificação do Mercado Luso.</p>
        <p>${JSON.stringify(data)}</p>
      `;
  }

  const html = generateLusoTemplate(subject, bodyContent, ctaLink, ctaText);
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

  // Se o envio geral estiver desligado
  if (!EMAIL_FLAG_ACTIVE) {
    console.log('[API Email] O envio automático de e-mails está desativado globalmente através do EMAIL_ACTIVE=false.');
    return res.status(200).json({ success: true, message: "Emails disabled globally" });
  }

  try {
    const { template, to, data } = req.body;

    if (!to || !template) {
      return res.status(400).json({ error: "Parâmetros 'to' e 'template' obrigatórios." });
    }

    const { subject, html } = renderEmail(template, data);

    const emailFrom = process.env.EMAIL_FROM || 'no-reply@mercadoluso.com';
    const resendApiKey = process.env.RESEND_API_KEY;
    const sendgridApiKey = process.env.SENDGRID_API_KEY;

    // 1. Enviar através de RESEND se configurado
    if (resendApiKey) {
      console.log(`[API Email] Enviando email via Resend para: ${to}`);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: emailFrom,
          to: to,
          subject: subject,
          html: html
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Resend API Error: ${response.status} - ${errorText}`);
      }

      const responseJson = await response.json();
      return res.status(200).json({ success: true, provider: 'resend', id: responseJson.id });
    }

    // 2. Enviar através de SENDGRID se configurado
    if (sendgridApiKey) {
      console.log(`[API Email] Enviando email via SendGrid para: ${to}`);
      const recipients = Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }];
      
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sendgridApiKey}`
        },
        body: JSON.stringify({
          personalizations: [{ to: recipients }],
          from: { email: emailFrom, name: 'Mercado Luso' },
          subject: subject,
          content: [{ type: 'text/html', value: html }]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SendGrid API Error: ${response.status} - ${errorText}`);
      }

      return res.status(200).json({ success: true, provider: 'sendgrid' });
    }

    // 3. Fallback: Simulação no Console com Log Limpo e Detalhado
    console.log(' ');
    console.log('========================================================================');
    console.log(`✉️ [SIMULAÇÃO DE EMAIL] ENVIADO COM SUCESSO COPIADO PARA DESENVOLVIMENTO`);
    console.log(`   Destinatário(s): ${Array.isArray(to) ? to.join(', ') : to}`);
    console.log(`   Remetente:      ${emailFrom}`);
    console.log(`   Assunto:        ${subject}`);
    console.log(`   Template:       ${template}`);
    console.log('------------------------------------------------------------------------');
    console.log(`   Mapeado dinamicamente com dados:`, JSON.stringify(data, null, 2));
    console.log('========================================================================');
    console.log(' ');

    return res.status(200).json({ 
      success: true, 
      simulated: true, 
      info: "Email simulado e logado em desenvolvimento com sucesso (sem chave API configurada)" 
    });

  } catch (err: any) {
    console.error("[API Email ERROR] Falhou o envio de email:", err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
}
