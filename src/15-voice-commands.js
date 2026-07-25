/**
 * 15-voice-commands.js
 * Sesli komut sistemi: konuşmayı metne çevirme, basit komutları anında (yerel) işleme, karmaşık komutları yapay zekaya yönlendirme.
 */

function getSpeechRecognitionClass() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

function getVoiceLangForTarget(targetInputId) {
    const container = document.querySelector(`.voice-lang-toggle[data-for="${targetInputId}"]`);
    const activeBtn = container ? container.querySelector(".voice-lang-btn.active") : null;
    return activeBtn ? activeBtn.dataset.lang : "tr-TR";
  }

function getVoiceCommandLang() {
    const container = document.getElementById("voiceCommandLangToggle");
    const activeBtn = container ? container.querySelector(".voice-lang-btn.active") : null;
    return activeBtn ? activeBtn.dataset.lang : "tr-TR";
  }

function startVoiceCommand() {
    const SpeechRecognitionClass = getSpeechRecognitionClass();
    const btn = document.getElementById("voiceCommandBtn");
    if (!SpeechRecognitionClass) {
      showToast(t("voiceNotSupported"), "error");
      return;
    }
    if (activeRecognition) {
      activeRecognition.stop();
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = getVoiceCommandLang();
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    btn.classList.add("listening");
    activeRecognition = recognition;
    hideVoiceCommandConfirm();
    const transcriptEl = document.getElementById("voiceCommandTranscript");
    transcriptEl.style.display = "none";

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      transcriptEl.textContent = `🎤 "${transcript}"`;
      transcriptEl.style.display = "block";
      processVoiceCommand(transcript);
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") {
        showToast(t("voiceNoSpeech"), "info");
      } else if (event.error === "not-allowed" || event.error === "permission-denied") {
        showToast(t("voiceNoPermission"), "error");
      } else {
        showToast(t("voiceError"), "error");
      }
    };

    recognition.onend = () => {
      btn.classList.remove("listening");
      activeRecognition = null;
    };

    recognition.start();
  }

function speakFeedback(text) {
    if (!("speechSynthesis" in window)) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = getVoiceCommandLang();
      window.speechSynthesis.speak(utterance);
    } catch (e) {}
  }

function tryLocalVoiceParse(transcript) {
    const lower = transcript.trim().toLowerCase();

    // Karmaşık/başka türde bir komuma benziyorsa, yerelde çözmeye çalışma — AI'a bırak.
    const complexHints = [
      "veresiye", "borç", "borc", "tamamla", "temizle", "boşalt", "bosalt",
      "indirim", "yeni ürün", "yeni urun", "stok var", "kaç tane", "kac tane", "ne kadar var"
    ];
    if (complexHints.some((hint) => lower.includes(hint))) return false;

    let working = lower;
    VOICE_STOPWORDS.forEach((w) => {
      working = working.replace(new RegExp(`\\b${w}\\b`, "g"), " ");
    });

    // Baştaki sayıyı (rakam ya da Türkçe sayı kelimesi) çıkar
    let qty = 1;
    const trimmed = working.trim();
    const digitMatch = trimmed.match(/^(\d+)\s*(.*)$/);
    const wordMatch = trimmed.match(/^(\p{L}+)\s+(.*)$/u);

    let remainder = trimmed;
    if (digitMatch) {
      qty = Number(digitMatch[1]) || 1;
      remainder = digitMatch[2];
    } else if (wordMatch && TURKISH_NUMBER_WORDS[wordMatch[1]]) {
      qty = TURKISH_NUMBER_WORDS[wordMatch[1]];
      remainder = wordMatch[2];
    }

    remainder = remainder.trim();
    if (!remainder) return false;

    const product = findProductByFuzzyName(remainder);
    if (!product) return false;

    // Net bir ürün eşleşmesi bulundu — AI'a hiç gitmeden anında sepete ekle.
    addToCart(product, qty);
    switchTab("tab-kasa");
    const msg = `${qty} ${product.name} ${t("voiceAddedToCart")}`;
    showToast(msg, "success");
    speakFeedback(msg);
    return true;
  }

