/**
 * 04-fiscal.js
 * Resmi mali kayıt (e-Fatura/Yazar Kasa) entegrasyonu ayarları — varsayılan olarak pasif, istenince aktif edilebilir altyapı.
 */

function toggleFiscalEnabled(checked) {
    fiscalEnabled = checked;
    document.getElementById("fiscalConfigFields").style.display = checked ? "block" : "none";
    const targetRef = originalDocRef || docRef;
    if (targetRef) {
      targetRef.set({ fiscalEnabled: checked }, { merge: true }).catch((e) => console.error("Mali kayıt ayarı kaydedilemedi", e));
    }
  }

function saveFiscalSettings() {
    fiscalProvider = document.getElementById("fiscalProvider").value;
    fiscalApiKey = document.getElementById("fiscalApiKey").value.trim();
    fiscalEndpoint = document.getElementById("fiscalEndpoint").value.trim();
    fiscalVkn = document.getElementById("fiscalVkn").value.trim();

    const targetRef = originalDocRef || docRef;
    if (targetRef) {
      targetRef
        .set({ fiscalProvider, fiscalApiKey, fiscalEndpoint, fiscalVkn }, { merge: true })
        .catch((e) => console.error("Mali kayıt ayarları kaydedilemedi", e));
    }

    const statusEl = document.getElementById("fiscalStatus");
    if (fiscalApiKey && fiscalEndpoint) {
      statusEl.textContent = t("fiscalReadyToTry");
      statusEl.style.color = "var(--green-text)";
    } else if (fiscalApiKey || fiscalEndpoint) {
      statusEl.textContent = t("fiscalNotConnectedYet");
      statusEl.style.color = "var(--amber-text)";
    } else {
      statusEl.textContent = "";
    }
    showToast(t("fiscalSettingsSaved"), "success");
  }

function renderFiscalSettings() {
    const toggle = document.getElementById("fiscalEnabledToggle");
    if (!toggle) return;
    toggle.checked = fiscalEnabled;
    document.getElementById("fiscalConfigFields").style.display = fiscalEnabled ? "block" : "none";
    document.getElementById("fiscalProvider").value = fiscalProvider;
    document.getElementById("fiscalApiKey").value = fiscalApiKey;
    document.getElementById("fiscalEndpoint").value = fiscalEndpoint;
    document.getElementById("fiscalVkn").value = fiscalVkn;
  }

function attemptSendToFiscalProvider(sale) {
    if (!fiscalEnabled || !fiscalApiKey || !fiscalEndpoint) return;
    if (!isChainConfigured() || !currentUser) return;

    const invoicePayload = {
      vkn: fiscalVkn,
      faturaTarihi: sale.timestamp,
      faturaNo: sale.id,
      kalemler: sale.items.map((item) => ({
        urunAdi: item.name,
        miktar: item.qty,
        birimFiyat: item.price,
        toplam: Math.round(item.qty * item.price * 100) / 100
      })),
      araToplam: sale.subtotal,
      indirim: sale.discount || 0,
      genelToplam: sale.total,
      odemeTuru: sale.paymentType
    };

    currentUser
      .getIdToken()
      .then((idToken) =>
        fetch(`${chainConfig.workerUrl}/relay-fiscal-invoice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, fiscalEndpoint, fiscalApiKey, invoicePayload })
        })
      )
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          logAudit("Mali kayıt gönderildi", `Satış #${sale.id}`);
        } else {
          console.error("Mali kayıt gönderimi başarısız:", data);
          logAudit("Mali kayıt gönderimi BAŞARISIZ", `Satış #${sale.id} — ${data.error || "entegratör " + data.providerStatus + " döndürdü"}`);
        }
      })
      .catch((e) => {
        console.error("Mali kayıt gönderim hatası:", e);
        logAudit("Mali kayıt gönderimi BAŞARISIZ", `Satış #${sale.id} (bağlantı hatası)`);
      });
  }
