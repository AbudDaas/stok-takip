/**
 * 03-staff-roles.js
 * Personel yönetimi: kasiyer/müdür rolleri, PIN girişi, sahip PIN'i, işlem geçmişi (audit log).
 */

function applyAccountTypeUI() {
    const isAdminUser = currentUser && currentUser.uid === ADMIN_UID;
    const isPatron = accountType === "patron";
    const operationalTabs = ["tab-products", "tab-kasa", "tab-scan", "tab-sales", "tab-veresiye", "tab-orders", "tab-pricechanges"];

    // Yönetici (sen) her zaman her şeyi görür.
    if (isAdminUser) {
      operationalTabs.forEach((tabId) => {
        const btn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
        if (btn) btn.style.display = "flex";
      });
      const branchesBtn = document.getElementById("branchesNavBtn");
      if (branchesBtn) branchesBtn.style.display = "flex";
      return;
    }

    // Bir şubeyi görüntülerken, o şubenin tam ekranını göster (kısıtlama uygulama).
    if (viewingBranchUid) {
      operationalTabs.forEach((tabId) => {
        const btn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
        if (btn) btn.style.display = "flex";
      });
      return;
    }

    // Patron hesabı: sadece Ayarlar + Şubelerim görünür.
    if (isPatron) {
      operationalTabs.forEach((tabId) => {
        const btn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
        if (btn) btn.style.display = "none";
      });
      const branchesBtn = document.getElementById("branchesNavBtn");
      if (branchesBtn) branchesBtn.style.display = "flex";
      switchTab("tab-branches");
      return;
    }

    // Şube ya da tekil bakkal/market hesabı: normal sekmeler görünür, Şubelerim gizli.
    operationalTabs.forEach((tabId) => {
      const btn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
      if (btn) btn.style.display = "flex";
    });
    const branchesBtn = document.getElementById("branchesNavBtn");
    if (branchesBtn) branchesBtn.style.display = "none";
  }

function logAudit(action, details) {
    const actorName = currentStaff ? `${currentStaff.name} (${currentStaff.role === "manager" ? t("staffRoleManager") : t("staffRoleCashier")})` : (currentUser && currentUser.email) || "?";
    auditLog.push({
      timestamp: new Date().toISOString(),
      actor: actorName,
      action,
      details: details || ""
    });
    if (auditLog.length > 300) {
      auditLog = auditLog.slice(auditLog.length - 300);
    }
  }

function renderAuditLog() {
    const listEl = document.getElementById("auditLogList");
    const emptyEl = document.getElementById("auditLogEmptyState");
    if (!listEl) return;

    const sorted = [...auditLog].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 100);
    if (!sorted.length) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      return;
    }
    emptyEl.style.display = "none";

    listEl.innerHTML = sorted
      .map((entry) => {
        const d = new Date(entry.timestamp);
        const dateStr = d.toLocaleString(locale(), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        return `
          <div class="audit-log-row">
            <p class="audit-log-action">${escapeHtml(entry.action)}</p>
            <p class="audit-log-meta">${dateStr} · ${escapeHtml(entry.actor)}${entry.details ? " · " + escapeHtml(entry.details) : ""}</p>
          </div>`;
      })
      .join("");
  }

function saveOwnerPin() {
    const value = document.getElementById("ownerPinInput").value.trim();
    if (!/^\d{4,6}$/.test(value)) {
      showToast(t("ownerPinInvalid"), "error");
      return;
    }
    ownerPin = value;
    const targetRef = originalDocRef || docRef;
    if (targetRef) {
      targetRef.set({ ownerPin: value }, { merge: true }).catch((e) => console.error("Sahip PIN'i kaydedilemedi", e));
    }
    document.getElementById("ownerPinInput").value = "";
    renderOwnerPinStatus();
    showToast(t("ownerPinSaved"), "success");
  }

function renderOwnerPinStatus() {
    const statusEl = document.getElementById("ownerPinStatus");
    if (!statusEl) return;
    statusEl.textContent = ownerPin ? t("ownerPinIsSet") : t("ownerPinNotSet");
    statusEl.style.color = ownerPin ? "var(--green-text)" : "var(--red-text)";
  }

function renderStaffList() {
    const listEl = document.getElementById("staffList");
    const emptyEl = document.getElementById("staffEmptyState");
    if (!listEl) return;

    if (!staffMembers.length) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      return;
    }
    emptyEl.style.display = "none";

    listEl.innerHTML = staffMembers
      .map((s, i) => {
        const roleLabel = s.role === "manager" ? t("staffRoleManager") : t("staffRoleCashier");
        return `
          <div class="staff-row">
            <div>
              <p class="staff-row-name">${escapeHtml(s.name)}</p>
              <p class="staff-row-role">${roleLabel}</p>
            </div>
            <button class="staff-remove-btn" data-index="${i}" aria-label="Kaldır"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
          </div>`;
      })
      .join("");

    listEl.querySelectorAll(".staff-remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        staffMembers.splice(Number(btn.dataset.index), 1);
        save();
        renderStaffList();
        showToast(t("staffRemoved"), "success");
      });
    });
  }

function addStaffMember() {
    const name = document.getElementById("staffName").value.trim();
    const pin = document.getElementById("staffPin").value.trim();
    const role = document.getElementById("staffRole").value;

    if (!name || !pin) {
      showToast(t("staffFieldsRequired"), "error");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      showToast(t("staffPinInvalid"), "error");
      return;
    }

    staffMembers.push({ id: genId(), name, pin, role });
    save();
    renderStaffList();
    document.getElementById("staffName").value = "";
    document.getElementById("staffPin").value = "";
    showToast(t("staffAdded"), "success");
  }

