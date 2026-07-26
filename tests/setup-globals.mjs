// Testler bir tarayıcıda değil Node.js'te çalıştığı için, uygulamanın modül
// yüklenirken (import anında) okuduğu birkaç tarayıcı global'ini burada
// sahte (mock) olarak tanımlıyoruz. Bu dosya, gerçek uygulama modüllerinden
// ÖNCE import edilmelidir.
globalThis.window = {
  location: { search: "" },
  i18n: {
    getLang: () => "tr",
    t: (key) => (key === "unitKgShort" ? "kg" : key === "unitAdetShort" ? "adet" : key)
  }
};
