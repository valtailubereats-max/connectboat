import React from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import {
  Shield,
  Info,
  Cookie,
  Settings,
  ShieldAlert,
  CheckCircle,
  BarChart3,
  Database,
  Mail,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Cookies = () => {
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Helmet>
        <title>Cookie Policy | ConnectBoat</title>
        <meta
          name="description"
          content="Read the ConnectBoat Cookie Policy and learn how we use cookies, browser storage and analytics technologies across our marine marketplace."
        />
        <link rel="canonical" href="https://connectboat.co.uk/cookie-policy" />
        <meta property="og:url" content="https://connectboat.co.uk/cookie-policy" />
        <meta property="og:title" content="Cookie Policy | ConnectBoat" />
        <meta
          property="og:description"
          content="How ConnectBoat uses essential technologies, browser storage and Google Analytics 4 across the marine marketplace."
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
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
            <Cookie size={28} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900">
              Cookie Policy
            </h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">
              ConnectBoat Marine Marketplace
            </p>
          </div>
        </div>

        <div className="prose prose-slate max-w-none space-y-8">
          <p className="text-sm font-semibold text-emerald-600">
            Last updated: 27 August 2026
          </p>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <Info size={20} />
              <h2 className="text-xl font-bold m-0">
                1. What Are Cookies and Similar Technologies?
              </h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Cookies are small text files that a website may place on your computer, phone or
              other device. They can help a website operate correctly, remember settings, support
              authentication and understand how visitors use the service.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              ConnectBoat may also use browser storage and similar technologies, including local
              storage or session storage. These technologies are not always technically cookies,
              but they may perform similar functions, such as remembering preferences or supporting
              platform functionality. In this policy, references to cookies may also include these
              similar technologies where appropriate.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <Settings size={20} />
              <h2 className="text-xl font-bold m-0">2. How ConnectBoat Uses Cookies</h2>
            </div>

            <p className="text-slate-600 leading-relaxed font-semibold mb-3">
              ConnectBoat uses cookies and similar technologies for different purposes:
            </p>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-extrabold text-slate-800 text-sm mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Strictly Necessary Technologies
                </p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  These are used where necessary for core website functions, account security,
                  authentication, session handling, fraud prevention, navigation and other
                  functionality required to provide the service you request. Disabling or blocking
                  these technologies may prevent parts of ConnectBoat from working correctly.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-extrabold text-slate-800 text-sm mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Preference and Browser Storage
                </p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  These technologies may remember choices such as selected settings, interface
                  preferences, search state or other information that helps provide a more
                  convenient experience when you use ConnectBoat.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-extrabold text-slate-800 text-sm mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  Analytics and Performance Technologies
                </p>
                <p className="text-slate-600 text-sm leading-relaxed">
                  These technologies help us understand how the platform is used, which pages are
                  visited, general interaction patterns and technical performance. We use this
                  information to improve usability, diagnose issues and understand the performance
                  of ConnectBoat.
                </p>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <BarChart3 size={20} />
              <h2 className="text-xl font-bold m-0">3. Google Analytics 4</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              ConnectBoat uses Google Analytics 4 (GA4) to help us understand how visitors use the
              website. Google Analytics may process information such as page visits, interaction
              events, device and browser information, approximate location derived from technical
              information and related identifiers.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              Google Analytics may use cookies or similar technologies to provide measurement and
              reporting services. We do not describe this information as completely anonymous,
              because analytics technologies may use technical identifiers and other usage data.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              Where applicable law requires consent before optional analytics technologies are
              stored or accessed on your device, ConnectBoat will treat those technologies as
              non-essential and they should be used in accordance with the cookie choices made
              available to you.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <Database size={20} />
              <h2 className="text-xl font-bold m-0">4. Firebase and Essential Platform Services</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              ConnectBoat uses Google Firebase services for functions including authentication,
              Firestore database services and file storage. These services may use technical
              identifiers, local browser storage or other technologies where necessary to support
              login, security, data synchronisation and platform operation.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              Technologies that are genuinely required to provide a service requested by the user
              are treated separately from optional analytics technologies.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <ShieldAlert size={20} />
              <h2 className="text-xl font-bold m-0">5. Third-Party Services</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Some technologies used by ConnectBoat are provided by trusted third-party service
              providers. Depending on how you use the platform, these may include:
            </p>

            <ul className="list-disc pl-5 text-slate-600 text-sm space-y-2 mt-3">
              <li>
                <strong>Google / Firebase:</strong> authentication, database, storage and technical
                platform services.
              </li>
              <li>
                <strong>Google Analytics 4:</strong> website measurement, usage analytics and
                performance reporting.
              </li>
              <li>
                <strong>Stripe:</strong> payment processing for ConnectBoat listing plans and
                optional paid platform services. Stripe may use its own security and fraud-prevention
                technologies when you use Stripe Checkout.
              </li>
              <li>
                <strong>Resend:</strong> transactional email delivery. Resend is primarily an email
                delivery service and is not used by ConnectBoat as an advertising-cookie provider.
              </li>
            </ul>

            <p className="text-slate-600 leading-relaxed mt-3">
              ConnectBoat may display sponsored advertising without this, by itself, meaning that
              third-party advertising cookies or behavioural-tracking technologies are placed on
              your device. If ConnectBoat introduces non-essential advertising cookies or similar
              tracking technologies in the future, this policy and the applicable consent controls
              will be updated before those technologies are used where consent is required.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              Third-party providers may process information under their own privacy and technology
              policies. More information about how ConnectBoat uses service providers is available
              in our{' '}
              <Link
                to="/privacy"
                className="font-bold text-emerald-600 hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <CheckCircle size={20} />
              <h2 className="text-xl font-bold m-0">6. Your Cookie Choices</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              You can control or delete cookies through your browser settings. Most modern browsers
              allow you to view stored cookies, remove them, block particular websites or restrict
              cookies more generally.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              Blocking strictly necessary technologies may affect authentication, saved settings,
              listing management or other important ConnectBoat functions.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              Where ConnectBoat provides a cookie consent or preference control for optional
              technologies, you can use that control to make or update the choices available to you.
              Browser-level controls may also remain available independently.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <Shield size={20} />
              <h2 className="text-xl font-bold m-0">7. Cookies and Personal Data</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              Information collected through cookies and similar technologies may constitute
              personal data where it identifies or can be linked to an individual or device.
              Where this occurs, that information is handled in accordance with our{' '}
              <Link
                to="/privacy"
                className="font-bold text-emerald-600 hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <Info size={20} />
              <h2 className="text-xl font-bold m-0">8. Changes to this Cookie Policy</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              We may update this Cookie Policy to reflect changes to ConnectBoat, the technologies
              we use, our service providers or applicable legal requirements. The latest version
              will be published on this page with an updated date.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <Mail size={20} />
              <h2 className="text-xl font-bold m-0">9. Contact</h2>
            </div>

            <p className="text-slate-600 leading-relaxed">
              If you have questions about cookies, analytics or similar technologies used by
              ConnectBoat, contact:
            </p>

            <p className="text-slate-800 font-bold mt-3">
              ConnectBoat
              <br />
              <a
                href="mailto:contato@connectboat.co.uk"
                className="text-emerald-600 hover:underline"
              >
                contato@connectboat.co.uk
              </a>
            </p>
          </section>

          <section className="pt-8 border-t border-slate-100">
            <p className="text-sm text-slate-400 leading-relaxed">
              This Cookie Policy should be read together with our{' '}
              <Link
                to="/privacy"
                className="font-semibold text-emerald-500 hover:underline"
              >
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link
                to="/terms"
                className="font-semibold text-emerald-500 hover:underline"
              >
                Terms of Use
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

export default Cookies;
