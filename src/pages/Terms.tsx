import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import { Shield, Info, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { Link } from 'react-router-dom';

const Terms = () => {
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Helmet>
        <title>Terms of Use | ConnectBoat</title>
        <meta
          name="description"
          content="Read the ConnectBoat Terms of Use for boat buyers, sellers, boat hire and charter operators, brokers, marine businesses and service providers."
        />
        <link rel="canonical" href="https://connectboat.co.uk/terms" />
        <meta property="og:url" content="https://connectboat.co.uk/terms" />
        <meta property="og:title" content="Terms of Use | ConnectBoat" />
        <meta
          property="og:description"
          content="Terms governing the use of ConnectBoat, including marine listings, paid listing services, boat sales, hire and charter, moderation and user responsibilities."
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
            <h1 className="text-3xl md:text-4xl font-black text-slate-900">Terms of Use</h1>
            <p className="text-sm text-slate-500 mt-1">
              ConnectBoat Marine Marketplace
            </p>
          </div>
        </div>

        <div className="prose prose-slate max-w-none space-y-8">
          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Info size={20} />
              <h2 className="text-xl font-bold m-0">1. Nature of the Platform</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              ConnectBoat is an online marine marketplace designed to connect buyers, sellers,
              boat owners, boat hire and charter operators, brokers, dealers, marine businesses
              and service providers. Listings may include boats and yachts for sale or hire,
              engines, parts, marine electronics, trailers, accessories, marina-related services
              and other marine products or services.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              Unless expressly stated otherwise, ConnectBoat is not the owner, seller, buyer,
              manufacturer, broker, charter operator, insurer, surveyor, lender, escrow agent or
              delivery provider for items or services advertised by users. ConnectBoat provides
              advertising, discovery and related platform services and is not a party to the
              underlying sale, hire, charter or service agreement made between users.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <CheckCircle size={20} />
              <h2 className="text-xl font-bold m-0">2. Accounts and Eligibility</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Users must provide accurate and current information when creating or maintaining an
              account. You are responsible for safeguarding your login credentials and for activity
              carried out through your account. You must not impersonate another person or business,
              create an account for fraudulent purposes or use the platform in breach of applicable law.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              ConnectBoat may be accessed by users internationally, while the geographic markets in
              which listings may be published are determined by the availability and location options
              offered on the platform from time to time.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Info size={20} />
              <h2 className="text-xl font-bold m-0">3. Listings and Paid Platform Services</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              ConnectBoat may offer paid listing plans, including Standard, Featured and Premium
              options, together with optional extras such as Media Boost. The features, photo limits,
              duration and price applicable to each plan are shown on the Pricing page and during the
              listing and checkout process. The information displayed at the point of purchase forms
              part of the service you order.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              Payment for a listing does not automatically guarantee publication. Paid listings may
              remain pending until they have been reviewed and approved by an authorised ConnectBoat
              administrator or moderator. Where a paid listing is subject to a stated listing period,
              that period begins when the listing is approved and made active, unless the checkout or
              plan description expressly states otherwise.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              Featured or Premium placement increases visibility but does not guarantee enquiries,
              clicks, leads, a sale, a hire booking or any particular commercial result.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              ConnectBoat may also display clearly identified sponsored advertising from third-party
              advertisers within or around listing pages. Sponsored advertising is separate from the
              listing being viewed and does not imply that ConnectBoat endorses the advertiser,
              product or service. Clicking sponsored advertising may take you to an external website
              or service operated by a third party.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <AlertTriangle size={20} />
              <h2 className="text-xl font-bold m-0">4. Payments to ConnectBoat</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Payments made to ConnectBoat are payments for ConnectBoat platform services, such as
              listing plans, enhanced visibility or optional media features. Payment processing may
              be provided by a third-party payment processor such as Stripe and is subject to the
              payment information and conditions shown at checkout.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              These platform-service payments are separate from any payment between users for a boat,
              yacht, hire, charter, deposit, marine product, delivery or third-party service.
              ConnectBoat does not hold purchase money or charter deposits on behalf of users unless
              a specific ConnectBoat service expressly states otherwise.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <AlertTriangle size={20} />
              <h2 className="text-xl font-bold m-0">5. Transactions Between Users</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Negotiations and transactions relating to advertised boats, products, hire, charter or
              marine services take place directly between the relevant users or businesses. Communication
              may take place outside ConnectBoat, including through WhatsApp, telephone, email or
              in-person meetings.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              ConnectBoat does not set or guarantee the transaction price, deposit, delivery terms,
              hire conditions, cancellation terms, warranty, insurance arrangements or payment method
              agreed between users. Each party is responsible for understanding and documenting the
              terms of its own transaction.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <CheckCircle size={20} />
              <h2 className="text-xl font-bold m-0">6. Boat and Yacht Sales</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Buyers should carry out appropriate checks before committing to a purchase. Depending on
              the vessel and transaction, these may include checking the identity and authority of the
              seller, ownership and registration documents, finance or other interests affecting the
              vessel, VAT status, maintenance history, specifications and the physical condition of the
              vessel.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              Where appropriate, users should consider an independent marine survey, sea trial,
              professional inspection and independent legal or financial advice. ConnectBoat does not
              certify seaworthiness, ownership, value, condition or legal title merely because a listing
              appears on the platform.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <CheckCircle size={20} />
              <h2 className="text-xl font-bold m-0">7. Boat Hire and Charter</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Boat hire and charter listings are offered by the relevant owner, operator, broker or
              business identified in the listing. That provider is responsible for the accuracy of the
              offer and for complying with applicable requirements relating to operation, licensing,
              insurance, passenger capacity, skipper or crew arrangements, safety equipment and any
              other legal or regulatory obligations that apply to the service.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              Hirers and charter customers are responsible for reviewing the provider's terms before
              booking, including deposits, cancellation terms, minimum hire periods, skipper
              requirements, fuel arrangements, weather policies and any licence or experience
              requirements. ConnectBoat is not responsible for weather disruption or for the
              performance of a hire or charter supplied by a third party.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <CheckCircle size={20} />
              <h2 className="text-xl font-bold m-0">8. User and Advertiser Responsibilities</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Users and advertisers are responsible for:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Providing accurate, lawful and non-misleading information.</li>
              <li>Keeping prices, availability, location and contact details reasonably up to date.</li>
              <li>Using photographs, videos, logos and descriptions they own or are authorised to use.</li>
              <li>Disclosing material information that a reasonable buyer or hirer should know.</li>
              <li>Complying with applicable tax, consumer, trading, marine and other legal obligations.</li>
              <li>Treating other users fairly and respectfully.</li>
              <li>Protecting their own payment details and avoiding unsafe or unverifiable transactions.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">9. Prohibited Content and Conduct</h2>
            <p className="text-slate-600 leading-relaxed">
              You must not use ConnectBoat to publish or promote fraudulent, deceptive, unlawful,
              stolen, counterfeit or prohibited goods or services; impersonate another person or
              business; infringe intellectual property or privacy rights; distribute malware or spam;
              manipulate platform metrics; or attempt to bypass security, moderation or payment systems.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              Duplicate, misleading, irrelevant or deliberately miscategorised listings may also be
              restricted or removed where reasonably necessary to protect the quality and integrity of
              the marketplace.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">10. Moderation, Approval and Suspension</h2>
            <p className="text-slate-600 leading-relaxed">
              ConnectBoat may review listings and may approve, reject, hide, edit limited presentation
              elements, request corrections, suspend or remove content where reasonably necessary to
              enforce these Terms, protect users, comply with law, respond to substantiated reports or
              maintain the integrity and security of the platform.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              We may also restrict or suspend an account where there is a reasonable basis to suspect
              fraud, abuse, repeated policy breaches, security risks or unlawful activity. Where
              appropriate, we may ask a user to provide information needed to verify an account,
              listing or business.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Shield size={20} />
              <h2 className="text-xl font-bold m-0">11. Safety Recommendations</h2>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 text-amber-900">
              <p className="font-bold mb-2">For your safety, we recommend:</p>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li>Verify the identity and authority of the person or business you are dealing with.</li>
                <li>Avoid sending substantial deposits or purchase funds before appropriate checks are completed.</li>
                <li>Inspect boats, equipment and documents carefully before completing a transaction.</li>
                <li>Use independent surveys or professional advice for significant vessel purchases where appropriate.</li>
                <li>Be cautious of unusually low prices, urgent payment demands or requests to move money through unusual methods.</li>
                <li>For hire or charter, confirm insurance, operator details, cancellation terms and safety arrangements before paying.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">12. Cancellations, Refunds and Consumer Rights</h2>
            <p className="text-slate-600 leading-relaxed">
              Nothing in these Terms removes or limits any statutory rights that apply to you as a
              consumer. Where applicable law gives you a right to cancel a ConnectBoat platform service,
              that right will apply in accordance with the law.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              Requests relating to cancellation, duplicate payment, billing errors or refunds for
              ConnectBoat platform services should be sent to{' '}
              <a
                href="mailto:contato@connectboat.co.uk"
                className="font-bold text-indigo-600 hover:underline"
              >
                contato@connectboat.co.uk
              </a>
              . Any entitlement to a refund will depend on the circumstances, the service supplied and
              applicable consumer law. This section concerns fees paid to ConnectBoat and does not govern
              refunds, deposits or cancellations agreed directly between users for a boat sale, hire,
              charter or third-party service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">13. Intellectual Property</h2>
            <p className="text-slate-600 leading-relaxed">
              ConnectBoat and its branding, software, interface and original platform content are
              protected by applicable intellectual property laws. Users retain ownership of content
              they submit, subject to the rights required for ConnectBoat to host, display, resize,
              reproduce and promote that content for the purpose of operating and marketing the
              relevant listing and the platform.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              By uploading content, you confirm that you have the necessary rights and permissions to
              use it and to allow ConnectBoat to display it for these purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">14. Availability and Limitation of Liability</h2>
            <p className="text-slate-600 leading-relaxed">
              ConnectBoat aims to provide a reliable marketplace but cannot guarantee that the website
              or every feature will always be uninterrupted, error-free or available. We may carry out
              maintenance, updates or security work and may modify platform features where reasonably
              necessary.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              To the fullest extent permitted by applicable law, ConnectBoat is not responsible for
              losses caused by the acts, omissions, misrepresentations or contractual failures of
              independent users or third-party businesses, or for the condition, ownership, legality,
              availability or performance of items and services supplied by them.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              Nothing in these Terms excludes or limits liability where it would be unlawful to do so,
              including liability that cannot lawfully be excluded under applicable consumer law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">15. Privacy, Cookies and Platform Compliance</h2>
            <p className="text-slate-600 leading-relaxed">
              Personal information is handled in accordance with our{' '}
              <Link to="/privacy" className="font-bold text-indigo-600 hover:underline">
                Privacy Policy
              </Link>{' '}
              and information about cookies and similar technologies is provided in our{' '}
              <Link to="/cookies" className="font-bold text-indigo-600 hover:underline">
                Cookie Policy
              </Link>
              .
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              ConnectBoat may request or retain information where reasonably required for security,
              fraud prevention, legal compliance, payment administration or obligations that may apply
              to operators of digital platforms. Where a legal reporting obligation applies, relevant
              information may be processed or disclosed as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">16. Changes to these Terms</h2>
            <p className="text-slate-600 leading-relaxed">
              We may update these Terms to reflect changes to the platform, our services or applicable
              legal requirements. Material changes will apply from the date stated in the updated
              version and, where required, we will provide appropriate notice. Continued use of the
              platform after an updated version takes effect constitutes acceptance of the updated
              Terms to the extent permitted by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">17. Governing Law and Jurisdiction</h2>
            <p className="text-slate-600 leading-relaxed">
              These Terms and ConnectBoat platform services are governed by the laws of England and
              Wales, except where mandatory consumer law provides you with additional rights or
              protections that cannot lawfully be excluded. Nothing in this section prevents a
              consumer from relying on mandatory rights available under the law applicable to them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">18. Contact</h2>
            <p className="text-slate-600 leading-relaxed">
              Questions about these Terms, platform-service payments, complaints or legal matters may
              be sent to{' '}
              <a
                href="mailto:contato@connectboat.co.uk"
                className="font-bold text-indigo-600 hover:underline"
              >
                contato@connectboat.co.uk
              </a>
              .
            </p>
          </section>

          <section className="pt-8 border-t border-slate-100">
            <p className="text-sm text-slate-400">
              These Terms apply to the use of ConnectBoat and to ConnectBoat platform services. Separate
              terms agreed directly between buyers, sellers, owners, charter operators or service
              providers remain the responsibility of those parties.
            </p>
            <p className="text-sm text-slate-400 mt-2">
              Last updated: 27 August 2026.
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

export default Terms;
