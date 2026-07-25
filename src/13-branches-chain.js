/**
 * 13-branches-chain.js
 * Çok şubeli yönetim (patron/zincir sahibi hesapları): şube oluşturma/düzenleme/silme, ortak ürün kataloğu senkronizasyonu.
 */

function calcTodaySalesTotal(salesArr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (salesArr || []).filter((s) => new Date(s.timestamp) >= today).reduce((sum, s) => sum + s.total, 0);
  }

function loadBranches() {
    if (!currentUser || !cloudEnabled) return;
    db.collection("isletmeler")
      .where("chainOwnerUid", "==", currentUser.uid)
      .get()
      .then((snap) => {
        const branches = [];
        snap.forEach((doc) => {
          const data = doc.data();
          branches.push({
            uid: doc.id,
            branchName: data.branchName || doc.id,
            products: data.products || [],
            sales: data.sales || []
          });
        });
        loadedBranches = branches;
        renderBranchList(branches);
        renderBranchSummary(branches);
      })
      .catch((e) => {
        console.error("Şube listesi okunamadı", e);
        renderBranchList([]);
      });
  }

function renderCatalogList() {
    const listEl = document.getElementById("catalogList");
    const emptyEl = document.getElementById("catalogEmptyState");
    if (!listEl) return;

    if (!masterCatalog.length) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      return;
    }
    emptyEl.style.display = "none";

    listEl.innerHTML = masterCatalog
      .map((item, i) => `
        <div class="branch-row">
          <div class="branch-info">
            <p class="branch-name">${escapeHtml(item.name)}</p>
            <p class="branch-meta">${escapeHtml(item.category)} · ${formatTL(item.price)}</p>
          </div>
          <button class="branch-delete-btn" data-index="${i}" aria-label="Kaldır"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
        </div>`)
      .join("");

    listEl.querySelectorAll(".branch-delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        masterCatalog.splice(Number(btn.dataset.index), 1);
        saveMasterCatalog();
        renderCatalogList();
      });
    });
  }

function saveMasterCatalog() {
    const targetRef = originalDocRef || docRef;
    if (targetRef) {
      targetRef.set({ masterCatalog }, { merge: true }).catch((e) => console.error("Katalog kaydedilemedi", e));
    }
  }

function addCatalogItem() {
    const name = document.getElementById("catalogName").value.trim();
    const category = document.getElementById("catalogCategory").value.trim() || t("categoryOtherDefault");
    const price = Number(document.getElementById("catalogPrice").value) || 0;

    if (!name) {
      showToast(t("branchFieldsRequired"), "error");
      return;
    }

    const existingIndex = masterCatalog.findIndex((it) => it.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (existingIndex >= 0) {
      masterCatalog[existingIndex] = { name, category, price };
    } else {
      masterCatalog.push({ name, category, price });
    }

    saveMasterCatalog();
    renderCatalogList();
    document.getElementById("catalogName").value = "";
    document.getElementById("catalogCategory").value = "";
    document.getElementById("catalogPrice").value = "";

    pushCatalogToAllBranches();
  }

function pushCatalogToAllBranches() {
    if (!loadedBranches.length) return;
    const loadingEl = document.getElementById("catalogSyncing");
    if (loadingEl) loadingEl.style.display = "flex";

    const writes = loadedBranches.map((branch) => {
      const branchProducts = branch.products.map((p) => ({ ...p }));

      masterCatalog.forEach((item) => {
        const match = branchProducts.find((p) => p.name.trim().toLowerCase() === item.name.trim().toLowerCase());
        if (match) {
          match.category = item.category;
          match.price = item.price;
        } else {
          branchProducts.push(mkProduct(item.name, item.category, 0, 5, item.price, "", "adet", 0));
        }
      });

      return db
        .collection("isletmeler")
        .doc(branch.uid)
        .set({ products: branchProducts }, { merge: true });
    });

    Promise.all(writes)
      .then(() => {
        if (loadingEl) loadingEl.style.display = "none";
        showToast(t("catalogSyncSuccess"), "success");
        loadBranches();
      })
      .catch((e) => {
        console.error("Katalog şubelere gönderilemedi", e);
        if (loadingEl) loadingEl.style.display = "none";
        showToast(t("catalogSyncError"), "error");
      });
  }

function renderBranchList(branches) {
    const listEl = document.getElementById("branchList");
    const emptyEl = document.getElementById("branchEmptyState");
    if (!listEl) return;

    if (!branches.length) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      return;
    }
    emptyEl.style.display = "none";

    listEl.innerHTML = branches
      .map((b) => {
        const todaySales = calcTodaySalesTotal(b.sales);
        return `
          <div class="branch-row">
            <div class="branch-info">
              <p class="branch-name">${escapeHtml(b.branchName)}</p>
              <p class="branch-meta">${b.products.length} ürün · Bugün: ${formatTL(todaySales)}</p>
            </div>
            <div class="branch-row-actions">
              <button class="branch-view-btn" data-uid="${b.uid}" data-name="${escapeHtml(b.branchName)}">${t("branchViewBtn")}</button>
              <button class="branch-edit-btn" data-uid="${b.uid}" data-name="${escapeHtml(b.branchName)}" aria-label="Düzenle"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
              <button class="branch-delete-btn" data-uid="${b.uid}" data-name="${escapeHtml(b.branchName)}" aria-label="Sil"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
            </div>
          </div>`;
      })
      .join("");

    listEl.querySelectorAll(".branch-view-btn").forEach((btn) => {
      btn.addEventListener("click", () => viewBranch(btn.dataset.uid, btn.dataset.name));
    });
    listEl.querySelectorAll(".branch-edit-btn").forEach((btn) => {
      btn.addEventListener("click", () => openBranchEditModal(btn.dataset.uid, btn.dataset.name));
    });
    listEl.querySelectorAll(".branch-delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => confirmDeleteBranch(btn.dataset.uid, btn.dataset.name));
    });
  }

