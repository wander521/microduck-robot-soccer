// BASE_URL is absolute-from-origin so it also resolves inside the module worker.
const base = new URL(import.meta.env.BASE_URL, location.href);
export const assetUrl = (path) => new URL(path, base).href;
