/**
 * Performans loglama altyapısı.
 *
 * Önemli işlemlerin (satış tamamlama, AI raporu gibi) ne kadar sürdüğünü
 * ölçüp cihazın kendi localStorage'ında saklar. Şu an için ekranda
 * gösterilmiyor — sadece "müşteri uygulama yavaş dedi" gibi bir durumda,
 * ileride bakabileceğimiz bir kayıt tutuyoruz.
 */

const PERF_LOG_KEY = "bakkal_perf_log";
const MAX_ENTRIES = 200;

/**
 * Bir işlemin süresini ölçüp kaydeder.
 * @param {string} label - İşlemin adı (örn. "completeSale")
 * @param {() => any} fn - Ölçülecek fonksiyon
 * @returns fn'in dönüş değeri
 */
export function measurePerf(label, fn) {
  const start = performance.now();
  let result;
  let errorOccurred = false;
  try {
    result = fn();
  } catch (e) {
    errorOccurred = true;
    throw e;
  } finally {
    const durationMs = Math.round(performance.now() - start);
    logPerfEntry(label, durationMs, errorOccurred);
  }
  return result;
}

export function logPerfEntry(label, durationMs, errorOccurred = false) {
  let entries = [];
  try {
    entries = JSON.parse(localStorage.getItem(PERF_LOG_KEY) || "[]");
  } catch (e) {
    entries = [];
  }

  entries.push({
    label,
    durationMs,
    errorOccurred,
    timestamp: new Date().toISOString()
  });

  // Çok büyümesin diye en fazla MAX_ENTRIES kadar tutuyoruz (en eskiler düşer).
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(entries.length - MAX_ENTRIES);
  }

  try {
    localStorage.setItem(PERF_LOG_KEY, JSON.stringify(entries));
  } catch (e) {
    // localStorage doluysa ya da erişilemiyorsa sessizce vazgeç — performans
    // loglaması, uygulamanın asıl işlevini asla bozmamalı.
  }
}

/**
 * Kaydedilen performans verilerini döndürür — ileride bir "Performans"
 * ekranı eklersek burası kullanılacak.
 */
export function getPerfLog() {
  try {
    return JSON.parse(localStorage.getItem(PERF_LOG_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

/**
 * Etiket bazında ortalama/en yavaş süreleri özetler.
 */
export function summarizePerfLog() {
  const entries = getPerfLog();
  const byLabel = {};
  entries.forEach((e) => {
    if (!byLabel[e.label]) byLabel[e.label] = { count: 0, totalMs: 0, maxMs: 0 };
    byLabel[e.label].count++;
    byLabel[e.label].totalMs += e.durationMs;
    byLabel[e.label].maxMs = Math.max(byLabel[e.label].maxMs, e.durationMs);
  });
  return Object.keys(byLabel).map((label) => ({
    label,
    count: byLabel[label].count,
    avgMs: Math.round(byLabel[label].totalMs / byLabel[label].count),
    maxMs: byLabel[label].maxMs
  }));
}

export function clearPerfLog() {
  try {
    localStorage.removeItem(PERF_LOG_KEY);
  } catch (e) {}
}