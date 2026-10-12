const { contextBridge } = require("electron");

// Frontend checks this flag to enable desktop-only UX
// (sync progress chip, pending-book retries, native feel).
contextBridge.exposeInMainWorld("__ZAYRO_DESKTOP__", true);
