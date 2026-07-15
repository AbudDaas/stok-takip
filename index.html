<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Bakkal Stok Takip</title>
<meta name="theme-color" content="#1F3864" />
<link rel="manifest" href="manifest.json" />
<link rel="icon" href="icons/icon-192.png" />
<link rel="apple-touch-icon" href="icons/icon-192.png" />
<link rel="stylesheet" href="css/style.css" />
</head>
<body>

  <header class="topbar">
    <div class="topbar-title">
      <i class="fa-solid fa-store" aria-hidden="true"></i>
      <span data-i18n="appName">Bakkal Stok Takip</span>
    </div>
    <div class="topbar-right">
      <div class="lang-switch">
        <button class="lang-btn" data-lang="tr">TR</button>
        <button class="lang-btn" data-lang="en">EN</button>
        <button class="lang-btn" data-lang="ar">AR</button>
      </div>
      <div id="syncBadge" class="sync-badge" title="Senkronizasyon durumu">
        <i class="fa-solid fa-cloud" id="syncIcon" aria-hidden="true"></i>
        <span id="syncText">Yerel</span>
      </div>
      <button id="logoutBtn" class="icon-btn-topbar" data-i18n-title="logoutTitle" title="Çıkış yap" style="display:none;">
        <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
      </button>
    </div>
  </header>

  <!-- GİRİŞ / KAYIT EKRANI (yalnızca bulut senkronizasyonu ayarlıysa gösterilir) -->
  <div id="authScreen" class="auth-screen" style="display:none;">
    <div class="auth-box">
      <div class="auth-logo">
        <i class="fa-solid fa-store" aria-hidden="true"></i>
        <span data-i18n="appName">Bakkal Stok Takip</span>
      </div>
      <p class="auth-title" data-i18n="authTitle">Giriş Yap</p>
      <p id="authError" class="auth-error" style="display:none;"></p>
      <div class="form-row">
        <input id="authEmail" type="email" data-i18n-placeholder="authEmailPh" placeholder="E-posta" autocomplete="username" />
      </div>
      <div class="form-row">
        <input id="authPassword" type="password" data-i18n-placeholder="authPasswordPh" placeholder="Şifre" autocomplete="current-password" />
      </div>
      <button id="authSubmitBtn" class="btn btn-primary btn-block" data-i18n="authSubmit">Giriş Yap</button>
      <button id="forgotPasswordBtn" class="link-btn" data-i18n="authForgot">Şifremi unuttum</button>
      <p class="auth-hint" data-i18n="authHint">Hesabınız yoksa işletme sahibinden/yöneticinizden hesap açmasını isteyin.</p>
    </div>
  </div>

  <div id="toastContainer" class="toast-container"></div>

  <main id="app">

    <!-- ÖZET -->
    <section class="stats-grid">
      <div class="stat-card">
        <p class="stat-label" data-i18n="statTotalProducts">Toplam ürün</p>
        <p class="stat-value" id="statTotal">0</p>
      </div>
      <div class="stat-card stat-danger">
        <p class="stat-label" data-i18n="statOrderNeeded">Sipariş gerekli</p>
        <p class="stat-value" id="statOrder">0</p>
      </div>
    </section>

    <!-- SEKME: ÜRÜNLER -->
    <section id="tab-products" class="tab-panel active">

      <button id="importBackupBtn" class="btn btn-block import-backup-btn" style="display:none;">
        <i class="fa-solid fa-arrows-rotateload" aria-hidden="true"></i>
        <span data-i18n="importBackupBtn">Yerel yedeği içe aktar (eski verileri geri yükle)</span>
      </button>

      <div class="card">
        <p class="card-title" data-i18n="addProductTitle">Ürün ekle</p>
        <div class="form-row">
          <input id="newName" type="text" data-i18n-placeholder="namePh" placeholder="Ürün adı, örn. pepsi 1 lt" />
        </div>
        <div class="form-row two-col">
          <input id="newCategory" type="text" data-i18n-placeholder="categoryPh" placeholder="Kategori, örn. içecekler" />
          <input id="newMin" type="number" min="0" step="any" data-i18n-placeholder="minStockPh" placeholder="Min. stok" value="5" />
        </div>
        <div class="form-row two-col">
          <input id="newQty" type="number" min="0" step="any" data-i18n-placeholder="startStockPh" placeholder="Başlangıç stok" value="0" />
          <input id="newPrice" type="number" min="0" step="0.01" data-i18n-placeholder="pricePh" placeholder="Fiyat (₺)" value="0" />
        </div>
        <div class="form-row">
          <input id="newCostPrice" type="number" min="0" step="0.01" data-i18n-placeholder="costPricePh" placeholder="Alış fiyatı (₺, opsiyonel)" value="0" />
        </div>
        <div class="form-row">
          <label class="field-label" data-i18n="unitLabel">Satış birimi</label>
          <select id="newUnit">
            <option value="adet" data-i18n="unitAdet">Adet (tam sayı)</option>
            <option value="kg" data-i18n="unitKg">Kg (tartılı / açık ürün)</option>
          </select>
        </div>
        <div class="form-row barcode-row">
          <input id="newBarcode" type="text" data-i18n-placeholder="barcodePh" placeholder="Barkod (opsiyonel)" />
          <button id="scanNewBarcodeBtn" type="button" class="btn btn-icon-only" data-i18n-aria="scanBarcodeAria" aria-label="Barkod tara">
            <i class="fa-solid fa-barcode" aria-hidden="true"></i>
          </button>
        </div>
        <button id="addBtn" class="btn btn-primary btn-block">
          <i class="fa-solid fa-plus" aria-hidden="true"></i> <span data-i18n="addProductBtn">Ürün ekle</span>
        </button>
      </div>

      <div class="card">
        <p class="card-title" data-i18n="bulkScanTitle">Rafı fotoğrafla (toplu ekle)</p>
        <p class="card-subtitle" data-i18n="bulkScanSubtitle">Bir raf fotoğrafı çek, yapay zeka ürünleri tanısın, sistemde olmayanları toplu ekle.</p>
        <input id="shelfPhotoInput" type="file" accept="image/*" multiple style="display:none;" />
        <button id="shelfPhotoBtn" class="btn btn-primary btn-block">
          <i class="fa-solid fa-camera" aria-hidden="true"></i> <span data-i18n="bulkScanBtn">Fotoğraf çek / seç</span>
        </button>
        <div id="bulkScanLoading" class="bulk-scan-loading" style="display:none;">
          <i class="fa-solid fa-spinner spin" aria-hidden="true"></i>
          <span data-i18n="bulkScanAnalyzing">Fotoğraf analiz ediliyor...</span>
        </div>
      </div>

      <div class="section-header">
        <p class="card-title" data-i18n="allProductsTitle">Tüm ürünler</p>
        <input id="searchBox" type="text" class="search-input" data-i18n-placeholder="searchPh" placeholder="Ürün ara..." />
      </div>

      <div id="productList" class="list"></div>
      <p id="emptyState" class="empty-state" data-i18n="emptyProducts">Henüz ürün yok. Yukarıdan ekleyerek başla.</p>
    </section>

    <!-- SEKME: QR TARA (STOK GİRİŞ/ÇIKIŞ) -->
    <section id="tab-scan" class="tab-panel">
      <div class="card">
        <p class="card-title" data-i18n="scanTitle">QR kod ile giriş / çıkış</p>
        <p class="card-subtitle" data-i18n="scanSubtitle">Bir ürünün QR kodunu okutarak stok girişi veya çıkışı yapabilirsin.</p>
        <button id="startScanBtn" class="btn btn-primary btn-block">
          <i class="fa-solid fa-camera" aria-hidden="true"></i> <span data-i18n="startCamera">Kamerayı başlat</span>
        </button>
        <div id="qrReader" class="qr-reader"></div>
        <button id="stopScanBtn" class="btn btn-block" style="display:none;">
          <i class="fa-solid fa-stop" aria-hidden="true"></i> <span data-i18n="stopScan">Taramayı durdur</span>
        </button>
      </div>

      <div class="card">
        <p class="card-title" data-i18n="printQrTitle">QR kodları yazdır</p>
        <p class="card-subtitle" data-i18n="printQrSubtitle">Her ürün için bir QR kod oluşturup rafa yapıştırabilirsin. Ürünler listesinden bir ürüne dokun, "QR kodu göster" seçeneğini kullan.</p>
      </div>
    </section>

    <!-- SEKME: KASA (SATIŞ) -->
    <section id="tab-kasa" class="tab-panel">
      <div class="card">
        <p class="card-title" data-i18n="kasaTitle">Kasa — QR okutarak satış</p>
        <p class="card-subtitle" data-i18n="kasaSubtitle">Müşterinin aldığı ürünlerin QR kodunu sırayla okut, sepete otomatik eklensin.</p>
        <button id="startKasaScanBtn" class="btn btn-primary btn-block">
          <i class="fa-solid fa-camera" aria-hidden="true"></i> <span data-i18n="startCamera">Kamerayı başlat</span>
        </button>
        <div id="qrReaderKasa" class="qr-reader"></div>
        <button id="stopKasaScanBtn" class="btn btn-block" style="display:none;">
          <i class="fa-solid fa-stop" aria-hidden="true"></i> <span data-i18n="stopScan">Taramayı durdur</span>
        </button>
      </div>

      <div class="card">
        <p class="card-title" data-i18n="manualAddTitle">Ürün seç ve ekle (QR'sız)</p>
        <div class="form-row">
          <input id="manualAddSearch" type="text" data-i18n-placeholder="searchPh" placeholder="Ürün ara..." />
        </div>
        <div id="manualAddResults" class="list"></div>
      </div>

      <div class="card">
        <div class="card-header-row">
          <p class="card-title" data-i18n="cartTitle">Sepet</p>
          <button id="clearCartBtn" class="btn btn-sm">
            <i class="fa-solid fa-trash" aria-hidden="true"></i> <span data-i18n="clearCart">Sepeti boşalt</span>
          </button>
        </div>
        <div id="cartList" class="list"></div>
        <p id="cartEmptyState" class="empty-state" data-i18n="emptyCart">Sepet boş. Ürün QR kodunu okutarak ekle.</p>

        <div class="form-row">
          <label class="field-label" data-i18n="discountLabel">İndirim (₺)</label>
          <input id="cartDiscount" type="number" min="0" step="0.01" value="0" />
        </div>

        <div class="cart-subtotal-row">
          <span data-i18n="subtotalLabel">Ara toplam</span>
          <span id="cartSubtotal">0,00 ₺</span>
        </div>
        <div class="cart-total-row">
          <span data-i18n="totalLabel">Toplam</span>
          <span id="cartTotal">0,00 ₺</span>
        </div>

        <div class="payment-type-row">
          <button id="payNakitBtn" class="payment-type-btn active" data-type="nakit">
            <i class="fa-solid fa-money-bill" aria-hidden="true"></i> <span data-i18n="payNakit">Nakit</span>
          </button>
          <button id="payVeresiyeBtn" class="payment-type-btn" data-type="veresiye">
            <i class="fa-solid fa-book" aria-hidden="true"></i> <span data-i18n="payVeresiye">Veresiye</span>
          </button>
        </div>
        <div id="veresiyeCustomerRow" class="form-row" style="display:none;">
          <div class="searchable-select">
            <input id="veresiyeCustomerSearch" type="text" data-i18n-placeholder="searchCustomerPh" placeholder="Müşteri ara..." autocomplete="off" />
            <input type="hidden" id="veresiyeCustomerSelectedId" />
            <div id="veresiyeCustomerResults" class="searchable-results"></div>
          </div>
        </div>

        <button id="completeSaleBtn" class="btn btn-primary btn-block">
          <i class="fa-solid fa-check" aria-hidden="true"></i> <span data-i18n="completeSaleBtn">Satışı tamamla</span>
        </button>
      </div>
    </section>

    <!-- SEKME: SATIŞLAR -->
    <section id="tab-sales" class="tab-panel">
      <div class="period-filter">
        <button class="period-btn active" data-period="today" data-i18n="periodToday">Bugün</button>
        <button class="period-btn" data-period="week" data-i18n="periodWeek">Bu Hafta</button>
        <button class="period-btn" data-period="month" data-i18n="periodMonth">Bu Ay</button>
        <button class="period-btn" data-period="all" data-i18n="periodAll">Tümü</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <p class="stat-label" data-i18n="statPeriodTotal">Toplam ciro</p>
          <p class="stat-value" id="statPeriodTotal">0,00 ₺</p>
        </div>
        <div class="stat-card">
          <p class="stat-label" data-i18n="statPeriodCount">İşlem sayısı</p>
          <p class="stat-value" id="statPeriodCount">0</p>
        </div>
      </div>

      <div class="profit-highlight-card">
        <p class="stat-label" data-i18n="statNetProfit">Net kâr</p>
        <p class="stat-value" id="statNetProfit">0,00 ₺</p>
      </div>

      <p class="card-title" data-i18n="topProductsTitle">En çok satan ürünler</p>
      <div id="topProductsList" class="list"></div>
      <p id="topProductsEmptyState" class="empty-state" data-i18n="emptyTopProducts">Bu dönemde satış yok.</p>

      <p class="card-title" data-i18n="salesHistoryTitle">Satış geçmişi</p>
      <div id="salesList" class="list"></div>
      <p id="salesEmptyState" class="empty-state" data-i18n="emptySales">Bu dönemde satış yapılmadı.</p>
    </section>

    <!-- SEKME: VERESİYE -->
    <section id="tab-veresiye" class="tab-panel">
      <div class="card">
        <p class="card-title" data-i18n="addCustomerTitle">Müşteri ekle</p>
        <div class="form-row">
          <input id="newCustomerName" type="text" data-i18n-placeholder="customerNamePh" placeholder="Müşteri adı" />
        </div>
        <div class="form-row">
          <input id="newCustomerPhone" type="text" data-i18n-placeholder="customerPhonePh" placeholder="Telefon (opsiyonel)" />
        </div>
        <button id="addCustomerBtn" class="btn btn-primary btn-block">
          <i class="fa-solid fa-user-plus" aria-hidden="true"></i> <span data-i18n="addCustomerBtn">Müşteri ekle</span>
        </button>
      </div>

      <div class="stats-grid">
        <div class="stat-card stat-danger">
          <p class="stat-label" data-i18n="statTotalDebt">Toplam alacak</p>
          <p class="stat-value" id="statTotalDebt">0,00 ₺</p>
        </div>
        <div class="stat-card">
          <p class="stat-label" data-i18n="statCustomerCount">Müşteri sayısı</p>
          <p class="stat-value" id="statCustomerCount">0</p>
        </div>
      </div>

      <p class="card-title" data-i18n="customersTitle">Müşteriler</p>
      <div id="customerList" class="list"></div>
      <p id="customerEmptyState" class="empty-state" data-i18n="emptyCustomers">Henüz müşteri yok.</p>
    </section>

    <!-- SEKME: SİPARİŞ LİSTESİ -->
    <section id="tab-orders" class="tab-panel">
      <div class="card-header-row">
        <p class="card-title" data-i18n="orderListTitle">Acil sipariş listesi</p>
        <button id="resetBtn" class="btn btn-sm">
          <i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i> <span data-i18n="resetAllBtn">Tümünü sıfırla</span>
        </button>
      </div>
      <div id="orderList" class="list"></div>
      <p id="orderEmptyState" class="empty-state" data-i18n="emptyOrders">Şu anda sipariş edilmesi gereken ürün yok.</p>
    </section>

  </main>

  <!-- ÜRÜN DETAY / QR MODAL -->
  <div id="detailModal" class="modal-overlay" style="display:none;">
    <div class="modal">
      <div class="modal-header">
        <p id="modalProductName" class="modal-title"></p>
        <button id="closeModalBtn" class="icon-btn" aria-label="Kapat"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </div>
      <div class="modal-body">
        <div class="qty-control">
          <button id="qtyMinusBtn" class="qty-btn" aria-label="Stok azalt"><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
          <span id="modalQty" class="qty-display">0</span>
          <button id="qtyPlusBtn" class="qty-btn" aria-label="Stok arttır"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
        </div>
        <p id="modalStatus" class="status-pill"></p>

        <div class="modal-section">
          <div id="modalQrCode" class="qr-code-box"></div>
          <button id="printQrBtn" class="btn btn-block">
            <i class="fa-solid fa-print" aria-hidden="true"></i> <span data-i18n="printQrBtn">QR kodu yazdır</span>
          </button>
        </div>

        <div class="modal-section">
          <label class="field-label" data-i18n="productNameLabel">Ürün adı</label>
          <input id="editName" type="text" />
          <div class="form-row two-col">
            <div>
              <label class="field-label" data-i18n="categoryLabel">Kategori</label>
              <input id="editCategory" type="text" />
            </div>
            <div>
              <label class="field-label" data-i18n="minStockLabel">Min. stok</label>
              <input id="editMin" type="number" min="0" step="any" />
            </div>
          </div>
          <label class="field-label" data-i18n="priceLabel">Fiyat (₺)</label>
          <input id="editPrice" type="number" min="0" step="0.01" />
          <label class="field-label" data-i18n="costPriceLabel">Alış fiyatı (₺, opsiyonel)</label>
          <input id="editCostPrice" type="number" min="0" step="0.01" />
          <label class="field-label" data-i18n="unitLabel">Satış birimi</label>
          <select id="editUnit">
            <option value="adet" data-i18n="unitAdet">Adet (tam sayı)</option>
            <option value="kg" data-i18n="unitKg">Kg (tartılı / açık ürün)</option>
          </select>
          <label class="field-label" data-i18n="barcodeLabel">Barkod</label>
          <div class="form-row barcode-row">
            <input id="editBarcode" type="text" data-i18n-placeholder="barcodePh" placeholder="Barkod (opsiyonel)" />
            <button id="scanEditBarcodeBtn" type="button" class="btn btn-icon-only" data-i18n-aria="scanBarcodeAria" aria-label="Barkod tara">
              <i class="fa-solid fa-barcode" aria-hidden="true"></i>
            </button>
          </div>
          <button id="saveEditBtn" class="btn btn-primary btn-block" data-i18n="saveBtn">Kaydet</button>
          <button id="deleteProductBtn" class="btn btn-danger btn-block">
            <i class="fa-solid fa-trash" aria-hidden="true"></i> <span data-i18n="deleteProductBtn">Ürünü sil</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- HIZLI BARKOD TARAMA MODAL -->
  <div id="barcodeScanModal" class="modal-overlay" style="display:none;">
    <div class="modal">
      <div class="modal-header">
        <p class="modal-title" data-i18n="quickBarcodeTitle">Barkodu tara</p>
        <button id="closeBarcodeModalBtn" class="icon-btn" aria-label="Kapat"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </div>
      <div class="modal-body">
        <p class="card-subtitle" data-i18n="quickBarcodeSubtitle">Ürünün üzerindeki barkodu kameraya göster.</p>
        <div id="quickScanReader" class="qr-reader"></div>
      </div>
    </div>
  </div>

  <!-- TOPLU FOTOĞRAF TARAMA SONUÇ MODAL -->
  <div id="bulkScanModal" class="modal-overlay" style="display:none;">
    <div class="modal">
      <div class="modal-header">
        <p id="bulkScanModalTitle" class="modal-title"></p>
        <button id="closeBulkScanModalBtn" class="icon-btn" aria-label="Kapat"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </div>
      <div class="modal-body">
        <div id="bulkScanResultsList" class="list"></div>
        <button id="bulkAddAllBtn" class="btn btn-primary btn-block">
          <span data-i18n="bulkAddAllBtn">Hepsini ekle</span>
        </button>
      </div>
    </div>
  </div>

  <!-- MÜŞTERİ DETAY MODAL -->
  <div id="customerModal" class="modal-overlay" style="display:none;">
    <div class="modal">
      <div class="modal-header">
        <p id="customerModalName" class="modal-title"></p>
        <button id="closeCustomerModalBtn" class="icon-btn" aria-label="Kapat"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </div>
      <div class="modal-body">
        <p class="debt-display">
          <span data-i18n="currentBalance">Güncel bakiye</span>
          <span id="customerModalDebt" class="debt-amount">0,00 ₺</span>
        </p>

        <div class="modal-section">
          <label class="field-label" data-i18n="takePayment">Ödeme al</label>
          <div class="form-row barcode-row">
            <input id="paymentAmountInput" type="number" min="0" step="0.01" data-i18n-placeholder="amountPh" placeholder="Tutar (₺)" />
            <button id="recordPaymentBtn" class="btn btn-primary" style="width:auto;padding:0 16px;" data-i18n="saveBtn">Kaydet</button>
          </div>
        </div>

        <div class="modal-section">
          <label class="field-label" data-i18n="customerNameLabel">Müşteri adı</label>
          <input id="editCustomerName" type="text" />
          <label class="field-label" data-i18n="phoneLabel">Telefon</label>
          <input id="editCustomerPhone" type="text" />
          <button id="saveCustomerEditBtn" class="btn btn-primary btn-block" data-i18n="saveBtn">Kaydet</button>
          <button id="deleteCustomerBtn" class="btn btn-danger btn-block">
            <i class="fa-solid fa-trash" aria-hidden="true"></i> <span data-i18n="deleteCustomerBtn">Müşteriyi sil</span>
          </button>
        </div>

        <div class="modal-section">
          <p class="field-label" data-i18n="historyTitle">İşlem geçmişi</p>
          <div id="customerHistoryList" class="list"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ALT NAVİGASYON -->
  <nav class="bottom-nav">
    <button class="nav-btn active" data-tab="tab-products">
      <i class="fa-solid fa-list" aria-hidden="true"></i>
      <span data-i18n="navProducts">Ürünler</span>
    </button>
    <button class="nav-btn" data-tab="tab-kasa">
      <i class="fa-solid fa-money-bill-register" aria-hidden="true"></i>
      <span data-i18n="navKasa">Kasa</span>
    </button>
    <button class="nav-btn" data-tab="tab-scan">
      <i class="fa-solid fa-qrcode" aria-hidden="true"></i>
      <span data-i18n="navScan">QR Tara</span>
    </button>
    <button class="nav-btn" data-tab="tab-sales">
      <i class="fa-solid fa-receipt" aria-hidden="true"></i>
      <span data-i18n="navSales">Satışlar</span>
    </button>
    <button class="nav-btn" data-tab="tab-veresiye">
      <i class="fa-solid fa-book" aria-hidden="true"></i>
      <span data-i18n="navVeresiye">Veresiye</span>
    </button>
    <button class="nav-btn" data-tab="tab-orders">
      <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
      <span data-i18n="navOrders">Sipariş</span>
    </button>
  </nav>

  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>

  <!-- Firebase (bulut senkronizasyonu) -->
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
  <script src="js/firebase-config.js"></script>
  <script src="js/bulk-scan-config.js"></script>

  <script src="js/i18n.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