function processVoiceCommand(transcript) {
    if (tryLocalVoiceParse(transcript)) return;

    if (!isBulkScanConfigured()) {
      showToast(t("voiceCommandNotConfigured"), "error");
      return;
    }

    const productNames = products.map((p) => p.name).join(", ");
    const customerNames = customers.map((c) => c.name).join(", ");

    const prompt = [
      "Sen bir bakkal/market uygulamasının sesli komut yorumlayıcısısın.",
      "Kullanıcının cümlesi Türkçe, İngilizce ya da Arapça olabilir — hangi dilde olursa olsun anla ve aşağıdaki İngilizce alan adlarıyla JSON döndür.",
      "Kullanıcının söylediği cümleyi analiz et ve hangi işlemi yapmak istediğini belirle.",
      "",
      "Mevcut işlemler ve parametreleri:",
      '1. "add_to_cart" - Kasaya ürün ekleme. params: {productName, qty (belirtilmemişse 1)}',
      '2. "complete_sale" - Kasadaki mevcut satışı tamamlama/onaylama.',
      '3. "add_veresiye" - Bir müşteriye veresiye (borç) ekleme. params: {customerName, amount}',
      '4. "add_product" - Yeni ürün ekleme. params: {name, price, qty (belirtilmemişse 0), category (belirtilmemişse "Diğer")}',
      '5. "check_stock" - Bir ürünün stok durumunu sorma. params: {productName}',
      '6. "clear_cart" - Kasadaki sepeti tamamen boşaltma/temizleme.',
      '7. "apply_discount" - Mevcut sepete belirli bir TL indirim uygulama. params: {amount}',
      '8. "check_customer_debt" - Bir müşterinin güncel veresiye borcunu sorma. params: {customerName}',
      '9. "unknown" - Yukarıdakilerden hiçbiri net değilse.',
      "",
      "Sistemdeki gerçek ürün adları (productName için bunlardan EN YAKIN eşleşeni seç, yoksa kullanıcının söylediği gibi bırak):",
      productNames || "(henüz ürün yok)",
      "",
      "Sistemdeki gerçek müşteri adları (customerName için bunlardan en yakın eşleşeni seç):",
      customerNames || "(henüz müşteri yok)",
      "",
      `Kullanıcının cümlesi: "${transcript}"`,
      "",
      "SADECE geçerli bir JSON nesnesi döndür, başka hiçbir açıklama ekleme.",
      'Format: {"action":"add_to_cart","params":{"productName":"Pepsi 1 Lt","qty":2}}'
    ].join("\n");

    callGeminiWithRetry(null, prompt)
      .then((data) => {
        const rawText = data && data.candidates && data.candidates[0] && data.candidates[0].content.parts[0].text;
        if (!rawText) {
          showToast(t("voiceCommandError"), "error");
          return;
        }
        let parsed;
        try {
          const cleaned = rawText.replace(/```json|```/g, "").trim();
          parsed = JSON.parse(cleaned);
        } catch (e) {
          showToast(t("voiceCommandError"), "error");
          return;
        }
        handleVoiceCommandAction(parsed);
      })
      .catch((e) => {
        console.error("Sesli komut hatası", e);
        showToast(t("voiceCommandError"), "error");
      });
  }