function renderBranchSummary(branches) {
    let totalSales = 0;
    let totalLowStock = 0;

    branches.forEach((b) => {
      totalSales += calcTodaySalesTotal(b.sales);
      totalLowStock += b.products.filter((p) => p.qty <= p.min).length;
    });

    const salesEl = document.getElementById("branchSummarySales");
    const ordersEl = document.getElementById("branchSummaryOrders");
    if (salesEl) salesEl.textContent = formatTL(totalSales);
    if (ordersEl) ordersEl.textContent = totalLowStock;
  }

function createBranch() {
    if (!isChainConfigured()) {
      showToast(t("branchNotConfigured"), "error");
      return;
    }
    const branchName = document.getElementById("branchName").value.trim();
    const email = document.getElementById("branchEmail").value.trim();
    const password = document.getElementById("branchPassword").value;

    if (!branchName || !email || !password) {
      showToast(t("branchFieldsRequired"), "error");
      return;
    }

    currentUser
      .getIdToken()
      .then((idToken) =>
        fetch(`${chainConfig.workerUrl}/create-branch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, branchName, email, password })
        })
      )
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          showToast(data.error, "error");
          return;
        }
        showToast(t("branchCreateSuccess"), "success");
        document.getElementById("branchName").value = "";
        document.getElementById("branchEmail").value = "";
        document.getElementById("branchPassword").value = "";
        loadBranches();
      })
      .catch((e) => {
        console.error(e);
        showToast(t("branchCreateError"), "error");
      });
  }

function viewBranch(uid, name) {
    if (!originalDocRef) {
      originalDocRef = docRef;
    }
    viewingBranchUid = uid;
    docRef = db.collection("isletmeler").doc(uid);
    if (firestoreUnsubscribe) firestoreUnsubscribe();
    attachFirestoreListener();

    document.getElementById("branchViewingBanner").style.display = "flex";
    document.getElementById("branchViewingText").textContent = `${t("branchViewingPrefix")} ${name}`;
    applyAccountTypeUI();
    switchTab("tab-products");
  }

function exitBranchView() {
    if (!originalDocRef) return;
    docRef = originalDocRef;
    originalDocRef = null;
    viewingBranchUid = null;
    if (firestoreUnsubscribe) firestoreUnsubscribe();
    attachFirestoreListener();
    document.getElementById("branchViewingBanner").style.display = "none";
    applyAccountTypeUI();
    switchTab("tab-branches");
  }

function openBranchEditModal(uid, name) {
    editingBranchUid = uid;
    document.getElementById("branchEditModalTitle").textContent = `${t("branchEditTitle")} — ${name}`;
    document.getElementById("branchEditEmail").value = "";
    document.getElementById("branchEditPassword").value = "";
    document.getElementById("branchEditModal").style.display = "flex";
  }

function closeBranchEditModal() {
    document.getElementById("branchEditModal").style.display = "none";
    editingBranchUid = null;
  }

function saveBranchEdit() {
    const newEmail = document.getElementById("branchEditEmail").value.trim();
    const newPassword = document.getElementById("branchEditPassword").value;

    if (!newEmail && !newPassword) {
      showToast(t("branchEditFieldsRequired"), "error");
      return;
    }

    currentUser
      .getIdToken()
      .then((idToken) =>
        fetch(`${chainConfig.workerUrl}/update-branch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, targetUid: editingBranchUid, newEmail: newEmail || null, newPassword: newPassword || null })
        })
      )
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          showToast(data.error, "error");
          return;
        }
        showToast(t("branchEditSuccess"), "success");
        closeBranchEditModal();
        loadBranches();
      })
      .catch((e) => {
        console.error(e);
        showToast(t("branchEditError"), "error");
      });
  }

function confirmDeleteBranch(uid, name) {
    if (!confirm(`${t("branchDeleteConfirm")} "${name}"?`)) return;

    currentUser
      .getIdToken()
      .then((idToken) =>
        fetch(`${chainConfig.workerUrl}/delete-branch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, targetUid: uid })
        })
      )
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          showToast(data.error, "error");
          return;
        }
        showToast(t("branchDeleteSuccess"), "success");
        loadBranches();
      })
      .catch((e) => {
        console.error(e);
        showToast(t("branchDeleteError"), "error");
      });
  }