function checkStaffSelection() {
    if (!staffMembers.length) {
      currentStaff = null;
      applyRoleRestrictionsUI();
      return;
    }
    let savedStaffId = null;
    try {
      savedStaffId = sessionStorage.getItem("bakkal_current_staff_id");
    } catch (e) {}
    if (savedStaffId === "__owner__") {
      currentStaff = null;
      applyRoleRestrictionsUI();
      return;
    }
    const savedStaff = staffMembers.find((s) => s.id === savedStaffId);
    if (savedStaff) {
      currentStaff = savedStaff;
      applyRoleRestrictionsUI();
      return;
    }
    showStaffPicker();
  }

function showStaffPicker() {
    const listEl = document.getElementById("staffPickerList");
    listEl.innerHTML = staffMembers
      .map((s) => {
        const roleLabel = s.role === "manager" ? t("staffRoleManager") : t("staffRoleCashier");
        return `
          <button class="staff-picker-btn" data-id="${s.id}">
            <span>${escapeHtml(s.name)}</span>
            <span class="staff-picker-role">${roleLabel}</span>
          </button>`;
      })
      .join("");

    listEl.querySelectorAll(".staff-picker-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const staff = staffMembers.find((s) => s.id === btn.dataset.id);
        if (!staff) return;
        openStaffPinView({ type: "staff", staff });
      });
    });

    document.getElementById("staffPickerListView").style.display = "block";
    document.getElementById("staffPickerPinView").style.display = "none";
    document.getElementById("staffPickerScreen").style.display = "flex";
  }

function openStaffPinView(selection) {
    staffPickerPendingSelection = selection;
    document.getElementById("staffPickerListView").style.display = "none";
    document.getElementById("staffPickerPinView").style.display = "block";

    const nameEl = document.getElementById("staffPickerSelectedName");
    if (selection.type === "owner") {
      nameEl.textContent = t("staffOwnerSelectedLabel");
    } else {
      const roleLabel = selection.staff.role === "manager" ? t("staffRoleManager") : t("staffRoleCashier");
      nameEl.textContent = `${selection.staff.name} (${roleLabel})`;
    }

    const pinInput = document.getElementById("staffPickerPinInput");
    const errorEl = document.getElementById("staffPickerPinError");
    pinInput.value = "";
    errorEl.style.display = "none";
    setTimeout(() => pinInput.focus(), 50);
  }

function staffPickerGoBack() {
    staffPickerPendingSelection = null;
    document.getElementById("staffPickerListView").style.display = "block";
    document.getElementById("staffPickerPinView").style.display = "none";
  }

function submitStaffPickerPin() {
    if (!staffPickerPendingSelection) return;
    const entered = document.getElementById("staffPickerPinInput").value.trim();
    const errorEl = document.getElementById("staffPickerPinError");

    if (staffPickerPendingSelection.type === "owner") {
      if (ownerPin && entered !== ownerPin) {
        errorEl.textContent = t("ownerPinWrong");
        errorEl.style.display = "block";
        return;
      }
      grantOwnerAccess();
      return;
    }

    const staff = staffPickerPendingSelection.staff;
    if (entered !== staff.pin) {
      errorEl.textContent = t("staffPinWrong");
      errorEl.style.display = "block";
      return;
    }
    currentStaff = staff;
    try {
      sessionStorage.setItem("bakkal_current_staff_id", staff.id);
    } catch (e) {}
    document.getElementById("staffPickerScreen").style.display = "none";
    applyRoleRestrictionsUI();
  }

function enterAsOwner() {
    if (ownerPin) {
      openStaffPinView({ type: "owner" });
      return;
    }
    grantOwnerAccess();
  }

function grantOwnerAccess() {
    currentStaff = null;
    try {
      sessionStorage.setItem("bakkal_current_staff_id", "__owner__");
    } catch (e) {}
    applyRoleRestrictionsUI();
  }

function applyRoleRestrictionsUI() {
    document.getElementById("staffPickerScreen").style.display = "none";

    if (!currentStaff || currentStaff.role === "manager") {
      // Sahip ya da müdür: önceki kasiyer kısıtlamasından kalmış olabilecek
      // gizli sekmeleri, hesap türü/basit mod kurallarına göre doğru şekilde geri getir.
      applyAccountTypeUI();
      reapplySimpleModeIfSet();
      updateSwitchUserButtonVisibility();
      return;
    }

    // Kasiyer: sadece Kasa, Satışlar, Veresiye görünür.
    const cashierBlockedTabs = ["tab-products", "tab-scan", "tab-orders", "tab-pricechanges", "tab-settings", "tab-branches", "tab-suppliers"];
    cashierBlockedTabs.forEach((tabId) => {
      const btn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
      if (btn) btn.style.display = "none";
    });
    const adminBtn = document.getElementById("adminNavBtn");
    if (adminBtn) adminBtn.style.display = "none";
    updateSwitchUserButtonVisibility();
    switchTab("tab-kasa");
  }

function updateSwitchUserButtonVisibility() {
    const btn = document.getElementById("switchUserBtn");
    if (!btn) return;
    btn.style.display = staffMembers.length > 0 ? "inline-flex" : "none";
  }

function switchUser() {
    currentStaff = null;
    try {
      sessionStorage.removeItem("bakkal_current_staff_id");
    } catch (e) {}
    showStaffPicker();
  }
