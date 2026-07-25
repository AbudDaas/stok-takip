/**
 * 12-push-notifications.js
 * Push bildirimleri (Firebase Cloud Messaging) ve raf kontrol uyarısı.
 */

function updateNotifButtonState() {
    const btn = document.getElementById("notifEnableBtn");
    if (!btn) return;
    const span = btn.querySelector("span");
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      span.textContent = t("notifDisableBtn");
      btn.disabled = true;
    } else {
      span.textContent = t("notifEnableBtn");
      btn.disabled = false;
    }
  }

function enableNotifications() {
    if (!isPushConfigured()) {
      showToast(t("notifError"), "error");
      return;
    }
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !cloudEnabled || !currentUser) {
      showToast(t("notifError"), "error");
      return;
    }

    Notification.requestPermission()
      .then((permission) => {
        if (permission !== "granted") {
          showToast(t("notifPermissionDenied"), "error");
          return;
        }
        return navigator.serviceWorker.ready.then((registration) => {
          const messaging = firebase.messaging();
          return messaging.getToken({ vapidKey: pushConfig.vapidKey, serviceWorkerRegistration: registration }).then((fcmToken) => {
            if (!fcmToken) {
              showToast(t("notifError"), "error");
              return;
            }
            return docRef
              .set({ fcmTokens: firebase.firestore.FieldValue.arrayUnion(fcmToken) }, { merge: true })
              .then(() => {
                showToast(t("notifEnabled"), "success");
                updateNotifButtonState();
              });
          });
        });
      })
      .catch((e) => {
        console.error(e);
        showToast(t("notifError"), "error");
      });
  }

function renderShelfCheckAlert() {
    const listEl = document.getElementById("shelfCheckList");
    const emptyEl = document.getElementById("shelfCheckEmptyState");
    if (!listEl) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySales = sales.filter((s) => new Date(s.timestamp) >= today);
    const soldTodayByProduct = {};
    todaySales.forEach((s) => {
      s.items.forEach((item) => {
        soldTodayByProduct[item.name] = (soldTodayByProduct[item.name] || 0) + item.qty;
      });
    });

    const cutoff14 = new Date(Date.now() - 14 * 86400000);
    const recentSales = sales.filter((s) => new Date(s.timestamp) >= cutoff14 && new Date(s.timestamp) < today);
    const salesByProduct14 = {};
    recentSales.forEach((s) => {
      s.items.forEach((item) => {
        salesByProduct14[item.name] = (salesByProduct14[item.name] || 0) + item.qty;
      });
    });

    const alerts = Object.keys(soldTodayByProduct)
      .map((name) => {
        const soldToday = soldTodayByProduct[name];
        const avgDaily = (salesByProduct14[name] || 0) / 14;
        if (soldToday < 3) return null; // çok küçük hacimlerde gürültü yaratmasın
        if (avgDaily > 0 && soldToday < avgDaily * 1.5) return null; // normalin çok üstünde değilse alarm verme
        if (avgDaily === 0 && soldToday < 5) return null; // geçmiş veri yoksa daha yüksek bir eşik kullan
        return { name, soldToday, avgDaily };
      })
      .filter(Boolean)
      .sort((a, b) => b.soldToday - a.soldToday);

    if (!alerts.length) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      return;
    }
    emptyEl.style.display = "none";

    listEl.innerHTML = alerts
      .map((a) => {
        const avgLabel = a.avgDaily > 0 ? `${t("shelfCheckUsualAvg")}: ${a.avgDaily.toFixed(1)}` : t("shelfCheckNoHistory");
        return `
          <div class="shelf-check-row">
            <div class="shelf-check-info">
              <p class="shelf-check-name">${escapeHtml(a.name)}</p>
              <p class="shelf-check-meta">${t("shelfCheckSoldToday")}: ${a.soldToday} · ${avgLabel}</p>
            </div>
            <span class="shelf-check-badge">${t("shelfCheckAction")}</span>
          </div>`;
      })
      .join("");

    // Daha önce bugün bildirilmemiş ürünler için tarayıcı bildirimi gönder
    alerts.forEach((a) => notifyShelfCheckOnce(a.name));
  }

function notifyShelfCheckOnce(productName) {
    const todayKey = new Date().toISOString().slice(0, 10);
    let notified = {};
    try {
      notified = JSON.parse(sessionStorage.getItem("bakkal_shelf_notified") || "{}");
    } catch (e) {}
    const key = `${todayKey}_${productName}`;
    if (notified[key]) return;
    notified[key] = true;
    try {
      sessionStorage.setItem("bakkal_shelf_notified", JSON.stringify(notified));
    } catch (e) {}

    // Yerel tarayıcı bildirimi (uygulama o an açıksa anında görünür)
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(t("shelfCheckNotifTitle"), {
          body: `${productName} ${t("shelfCheckNotifBody")}`,
          icon: "./icons/icon-192.png"
        });
      } catch (e) {}
    }

    // Gerçek push bildirimi (telefon/uygulama kapalıyken de ulaşır)
    sendShelfCheckPush(productName);
  }

function sendShelfCheckPush(productName) {
    if (!isChainConfigured() || !currentUser) return;
    currentUser
      .getIdToken()
      .then((idToken) =>
        fetch(`${chainConfig.workerUrl}/send-self-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken,
            title: t("shelfCheckNotifTitle"),
            message: `${productName} ${t("shelfCheckNotifBody")}`
          })
        })
      )
      .catch((e) => console.error("Raf kontrolü bildirimi gönderilemedi", e));
  }
