/// <reference types="vite/client" />

// Add Mixpanel to the global Window type so TS doesn't complain
declare global {
  interface Window {
    mixpanel?: any;
  }
}
export {};