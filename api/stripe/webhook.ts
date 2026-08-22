import type { Request, Response } from 'express';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { sendEmailDirect } from '../email/send.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const PROJECT_ID = 'navlink-489413';
const DATABASE_ID =
  'ai-studio-boatmarket-b1c69205-2a63-42a8-922c-14b64e4cb382';

const ADMIN_EMAILS = new Set([
  'valtailubereats@gmail.com',
  'valtail@gmail.com',
  'generalsales2021@gmail.com',
  'contato@connectboat.co.uk',
]);

let stripeClient: Stripe | null = null;

function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) return null;

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}

async function sendPaymentEmail(
  toEmail: string,
  userName: string,
  planName: string,
  amountFormatted?: string
) {
  const resendApiKey = process.env.RESEND_API_KEY;

  const emailFrom =
    process.env.EMAIL_FROM ||
    'ConnectBoat <no-reply@connectboat.co.uk>';

  const emailReplyTo =
    process.env.EMAIL_REPLY_TO ||
    'contato@connectboat.co.uk';

  if (!toEmail || !toEmail.includes('@')) return;

  if (resendApiKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },

        body: JSON.stringify({
          from: emailFrom,
          to: [toEmail],
          subject: `ðŸ’³ Payment Confirmed: ${planName}`,
          reply_to: emailReplyTo,

          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
              <div style="background-color:#0f172a;padding:24px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;font-size:22px;">â›µ ConnectBoat</h1>
                <p style="margin:4px 0 0 0;color:#38bdf8;font-size:12px;font-weight:600;text-transform:uppercase;">
                  UK Boat & Marine Marketplace
                </p>
              </div>

              <div style="padding:30px;color:#334155;">
                <p style="font-size:16px;font-weight:bold;margin-top:0;">
                  Hello ${userName || 'Valued Member'},
                </p>

                <p>
                  We have received your payment for
                  <strong>${planName}</strong>.
                </p>

                ${
                  amountFormatted
                    ? `
                  <p style="background:#f0fdf4;border:1px solid #bbf7d0;padding:12px;border-radius:6px;color:#166534;font-weight:bold;">
                    Amount Paid: ${amountFormatted}
                  </p>
                `
                    : ''
                }

                <p>
                  Your subscription features are now fully active on ConnectBoat.
                </p>

                <hr style="border:0;border-top:1px solid #e2e8f0;margin:25px 0;">

                <p style="font-size:12px;color:#64748b;margin:0;">
                  If you have any questions, please write to us at
                  <a href="mailto:contato@connectboat.co.uk" style="color:#0284c7;">
                    contato@connectboat.co.uk
                  </a>.
                </p>
              </div>
            </div>
          `,
        }),
      });

      console.log(
        `[Stripe Webhook Email] Sent payment confirmation email to ${toEmail}`
      );
    } catch (err) {
      console.warn(
        `[Stripe Webhook Email Error] Failed to send receipt:`,
        err
      );
    }
  }
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function getAssistedCustomerEmail(adData: any): string {
  const candidates = [
    adData?.contactEmail,
    adData?.sellerEmail,
    adData?.userEmail,
    adData?.email,
  ];

  for (const candidate of candidates) {
    const email = normalizeEmail(candidate);

    if (
      email &&
      email.includes('@') &&
      !ADMIN_EMAILS.has(email)
    ) {
      return email;
    }
  }

  return '';
}

let dbInstance: admin.firestore.Firestore | null = null;

function getAdminDb(): admin.firestore.Firestore {
  const firebaseAdmin = (admin as any).default || admin;

  if (!dbInstance) {
    const apps = firebaseAdmin.apps || [];

    if (!apps.length) {
      const serviceAccountJson =
        process.env.FIREBASE_SERVICE_ACCOUNT;

      if (serviceAccountJson) {
        try {
          let serviceAccount;

          try {
            serviceAccount =
              JSON.parse(serviceAccountJson);
          } catch (e) {
            const decoded = Buffer.from(
              serviceAccountJson,
              'base64'
            ).toString('utf-8');

            serviceAccount =
              JSON.parse(decoded);
          }

          firebaseAdmin.initializeApp({
            credential:
              firebaseAdmin.credential.cert(
                serviceAccount
              ),

            projectId: PROJECT_ID,
          });
        } catch (e: any) {
          console.error(
            `[Stripe Webhook getAdminDb] Service Account init failed: ${e.message}. Falling back to default app init.`
          );

          firebaseAdmin.initializeApp({
            projectId: PROJECT_ID,
          });
        }
      } else {
        firebaseAdmin.initializeApp({
          projectId: PROJECT_ID,
        });
      }
    }

    dbInstance = firebaseAdmin.firestore();

    if (DATABASE_ID) {
      try {
        dbInstance.settings({
          databaseId: DATABASE_ID,
        });
      } catch (e) {
        // Settings already applied
      }
    }
  }

  return dbInstance!;
}

function getAdminBucket() {
  const firebaseAdmin =
    (admin as any).default || admin;

  getAdminDb();

  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    'navlink-489413.firebasestorage.app';

  return firebaseAdmin
    .storage()
    .bucket(bucketName);
}

async function finalizeTempVideoStorage(
  adId: string,
  adData: any
) {
  const tempPath =
    adData?.tempVideoPath ||
    (
      adData?.videoStoragePath?.startsWith(
        'temporary-listing-videos/'
      )
        ? adData.videoStoragePath
        : null
    );

  if (!tempPath) {
    console.log(
      `[Stripe Webhook Media Boost] No temporary video path found for ad ${adId}`
    );

    return null;
  }

  try {
    const bucket =
      getAdminBucket();

    const tempFile =
      bucket.file(tempPath);

    const [exists] =
      await tempFile.exists();

    if (!exists) {
      console.warn(
        `[Stripe Webhook Media Boost] Temp file ${tempPath} does not exist in bucket`
      );

      return null;
    }

    const fileName =
      tempPath.split('/').pop() ||
      `video_${Date.now()}.mp4`;

    const userId =
      adData.sellerId ||
      adData.userId ||
      'user';

    const permPath =
      `listing-videos/${userId}/${adId}/${fileName}`;

    const permFile =
      bucket.file(permPath);

    console.log(
      `[Stripe Webhook Media Boost] Copying temp video ${tempPath} -> permanent ${permPath}`
    );

    await tempFile.copy(permFile);

    try {
      await permFile.makePublic();
    } catch (e) {
      console.warn(
        `[Stripe Webhook Media Boost] makePublic note:`,
        e
      );
    }

    await tempFile
      .delete({
        ignoreNotFound: true,
      })
      .catch((e) =>
        console.warn(
          `[Stripe Webhook Media Boost] Could not delete temp file:`,
          e
        )
      );

    const encodedPath =
      encodeURIComponent(permPath);

    const permUrl =
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media`;

    const firebaseAdmin =
      (admin as any).default || admin;

    return {
      videoUrl: permUrl,
      videoStoragePath: permPath,
      videoPaid: true,
      mediaBoostEnabled: true,
      mediaBoostPrice: 2.0,

      tempVideoPath:
        firebaseAdmin.firestore.FieldValue.delete(),

      tempVideoUrl:
        firebaseAdmin.firestore.FieldValue.delete(),
    };
  } catch (err) {
    console.error(
      `[Stripe Webhook Media Boost Error] Failed to finalize video storage for ad ${adId}:`,
      err
    );

    return null;
  }
}

async function cleanupTempVideoForAd(
  adId: string
) {
  try {
    const db =
      getAdminDb();

    const adDoc =
      await db
        .collection('ads')
        .doc(adId)
        .get();

    if (!adDoc.exists) return;

    const adData =
      adDoc.data() || {};

    if (adData.videoPaid) {
      console.log(
        `[Stripe Webhook Cleanup] Ad ${adId} video is already paid. Skipping cleanup.`
      );

      return;
    }

    const tempPath =
      adData.tempVideoPath ||
      (
        adData.videoStoragePath?.startsWith(
          'temporary-listing-videos/'
        )
          ? adData.videoStoragePath
          : null
      );

    if (tempPath) {
      const bucket =
        getAdminBucket();

      await bucket
        .file(tempPath)
        .delete({
          ignoreNotFound: true,
        })
        .catch(() => {});

      console.log(
        `[Stripe Webhook Cleanup] Deleted temporary video ${tempPath} for unpaid/cancelled ad ${adId}`
      );

      const firebaseAdmin =
        (admin as any).default || admin;

      await db
        .collection('ads')
        .doc(adId)
        .update({
          mediaBoostEnabled: false,

          videoUrl:
            firebaseAdmin.firestore.FieldValue.delete(),

          videoStoragePath:
            firebaseAdmin.firestore.FieldValue.delete(),

          tempVideoPath:
            firebaseAdmin.firestore.FieldValue.delete(),

          tempVideoUrl:
            firebaseAdmin.firestore.FieldValue.delete(),
        })
        .catch(() => {});
    }
  } catch (err) {
    console.error(
      `[Stripe Webhook Cleanup Error] for ad ${adId}:`,
      err
    );
  }
}

async function cleanupAbandonedTempVideos() {
  try {
    const bucket =
      getAdminBucket();

    const [files] =
      await bucket.getFiles({
        prefix:
          'temporary-listing-videos/',
      });

    const now =
      Date.now();

    const TWO_HOURS_MS =
      2 * 60 * 60 * 1000;

    for (const file of files) {
      try {
        const [metadata] =
          await file.getMetadata();

        const createdTime =
          new Date(
            metadata.timeCreated
          ).getTime();

        if (
          now - createdTime >
          TWO_HOURS_MS
        ) {
          console.log(
            `[Temp Video Sweeper] Deleting abandoned temporary video: ${file.name} (created ${metadata.timeCreated})`
          );

          await file
            .delete({
              ignoreNotFound: true,
            })
            .catch(() => {});
        }
      } catch (e) {
        // ignored
      }
    }
  } catch (e) {
    // ignored
  }
}

async function getRawBody(
  req: Request
): Promise<Buffer> {
  if (
    (req as any).rawBody &&
    Buffer.isBuffer(
      (req as any).rawBody
    )
  ) {
    return (req as any).rawBody;
  }

  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }

  return new Promise(
    (resolve, reject) => {
      const chunks: Buffer[] = [];

      req.on(
        'data',
        (chunk: Buffer) => {
          chunks.push(
            Buffer.isBuffer(chunk)
              ? chunk
              : Buffer.from(chunk)
          );
        }
      );

      req.on('end', () => {
        resolve(
          Buffer.concat(chunks)
        );
      });

      req.on(
        'error',
        (err) => {
          reject(err);
        }
      );
    }
  );
}

