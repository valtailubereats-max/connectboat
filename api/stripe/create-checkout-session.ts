import type { Request, Response } from 'express';
import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is missing.');
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

export default async function createCheckoutSessionHandler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const {
      itemType,
      plan,
      country,
      currency: requestedCurrency,
      userId,
      userEmail,
      adId,
      showcaseData,
      selectedAddOns,
      mediaBoostEnabled,
      successUrl,
      cancelUrl
    } = req.body || {};

    if (!itemType) {
      return res.status(400).json({ success: false, error: 'Missing required itemType' });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return res.status(400).json({
        success: false,
        error: 'STRIPE_NOT_CONFIGURED',
        errorMessage: 'Stripe Secret Key (STRIPE_SECRET_KEY) is not configured in environment variables.'
      });
    }

    const stripe = getStripe();

    // Determine currency: default GBP for UK, EUR for Portugal & rest
    const isUK = country === 'Reino Unido' || country === 'United Kingdom' || requestedCurrency?.toLowerCase() === 'gbp';
    const currency = isUK ? 'gbp' : 'eur';
    const currencySymbol = isUK ? '£' : '€';

    let productName = '';
    let productDescription = '';
    let amountCents = 299;

    // Calculate base plan price
    const activePlan = (plan || 'standard').toLowerCase();
    if (activePlan === 'premium') {
      amountCents = 999;
      productName = 'ConnectBoat - Premium Featured Listing';
      productDescription = `30-day top priority exposure & premium badge (${currencySymbol}9.99) for listing ${adId ? '#' + adId : ''}`.trim();
    } else if (activePlan === 'featured' || activePlan === 'national' || activePlan === 'local') {
      amountCents = 499;
      productName = 'ConnectBoat - Featured Listing';
      productDescription = `30-day homepage highlight & featured badge (${currencySymbol}4.99) for listing ${adId ? '#' + adId : ''}`.trim();
    } else if (activePlan === 'standard' || activePlan === 'free') {
      amountCents = 299;
      productName = 'ConnectBoat - Standard Listing';
      productDescription = `30-day active listing (${currencySymbol}2.99) for listing ${adId ? '#' + adId : ''}`.trim();
    } else if (itemType === 'digital_showcase') {
      amountCents = 899;
      const name = showcaseData?.showcaseName || 'Business Showcase';
      productName = `ConnectBoat - Digital Showcase (${name})`;
      productDescription = `Monthly Digital Showcase subscription (${currencySymbol}8.99/month)`;
    } else {
      amountCents = 299;
      productName = 'ConnectBoat - Standard Listing';
      productDescription = `30-day active listing (${currencySymbol}2.99)`;
    }

    // Add optional add-ons calculation if provided
    let addOnsExtraCents = 0;
    if (Array.isArray(selectedAddOns) && selectedAddOns.length > 0) {
      selectedAddOns.forEach((addon: any) => {
        if (typeof addon === 'object' && addon.price) {
          addOnsExtraCents += Math.round(Number(addon.price) * 100);
        }
      });
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency,
          product_data: {
            name: productName,
            description: productDescription,
          },
          unit_amount: amountCents + addOnsExtraCents,
        },
        quantity: 1,
      },
    ];

    const hasMediaBoost = !!mediaBoostEnabled;
    if (hasMediaBoost) {
      lineItems.push({
        price_data: {
          currency,
          product_data: {
            name: 'Media Boost — 60-second listing video',
            description: `Optional paid extra (${currencySymbol}2.00) to showcase video on listing`,
          },
          unit_amount: 200,
        },
        quantity: 1,
      });
    }

    const metadata: Record<string, string> = {
      itemType: String(itemType),
      userId: String(userId || ''),
      adId: String(adId || ''),
      plan: String(activePlan),
      country: String(country || ''),
      mediaBoostEnabled: hasMediaBoost ? 'true' : 'false',
    };

    if (Array.isArray(selectedAddOns) && selectedAddOns.length > 0) {
      metadata.addOnsJson = JSON.stringify(selectedAddOns);
    }

    if (showcaseData) {
      try {
        metadata.showcaseDataJson = JSON.stringify(showcaseData);
      } catch (e) {
        console.warn('[Stripe Session] Failed to stringify showcaseData', e);
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: userEmail && typeof userEmail === 'string' && userEmail.includes('@') ? userEmail : undefined,
      line_items: lineItems,
      automatic_tax: {
        enabled: false,
      },
      metadata,
      success_url: successUrl || `${req.headers.origin || 'http://localhost:3000'}?stripe_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.headers.origin || 'http://localhost:3000'}?stripe_cancel=true`,
    });

    return res.status(200).json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error('[Stripe create-checkout-session Error]:', err);
    return res.status(500).json({
      success: false,
      error: 'STRIPE_ERROR',
      errorMessage: err.message || 'Error creating Stripe checkout session'
    });
  }
}
