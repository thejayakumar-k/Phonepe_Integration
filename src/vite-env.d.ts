/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MERCHANT_UPI_ID: string;
  readonly VITE_MERCHANT_NAME: string;
  readonly VITE_PAYMENT_SESSION_MINUTES: string;
  readonly VITE_APP_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
