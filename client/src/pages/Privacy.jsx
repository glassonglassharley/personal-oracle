export default function Privacy() {
  return (
    <main className="legal-page">
      <div className="legal-wrap">
        <div className="legal-kicker">Vice to Value</div>
        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-updated">Effective June 9, 2026</p>

        <p className="legal-intro">
          Vice to Value ("we," "us," or "our") is a self-improvement app that helps you track and reduce spending on habits you want to change. This policy explains what data we collect, how we use it, and what choices you have. We handle your data with care — you are not the product.
        </p>

        <section className="legal-section">
          <h2>1. Data We Collect</h2>

          <h3>Account data</h3>
          <p>
            When you create an account you provide a <strong>username</strong> and <strong>password</strong>. Providing an <strong>email address</strong> is optional but required for password recovery and login links. We store usernames, bcrypt-hashed passwords, and email addresses in our database. We never store passwords in plain text.
          </p>
          <p>
            If you sign in via a <strong>Phantom, MetaMask, or Base wallet</strong>, we store your public wallet address as your account identifier. No private keys are ever transmitted to us.
          </p>

          <h3>Self-reported habit and spending data</h3>
          <p>
            The core of the app is <strong>your daily entries</strong>: which vices you track, how much you consumed, how much you spent, and whether a given day was "clean." This data is entered voluntarily by you. We store it to power your dashboard, streaks, savings projections, and badges. We do not sell this data or use it for advertising.
          </p>

          <h3>Financial data via Plaid</h3>
          <p>
            If you connect a bank account using our optional Plaid integration, Plaid acts as the intermediary. <strong>We never see or store your bank credentials.</strong> You authenticate directly with your bank through Plaid's encrypted interface. We receive read-only access to transaction data (merchant names, amounts, categories) that you authorize us to use for matching transactions to your tracked vices. This data is stored in your account and used only to populate your dashboard. You can disconnect Plaid at any time in Settings, which revokes our access.
          </p>

          <h3>AI Coach data</h3>
          <p>
            Our AI Coach feature sends a summary of your vice log data — aggregated spending totals, clean-day counts, and streak lengths — to <strong>Anthropic's API</strong> to generate personalized coaching responses. Your data is processed under Anthropic's API data handling policy. We do not send personally identifying information (your name, email, or username) to Anthropic; only anonymized behavioral aggregates. Annual Wrapped summaries are generated the same way and cached in our database to minimize API calls.
          </p>

          <h3>Usage and technical data</h3>
          <p>
            We log standard server-side request metadata (timestamps, API routes, HTTP status codes) for error diagnosis and security monitoring. We do not run third-party analytics, advertising trackers, or behavioral profiling.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. How We Use Your Data</h2>
          <ul>
            <li>To provide the app's core features: habit tracking, savings projections, streak calculations, badge awards, and goal progress.</li>
            <li>To generate AI coaching responses and annual summaries via Anthropic's API.</li>
            <li>To authenticate you and protect your account (passwords, JWT session tokens).</li>
            <li>To send password reset links and optional nightly reminders via email, if you opt in.</li>
            <li>To connect you with accountability partners you explicitly invite.</li>
            <li>To improve the reliability and performance of the service.</li>
          </ul>
          <p>We do not use your data for advertising, sell it to third parties, or share it with anyone other than the service providers listed in this policy.</p>
        </section>

        <section className="legal-section">
          <h2>3. Data Sharing</h2>
          <p>We share your data only with:</p>
          <ul>
            <li><strong>Neon (PostgreSQL hosting):</strong> Your data lives in a Neon-hosted database. Neon does not have access to your application-level data beyond what they need to operate the database.</li>
            <li><strong>Vercel (hosting):</strong> Our application runs on Vercel. Vercel processes network requests but does not have access to your application data.</li>
            <li><strong>Anthropic (AI):</strong> Anonymized vice log aggregates are sent to Anthropic's API for coaching responses. See Section 1.</li>
            <li><strong>Plaid (banking, optional):</strong> If you connect a bank account, Plaid acts as the secure intermediary. See Section 1.</li>
            <li><strong>Clerk (optional auth):</strong> If you sign in via MetaMask or Base wallet through Clerk, your authentication is processed by Clerk.</li>
          </ul>
          <p>All partners are subject to their own privacy policies and data processing agreements. We do not share your data for advertising or resale.</p>
        </section>

        <section className="legal-section">
          <h2>4. Authentication and Session Security</h2>
          <p>
            We use <strong>JSON Web Tokens (JWTs)</strong> for session management. Tokens are signed with a secret key stored in our server environment. Passwords are hashed using bcrypt with a cost factor of 12. We also support magic-link login via email for passwordless access. Session tokens expire and are invalidated when you sign out.
          </p>
          <p>
            We do not use tracking cookies for advertising. We use browser <code>localStorage</code> to persist your theme preference and session token on your device.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active. We intentionally keep long-term data — your year-over-year progress, multi-year streaks, and historical spending — because that longitudinal view is core to the value of the app. Your data is not automatically purged based on inactivity.
          </p>
          <p>
            When you delete your account, all associated data is permanently removed from our database: your profile, vices, entries, goals, saved amounts, partner connections, badges, and session tokens. Deletion is irreversible. Backups are rotated and purged on a rolling schedule, so your data may persist in encrypted backups for up to 30 days after account deletion.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Your Rights and Choices</h2>
          <p>You can, at any time:</p>
          <ul>
            <li><strong>Export your data:</strong> Download a CSV of all your logged entries from the Settings page.</li>
            <li><strong>Delete your account:</strong> Permanently delete your account and all associated data from the Settings page. This is immediate and irreversible.</li>
            <li><strong>Update your information:</strong> Change your email, password, and display name in Settings.</li>
            <li><strong>Disconnect Plaid:</strong> Revoke bank account access at any time via Settings.</li>
            <li><strong>Opt out of notifications:</strong> Disable nightly reminders in Settings at any time.</li>
          </ul>
          <p>If you are in the EU, UK, or California, you may have additional rights under GDPR, UK GDPR, or CCPA. To exercise any of these rights, email us at the address below.</p>
        </section>

        <section className="legal-section">
          <h2>7. Children</h2>
          <p>
            Vice to Value is intended for users aged 18 and older. We do not knowingly collect data from anyone under 18. If you believe a minor has created an account, contact us and we will delete it.
          </p>
        </section>

        <section className="legal-section">
          <h2>8. Security</h2>
          <p>
            We use industry-standard practices to protect your data: encrypted connections (TLS), bcrypt password hashing, signed JWT tokens, server-side secret management via environment variables, and principle of least privilege on database access. No security measure is perfect. If you discover a security vulnerability, please disclose it responsibly by emailing us.
          </p>
        </section>

        <section className="legal-section">
          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this policy as our features evolve. Material changes will be communicated via the app or email. Continued use after changes constitutes acceptance. The effective date at the top of this page reflects the most recent revision.
          </p>
        </section>

        <section className="legal-section">
          <h2>10. Contact</h2>
          <p>
            Questions, data requests, or concerns about this policy? Contact us at:<br />
            <strong>jmenyon8@gmail.com</strong>
          </p>
        </section>

        <div className="legal-footer-links">
          <a href="/terms">Terms of Service</a>
          <span>·</span>
          <a href="/">Back to app</a>
        </div>
      </div>
    </main>
  );
}
