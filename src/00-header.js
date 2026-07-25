/**
 * 00-header.js
 * Sıkı mod (strict mode) direktifi ve mümkün olduğunca erken servis çalışanı kaydı. Bu dosya HER ZAMAN derlenen çıktının en başında olmalıdır.
 */

"use strict";

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
