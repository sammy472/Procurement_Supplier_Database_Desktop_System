declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.jpg" {
  const src: string;
  export default src;
}

declare module "*.jpeg" {
  const src: string;
  export default src;
}

declare module "*.svg" {
  const src: string;
  export default src;
}

declare module "*.webp" {
  const src: string;
  export default src;
}

<<<<<<< HEAD
interface Window {
  api: {
    send: (channel: string, data: any) => void;
    invoke: (channel: string, data: any) => Promise<any>;
=======
export {};

declare global {
  interface Window {
    electron: {
      openExternal: (url: string) => void;
      onDeepLink: (callback: (url: string) => void) => () => void;
    };
    api: {
      send: (channel: string, data: any) => void;
    };
    auth: {
      onCode: (
        callback: (data: { code: string; provider: "google" | "microsoft" }) => void
      ) => void;
    };
>>>>>>> 6b6776360cb38a5baa9164bb506d3d0fcacac94f
  }
}
