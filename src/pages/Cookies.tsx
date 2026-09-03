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
import {
  clearAnalyticsCookies,
  hasAnalyticsConsent,
  initGA,
  saveCookieConsent,
} from '../utils/analytics';

const Cookies = () => {
  const [analyticsEnabled, setAnalyticsEnabled] = React.useState(false);
  const [preferenceMessage, setPreferenceMessage] = React.useState('');

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setAnalyticsEnabled(hasAnalyticsConsent());
  }, []);

  const enableAnalytics = () => {
    saveCookieConsent('analytics');
    initGA();
    setAnalyticsEnabled(true);
    setPreferenceMessage('Analytics cookies are now enabled.');
  };

  const useEssentialOnly = () => {
    saveCookieConsent('essential');
    clearAnalyticsCookies();
    setAnalyticsEnabled(false);
    setPreferenceMessage('Your preference is now Essential Only. Google Analytics cookies have been removed where accessible to ConnectBoat.');
  };

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
            Last updated: 3 September 2026
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
              platform functionality. For simplicity, this policy uses the term cookies to include
              cookies and other storage or access technologies where appropriate. UK rules can apply
              whenever information is stored on, or accessed from, a user&apos;s device, not only when a
              traditional cookie file is used. ConnectBoat therefore treats browser storage and
              similar technologies in accordance with the applicable Privacy and Electronic
              Communications Regulations (PECR) requirements.
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
              ConnectBoat treats Google Analytics as optional. GA4 is not loaded by ConnectBoat unless you have expressly selected Accept Analytics. If you select Essential Only, ConnectBoat does not intentionally enable GA4 and removes accessible Google Analytics cookies set for this site. If an applicable legal exemption permits a storage or access technology to be used without consent, ConnectBoat may rely on that exemption only where its legal conditions are met.
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
              Technologies that are genuinely necessary to provide a service requested by you, or that fall within another applicable PECR exemption, are treated separately from optional analytics technologies. Their use is limited to the purpose for which the relevant exemption applies.
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
              When the ConnectBoat cookie banner is shown, you can choose <strong>Accept Analytics</strong>
              or <strong>Essential Only</strong>. Optional Google Analytics is disabled unless you
              expressly choose to enable it. Choosing Essential Only does not prevent you from
              using the core marketplace.
            </p>

            <p className="text-slate-600 leading-relaxed mt-3">
              Consent for optional analytics must be a clear positive choice. ConnectBoat does not
              treat continued browsing, silence or closing the banner as consent to Analytics. You
              can withdraw a previous Analytics choice at any time on this page; when you do, we stop
              sending new ConnectBoat Analytics events and remove accessible <code>_ga</code> cookies
              from this site.
            </p>

            <div className="mt-5 p-5 bg-emerald-50/60 rounded-2xl border border-emerald-100">
              <p className="font-extrabold text-slate-900 text-sm">Manage your preference</p>
              <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                Your current ConnectBoat analytics preference is:
                <strong className="ml-1">{analyticsEnabled ? 'Analytics enabled' : 'Essential only'}</strong>.
                You can change or withdraw your analytics consent at any time using the buttons below.
              </p>

              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={enableAnalytics}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#52b64d] hover:bg-[#459d41] text-white text-xs font-extrabold transition-all"
                >
                  <BarChart3 size={15} />
                  Accept Analytics
                </button>

                <button
                  type="button"
                  onClick={useEssentialOnly}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white border border-slate-700 text-xs font-extrabold transition-all"
                >
                  <Shield size={15} />
                  Essential Only
                </button>
              </div>

              {preferenceMessage && (
                <p className="text-xs font-semibold text-emerald-700 mt-3" role="status">
                  {preferenceMessage}
                </p>
              )}
            </div>

            <p className="text-slate-600 leading-relaxed mt-4">
              You can also control or delete cookies through your browser settings. Most modern
              browsers allow you to view stored cookies, remove them, block particular websites or
              restrict cookies more generally. Blocking strictly necessary technologies may affect
              authentication, saved settings, listing management or other important ConnectBoat functions.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <Database size={20} />
              <h2 className="text-xl font-bold m-0">7. Technologies We Currently Use</h2>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-extrabold">Technology</th>
                    <th className="px-4 py-3 font-extrabold">Purpose</th>
                    <th className="px-4 py-3 font-extrabold">Type / duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-800">connectboat_cookie_consent</td>
                    <td className="px-4 py-3">Stores your Analytics or Essential Only choice.</td>
                    <td className="px-4 py-3">Local browser storage; remains until changed or cleared.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-800">_ga and _ga_*</td>
                    <td className="px-4 py-3">Google Analytics 4 measurement after you accept Analytics.</td>
                    <td className="px-4 py-3">Optional analytics cookies; Google commonly sets these for up to 2 years, subject to configuration and browser controls.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-800">Firebase / browser storage</td>
                    <td className="px-4 py-3">Authentication, security, data synchronisation and core platform operation.</td>
                    <td className="px-4 py-3">Essential storage where required for the requested service; duration varies by function and session state.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-800">ConnectBoat functional storage</td>
                    <td className="px-4 py-3">Remembers selected market, favourites, safety acknowledgements, interface state and other requested functionality.</td>
                    <td className="px-4 py-3">Local or session storage; retained until expiry, replacement, logout where applicable, or browser/site data is cleared.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-slate-500 text-xs leading-relaxed mt-3">
              Browser and third-party implementations can change the exact technical identifier or
              duration. We update this policy when material changes affect how ConnectBoat uses these technologies.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-2 text-emerald-600 mb-3">
              <Shield size={20} />
              <h2 className="text-xl font-bold m-0">8. Cookies and Personal Data</h2>
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
              <h2 className="text-xl font-bold m-0">9. Changes to this Cookie Policy</h2>
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
              <h2 className="text-xl font-bold m-0">10. Contact</h2>
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
