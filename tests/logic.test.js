/**
 * Saf mantık fonksiyonları için otomatik testler.
 *
 * ÖNEMLİ: Bu testler fonksiyonların KOPYASINI değil, gerçek kaynak kodunu
 * (src/ klasöründen) okuyup çalıştırır — böylece kod değişse bile testler
 * hep GERÇEK davranışı kontrol eder.
 *
 * Çalıştırmak için: node tests/logic.test.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

function loadFunctionsFromFile(filePath, mockGlobals) {
  const code = fs.readFileSync(filePath, "utf8");
  const context = vm.createContext(Object.assign({ console }, mockGlobals));
  vm.runInContext(code, context);
  return context;
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log("  ✅", name);
    passed++;
  } catch (e) {
    console.log("  ❌", name, "-", e.message);
    failed++;
  }
}

console.log("\n📦 02-utils.js — calcSellingPrice");
{
  const ctx = loadFunctionsFromFile(path.join(__dirname, "../src/02-utils.js"), {});

  test("varsayılan %20 kâr oranıyla doğru fiyat hesaplar", () => {
    assert.strictEqual(ctx.calcSellingPrice(100, null), 120);
  });

  test("özel kâr oranıyla doğru fiyat hesaplar", () => {
    assert.strictEqual(ctx.calcSellingPrice(100, 50), 150);
  });

  test("küsuratlı sonucu 2 ondalığa yuvarlar", () => {
    assert.strictEqual(ctx.calcSellingPrice(33.33, 15), 38.33);
  });

  test("%0 kâr oranında maliyeti aynen döndürür", () => {
    assert.strictEqual(ctx.calcSellingPrice(50, 0), 50);
  });
}

console.log("\n📦 07-kasa-checkout.js — getBulkDiscountForItem / calcLineTotal");
{
  const mockProducts = [
    { id: "p1", bulkDiscountQty: 24, bulkDiscountType: "percent", bulkDiscountValue: 10 },
    { id: "p2", bulkDiscountQty: 12, bulkDiscountType: "amount", bulkDiscountValue: 2 },
    { id: "p3" } // toplu indirimi olmayan normal ürün
  ];
  const ctx = loadFunctionsFromFile(path.join(__dirname, "../src/07-kasa-checkout.js"), {
    products: mockProducts
  });

  test("eşik altındaki miktarda indirim uygulanmaz", () => {
    const item = { productId: "p1", qty: 10, price: 20 };
    assert.strictEqual(ctx.getBulkDiscountForItem(item), null);
  });

  test("eşiğe ulaşan miktarda yüzde indirimi doğru hesaplar", () => {
    const item = { productId: "p1", qty: 24, price: 20 };
    const discount = ctx.getBulkDiscountForItem(item);
    // %10 indirim, adet başı 2 TL, 24 adet = 48 TL toplam indirim
    assert.strictEqual(discount.perUnitDiscount, 2);
    assert.strictEqual(discount.totalDiscount, 48);
  });

  test("adet başı sabit TL indirimi doğru hesaplar", () => {
    const item = { productId: "p2", qty: 12, price: 15 };
    const discount = ctx.getBulkDiscountForItem(item);
    assert.strictEqual(discount.perUnitDiscount, 2);
    assert.strictEqual(discount.totalDiscount, 24);
  });

  test("toplu indirimi olmayan üründe null döner", () => {
    const item = { productId: "p3", qty: 100, price: 20 };
    assert.strictEqual(ctx.getBulkDiscountForItem(item), null);
  });

  test("calcLineTotal, indirim yokken adet × fiyat döner", () => {
    const item = { productId: "p3", qty: 3, price: 20 };
    assert.strictEqual(ctx.calcLineTotal(item), 60);
  });

  test("calcLineTotal, indirim varken doğru düşülmüş toplamı döner", () => {
    const item = { productId: "p1", qty: 24, price: 20 };
    // 24*20 = 480, -48 indirim = 432
    assert.strictEqual(ctx.calcLineTotal(item), 432);
  });

  test("indirim, ürünün kendi fiyatını aşamaz (adet başı)", () => {
    const bigDiscountProduct = [{ id: "p4", bulkDiscountQty: 1, bulkDiscountType: "amount", bulkDiscountValue: 999 }];
    const ctx2 = loadFunctionsFromFile(path.join(__dirname, "../src/07-kasa-checkout.js"), {
      products: bigDiscountProduct
    });
    const item = { productId: "p4", qty: 1, price: 10 };
    const discount = ctx2.getBulkDiscountForItem(item);
    assert.strictEqual(discount.perUnitDiscount, 10); // 999 değil, en fazla fiyat kadar
  });
}

console.log("\n📦 06-veresiye.js — getCustomerDebt");
{
  const mockSales = [
    { paymentType: "veresiye", customerId: "c1", total: 100 },
    { paymentType: "veresiye", customerId: "c1", total: 50 },
    { paymentType: "nakit", customerId: "c1", total: 999 }, // nakit satış borca sayılmamalı
    { paymentType: "veresiye", customerId: "c2", total: 30 }
  ];
  const mockPayments = [{ customerId: "c1", amount: 40 }];
  const ctx = loadFunctionsFromFile(path.join(__dirname, "../src/06-veresiye.js"), {
    sales: mockSales,
    payments: mockPayments
  });

  test("sadece veresiye satışlarını borca sayar, nakit satışları saymaz", () => {
    // 100 + 50 - 40 ödeme = 110
    assert.strictEqual(ctx.getCustomerDebt("c1"), 110);
  });

  test("başka müşterinin borcunu karıştırmaz", () => {
    assert.strictEqual(ctx.getCustomerDebt("c2"), 30);
  });

  test("hiç kaydı olmayan müşteri için 0 döner", () => {
    assert.strictEqual(ctx.getCustomerDebt("c999"), 0);
  });

  test("ödeme borçtan fazlaysa negatif değil 0 döner", () => {
    const ctx2 = loadFunctionsFromFile(path.join(__dirname, "../src/06-veresiye.js"), {
      sales: [{ paymentType: "veresiye", customerId: "c1", total: 20 }],
      payments: [{ customerId: "c1", amount: 100 }]
    });
    assert.strictEqual(ctx2.getCustomerDebt("c1"), 0);
  });
}

console.log("\n📦 09-suppliers.js — getSupplierBalance");
{
  const mockTransactions = [
    { supplierId: "s1", type: "debt", amount: 500 },
    { supplierId: "s1", type: "payment", amount: 200 },
    { supplierId: "s2", type: "debt", amount: 80 }
  ];
  const ctx = loadFunctionsFromFile(path.join(__dirname, "../src/09-suppliers.js"), {
    supplierTransactions: mockTransactions
  });

  test("borç ve ödemeleri doğru netleştirir", () => {
    assert.strictEqual(ctx.getSupplierBalance("s1"), 300);
  });

  test("başka tedarikçinin işlemini karıştırmaz", () => {
    assert.strictEqual(ctx.getSupplierBalance("s2"), 80);
  });

  test("hiç işlemi olmayan tedarikçi için 0 döner", () => {
    assert.strictEqual(ctx.getSupplierBalance("s999"), 0);
  });
}

console.log("\n📦 08-sales-returns.js — isInPeriod");
{
  const ctx = loadFunctionsFromFile(path.join(__dirname, "../src/08-sales-returns.js"), {});

  test("bugünün tarihi 'today' periyoduna dahildir", () => {
    assert.strictEqual(ctx.isInPeriod(new Date().toISOString(), "today"), true);
  });

  test("30 gün önceki tarih 'today' periyoduna dahil değildir", () => {
    const old = new Date(Date.now() - 30 * 86400000).toISOString();
    assert.strictEqual(ctx.isInPeriod(old, "today"), false);
  });

  test("1 yıl önceki tarih 'week' periyoduna dahil değildir", () => {
    const old = new Date(Date.now() - 365 * 86400000).toISOString();
    assert.strictEqual(ctx.isInPeriod(old, "week"), false);
  });
}

console.log("\n📦 02-utils.js — formatQty / formatTL");
{
  const ctx = loadFunctionsFromFile(path.join(__dirname, "../src/02-utils.js"), {
    locale: () => "tr-TR",
    t: (key) => (key === "unitKgShort" ? "kg" : "adet")
  });

  test("adet birimli ürünü doğru formatlar", () => {
    assert.strictEqual(ctx.formatQty({ unit: "adet", qty: 5 }), "5 adet");
  });

  test("kg birimli ürünü doğru formatlar", () => {
    assert.strictEqual(ctx.formatQty({ unit: "kg", qty: 2.5 }), "2,5 kg");
  });

  test("formatTL, TL sembolüyle iki ondalık basar", () => {
    assert.strictEqual(ctx.formatTL(1234.5), "1.234,50 ₺");
  });

  test("formatTL, geçersiz girdide 0 olarak davranır", () => {
    assert.strictEqual(ctx.formatTL(null), "0,00 ₺");
  });
}

console.log(`\n${passed} test geçti, ${failed} test başarısız.\n`);
process.exit(failed > 0 ? 1 : 0);