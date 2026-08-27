import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import {
  Shield,
  Info,
  Database,
  Target,
  Lock,
  Scale,
  Cookie,
  CreditCard,
  Mail,
  Globe2,
  Clock3,
  UserCheck,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Privacy = () => {
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Helmet>
        <title>Privacy Policy | ConnectBoat</title>
        <meta
          name="description"
          content="Read the ConnectBoat Privacy Policy and learn how we handle account, listing, payment, communication, analytics and security data."
        />
        <link rel="canonical" href="https://connectboat.co.uk/privacy" />
        <meta property="og:url" content="https://connectboat.co.uk/privacy" />
        <meta property="og:title" content="Privacy Policy | ConnectBoat" />
        <meta
          property="og:description"
          content="How ConnectBoat collects, uses, stores and protects personal data across our marine marketplace."
        />
        <meta property="og:image" content="https://connectboat.co.uk/api/og-image" />
        <meta name="twitter:image" content="https://connectboat.co.uk/api/og-image" />
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2rem] p-8 md:p-12 shadow-xl border border-slate-100 relative"
      >
        <Link
          to="/"
          className="absolute top-6 right-6 md:top-8 md:right-8 text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-50 rounded-full border border-slate-100 shadow-sm"
          title="Close and return to home page"
        >
          <X size={20} />
        </Link>

        <div className="flex items-center gap-4 mb-8 pr-12">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0">
            <Shield size={28} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900">
              Privacy Policy
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              ConnectBoat Marine Marketplace
            </p>
          </div>
        </div>

        <div className="prose prose-slate max-w-none space-y-8">
          <p className="text-sm font-semibold text-indigo-600">
            Last updated: 27 August 2026
          </p>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Info size={20} />
              <h2 className="text-xl font-bold m-0">1. Introduction</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              ConnectBoat respects your privacy and is committed to handling personal data
              responsibly. This Privacy Policy explains what information we collect, why we use
              it, who may process it on our behalf, how long we keep it and the rights available
              to you when you use the ConnectBoat marine marketplace.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              This policy applies to visitors, registered users, advertisers, boat owners,
              buyers, sellers, hire and charter operators, marine businesses, service providers
              and other people who interact with ConnectBoat.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Database size={20} />
              <h2 className="text-xl font-bold m-0">2. Personal Data We May Collect</h2>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800 text-sm mb-1">
                  Account and profile information
                </p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Name, email address, profile photograph, telephone number, selected international
                  dialling code, country or market information, account identifiers and information
                  you choose to add to your profile.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800 text-sm mb-1">
                  Listing and marine marketplace information
                </p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Listing titles, descriptions, prices, category, region, city or town, boat and
                  equipment specifications, hire or charter information, seller or operator details,
                  photographs, videos, Media Boost content and other information submitted when
                  creating or editing a listing.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800 text-sm mb-1">
                  Contact and communication information
                </p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Telephone numbers, customer email addresses used for assisted listings, contact
                  preferences and information required to send transactional emails such as payment
                  confirmations, listing approvals, moderation messages and account-related notices.
                  Where a listing contains a telephone number or WhatsApp contact option, that
                  information may be visible to other users as part of the listing.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800 text-sm mb-1">
                  Payment and transaction-related information
                </p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  We may receive and store payment-related references such as the listing plan,
                  amount, payment status, Stripe Checkout Session ID, Stripe Payment Intent ID,
                  payment date and transaction status. ConnectBoat does not need to store your full
                  card number or card security code in order to provide its listing services.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800 text-sm mb-1">
                  Technical, usage and security information
                </p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Device and browser information, page visits, approximate technical location
                  derived from network information, IP-related logs where available, login and
                  authentication events, listing views, sponsored-advertising impressions and clicks,
                  interactions with contact or communication buttons, other interaction counters,
                  error logs, security events and diagnostic information used to operate, measure and
                  protect the platform.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800 text-sm mb-1">
                  Information provided to moderators or support
                </p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Reports, complaints, support requests, evidence supplied in connection with a
                  listing or account, and information used to investigate suspected fraud, abuse,
                  impersonation, security issues or policy breaches.
                </p>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Target size={20} />
              <h2 className="text-xl font-bold m-0">3. Why We Use Personal Data</h2>
            </div>

            <p className="text-slate-600 leading-relaxed mb-3">
              We may use personal data for the following purposes:
            </p>

            <ul className="list-disc pl-6 text-slate-600 space-y-2 text-sm leading-relaxed">
              <li>Creating, authenticating and maintaining user accounts.</li>
              <li>Publishing, displaying, editing and managing marine listings.</li>
              <li>Allowing buyers, sellers, owners, hirers and marine businesses to connect.</li>
              <li>Processing ConnectBoat listing plans, upgrades and optional paid services.</li>
              <li>Sending transactional and service-related emails.</li>
              <li>Reviewing and moderating listings before or after publication.</li>
              <li>Detecting, investigating and preventing fraud, abuse and security incidents.</li>
              <li>Providing customer support and responding to complaints or requests.</li>
              <li>Measuring platform usage and improving performance, usability and reliability.</li>
              <li>Maintaining records required for accounting, legal, regulatory or dispute purposes.</li>
              <li>Complying with obligations that may apply to ConnectBoat as a digital platform operator.</li>
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Scale size={20} />
              <h2 className="text-xl font-bold m-0">4. Lawful Bases for Processing</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Depending on the activity, ConnectBoat may rely on one or more lawful bases under
              UK data protection law:
            </p>

            <ul className="list-disc pl-6 text-slate-600 space-y-2 text-sm leading-relaxed mt-3">
              <li>
                <strong>Contract:</strong> where processing is necessary to provide an account,
                listing, paid plan, Media Boost or another service you request.
              </li>
              <li>
                <strong>Legitimate interests:</strong> where reasonably necessary to operate,
                secure, moderate, improve and protect the marketplace, prevent fraud and understand
                how the service is used, provided those interests are not overridden by your rights.
              </li>
              <li>
                <strong>Legal obligation:</strong> where information must be retained, processed or
                disclosed to comply with applicable law, tax, accounting, regulatory or lawful
                authority requirements.
              </li>
              <li>
                <strong>Consent:</strong> where the law requires consent, for example for certain
                optional cookies or similar technologies, or another activity that specifically
                asks for your consent.
              </li>
            </ul>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <CreditCard size={20} />
              <h2 className="text-xl font-bold m-0">5. Payments and Stripe</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              ConnectBoat uses Stripe to process payments for listing plans and optional paid
              platform services. Payment card information entered during Stripe Checkout is
              processed by Stripe under Stripe's own privacy and security arrangements.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              ConnectBoat may receive transaction references and payment status information from
              Stripe so that we can confirm payment, link the payment to the correct listing,
              issue service-related emails, prevent duplicate charges and maintain appropriate
              accounting and support records.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Mail size={20} />
              <h2 className="text-xl font-bold m-0">6. Transactional Emails and Resend</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              ConnectBoat may use an email delivery provider such as Resend to send transactional
              messages. These may include payment confirmations, listing approval or rejection
              notices, assisted-payment notifications, account-related messages and other essential
              service communications.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              Information provided to an email delivery provider is limited to what is reasonably
              necessary to send and administer the relevant message, such as the recipient email
              address, message content and delivery information.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Lock size={20} />
              <h2 className="text-xl font-bold m-0">7. Firebase, Hosting and Data Security</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              ConnectBoat uses Google Firebase services for functions including authentication,
              database storage and file storage. Listing photographs and video content may be stored
              using Firebase Storage, while account and listing records may be stored in Firestore.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              We use reasonable technical and organisational measures designed to protect personal
              data against unauthorised access, loss, alteration or disclosure. These measures may
              include authentication controls, access restrictions, server-side verification,
              security rules, encrypted network connections and administrative access controls.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              No online service can guarantee absolute security. Users should protect their login
              credentials, use trusted devices where possible and contact us if they believe their
              account has been compromised.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Cookie size={20} />
              <h2 className="text-xl font-bold m-0">8. Cookies, Browser Storage and Google Analytics</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              ConnectBoat uses cookies, local browser storage and similar technologies where needed
              to support authentication, remember settings, maintain platform functionality and
              improve the user experience.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              ConnectBoat also uses Google Analytics 4 to help understand how visitors use the
              website, including page visits and general interaction patterns. Google Analytics may
              use cookies, browser storage, device information and related technical identifiers.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              Where applicable law requires consent for optional analytics or similar technologies,
              those technologies should be used in accordance with the user's applicable cookie
              choices. More information is available in our{' '}
              <Link
                to="/cookie-policy"
                className="font-bold text-indigo-600 hover:underline"
              >
                Cookie Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <UserCheck size={20} />
              <h2 className="text-xl font-bold m-0">9. Public Listing Information and WhatsApp</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Information intentionally included in a public listing may be visible to visitors and
              registered users. This can include the listing description, photographs, video,
              approximate location, seller or operator name and contact information that you choose
              or authorise us to display.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              Where a WhatsApp or telephone contact option is available, selecting it may transfer
              you to a third-party service. Your use of WhatsApp or another external communication
              provider is also subject to that provider's own privacy terms.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Globe2 size={20} />
              <h2 className="text-xl font-bold m-0">10. Service Providers and International Transfers</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              ConnectBoat may use trusted service providers to operate the platform, including
              providers of cloud hosting and database services, authentication, payment processing,
              email delivery, analytics, security and technical infrastructure. Current examples
              include Google/Firebase, Stripe, Resend and Google Analytics.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              Some service providers may process data in countries outside the United Kingdom.
              Where UK data protection law applies to an international transfer, ConnectBoat will
              rely on an appropriate lawful transfer mechanism or safeguard where required.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Clock3 size={20} />
              <h2 className="text-xl font-bold m-0">11. How Long We Keep Personal Data</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              We keep personal data only for as long as reasonably necessary for the purpose for
              which it was collected, including providing the platform, maintaining an account,
              administering paid services, handling disputes, preventing fraud and meeting legal,
              accounting or regulatory requirements.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              Retention periods may therefore differ by category. For example, an account or listing
              may be removed from public display before related payment, security, moderation or
              accounting records are deleted. Where an exact period is not fixed, we use criteria
              such as account status, legal requirements, the risk of fraud or disputes and whether
              the information remains necessary for the service.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Scale size={20} />
              <h2 className="text-xl font-bold m-0">12. Your Data Protection Rights</h2>
            </div>

            <p className="text-slate-600 leading-relaxed mb-3">
              Depending on the circumstances and the lawful basis used, you may have rights including:
            </p>

            <ul className="list-disc pl-6 text-slate-600 space-y-2 text-sm leading-relaxed">
              <li>The right to access personal data held about you.</li>
              <li>The right to request correction of inaccurate or incomplete data.</li>
              <li>The right to request deletion of personal data in applicable circumstances.</li>
              <li>The right to request restriction of processing in applicable circumstances.</li>
              <li>The right to object to certain processing, including processing based on legitimate interests.</li>
              <li>The right to data portability where the legal conditions are met.</li>
              <li>The right to withdraw consent at any time where processing relies on consent.</li>
            </ul>

            <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
              <p className="font-bold text-indigo-900 text-sm mb-1">
                Your right to object
              </p>
              <p className="text-indigo-800 text-sm leading-relaxed">
                Where ConnectBoat relies on legitimate interests, you may have the right to object
                to that processing. We will consider the circumstances and stop the processing where
                required by law.
              </p>
            </div>

            <p className="text-slate-600 leading-relaxed mt-4">
              To exercise a privacy right, contact{' '}
              <a
                href="mailto:contato@connectboat.co.uk"
                className="font-bold text-indigo-600 hover:underline"
              >
                contato@connectboat.co.uk
              </a>
              . We may need to verify your identity before completing a request.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Shield size={20} />
              <h2 className="text-xl font-bold m-0">13. Complaints</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              If you have concerns about how ConnectBoat handles your personal data, please contact
              us first so that we can review the matter.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              You may also have the right to lodge a complaint with the Information Commissioner's
              Office (ICO), the United Kingdom's data protection supervisory authority, or with
              another competent supervisory authority where applicable.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Info size={20} />
              <h2 className="text-xl font-bold m-0">14. Children</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              ConnectBoat is a marine marketplace intended for people capable of entering into
              relevant marketplace and service arrangements. The platform is not designed as a
              service directed specifically at children. If we become aware that personal data has
              been submitted inappropriately by or about a child, we may take reasonable steps to
              review or remove it where appropriate.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Info size={20} />
              <h2 className="text-xl font-bold m-0">15. Changes to this Privacy Policy</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              We may update this Privacy Policy to reflect changes to ConnectBoat, our service
              providers, technology or legal requirements. The latest version will be published on
              this page with an updated date. Where a change is material and additional notice is
              required by law, we will take reasonable steps to provide that notice.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Mail size={20} />
              <h2 className="text-xl font-bold m-0">16. Contact</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              For questions about this Privacy Policy, requests relating to your personal data or
              privacy concerns, contact:
            </p>

            <p className="text-slate-800 font-bold mt-3">
              ConnectBoat
              <br />
              <a
                href="mailto:contato@connectboat.co.uk"
                className="text-indigo-600 hover:underline"
              >
                contato@connectboat.co.uk
              </a>
            </p>
          </section>

          <section className="pt-8 border-t border-slate-100">
            <p className="text-sm text-slate-400 leading-relaxed">
              This Privacy Policy should be read together with our{' '}
              <Link to="/terms" className="font-semibold text-indigo-500 hover:underline">
                Terms of Use
              </Link>{' '}
              and{' '}
              <Link to="/cookie-policy" className="font-semibold text-indigo-500 hover:underline">
                Cookie Policy
              </Link>
              .
            </p>
          </section>

          <div className="pt-6 border-t border-slate-100 flex justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center bg-[#52b64d] hover:bg-[#459d41] text-white font-extrabold px-8 py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all gap-2"
            >
              <X size={18} />
              Close and Return to Home
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Privacy;
