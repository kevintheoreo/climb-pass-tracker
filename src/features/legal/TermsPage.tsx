import { Page } from '../../components/Page'
import { LegalSection, LegalUpdated } from './LegalText'

/** The terms of use (FR-48). */
export default function TermsPage() {
  return (
    <Page title="Terms of use">
      <LegalUpdated />

      <LegalSection title="Using the app">
        <p>
          Climb Pass Tracker is a free tool for keeping your own record of climbing gym passes. By
          using it you agree to these terms.
        </p>
      </LegalSection>

      <LegalSection title="Not connected to any gym">
        <p>
          The app is independent. It is not made, endorsed or checked by any gym, and gym names are
          there only so you can find yours. The app does not know what you bought: you enter every
          pass yourself.
        </p>
      </LegalSection>

      <LegalSection title="Your record, not the gym’s">
        <p>
          The numbers in the app (entries left, expiry dates, reminders) come from what you typed
          and tapped. If they differ from your gym’s own records, your gym’s records decide. Check
          with the gym before relying on a pass.
        </p>
      </LegalSection>

      <LegalSection title="Your data and backups">
        <p>
          Your passes are saved only on your device. Browsers and phones can lose stored data (a
          cleared browser, a lost phone, a reset). Downloading a backup file from Settings is your
          responsibility; we cannot recover data for you because we never have it. The optional
          Dropbox backup is a convenience, not a guarantee: it can fail (no connection, a full
          Dropbox, a sign-in Dropbox no longer accepts), so keep a backup file as well if your
          passes matter.
        </p>
      </LegalSection>

      <LegalSection title="No warranty">
        <p>
          The app is provided “as is”, without promises that it will always work or be free of
          mistakes. To the extent the law allows, we are not liable for any loss that comes from
          using it, including a lost pass record or a missed expiry.
        </p>
      </LegalSection>

      <LegalSection title="Changes and law">
        <p>
          These terms may change; the date above shows the latest version, and continuing to use the
          app means you accept it. They are governed by the laws of Singapore.
        </p>
      </LegalSection>
    </Page>
  )
}
