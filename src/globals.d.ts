/** The version in package.json, filled in by Vite (see `define` in vite.config.ts). */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** The public app key of the Dropbox app (not a secret). Without it the Dropbox backup is off. */
  readonly VITE_DROPBOX_APP_KEY?: string
}
