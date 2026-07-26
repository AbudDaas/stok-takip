import { state } from './00-state.js';
import { locale } from './01-firebase-core.js';
import { escapeHtml, isAdminConfigured, showToast } from './02-utils.js';

export function loadAdminFeedback() {
    if (!state.currentUser || state.currentUser.uid !== state.ADMIN_UID) return;
    state.db.collection("admin")
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

export function renderAdminFeedback(list) {
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

export function loadAdminBusinessList() {
    if (!state.currentUser || state.currentUser.uid !== state.ADMIN_UID) return;
    state.db.collection("admin")
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

export function renderAdminBusinessList(list) {
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
        const statusLabel = b.active ? state.t("adminActiveLabel") : state.t("adminInactiveLabel");
        const toggleLabel = b.active ? state.t("adminInactiveLabel") : state.t("adminActiveLabel");
        const dateStr = new Date(b.createdAt).toLocaleDateString(locale());
        const categoryKey = "category" + (b.businessCategory || "diger").charAt(0).toUpperCase() + (b.businessCategory || "diger").slice(1);
        const categoryLabel = state.t(categoryKey);
        return `
          <div class="admin-business-row">
            <div class="admin-business-info">
              <p class="admin-business-name">${escapeHtml(b.businessName)}</p>
              <p class="admin-business-meta">${escapeHtml(b.email)} · ${dateStr}</p>
              <span class="admin-status-badge ${statusClass}">${statusLabel}</span>
              <span class="admin-category-badge">${escapeHtml(categoryLabel)}</span>
              <div class="admin-branch-limit-row">
                <label>${state.t("adminMaxBranchesLabel")}</label>
                <input type="number" min="0" class="admin-branch-limit-input" data-uid="${b.uid}" placeholder="∞" />
                <button class="admin-branch-limit-save-btn" data-uid="${b.uid}">${state.t("adminSaveBtn")}</button>
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
          showToast(state.t("branchFieldsRequired"), "error");
          return;
        }
        setAdminBranchLimit(btn.dataset.uid, value);
      });
    });
  }

export function loadBranchesForAdmin(patronUid) {
    const container = document.getElementById(`adminBranches-${patronUid}`);
    if (!container) return;

    state.currentUser
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

export function createAdminBusiness() {
    if (!isAdminConfigured()) {
      showToast(state.t("adminNotConfigured"), "error");
      return;
    }
    const businessName = document.getElementById("adminBusinessName").value.trim();
    const email = document.getElementById("adminBusinessEmail").value.trim();
    const password = document.getElementById("adminBusinessPassword").value;
    const accountType = document.getElementById("adminAccountType").value;
    const businessCategory = document.getElementById("adminBusinessCategory").value;

    if (!businessName || !email || !password) {
      showToast(state.t("adminFieldsRequired"), "error");
      return;
    }

    state.currentUser
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
        showToast(state.t("adminCreateSuccess"), "success");
        document.getElementById("adminBusinessName").value = "";
        document.getElementById("adminBusinessEmail").value = "";
        document.getElementById("adminBusinessPassword").value = "";
        loadAdminBusinessList();
      })
      .catch((e) => {
        console.error(e);
        showToast(state.t("adminCreateError"), "error");
      });
  }

export function toggleAdminBusiness(targetUid, active) {
    state.currentUser
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
        showToast(state.t("adminToggleError"), "error");
      });
  }

export function setAdminBranchLimit(targetUid, maxBranches) {
    state.currentUser
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
        showToast(state.t("adminBranchLimitSaved"), "success");
      })
      .catch((e) => {
        console.error(e);
        showToast(state.t("adminToggleError"), "error");
      });
  }
