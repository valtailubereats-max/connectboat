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
            <p className="text-sm text-slate-500 mt-1">ConnectBoat Marine Marketplace</p>
          </div>
        </div>

        <div className="prose prose-slate max-w-none space-y-8">
          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Info size={20} />
              <h2 className="text-xl font-bold m-0">1. Nature of the Platform</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              ConnectBoat is an online marine marketplace designed to connect buyers, sellers, boat
              owners, boat hire and charter operators, brokers, dealers, marine businesses and service
              providers. Listings may include boats and yachts for sale or hire, engines, parts, marine
              electronics, trailers, accessories, marina-related services and other marine products or
              services.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              ConnectBoat provides advertising, discovery and contact-facilitation services only. Unless
              we expressly confirm otherwise in writing, ConnectBoat is not the owner, seller, buyer,
              manufacturer, broker, charter operator, insurer, surveyor, lender, escrow agent, payment
              intermediary, carrier or delivery provider for items or services advertised by users. We
              are not a party to, and do not negotiate, arrange, control or guarantee, any sale, hire,
              charter or service agreement made between users.
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
              You must be at least 18 years old and have the legal capacity to enter into relevant
              contracts. ConnectBoat may be accessed internationally, while the geographic markets in
              which listings may be published are determined by the availability and location options
              offered on the platform from time to time.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <Info size={20} />
              <h2 className="text-xl font-bold m-0">3. Listings, Free Categories and Paid Platform Services</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              ConnectBoat may charge for listing plans relating to Boats for Sale and Boats for Hire,
              including Standard, Featured and Premium options, together with optional extras such as
              Media Boost or other visibility and media features. The features, photo limits, duration
              and price applicable to each paid service are shown on the Pricing page and during the
              listing and checkout process. The information displayed at the point of purchase forms
              part of the service you order.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              Eligible Marketplace categories, including Boat Parts, Boat Engines, Marine Electronics,
              Trailers, Marinas, Boat Services, Accessories and Wanted, include one free listing per
              registered account. That one-time free listing allows up to three photographs. After the
              free benefit has been used, each additional eligible Marketplace listing is charged at
              the price displayed before publication (currently £1.99 per listing) and also allows up
              to three photographs. The free benefit does not renew when a listing expires or is deleted.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              The one-time free Marketplace benefit is linked to the account and its identifying contact
              information. Users must not create duplicate or misleading accounts, reuse the same contact
              details, or deliberately misclassify a listing in order to obtain additional free listings
              or avoid the applicable boat-listing fee. ConnectBoat may refuse, reclassify, suspend or
              remove listings or accounts used to circumvent this policy.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              Complete boats or yachts offered for sale or hire must be listed only under Boats for Sale
              or Boats for Hire and must use the applicable boat listing plan. Marketplace categories may
              not be used to advertise a complete boat for sale, hire, rent or charter. A genuine Wanted
              listing seeking to buy or find a boat is not treated as a boat-for-sale listing.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              ConnectBoat may also display referenced, imported or claimable listings based on
              information supplied by a user, business, authorised representative or obtained from a
              publicly available source. Where an external source link is shown, the external source
              remains separate from ConnectBoat and should be checked for the latest availability,
              price, specifications and contact information. A referenced or claimable listing does
              not by itself mean that the owner or advertiser has endorsed ConnectBoat or appointed
              ConnectBoat as its agent.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              If you are the owner, operator or authorised representative of a referenced or
              claimable listing, you may contact ConnectBoat to request correction, removal or, where
              the relevant feature is available, to claim and manage the listing. We may request
              reasonable information to verify your authority before transferring control or making
              certain changes.
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
              Each advertiser must accurately state whether they are acting as a private seller or as a
              trader. Traders are responsible for providing all information, pricing, consumer rights,
              cancellation terms, tax information and other disclosures required by law for their
              listings. ConnectBoat may display that status and request supporting information where
              reasonably necessary.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              ConnectBoat may also display clearly identified sponsored advertising from third-party
              advertisers within or around listing pages. Sponsored advertising is separate from the
              listing being viewed and does not imply that ConnectBoat endorses the advertiser, product
              or service. Clicking sponsored advertising may take you to an external website or service
              operated by a third party.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <AlertTriangle size={20} />
              <h2 className="text-xl font-bold m-0">4. Payments to ConnectBoat</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Payments made to ConnectBoat are payments for ConnectBoat platform services, such as
              listing plans, enhanced visibility, advertising or optional media features. Payment
              processing may be provided by a third-party payment processor such as Stripe and is
              subject to the payment information and conditions shown at checkout.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              These platform-service payments are separate from any payment between users for a boat,
              yacht, hire, charter, deposit, marine product, delivery or third-party service. ConnectBoat
              does not hold purchase money or charter deposits on behalf of users unless a specific
              ConnectBoat service expressly states otherwise.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <AlertTriangle size={20} />
              <h2 className="text-xl font-bold m-0">5. Transactions Between Users</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Negotiations and transactions relating to advertised boats, products, hire, charter or
              marine services take place directly between the relevant users or businesses.
              Communication may take place outside ConnectBoat, including through WhatsApp, telephone,
              email or in-person meetings.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              ConnectBoat does not set or guarantee the transaction price, deposit, delivery terms, hire
              conditions, cancellation terms, warranty, insurance arrangements or payment method agreed
              between users. Each party is responsible for understanding and documenting the terms of
              its own transaction.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              A listing appearing on ConnectBoat is not a verification, recommendation, endorsement or
              certification of the advertiser, vessel, product or service. Users are responsible for
              carrying out appropriate checks before sending money, agreeing a contract or taking
              delivery.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              Advertisers may choose which contact methods are made available on a listing, including
              WhatsApp, telephone and email. Where ConnectBoat provides an internal email contact
              form, ConnectBoat acts only as a technical communication channel: the message and the
              sender&apos;s account contact details are forwarded to the listing contact so that the
              parties can communicate directly. ConnectBoat does not become a party to the enquiry or
              any resulting transaction and does not guarantee that a message will be delivered,
              opened or answered.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              ConnectBoat may record that a logged-in user contacted or expressed interest in a
              listing, including the listing, user, contact method and time, for marketplace
              functionality, seller notifications, fraud prevention, support and dispute handling as
              described in the Privacy Policy.
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
              Hirers and charter customers are responsible for reviewing the provider&apos;s terms before
              booking, including deposits, cancellation terms, minimum hire periods, skipper
              requirements, fuel arrangements, weather policies and any licence or experience
              requirements. ConnectBoat is not responsible for weather disruption or for the performance
              of a hire or charter supplied by a third party.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-indigo-600 mb-3">
              <CheckCircle size={20} />
              <h2 className="text-xl font-bold m-0">8. User and Advertiser Responsibilities</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">Users and advertisers are responsible for:</p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Providing accurate, lawful and non-misleading information.</li>
              <li>Keeping prices, availability, location and contact details reasonably up to date.</li>
              <li>Using photographs, videos, logos and descriptions they own or are authorised to use.</li>
              <li>Disclosing material information that a reasonable buyer or hirer should know.</li>
              <li>Complying with applicable tax, consumer, trading, marine and other legal obligations.</li>
              <li>Treating other users fairly and respectfully.</li>
              <li>Protecting their own payment details and avoiding unsafe or unverifiable transactions.</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-3">
              For Boats for Sale, advertisers should mark a listing as sold when the vessel is no
              longer available. A sold listing may remain publicly visible until its original expiry
              date for marketplace continuity, but seller contact options may be disabled while the
              listing is marked sold. If a transaction falls through, the advertiser may reactivate
              the listing only while the original listing period is still valid. Reactivation does
              not extend, restart or replace the original expiry date and does not create a new paid
              listing period.
            </p>
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
              appropriate, we may ask a user to provide information needed to verify an account, listing
              or business.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              Where appropriate and lawful, we will give an affected user the principal reason for a
              removal, restriction or suspension and a reasonable opportunity to request a review. We
              may act without prior notice where this is reasonably necessary for safety, security,
              fraud prevention or legal compliance.
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
              consumer. If you are a consumer and buy a ConnectBoat platform service at a distance, you
              may have a statutory right to cancel the contract within 14 days after it is made, subject
              to applicable exceptions and legal requirements.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              If you expressly ask us to begin providing a service during the cancellation period, we
              may begin the service and, where permitted by law, you may have to pay an amount
              proportionate to the service supplied up to the time you cancel. Where the law permits the
              cancellation right to be lost after full performance, this will only apply where the
              required consent and acknowledgement have been obtained.
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
              . To cancel, please send a clear statement of your decision together with your name and,
              where available, your order or listing reference. Where a refund is legally due, it will
              be made without undue delay and within the period required by applicable law, normally
              using the original payment method unless otherwise agreed. This section concerns fees paid
              to ConnectBoat only; it does not govern refunds, deposits or cancellations agreed directly
              between users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">13. Intellectual Property</h2>
            <p className="text-slate-600 leading-relaxed">
              ConnectBoat and its branding, software, interface and original platform content are
              protected by applicable intellectual property laws. Users retain ownership of content
              they submit. By uploading content, you grant ConnectBoat a non-exclusive, worldwide,
              royalty-free licence to host, reproduce, resize, display and promote that content as
              reasonably necessary to operate and market the relevant listing and the platform.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              By uploading content, you confirm that you have the necessary rights and permissions to
              use it and to allow ConnectBoat to display and process it for these purposes.
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
              availability or performance of items and services supplied by them. We remain responsible
              for foreseeable loss or damage caused by our breach of these Terms or our failure to use
              reasonable care and skill in providing our platform services where applicable law requires
              us to be responsible.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              Nothing in these Terms excludes or limits liability where it would be unlawful to do so,
              including liability for death or personal injury caused by negligence, fraud or fraudulent
              misrepresentation, or liability that cannot lawfully be excluded under applicable consumer
              law.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              If you use ConnectBoat in the course of a business, our total liability to you in connection
              with these Terms or our platform services is limited to the fees you paid to ConnectBoat in
              the 12 months before the event giving rise to the claim. This cap does not apply where it
              would be unlawful to limit liability.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">15. Third-Party Services and Force Majeure</h2>
            <p className="text-slate-600 leading-relaxed">
              The platform may contain links or contact options for third-party services, including
              WhatsApp, telephone networks, email providers, payment providers and external websites.
              Your use of those services is subject to the relevant third party&apos;s terms and privacy
              policy. ConnectBoat does not control or endorse their content, availability or performance.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              We are not liable for delay or failure to perform caused by events beyond our reasonable
              control, including internet or power failures, strikes, natural disasters, government
              action or failures of third-party infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">16. Privacy, Cookies and Platform Compliance</h2>
            <p className="text-slate-600 leading-relaxed">
              Personal information is handled in accordance with our{' '}
              <Link to="/privacy" className="font-bold text-indigo-600 hover:underline">
                Privacy Policy
              </Link>{' '}
              and information about cookies and similar technologies is provided in our{' '}
              <Link to="/cookie-policy" className="font-bold text-indigo-600 hover:underline">
                Cookie Policy
              </Link>
              .
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              ConnectBoat may request, verify or retain information where reasonably required for
              security, fraud prevention, legal compliance, payment administration or obligations that
              may apply to operators of digital platforms. Where a legal reporting obligation applies,
              relevant information may be processed or disclosed as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">17. Changes to these Terms</h2>
            <p className="text-slate-600 leading-relaxed">
              We may update these Terms to reflect changes to the platform, our services or applicable
              legal requirements. Material changes will apply from the date stated in the updated
              version and, where required, we will provide appropriate notice. Continued use of the
              platform after an updated version takes effect constitutes acceptance of the updated Terms
              to the extent permitted by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">18. Governing Law and Jurisdiction</h2>
            <p className="text-slate-600 leading-relaxed">
              These Terms and ConnectBoat platform services are governed by the laws of England and
              Wales, except where mandatory consumer law provides you with additional rights or
              protections that cannot lawfully be excluded. Nothing in this section prevents a consumer
              from relying on mandatory rights available under the law applicable to them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">19. Contact</h2>
            <p className="text-slate-600 leading-relaxed">
              Questions about these Terms, platform-service payments, complaints or legal matters may be
              sent to{' '}
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
            <p className="text-sm text-slate-400 mt-2">Last updated: 3 September 2026.</p>
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