function handleVoiceCommandAction(parsed) {
    const action = parsed.action;
    const params = parsed.params || {};

    if (action === "clear_cart") {
      if (!cart.length) {
        showToast(t("voiceCartEmpty"), "info");
        return;
      }
      showVoiceCommandConfirm(t("voiceConfirmClearCart"), () => {
        clearCart();
        speakFeedback(t("voiceCartClearedDone"));
      });
      return;
    }

    if (action === "apply_discount") {
      const amount = Number(params.amount) || 0;
      if (!cart.length) {
        showToast(t("voiceCartEmpty"), "error");
        return;
      }
      if (!amount || amount <= 0) {
        showToast(t("alertInvalidAmount"), "error");
        return;
      }
      showVoiceCommandConfirm(`${t("voiceConfirmDiscount")}: ${formatTL(amount)}`, () => {
        document.getElementById("cartDiscount").value = amount;
        renderCart();
        speakFeedback(t("voiceDiscountDone"));
      });
      return;
    }

    if (action === "check_customer_debt") {
      const customer = customers.find((c) => c.name.toLowerCase() === String(params.customerName || "").toLowerCase());
      if (!customer) {
        const msg = `${t("voiceCustomerNotFound")}: ${params.customerName}`;
        showToast(msg, "error");
        speakFeedback(msg);
        return;
      }
      const debt = getCustomerDebt(customer.id);
      const msg = `${customer.name}: ${formatTL(debt)}`;
      showToast(msg, "info");
      speakFeedback(msg);
      return;
    }

    if (action === "add_to_cart") {
      const product = findProductByFuzzyName(params.productName);
      if (!product) {
        const msg = `${t("voiceProductNotFound")}: ${params.productName}`;
        showToast(msg, "error");
        speakFeedback(msg);
        return;
      }
      const qty = Number(params.qty) || 1;
      addToCart(product, qty);
      switchTab("tab-kasa");
      const msg = `${qty} ${product.name} ${t("voiceAddedToCart")}`;
      showToast(msg, "success");
      speakFeedback(msg);
      return;
    }

    if (action === "check_stock") {
      const product = findProductByFuzzyName(params.productName);
      if (!product) {
        const msg = `${t("voiceProductNotFound")}: ${params.productName}`;
        showToast(msg, "error");
        speakFeedback(msg);
        return;
      }
      const msg = `${product.name}: ${formatQty(product)}`;
      showToast(msg, "info");
      speakFeedback(msg);
      return;
    }

    if (action === "complete_sale") {
      if (!cart.length) {
        const msg = t("voiceCartEmpty");
        showToast(msg, "error");
        speakFeedback(msg);
        return;
      }
      const subtotal = cart.reduce((sum, c) => sum + calcLineTotal(c), 0);
      showVoiceCommandConfirm(`${t("voiceConfirmSale")}: ${formatTL(subtotal)}`, () => {
        completeSale();
        speakFeedback(t("voiceSaleDone"));
      });
      return;
    }

    if (action === "add_veresiye") {
      const customer = customers.find((c) => c.name.toLowerCase() === String(params.customerName || "").toLowerCase());
      const amount = Number(params.amount) || 0;
      if (!customer) {
        const msg = `${t("voiceCustomerNotFound")}: ${params.customerName}`;
        showToast(msg, "error");
        speakFeedback(msg);
        return;
      }
      if (!amount || amount <= 0) {
        showToast(t("alertInvalidAmount"), "error");
        return;
      }
      showVoiceCommandConfirm(`${customer.name} ${t("voiceConfirmVeresiye")}: ${formatTL(amount)}`, () => {
        sales.push({
          id: genId(),
          timestamp: new Date().toISOString(),
          items: [{ name: t("voiceManualDebtLabel"), qty: 1, price: amount, unit: "adet", costPrice: 0 }],
          subtotal: amount,
          discount: 0,
          total: amount,
          cost: 0,
          profit: 0,
          paymentType: "veresiye",
          customerId: customer.id,
          customerName: customer.name
        });
        logAudit("Sesli komutla veresiye eklendi", `${customer.name}: ${formatTL(amount)}`);
        save();
        renderAll();
        speakFeedback(t("voiceVeresiyeDone"));
      });
      return;
    }

    if (action === "add_product") {
      const name = params.name;
      const price = Number(params.price) || 0;
      if (!name) {
        showToast(t("voiceCommandError"), "error");
        return;
      }
      showVoiceCommandConfirm(`${t("voiceConfirmAddProduct")}: ${name} (${formatTL(price)})`, () => {
        products.push(mkProduct(name, params.category || t("categoryOtherDefault"), Number(params.qty) || 0, 5, price, "", "adet", 0));
        logAudit("Sesli komutla ürün eklendi", name);
        save();
        renderAll();
        speakFeedback(t("voiceProductAddedDone"));
      });
      return;
    }

    const msg = t("voiceCommandUnknown");
    showToast(msg, "error");
    speakFeedback(msg);
  }

function showVoiceCommandConfirm(text, onConfirm) {
    pendingVoiceAction = onConfirm;
    document.getElementById("voiceCommandConfirmText").textContent = text;
    document.getElementById("voiceCommandConfirm").style.display = "block";
  }

function hideVoiceCommandConfirm() {
    pendingVoiceAction = null;
    document.getElementById("voiceCommandConfirm").style.display = "none";
  }

function confirmVoiceAction() {
    if (pendingVoiceAction) pendingVoiceAction();
    hideVoiceCommandConfirm();
  }

function startVoiceInput(targetInputId, micBtn) {
    const SpeechRecognitionClass = getSpeechRecognitionClass();
    if (!SpeechRecognitionClass) {
      showToast(t("voiceNotSupported"), "error");
      return;
    }

    if (activeRecognition) {
      activeRecognition.stop();
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = getVoiceLangForTarget(targetInputId);
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    micBtn.classList.add("listening");
    activeRecognition = recognition;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const input = document.getElementById(targetInputId);
      if (input) input.value = transcript.trim();
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") {
        showToast(t("voiceNoSpeech"), "info");
      } else if (event.error === "not-allowed" || event.error === "permission-denied") {
        showToast(t("voiceNoPermission"), "error");
      } else {
        showToast(t("voiceError"), "error");
      }
    };

    recognition.onend = () => {
      micBtn.classList.remove("listening");
      activeRecognition = null;
    };

    recognition.start();
  }

function setVoiceLang(container, lang) {
    container.querySelectorAll(".voice-lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });
  }
