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
            Last updated: 3 September 2026
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

            <p className="text-slate-600 leading-relaxed mt-3">
              For the purposes of applicable UK data protection law, ConnectBoat is the controller
              of the personal data described in this Privacy Policy. Privacy questions and requests
              may be sent to{' '}
              <a
                href="mailto:contato@connectboat.co.uk"
                className="font-bold text-indigo-600 hover:underline"
              >
                contato@connectboat.co.uk
              </a>
              .
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
                  Telephone and WhatsApp numbers, contact email addresses, contact-method
                  preferences, and information required to send transactional or marketplace
                  communications such as payment confirmations, listing approvals, moderation
                  messages, account-related notices and buyer-to-seller enquiries. Where you choose
                  to make a telephone, WhatsApp or email contact method public on a listing, that
                  contact information may be visible to visitors or registered users.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800 text-sm mb-1">
                  Enquiry and marketplace interaction information
                </p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  When a logged-in user contacts or expresses interest in a listing, we may record
                  information such as the user and listing identifiers, sender name and account email,
                  the contact method used, date and time, seller or listing owner identifier and
                  related notification or delivery information. If you use the internal Email Seller
                  form, we also process the message text you submit in order to deliver it to the
                  listing contact.
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
              <li>Delivering buyer-to-seller enquiries and recording marketplace interest or contact events.</li>
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
                listing, paid plan, Media Boost, requested contact feature or another service you
                ask us to provide.
              </li>
              <li>
                <strong>Legitimate interests:</strong> where reasonably necessary for our
                legitimate interests in operating and improving the marketplace, facilitating and
                evidencing genuine listing enquiries, protecting users and the platform from fraud
                and abuse, maintaining security, enforcing platform rules, moderating content and
                measuring service performance, provided those interests are not overridden by your
                rights and freedoms.
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
            <p className="text-slate-600 leading-relaxed mt-3">
              If a registered user chooses <strong>Email Seller</strong>, ConnectBoat may send the
              enquiry through our email delivery provider to the email address selected by the
              advertiser for that listing. The recipient may receive the sender&apos;s name, authenticated
              account email address, the enquiry message, listing title and a link to the relevant
              listing. This allows the recipient to reply directly to the sender. ConnectBoat does
              not use the contents of a seller enquiry for unrelated advertising.
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
              those technologies will be used in accordance with the user's applicable cookie
              choices and applicable law. More information is available in our{' '}
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
              <h2 className="text-xl font-bold m-0">9. Public Listing Information and Contact Methods</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Information intentionally included in a public listing may be visible to visitors and
              registered users. This can include the listing description, photographs, video,
              approximate location, seller or operator name and contact information that you choose
              or authorise us to display.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              Advertisers can choose which supported contact methods are enabled for a listing,
              including WhatsApp, telephone and email. A method that is not enabled should not be
              presented as a public contact option. Telephone or WhatsApp contact may transfer you
              to a third-party telecommunications or messaging service, whose own privacy terms
              also apply.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              The internal Email Seller feature is different from simply publishing an email link.
              ConnectBoat verifies the logged-in sender, processes the enquiry and forwards it to the
              listing contact using our email delivery infrastructure. We may also create an enquiry
              or interest record linked to the relevant user and listing so that the contact event
              can be supported, notified and, where necessary, investigated.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Globe2 size={20} />
              <h2 className="text-xl font-bold m-0">9A. Referenced, Imported and Claimable Listings</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Some listings may be referenced, imported or prepared from information provided by a
              third party or obtained from a publicly available source, such as an advertiser&apos;s
              website or public listing page. In those cases we may process information such as the
              vessel or service description, business or contact name, public business contact
              details, location, photographs where we have a lawful basis to use them, and the
              original source URL.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              We use this information where reasonably necessary to operate the marketplace,
              identify the source, prevent duplicate imports, maintain listing accuracy and allow
              an owner or authorised representative to request correction, removal or claim a
              listing. Where this information is personal data obtained from another source,
              ConnectBoat will provide privacy information to the individual where required by
              applicable UK data protection law, subject to any lawful exception.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              If you believe a referenced or claimable listing contains your personal data and you
              want it corrected or removed, contact us using the details in section 18.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Target size={20} />
              <h2 className="text-xl font-bold m-0">10. Advertising and Sponsored Content</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              ConnectBoat may display clearly identified sponsored advertising from third-party
              advertisers. We may process information such as advertising impressions, clicks and
              general interaction data to operate, measure, protect and improve advertising features.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              Purchasing advertising on ConnectBoat does not give an advertiser unrestricted access
              to users' personal data. We do not disclose personal data to advertisers merely because
              they advertise on the platform, unless a disclosure is explained to you, is necessary
              for a service you request, or is otherwise permitted or required by law. If you choose
              to click an advertisement or visit an advertiser's external website or service, that
              third party may collect information under its own privacy terms.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Globe2 size={20} />
              <h2 className="text-xl font-bold m-0">11. Service Providers and International Transfers</h2>
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
              <h2 className="text-xl font-bold m-0">12. How Long We Keep Personal Data</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              We keep personal data only for as long as reasonably necessary for the purpose for
              which it was collected, including providing the platform, maintaining an account,
              administering paid services, handling disputes, preventing fraud and meeting legal,
              accounting or regulatory requirements.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              Retention periods may therefore differ by category. For example, an account or listing
              may be removed from public display before related payment, security, moderation,
              enquiry, email-delivery or accounting records are deleted. Sold listings may remain
              publicly visible until their original listing expiry date even though seller contact
              has been disabled. Where an exact period is not fixed, we use criteria such as account
              and listing status, legal requirements, the risk of fraud or disputes and whether the
              information remains necessary for the service.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Scale size={20} />
              <h2 className="text-xl font-bold m-0">13. Your Data Protection Rights</h2>
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
              <h2 className="text-xl font-bold m-0">14. Complaints</h2>
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
              <h2 className="text-xl font-bold m-0">15. Children</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              ConnectBoat is intended for users aged 18 or over and is not directed at children.
              Users must be at least 18 years old to create an account or use services that require
              legal capacity to enter into marketplace or service arrangements. If we become aware
              that personal data has been submitted inappropriately by or about a child, we may take
              reasonable steps to review, restrict or remove it where appropriate.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <UserCheck size={20} />
              <h2 className="text-xl font-bold m-0">16. Automated Decision-Making</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              ConnectBoat does not currently use personal data to make decisions that produce legal
              effects or similarly significant effects based solely on automated processing. We may
              use automated tools to support security, fraud prevention, spam detection, analytics
              or moderation, but significant account or listing decisions may be reviewed by an
              authorised administrator or moderator where appropriate.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Info size={20} />
              <h2 className="text-xl font-bold m-0">17. Changes to this Privacy Policy</h2>
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
              <h2 className="text-xl font-bold m-0">18. Contact</h2>
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
