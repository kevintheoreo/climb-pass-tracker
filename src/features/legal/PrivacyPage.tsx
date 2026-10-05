import { Page } from '../../components/Page'
import { LegalSection, LegalUpdated } from './LegalText'

/** The privacy policy (FR-48). It must stay true to what the app does: it collects nothing. */
export default function PrivacyPage() {
  return (
    <Page title="Privacy policy">
      <LegalUpdated />

      <LegalSection title="The short version">
        <p>
          Climb Pass Tracker collects nothing about you. There are no accounts, no sign-in, no
          analytics, no advertising and no tracking. Your passes stay on your phone.
        </p>
      </LegalSection>

      <LegalSection title="What the app stores, and where">
        <p>
          What you enter (gym names, pass types, number of entries, dates, prices, comments, and
          each time you tap − or +) is saved in your browser’s storage on your own device. It is
          never sent to us or to anyone else, because the app has no server to send it to.
        </p>
        <p>
          The app also keeps your settings (reminder choices) and a few small facts, such as when
          you last downloaded a backup file, in the same place.
        </p>
      </LegalSection>

      <LegalSection title="The website itself">
        <p>
          The app is delivered as a website, and the host (Netlify) may keep ordinary server logs
          when your device loads it, such as your IP address, the time and the page requested. We do
          not use these logs, and they never contain your passes. After the first visit the app
          works without a connection.
        </p>
      </LegalSection>

      <LegalSection title="Links to other sites">
        <p>
          The About screen links to the developer’s Instagram and Buy Me a Coffee pages. They open
          only if you tap them, in a new tab, and are run by other companies under their own privacy
          policies. The app sends them nothing about you or your passes.
        </p>
      </LegalSection>

      <LegalSection title="Backup files">
        <p>
          Settings lets you download a backup file and open one on another device. The file is made
          on your device and goes only where you put it. It is not encrypted, so anyone who has it
          can read your passes. Keep it, and the way you send it, somewhere you trust.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and tracking">
        <p>The app does not use cookies, advertising identifiers or any third-party tracking.</p>
      </LegalSection>

      <LegalSection title="Deleting your data">
        <p>
          Settings → Delete all local data removes everything the app has stored. Clearing the
          site’s data in your browser, or removing the app from your phone, does the same. Your
          browser may also clear the storage of a website it considers unused; installing the app to
          your home screen and downloading a backup file from time to time protect you from that.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          Because we hold no personal data about you, there is nothing for us to access, correct or
          delete on your behalf. Everything is in your hands, in the app.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          If the app ever changes how it handles data, this page will change first, and the date
          above will show it.
        </p>
      </LegalSection>
    </Page>
  )
}
