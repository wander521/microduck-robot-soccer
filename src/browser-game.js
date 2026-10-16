export class BrowserGame {
  constructor() {
    this.worker = null;
    this.onState = () => {};
    this.onError = () => {};
  }
  start(name, onProgress = () => {}) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL("./physics/worker.js", import.meta.url),
        { type: "module" },
      );
      this.worker = worker;
      let settled = false;
      const fail = (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
        this.onError(error);
      };
      worker.onerror = (event) =>
        fail(new Error(event.message || "浏览器物理引擎无法启动"));
      worker.onmessage = ({ data }) => {
        if (data.type === "progress") onProgress(data.value, data.message);
        if (data.type === "ready") {
          settled = true;
          resolve(data.id);
        }
        if (data.type === "state") this.onState(data);
        if (data.type === "error") fail(new Error(data.message));
      };
      worker.postMessage({ type: "init", name });
    });
  }
  send(message) {
    this.worker?.postMessage(message);
  }
  dispose() {
    this.worker?.terminate();
    this.worker = null;
  }
}
