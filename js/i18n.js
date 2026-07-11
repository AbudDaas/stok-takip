(function () {
  "use strict";

  // ---------- Çeviri sözlüğü (Translation dictionary) ----------
  var translations = {
    tr: {
      app_title: "Bakkal Stok Takip",
      sync_local: "Yerel",
      sync_connecting: "Bağlanıyor",
      sync_connected: "Senkron",
      sync_error: "Hata",
      sync_status_tooltip: "Senkronizasyon durumu",
      logout_tooltip: "Çıkış yap",

      auth_title: "Giriş Yap",
      auth_email_placeholder: "E-posta",
      auth_password_placeholder: "Şifre",
      auth_submit: "Giriş Yap",
      auth_forgot: "Şifremi unuttum",
      auth_hint: "Hesabınız yoksa işletme sahibinden/yöneticinizden hesap açmasını isteyin.",

      stat_total_products: "Toplam ürün",
      stat_order_needed: "Sipariş gerekli",

      card_add_product: "Ürün ekle",
      placeholder_product_name: "Ürün adı, örn. pepsi 1 lt",
      placeholder_category: "Kategori, örn. içecekler",
      placeholder_min_stock: "Min. stok",
      placeholder_initial_stock: "Başlangıç stok",
      placeholder_price: "Fiyat (₺)",
      label_unit: "Satış birimi",
      unit_option_adet: "Adet (tam sayı)",
      unit_option_kg: "Kg (tartılı / açık ürün)",
      placeholder_barcode: "Barkod (opsiyonel)",
      aria_scan_barcode: "Barkod tara",
      btn_add_product: "Ürün ekle",
      card_all_products: "Tüm ürünler",
      placeholder_search_product: "Ürün ara...",
      empty_no_products: "Henüz ürün yok. Yukarıdan ekleyerek başla.",

      tab_products: "Ürünler",
      tab_kasa: "Kasa",
      tab_scan: "QR Tara",
      tab_sales: "Satışlar",
      tab_veresiye: "Veresiye",
      tab_orders: "Sipariş",

      card_qr_scan_title: "QR kod ile giriş / çıkış",
      card_qr_scan_subtitle: "Bir ürünün QR kodunu okutarak stok girişi veya çıkışı yapabilirsin.",
      btn_start_camera: "Kamerayı başlat",
      btn_stop_scan: "Taramayı durdur",
      card_print_qr_title: "QR kodları yazdır",
      card_print_qr_subtitle: "Her ürün için bir QR kod oluşturup rafa yapıştırabilirsin. Ürünler listesinden bir ürüne dokun, \"QR kodu göster\" seçeneğini kullan.",

      card_kasa_title: "Kasa — QR okutarak satış",
      card_kasa_subtitle: "Müşterinin aldığı ürünlerin QR kodunu sırayla okut, sepete otomatik eklensin.",
      card_manual_add_title: "Ürün seç ve ekle (QR'sız)",
      card_cart_title: "Sepet",
      btn_clear_cart: "Sepeti boşalt",
      empty_cart: "Sepet boş. Ürün QR kodunu okutarak ekle.",
      label_discount: "İndirim (₺)",
      label_subtotal: "Ara toplam",
      label_total: "Toplam",
      payment_cash: "Nakit",
      payment_credit: "Veresiye",
      btn_complete_sale: "Satışı tamamla",

      period_today: "Bugün",
      period_week: "Bu Hafta",
      period_month: "Bu Ay",
      period_all: "Tümü",
      stat_total_revenue: "Toplam ciro",
      stat_transaction_count: "İşlem sayısı",
      card_top_products: "En çok satan ürünler",
      empty_no_sales_period: "Bu dönemde satış yok.",
      card_sales_history: "Satış geçmişi",
      empty_no_sales_made: "Bu dönemde satış yapılmadı.",

      card_add_customer: "Müşteri ekle",
      placeholder_customer_name: "Müşteri adı",
      placeholder_customer_phone: "Telefon (opsiyonel)",
      btn_add_customer: "Müşteri ekle",
      stat_total_debt: "Toplam alacak",
      stat_customer_count: "Müşteri sayısı",
      card_customers: "Müşteriler",
      empty_no_customers: "Henüz müşteri yok.",

      card_urgent_orders: "Acil sipariş listesi",
      btn_reset_all: "Tümünü sıfırla",
      empty_no_orders_needed: "Şu anda sipariş edilmesi gereken ürün yok.",

      aria_decrease_stock: "Stok azalt",
      aria_increase_stock: "Stok arttır",
      btn_print_qr: "QR kodu yazdır",
      label_product_name: "Ürün adı",
      label_category: "Kategori",
      label_min_stock2: "Min. stok",
      label_price: "Fiyat (₺)",
      label_barcode: "Barkod",
      btn_save: "Kaydet",
      btn_delete_product: "Ürünü sil",

      modal_scan_barcode_title: "Barkodu tara",
      modal_scan_barcode_subtitle: "Ürünün üzerindeki barkodu kameraya göster.",

      label_current_balance: "Güncel bakiye",
      label_take_payment: "Ödeme al",
      placeholder_amount: "Tutar (₺)",
      label_edit_customer_phone: "Telefon",
      btn_delete_customer: "Müşteriyi sil",
      label_transaction_history: "İşlem geçmişi",

      status_yeterli: "Yeterli",
      status_kritik: "Kritik",
      status_tukendi: "Tükendi",

      unit_kg: "kg",
      unit_adet: "adet",
      category_other: "diğer",

      btn_manual_add: "Ekle",
      empty_no_match_product: "Eşleşen ürün yok.",
      empty_no_history: "Henüz işlem yok.",
      label_payment_received: "Ödeme alındı",
      sold_qty_template: "{qty} adet satıldı",
      btn_cancel_sale: "İptal et",

      confirm_logout: "Çıkış yapmak istediğine emin misin?",
      auth_forgot_need_email: "Şifre sıfırlama bağlantısı göndermek için önce e-posta adresini yaz.",
      auth_forgot_sent: "Şifre sıfırlama bağlantısı e-postana gönderildi. Gelen kutunu (ve spam klasörünü) kontrol et.",
      auth_fields_required: "E-posta ve şifre gerekli.",
      auth_error_invalid_email: "Geçersiz e-posta adresi.",
      auth_error_user_not_found: "Bu e-posta ile kayıtlı bir hesap bulunamadı. İşletme sahibinden hesap açmasını isteyin.",
      auth_error_wrong_password: "Şifre hatalı.",
      auth_error_invalid_credential: "E-posta veya şifre hatalı.",
      auth_error_too_many_requests: "Çok fazla deneme yapıldı, biraz sonra tekrar dene.",
      auth_error_generic: "Bir hata oluştu, tekrar dene.",

      confirm_delete_customer_with_debt: "Bu müşterinin {amount} bakiyesi var. Yine de silmek istediğine emin misin?",
      alert_scan_not_found: "Bu kod kayıtlı bir ürüne ait değil.",
      alert_camera_error: "Kamera başlatılamadı. Tarayıcı izinlerini kontrol et.",
      prompt_kg: "Kaç kg?",
      alert_invalid_weight: "Geçerli bir ağırlık girmedin.",
      confirm_stock_action: "{name}\nMevcut stok: {stock}\n\nStok GİRİŞİ için Tamam, ÇIKIŞI için İptal'e bas.",
      prompt_kg_kasa: "{name} — kaç kg?",
      prompt_adet_kasa: "{name} — kaç adet?",
      alert_invalid_amount: "Geçerli bir miktar girmedin.",
      scan_feedback_added: "{name} eklendi",
      confirm_clear_cart: "Sepeti boşaltmak istediğine emin misin?",
      alert_cart_empty: "Sepet boş.",
      alert_need_customer_first: "Önce Veresiye sekmesinden bir müşteri eklemen gerekiyor.",
      alert_select_customer: "Lütfen bir müşteri seç.",
      alert_sale_completed: "Satış tamamlandı: {total}",
      label_credit_suffix: " (Veresiye: {name})",
      confirm_cancel_sale: "Bu satış iptal edilsin mi?\n{total} tutarındaki satış silinecek ve ürünler stoğa geri eklenecek.",
      confirm_delete_product: "Bu ürünü silmek istediğine emin misin?",
      confirm_reset_all: "Tüm ürünlerin stoğu minimum seviyeye sıfırlansın mı?",
      confirm_delete_customer: "Bu müşteriyi silmek istediğine emin misin?",
      alert_qr_lib_error: "QR kütüphanesi yüklenemedi (internet bağlantısını kontrol et).",
      prompt_edit_weight: "{name} — yeni ağırlık (kg)",
      print_qr_window_title: "QR Yazdır",
      aria_edit_weight: "Ağırlığı düzenle",
      aria_decrease_cart_qty: "Azalt",
      aria_increase_cart_qty: "Arttır",
      aria_remove_from_cart: "Kaldır",
      aria_close: "Kapat"
    },
    ar: {
      app_title: "تتبع مخزون البقالة",
      sync_local: "محلي",
      sync_connecting: "جارٍ الاتصال",
      sync_connected: "متزامن",
      sync_error: "خطأ",
      sync_status_tooltip: "حالة المزامنة",
      logout_tooltip: "تسجيل الخروج",

      auth_title: "تسجيل الدخول",
      auth_email_placeholder: "البريد الإلكتروني",
      auth_password_placeholder: "كلمة المرور",
      auth_submit: "تسجيل الدخول",
      auth_forgot: "نسيت كلمة المرور",
      auth_hint: "إذا لم يكن لديك حساب، يرجى طلب إنشاء حساب من صاحب العمل أو المسؤول.",

      stat_total_products: "إجمالي المنتجات",
      stat_order_needed: "يلزم الطلب",

      card_add_product: "إضافة منتج",
      placeholder_product_name: "اسم المنتج، مثال: بيبسي 1 لتر",
      placeholder_category: "الفئة، مثال: مشروبات",
      placeholder_min_stock: "الحد الأدنى للمخزون",
      placeholder_initial_stock: "المخزون الابتدائي",
      placeholder_price: "السعر (₺)",
      label_unit: "وحدة البيع",
      unit_option_adet: "قطعة (عدد صحيح)",
      unit_option_kg: "كجم (منتج موزون)",
      placeholder_barcode: "الباركود (اختياري)",
      aria_scan_barcode: "مسح الباركود",
      btn_add_product: "إضافة منتج",
      card_all_products: "جميع المنتجات",
      placeholder_search_product: "ابحث عن منتج...",
      empty_no_products: "لا توجد منتجات بعد. ابدأ بالإضافة من الأعلى.",

      tab_products: "المنتجات",
      tab_kasa: "الصندوق",
      tab_scan: "مسح QR",
      tab_sales: "المبيعات",
      tab_veresiye: "الديون",
      tab_orders: "الطلبات",

      card_qr_scan_title: "الإدخال / الإخراج عبر رمز QR",
      card_qr_scan_subtitle: "يمكنك إجراء إدخال أو إخراج للمخزون عن طريق مسح رمز QR الخاص بالمنتج.",
      btn_start_camera: "تشغيل الكاميرا",
      btn_stop_scan: "إيقاف المسح",
      card_print_qr_title: "طباعة رموز QR",
      card_print_qr_subtitle: "يمكنك إنشاء رمز QR لكل منتج ولصقه على الرف. اضغط على أحد المنتجات من القائمة لعرض رمز QR الخاص به.",

      card_kasa_title: "الصندوق — البيع عبر مسح QR",
      card_kasa_subtitle: "امسح رموز QR للمنتجات التي اشتراها العميل بالتتابع ليتم إضافتها تلقائيًا إلى السلة.",
      card_manual_add_title: "اختر منتجًا وأضفه (بدون QR)",
      card_cart_title: "السلة",
      btn_clear_cart: "إفراغ السلة",
      empty_cart: "السلة فارغة. أضف منتجًا عن طريق مسح رمز QR.",
      label_discount: "الخصم (₺)",
      label_subtotal: "المجموع الفرعي",
      label_total: "الإجمالي",
      payment_cash: "نقدًا",
      payment_credit: "دين",
      btn_complete_sale: "إتمام البيع",

      period_today: "اليوم",
      period_week: "هذا الأسبوع",
      period_month: "هذا الشهر",
      period_all: "الكل",
      stat_total_revenue: "إجمالي الإيرادات",
      stat_transaction_count: "عدد العمليات",
      card_top_products: "الأكثر مبيعًا",
      empty_no_sales_period: "لا توجد مبيعات في هذه الفترة.",
      card_sales_history: "سجل المبيعات",
      empty_no_sales_made: "لم يتم إجراء أي عملية بيع في هذه الفترة.",

      card_add_customer: "إضافة عميل",
      placeholder_customer_name: "اسم العميل",
      placeholder_customer_phone: "الهاتف (اختياري)",
      btn_add_customer: "إضافة عميل",
      stat_total_debt: "إجمالي المستحقات",
      stat_customer_count: "عدد العملاء",
      card_customers: "العملاء",
      empty_no_customers: "لا يوجد عملاء بعد.",

      card_urgent_orders: "قائمة الطلبات العاجلة",
      btn_reset_all: "إعادة تعيين الكل",
      empty_no_orders_needed: "لا توجد منتجات تحتاج إلى طلب حاليًا.",

      aria_decrease_stock: "إنقاص المخزون",
      aria_increase_stock: "زيادة المخزون",
      btn_print_qr: "طباعة رمز QR",
      label_product_name: "اسم المنتج",
      label_category: "الفئة",
      label_min_stock2: "الحد الأدنى للمخزون",
      label_price: "السعر (₺)",
      label_barcode: "الباركود",
      btn_save: "حفظ",
      btn_delete_product: "حذف المنتج",

      modal_scan_barcode_title: "مسح الباركود",
      modal_scan_barcode_subtitle: "أظهر الباركود الموجود على المنتج للكاميرا.",

      label_current_balance: "الرصيد الحالي",
      label_take_payment: "تحصيل دفعة",
      placeholder_amount: "المبلغ (₺)",
      label_edit_customer_phone: "الهاتف",
      btn_delete_customer: "حذف العميل",
      label_transaction_history: "سجل المعاملات",

      status_yeterli: "كافٍ",
      status_kritik: "حرج",
      status_tukendi: "نفد",

      unit_kg: "كجم",
      unit_adet: "قطعة",
      category_other: "أخرى",

      btn_manual_add: "إضافة",
      empty_no_match_product: "لا توجد منتجات مطابقة.",
      empty_no_history: "لا توجد معاملات بعد.",
      label_payment_received: "تم استلام الدفعة",
      sold_qty_template: "تم بيع {qty} قطعة",
      btn_cancel_sale: "إلغاء",

      confirm_logout: "هل أنت متأكد من رغبتك في تسجيل الخروج؟",
      auth_forgot_need_email: "لإرسال رابط إعادة تعيين كلمة المرور، يرجى إدخال بريدك الإلكتروني أولاً.",
      auth_forgot_sent: "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني. تحقق من صندوق الوارد (ومجلد البريد العشوائي).",
      auth_fields_required: "البريد الإلكتروني وكلمة المرور مطلوبان.",
      auth_error_invalid_email: "عنوان بريد إلكتروني غير صالح.",
      auth_error_user_not_found: "لم يتم العثور على حساب مسجل بهذا البريد الإلكتروني. يرجى طلب إنشاء حساب من صاحب العمل.",
      auth_error_wrong_password: "كلمة المرور غير صحيحة.",
      auth_error_invalid_credential: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
      auth_error_too_many_requests: "تمت محاولات كثيرة جدًا، يرجى المحاولة مرة أخرى لاحقًا.",
      auth_error_generic: "حدث خطأ ما، يرجى المحاولة مرة أخرى.",

      confirm_delete_customer_with_debt: "لدى هذا العميل رصيد مستحق قدره {amount}. هل أنت متأكد من رغبتك في حذفه رغم ذلك؟",
      alert_scan_not_found: "هذا الرمز لا يخص أي منتج مسجل.",
      alert_camera_error: "تعذر تشغيل الكاميرا. يرجى التحقق من أذونات المتصفح.",
      prompt_kg: "كم كجم؟",
      alert_invalid_weight: "لم تُدخل وزنًا صحيحًا.",
      confirm_stock_action: "{name}\nالمخزون الحالي: {stock}\n\nاضغط موافق للإدخال إلى المخزون، أو إلغاء للإخراج منه.",
      prompt_kg_kasa: "{name} — كم كجم؟",
      prompt_adet_kasa: "{name} — كم قطعة؟",
      alert_invalid_amount: "لم تُدخل كمية صحيحة.",
      scan_feedback_added: "تمت إضافة {name}",
      confirm_clear_cart: "هل أنت متأكد من رغبتك في إفراغ السلة؟",
      alert_cart_empty: "السلة فارغة.",
      alert_need_customer_first: "يجب عليك أولاً إضافة عميل من تبويب الديون.",
      alert_select_customer: "يرجى اختيار عميل.",
      alert_sale_completed: "تم إتمام البيع: {total}",
      label_credit_suffix: " (دين: {name})",
      confirm_cancel_sale: "هل تريد إلغاء هذه العملية؟\nسيتم حذف عملية البيع بقيمة {total} وإعادة المنتجات إلى المخزون.",
      confirm_delete_product: "هل أنت متأكد من رغبتك في حذف هذا المنتج؟",
      confirm_reset_all: "هل تريد إعادة تعيين مخزون جميع المنتجات إلى الحد الأدنى؟",
      confirm_delete_customer: "هل أنت متأكد من رغبتك في حذف هذا العميل؟",
      alert_qr_lib_error: "تعذر تحميل مكتبة رمز QR (تحقق من اتصال الإنترنت).",
      prompt_edit_weight: "{name} — الوزن الجديد (كجم)",
      print_qr_window_title: "طباعة QR",
      aria_edit_weight: "تعديل الوزن",
      aria_decrease_cart_qty: "إنقاص",
      aria_increase_cart_qty: "زيادة",
      aria_remove_from_cart: "إزالة",
      aria_close: "إغلاق"
    }
  };

  var STORAGE_KEY = "bakkal_lang";
  window.currentLang = localStorage.getItem(STORAGE_KEY) || "tr";

  // t("key") veya t("key", {var: değer}) şeklinde kullanılır
  window.t = function (key, vars) {
    var dict = translations[window.currentLang] || translations.tr;
    var str = dict[key] !== undefined ? dict[key] : (translations.tr[key] !== undefined ? translations.tr[key] : key);
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        str = str.split("{" + k + "}").join(vars[k]);
      });
    }
    return str;
  };

  function applyStaticI18n() {
    document.documentElement.setAttribute("lang", window.currentLang === "ar" ? "ar" : "tr");
    document.documentElement.setAttribute("dir", window.currentLang === "ar" ? "rtl" : "ltr");

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = window.t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      el.setAttribute("placeholder", window.t(el.getAttribute("data-i18n-placeholder")));
    });
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      el.setAttribute("title", window.t(el.getAttribute("data-i18n-title")));
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      el.setAttribute("aria-label", window.t(el.getAttribute("data-i18n-aria")));
    });

    document.title = window.t("app_title");

    var langBtn = document.getElementById("langToggleBtn");
    if (langBtn) langBtn.textContent = window.currentLang === "ar" ? "TR" : "AR";
  }

  window.setLanguage = function (lang) {
    window.currentLang = lang === "ar" ? "ar" : "tr";
    try {
      localStorage.setItem(STORAGE_KEY, window.currentLang);
    } catch (e) {}
    applyStaticI18n();
    document.dispatchEvent(new CustomEvent("languagechanged"));
  };

  document.addEventListener("click", function (e) {
    if (e.target && e.target.id === "langToggleBtn") {
      window.setLanguage(window.currentLang === "ar" ? "tr" : "ar");
    }
  });

  // Sayfa yüklendiğinde (script en altta olduğu için DOM zaten hazır) statik metinleri uygula
  applyStaticI18n();
})();