export default async function stripeWebhookHandler(
  req: Request & {
    rawBody?: Buffer;
  },
  res: Response
) {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .send('Method Not Allowed');
  }

  const stripe =
    getStripe();

  const webhookSecret =
    process.env.STRIPE_WEBHOOK_SECRET;

  const sig =
    req.headers['stripe-signature'];

  if (!stripe) {
    return res
      .status(500)
      .send(
        'Stripe is not configured'
      );
  }

  if (!webhookSecret) {
    return res
      .status(500)
      .send(
        'Webhook secret is not configured'
      );
  }

  if (!sig) {
    return res
      .status(400)
      .send(
        'Missing stripe-signature header'
      );
  }

  let rawBody: Buffer;

  try {
    rawBody =
      await getRawBody(req);
  } catch (err: any) {
    console.error(
      `[Stripe Webhook Read Error]: ${err.message}`
    );

    return res
      .status(400)
      .send(
        `Error reading request body: ${err.message}`
      );
  }

  let event: Stripe.Event;

  try {
    event =
      stripe.webhooks.constructEvent(
        rawBody,
        sig,
        webhookSecret
      );
  } catch (err: any) {
    console.error(
      `[Stripe Webhook Verification Error]: ${err.message}`
    );

    return res
      .status(400)
      .send(
        `Webhook Signature Verification Error: ${err.message}`
      );
  }

  if (
    event &&
    event.type ===
      'checkout.session.completed'
  ) {
    const session =
      event.data.object as Stripe.Checkout.Session;

    const metadata =
      session.metadata || {};

    const {
      itemType,
      adId,
      userId,
      plan,
      showcaseDataJson,
      paymentFlow,
    } = metadata;

    try {
      const db =
        getAdminDb();

      if (
        itemType ===
          'featured_ad' ||
        itemType ===
          'ad_listing' ||
        itemType ===
          'ad_promotion'
      ) {
        if (!adId) {
          console.error(
            `[Stripe Webhook Error] itemType is '${itemType}' but adId is missing from metadata!`
          );
        } else {
          const thirtyDaysFromNow =
            new Date(
              Date.now() +
                30 *
                  24 *
                  60 *
                  60 *
                  1000
            );

          const activePlan =
            (
              plan || 'standard'
            ).toLowerCase();

          let level =
            'standard';

          let isFeatured =
            false;

          if (
            activePlan ===
            'premium'
          ) {
            level =
              'premium';

            isFeatured =
              true;
          } else if (
            activePlan ===
              'featured' ||
            activePlan ===
              'national' ||
            activePlan ===
              'local'
          ) {
            level =
              activePlan ===
              'national'
                ? 'national'
                : 'featured';

            isFeatured =
              true;
          } else {
            level =
              'standard';

            isFeatured =
              false;
          }

          const firebaseAdmin =
            (admin as any)
              .default || admin;

          const isMediaBoostPaid =
            metadata.mediaBoostEnabled ===
              'true' ||
            metadata.mediaBoostEnabled ===
              '1';

          const adDoc =
            await db
              .collection('ads')
              .doc(adId)
              .get();

          const adData =
            adDoc.data() || {};

          const isAdminAssisted =
            paymentFlow ===
            'admin_assisted';

          const updatePayload: Record<
            string,
            any
          > = isAdminAssisted
            ? {
                plan: activePlan,

                paymentStatus:
                  'paid',

                paymentFlow:
                  'admin_assisted',

                paymentSource:
                  'admin_assisted',

                awaitingAdminActivation:
                  true,

                paidAt:
                  firebaseAdmin.firestore.FieldValue.serverTimestamp(),

                stripeCheckoutSessionId:
                  session.id,

                stripePaymentIntentId:
                  typeof session.payment_intent ===
                  'string'
                    ? session.payment_intent
                    : session
                        .payment_intent
                        ?.id || null,
              }
            : {
                plan:
                  activePlan,

                // Normal customer checkout: payment confirms the listing, but
                // moderation is still required before it becomes public.
                status:
                  adData.status === 'approved' ? 'approved' : 'pending',

                adStatus:
                  adData.status === 'approved' ? (adData.adStatus || 'active') : 'pending',

                paymentStatus:
                  'paid',

                paymentFlow:
                  'standard_checkout',

                paymentSource:
                  'stripe_checkout',

                awaitingAdminApproval:
                  adData.status === 'approved' ? false : true,

                paidAt:
                  adData.paidAt || firebaseAdmin.firestore.FieldValue.serverTimestamp(),

                stripeCheckoutSessionId:
                  session.id,

                stripePaymentIntentId:
                  typeof session.payment_intent ===
                  'string'
                    ? session.payment_intent
                    : session
                        .payment_intent
                        ?.id || null,
              };

          if (
            !isAdminAssisted &&
            (
              isMediaBoostPaid ||
              adData.mediaBoostEnabled ||
              adData.tempVideoPath
            )
          ) {
            const videoUpdates =
              await finalizeTempVideoStorage(
                adId,
                adData
              );

            if (videoUpdates) {
              Object.assign(
                updatePayload,
                videoUpdates
              );
            } else {
              updatePayload.mediaBoostEnabled =
                true;

              updatePayload.videoPaid =
                true;

              updatePayload.mediaBoostPrice =
                2.0;
            }
          }

          await db
            .collection('ads')
            .doc(adId)
            .set(
              updatePayload,
              {
                merge: true,
              }
            );

          if (isAdminAssisted) {
            console.log(
              `[Stripe Webhook] Assisted payment confirmed for ad ${adId}. Listing remains pending and awaits admin activation.`
            );

            if (
              !adData.assistedPaymentAdminEmailSent
            ) {
              try {
                const adminEmail =
                  process.env.ADMIN_NOTIFICATION_EMAIL ||
                  'contato@connectboat.co.uk';

                const resendApiKey =
                  process.env.RESEND_API_KEY;

                const emailFrom =
                  process.env.EMAIL_FROM ||
                  'ConnectBoat <no-reply@connectboat.co.uk>';

                const emailReplyTo =
                  process.env.EMAIL_REPLY_TO ||
                  'contato@connectboat.co.uk';

                const amountPaid =
                  session.amount_total !=
                  null
                    ? `Â£${(
                        session.amount_total /
                        100
                      ).toFixed(2)}`
                    : 'Paid';

                const planLabel =
                  activePlan ===
                  'premium'
                    ? 'Premium Featured'
                    : activePlan ===
                      'featured'
                    ? 'Featured Listing'
                    : 'Standard Listing';

                if (resendApiKey) {
                  const response =
                    await fetch(
                      'https://api.resend.com/emails',
                      {
                        method:
                          'POST',

                        headers: {
                          'Content-Type':
                            'application/json',

                          Authorization:
                            `Bearer ${resendApiKey}`,
                        },

                        body:
                          JSON.stringify({
                            from:
                              emailFrom,

                            to: [
                              adminEmail,
                            ],

                            reply_to:
                              emailReplyTo,

                            subject:
                              `ðŸ’³ Assisted Payment Received â€” ${
                                adData.title ||
                                adId
                              }`,

                            html: `
                              <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
                                <h2 style="color:#0f172a;">
                                  ConnectBoat Assisted Payment
                                </h2>

                                <p>
                                  A customer has completed an assisted listing payment.
                                </p>

                                <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:18px;margin:20px 0;">
                                  <p>
                                    <strong>Listing:</strong>
                                    ${
                                      adData.title ||
                                      'Untitled listing'
                                    }
                                  </p>

                                  <p>
                                    <strong>Ad ID:</strong>
                                    ${adId}
                                  </p>

                                  <p>
                                    <strong>Plan:</strong>
                                    ${planLabel}
                                  </p>

                                  <p>
                                    <strong>Amount:</strong>
                                    ${amountPaid}
                                  </p>

                                  <p>
                                    <strong>Status:</strong>
                                    Paid / Awaiting Admin Activation
                                  </p>
                                </div>

                                <p>
                                  The listing has NOT been published automatically.
                                  Open Admin Ads and use
                                  <strong>Approve</strong>
                                  when you are ready to activate it.
                                </p>

                                <p>
                                  <a
                                    href="https://connectboat.co.uk/admin/ads"
                                    style="display:inline-block;background:#0f172a;color:#ffffff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold;"
                                  >
                                    Open Admin Ads
                                  </a>
                                </p>
                              </div>
                            `,
                          }),
                      }
                    );

                  if (
                    !response.ok
                  ) {
                    const responseText =
                      await response.text();

                    throw new Error(
                      `Resend error ${response.status}: ${responseText}`
                    );
                  }

                  await db
                    .collection(
                      'ads'
                    )
                    .doc(adId)
                    .update({
                      assistedPaymentAdminEmailSent:
                        true,

                      assistedPaymentAdminEmailSentAt:
                        firebaseAdmin.firestore.FieldValue.serverTimestamp(),
                    });

                  console.log(
                    `[Stripe Webhook] Assisted payment admin notification sent to ${adminEmail}`
                  );
                } else {
                  console.warn(
                    '[Stripe Webhook] RESEND_API_KEY missing. Assisted payment admin email was not sent.'
                  );
                }
              } catch (
                adminEmailErr
              ) {
                console.error(
                  '[Stripe Webhook] Failed to send assisted payment admin notification:',
                  adminEmailErr
                );
              }
            }

            const assistedCustomerEmail =
              getAssistedCustomerEmail(adData);

            if (
              assistedCustomerEmail &&
              !adData.assistedPaymentCustomerEmailSent
            ) {
              try {
                const resendApiKey =
                  process.env.RESEND_API_KEY;

                const emailFrom =
                  process.env.EMAIL_FROM ||
                  'ConnectBoat <no-reply@connectboat.co.uk>';

                const emailReplyTo =
                  process.env.EMAIL_REPLY_TO ||
                  'contato@connectboat.co.uk';

                const amountPaid =
                  session.amount_total != null
                    ? `Â£${(
                        session.amount_total /
                        100
                      ).toFixed(2)}`
                    : 'Paid';

                const planLabel =
                  activePlan === 'premium'
                    ? 'Premium Featured'
                    : activePlan === 'featured'
                    ? 'Featured Listing'
                    : 'Standard Listing';

                if (resendApiKey) {
                  const response =
                    await fetch(
                      'https://api.resend.com/emails',
                      {
                        method: 'POST',

                        headers: {
                          'Content-Type':
                            'application/json',
                          Authorization:
                            `Bearer ${resendApiKey}`,
                        },

                        body: JSON.stringify({
                          from: emailFrom,
                          to: [assistedCustomerEmail],
                          reply_to: emailReplyTo,

                          subject:
                            `Payment received â€” ${adData.title || 'your ConnectBoat listing'}`,

                          html: `
                            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#334155;">
                              <div style="background:#0f172a;padding:24px;text-align:center;border-radius:12px 12px 0 0;">
                                <h2 style="margin:0;color:#ffffff;">â›µ ConnectBoat</h2>
                              </div>

                              <div style="border:1px solid #e2e8f0;border-top:0;padding:28px;border-radius:0 0 12px 12px;">
                                <p>
                                  Hello ${adData.sellerName || 'Advertiser'},
                                </p>

                                <p>
                                  We have received the payment for your listing:
                                </p>

                                <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:16px;margin:18px 0;">
                                  <p><strong>Listing:</strong> ${adData.title || 'Untitled listing'}</p>
                                  <p><strong>Plan:</strong> ${planLabel}</p>
                                  <p><strong>Amount paid:</strong> ${amountPaid}</p>
                                  <p><strong>Status:</strong> Paid / Awaiting Admin Approval</p>
                                </div>

                                <p>
                                  Your payment was completed successfully.
                                  The listing is now awaiting final review and activation by the ConnectBoat administrator.
                                </p>

                                <p>
                                  You will receive another email when the listing is approved and published.
                                </p>

                                <p style="font-size:12px;color:#64748b;margin-top:28px;">
                                  Questions? Contact us at
                                  <a href="mailto:contato@connectboat.co.uk">contato@connectboat.co.uk</a>.
                                </p>
                              </div>
                            </div>
                          `,
                        }),
                      }
                    );

                  if (!response.ok) {
                    const responseText =
                      await response.text();

                    throw new Error(
                      `Resend error ${response.status}: ${responseText}`
                    );
                  }

                  await db
                    .collection('ads')
                    .doc(adId)
                    .update({
                      assistedPaymentCustomerEmailSent:
                        true,

                      assistedPaymentCustomerEmail:
                        assistedCustomerEmail,

                      assistedPaymentCustomerEmailSentAt:
                        firebaseAdmin.firestore.FieldValue.serverTimestamp(),
                    });

                  console.log(
                    `[Stripe Webhook] Assisted payment customer notification sent to ${assistedCustomerEmail}`
                  );
                }
              } catch (
                customerEmailErr
              ) {
                console.error(
                  '[Stripe Webhook] Failed to send assisted payment customer notification:',
                  customerEmailErr
                );
              }
            } else if (!assistedCustomerEmail) {
              console.log(
                `[Stripe Webhook] Assisted payment for ad ${adId}: no customer email different from admin email was found.`
              );
            }
          } else {
            console.log(
              `[Stripe Webhook] Payment confirmed for ad ${adId} on plan ${activePlan}. Listing remains pending until admin/moderator approval.`
            );
          }

          if (isAdminAssisted) {
            console.log(
              `[Stripe Webhook Email] Assisted payment for ad ${adId}: skipping normal activation receipt until admin approval.`
            );
          } else {
            const customerEmail =
              session.customer_details
                ?.email ||
              session.customer_email ||
              adData.sellerEmail ||
              adData.email;

            const isAlreadySent =
              adData.paymentConfirmationEmailSent ===
                true &&
              adData.stripeCheckoutSessionId ===
                session.id;

            if (isAlreadySent) {
              console.log(
                `[Stripe Webhook Email] Email already sent for session ${session.id} (Ad ${adId}). Skipping duplicate dispatch.`
              );
            } else if (
              customerEmail
            ) {
              const isHire =
                adData.category ===
                  'aluguel' ||
                adData.listingType ===
                  'hire' ||
                adData.type ===
                  'hire';

              const currencySymbol =
                session.currency?.toUpperCase() ===
                'EUR'
                  ? 'â‚¬'
                  : 'Â£';

              const hasMediaBoost =
                isMediaBoostPaid ||
                !!adData.mediaBoostEnabled;

              let planTitle =
                'Standard Listing';

              let fallbackPlanPrice = 4.99;

              if (
                activePlan ===
                'premium'
              ) {
                planTitle =
                  'Premium Featured Listing';

                fallbackPlanPrice = 12.99;
              } else if (
                activePlan ===
                  'featured' ||
                activePlan ===
                  'national' ||
                activePlan ===
                  'local'
              ) {
                planTitle =
                  'Featured Listing';

                fallbackPlanPrice = 7.99;
              }

              const actualTotalNumeric =
                typeof session.amount_total === 'number'
                  ? session.amount_total / 100
                  : null;

              const actualPlanNumeric =
                actualTotalNumeric !== null
                  ? Math.max(
                      0,
                      actualTotalNumeric -
                        (hasMediaBoost ? 2.0 : 0)
                    )
                  : fallbackPlanPrice;

              const planPrice =
                `${currencySymbol}${actualPlanNumeric.toFixed(2)}`;

              const totalAmountFormatted =
                actualTotalNumeric !== null
                  ? `${currencySymbol}${actualTotalNumeric.toFixed(2)}`
                  : `${currencySymbol}${(
                      fallbackPlanPrice +
                      (hasMediaBoost ? 2.0 : 0)
                    ).toFixed(2)}`;

              let baseUrl =
                process.env.PUBLIC_SITE_URL ||
                process.env.SITE_URL ||
                'https://www.connectboat.co.uk';

              baseUrl =
                baseUrl.replace(
                  /\/$/,
                  ''
                );

              const emailPayload = {
                userName:
                  session
                    .customer_details
                    ?.name ||
                  adData.sellerName ||
                  'Valued Advertiser',

                adTitle:
                  adData.title ||
                  'Boat Listing',

                adId,

                listingType:
                  isHire
                    ? 'Boat for Hire'
                    : 'Boat for Sale',

                planTitle,

                planPrice,

                hasMediaBoost,

                mediaBoostPrice:
                  `${currencySymbol}2.00`,

                totalAmount:
                  totalAmountFormatted,

                paymentDate:
                  new Date().toLocaleDateString(
                    'en-GB',
                    {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute:
                        '2-digit',
                    }
                  ),

                awaitingApproval:
                  adData.status !== 'approved',

                expiryDate:
                  adData.status === 'approved' && adData.expirationDate?.toDate
                    ? adData.expirationDate.toDate().toLocaleDateString(
                        'en-GB',
                        {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        }
                      )
                    : 'Starts 30 days from approval',

                paymentRef:
                  session.id ||
                  session.payment_intent ||
                  adId,

                adUrl:
                  `${baseUrl}/anuncio/${adId}`,

                manageUrl:
                  `${baseUrl}/profile`,
              };

              try {
                await sendEmailDirect(
                  customerEmail,
                  'recibo_pagamento_anuncio',
                  emailPayload
                );

                console.log(
                  `[Stripe Webhook Email] Sent itemized receipt email to ${customerEmail} for ad ${adId}`
                );

                await db
                  .collection(
                    'ads'
                  )
                  .doc(adId)
                  .update({
                    stripeCheckoutSessionId:
                      session.id,

                    paymentConfirmationEmailSent:
                      true,

                    paymentConfirmationEmailStatus:
                      'sent',

                    paymentConfirmationEmailSentAt:
                      firebaseAdmin.firestore.FieldValue.serverTimestamp(),

                    paymentConfirmationEmailError:
                      null,
                  })
                  .catch((e) =>
                    console.warn(
                      `[Stripe Webhook Email] Note on updating email sent status in Firestore:`,
                      e
                    )
                  );
              } catch (
                emailErr: any
              ) {
                console.error(
                  `[Stripe Webhook Email ERROR] Failed sending receipt to ${customerEmail} for ad ${adId}:`,
                  emailErr
                );

                await db
                  .collection(
                    'ads'
                  )
                  .doc(adId)
                  .update({
                    stripeCheckoutSessionId:
                      session.id,

                    paymentConfirmationEmailStatus:
                      'failed',

                    paymentConfirmationEmailError:
                      emailErr?.message ||
                      String(
                        emailErr
                      ),

                    paymentConfirmationEmailLastAttemptAt:
                      firebaseAdmin.firestore.FieldValue.serverTimestamp(),
                  })
                  .catch((e) =>
                    console.warn(
                      `[Stripe Webhook Email] Note on recording email failure in Firestore:`,
                      e
                    )
                  );
              }
            } else {
              console.warn(
                `[Stripe Webhook Email Warning] No customer email available for session ${session.id} (Ad ${adId}). Record email status as not_sent.`
              );

              await db
                .collection('ads')
                .doc(adId)
                .update({
                  stripeCheckoutSessionId:
                    session.id,

                  paymentConfirmationEmailStatus:
                    'no_email_provided',
                })
                .catch(() => {});
            }
          }
        }
      } else if (
        itemType ===
          'digital_showcase' &&
        userId
      ) {
        let showcaseData: any =
          {};

        if (
          showcaseDataJson
        ) {
          try {
            showcaseData =
              JSON.parse(
                showcaseDataJson
              );
          } catch (e) {
            console.warn(
              '[Stripe Webhook] Failed to parse showcaseDataJson metadata',
              e
            );
          }
        }

        const userFields: Record<
          string,
          any
        > = {
          showcasePaid: true,
          showcasePlan:
            'premium',
          showcaseActive:
            true,
        };

        if (
          showcaseData.showcaseName
        ) {
          userFields.showcaseName =
            showcaseData.showcaseName;
        }

        if (
          showcaseData.showcaseSlug
        ) {
          userFields.showcaseSlug =
            showcaseData.showcaseSlug;
        }

        if (
          showcaseData.country
        ) {
          userFields.country =
            showcaseData.country;
        }

        if (
          showcaseData.city
        ) {
          userFields.city =
            showcaseData.city;
        }

        await db
          .collection('users')
          .doc(userId)
          .set(
            userFields,
            {
              merge: true,
            }
          );

        console.log(
          `[Stripe Webhook] Successfully updated user ${userId} for digital showcase`
        );

        const sellerProfileFields: Record<
          string,
          any
        > = {
          ...userFields,
          showcaseApproved:
            true,
        };

        if (
          showcaseData.showcaseCategory
        ) {
          sellerProfileFields.showcaseCategory =
            showcaseData.showcaseCategory;
        }

        if (
          showcaseData.showcaseLogo
        ) {
          sellerProfileFields.showcaseLogo =
            showcaseData.showcaseLogo;
        }

        if (
          showcaseData.showcaseCover
        ) {
          sellerProfileFields.showcaseCover =
            showcaseData.showcaseCover;
        }

        if (
          showcaseData.showcaseDescription
        ) {
          sellerProfileFields.showcaseDescription =
            showcaseData.showcaseDescription;
        }

        if (
          showcaseData.showcaseWhatsapp
        ) {
          sellerProfileFields.showcaseWhatsapp =
            showcaseData.showcaseWhatsapp;
        }

        if (
          showcaseData.showcaseFacebook
        ) {
          sellerProfileFields.showcaseFacebook =
            showcaseData.showcaseFacebook;
        }

        if (
          showcaseData.showcaseInstagram
        ) {
          sellerProfileFields.showcaseInstagram =
            showcaseData.showcaseInstagram;
        }

        await db
          .collection(
            'sellerPublicProfiles'
          )
          .doc(userId)
          .set(
            sellerProfileFields,
            {
              merge: true,
            }
          );

        console.log(
          `[Stripe Webhook] Successfully updated sellerPublicProfile ${userId} for digital showcase`
        );
      }
    } catch (err: any) {
      console.error(
        `[Stripe Webhook Fulfillment Error]: ${err.message}`,
        err
      );

      return res
        .status(500)
        .send(
          `Firestore update failed: ${err.message}`
        );
    }
  } else if (
    event &&
    (
      event.type ===
        'checkout.session.expired' ||
      event.type ===
        'payment_intent.payment_failed'
    )
  ) {
    const session =
      event.data.object as any;

    const adId =
      session?.metadata?.adId;

    if (adId) {
      console.log(
        `[Stripe Webhook] Session expired or payment failed for ad ${adId}. Cleaning up temporary video...`
      );

      await cleanupTempVideoForAd(
        adId
      );
    }
  }

  cleanupAbandonedTempVideos().catch(
    () => {}
  );

  return res
    .status(200)
    .json({
      received: true,
    });
}
