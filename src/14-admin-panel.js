/**
 * 14-admin-panel.js
 * Yönetim paneli (sadece SaaS admin hesabı): işletme oluşturma, aktif/pasif yapma, şube limiti, gelen geri bildirimler.
 */

function loadAdminFeedback() {
    if (!currentUser || currentUser.uid !== ADMIN_UID) return;
    db.collection("admin")
      .doc("feedback")
      .get()
      .then((snap) => {
        const list = snap.exists && snap.data().list ? snap.data().list : [];
        renderAdminFeedback(list);
      })
      .catch((e) => {
        console.error("Geri bildirimler okunamadı", e);
        renderAdminFeedback([]);
      });
  }

function renderAdminFeedback(list) {
    const listEl = document.getElementById("adminFeedbackList");
    const emptyEl = document.getElementById("adminFeedbackEmptyState");
    if (!listEl) return;

    if (!list.length) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      return;
    }
    emptyEl.style.display = "none";

    const sorted = [...list].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    listEl.innerHTML = sorted
      .map((f) => {
        const d = new Date(f.timestamp);
        const dateStr = d.toLocaleString(locale(), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        return `
          <div class="audit-log-row">
            <p class="audit-log-action">${escapeHtml(f.message)}</p>
            <p class="audit-log-meta">${dateStr} · ${escapeHtml(f.email || f.uid)}</p>
          </div>`;
      })
      .join("");
  }

function loadAdminBusinessList() {
    if (!currentUser || currentUser.uid !== ADMIN_UID) return;
    db.collection("admin")
      .doc("businesses")
      .get()
      .then((snap) => {
        const list = snap.exists && snap.data().list ? snap.data().list : [];
        renderAdminBusinessList(list);
      })
      .catch((e) => {
        console.error("Yönetim listesi okunamadı", e);
        renderAdminBusinessList([]);
      });
  }

function renderAdminBusinessList(list) {
    const listEl = document.getElementById("adminBusinessList");
    const emptyEl = document.getElementById("adminEmptyState");
    if (!listEl) return;

    if (!list.length) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      return;
    }
    emptyEl.style.display = "none";

    listEl.innerHTML = list
      .map((b) => {
        const statusClass = b.active ? "admin-status-active" : "admin-status-inactive";
        const statusLabel = b.active ? t("adminActiveLabel") : t("adminInactiveLabel");
        const toggleLabel = b.active ? t("adminInactiveLabel") : t("adminActiveLabel");
        const dateStr = new Date(b.createdAt).toLocaleDateString(locale());
        const categoryKey = "category" + (b.businessCategory || "diger").charAt(0).toUpperCase() + (b.businessCategory || "diger").slice(1);
        const categoryLabel = t(categoryKey);
        return `
          <div class="admin-business-row">
            <div class="admin-business-info">
              <p class="admin-business-name">${escapeHtml(b.businessName)}</p>
              <p class="admin-business-meta">${escapeHtml(b.email)} · ${dateStr}</p>
              <span class="admin-status-badge ${statusClass}">${statusLabel}</span>
              <span class="admin-category-badge">${escapeHtml(categoryLabel)}</span>
              <div class="admin-branch-limit-row">
                <label>${t("adminMaxBranchesLabel")}</label>
                <input type="number" min="0" class="admin-branch-limit-input" data-uid="${b.uid}" placeholder="∞" />
                <button class="admin-branch-limit-save-btn" data-uid="${b.uid}">${t("adminSaveBtn")}</button>
              </div>
              <div class="admin-branches-list" id="adminBranches-${b.uid}"></div>
            </div>
            <button class="admin-toggle-btn" data-uid="${b.uid}" data-active="${b.active}">${toggleLabel}</button>
          </div>`;
      })
      .join("");

    list.forEach((b) => loadBranchesForAdmin(b.uid));

    listEl.querySelectorAll(".admin-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const currentlyActive = btn.dataset.active === "true";
        toggleAdminBusiness(btn.dataset.uid, !currentlyActive);
      });
    });

    listEl.querySelectorAll(".admin-branch-limit-save-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = listEl.querySelector(`.admin-branch-limit-input[data-uid="${btn.dataset.uid}"]`);
        const value = Number(input.value);
        if (!input.value || isNaN(value) || value < 0) {
          showToast(t("branchFieldsRequired"), "error");
          return;
        }
        setAdminBranchLimit(btn.dataset.uid, value);
      });
    });
  }

function loadBranchesForAdmin(patronUid) {
    const container = document.getElementById(`adminBranches-${patronUid}`);
    if (!container) return;

    currentUser
      .getIdToken()
      .then((idToken) =>
        fetch(`${adminConfig.workerUrl}/list-branches-for`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, targetUid: patronUid })
        })
      )
      .then((r) => r.json())
      .then((data) => {
        if (data.error || !data.branches || !data.branches.length) {
          container.innerHTML = "";
          return;
        }
        container.innerHTML = data.branches
          .map(
            (br) => `
              <div class="admin-branch-sub-row">
                <i class="fa-solid fa-code-branch" aria-hidden="true"></i>
                <span class="admin-branch-sub-name">${escapeHtml(br.branchName)}</span>
                <span class="admin-branch-sub-email">${escapeHtml(br.email)}</span>
              </div>`
          )
          .join("");
      })
      .catch((e) => console.error("Şubeler yüklenemedi", e));
  }

function createAdminBusiness() {
    if (!isAdminConfigured()) {
      showToast(t("adminNotConfigured"), "error");
      return;
    }
    const businessName = document.getElementById("adminBusinessName").value.trim();
    const email = document.getElementById("adminBusinessEmail").value.trim();
    const password = document.getElementById("adminBusinessPassword").value;
    const accountType = document.getElementById("adminAccountType").value;
    const businessCategory = document.getElementById("adminBusinessCategory").value;

    if (!businessName || !email || !password) {
      showToast(t("adminFieldsRequired"), "error");
      return;
    }

    currentUser
      .getIdToken()
      .then((idToken) =>
        fetch(`${adminConfig.workerUrl}/create-business`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, businessName, email, password, accountType, businessCategory })
        })
      )
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          showToast(data.error, "error");
          return;
        }
        showToast(t("adminCreateSuccess"), "success");
        document.getElementById("adminBusinessName").value = "";
        document.getElementById("adminBusinessEmail").value = "";
        document.getElementById("adminBusinessPassword").value = "";
        loadAdminBusinessList();
      })
      .catch((e) => {
        console.error(e);
        showToast(t("adminCreateError"), "error");
      });
  }

function toggleAdminBusiness(targetUid, active) {
    currentUser
      .getIdToken()
      .then((idToken) =>
        fetch(`${adminConfig.workerUrl}/toggle-business`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, targetUid, active })
        })
      )
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          showToast(data.error, "error");
          return;
        }
        loadAdminBusinessList();
      })
      .catch((e) => {
        console.error(e);
        showToast(t("adminToggleError"), "error");
      });
  }

function setAdminBranchLimit(targetUid, maxBranches) {
    currentUser
      .getIdToken()
      .then((idToken) =>
        fetch(`${adminConfig.workerUrl}/set-branch-limit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, targetUid, maxBranches })
        })
      )
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          showToast(data.error, "error");
          return;
        }
        showToast(t("adminBranchLimitSaved"), "success");
      })
      .catch((e) => {
        console.error(e);
        showToast(t("adminToggleError"), "error");
      });
  }
