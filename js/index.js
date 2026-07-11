const functions = require("@google-cloud/functions-framework");

functions.http("recognizeShelf", async (req, res) => {
  // CORS ayarları - tarayıcının bu fonksiyona istek atabilmesi için gerekli
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type, x-app-secret");
    res.status(204).send("");
    return;
  }

  // Basit paylaşılan-anahtar kontrolü (kötüye kullanımı azaltmak için).
  // Bu tam bir güvenlik önlemi değildir, sadece rastgele botların fonksiyonu
  // bulup ücretsiz/ücretli kotanı tüketmesini zorlaştırır.
  const providedSecret = req.get("x-app-secret");
  if (!process.env.APP_SECRET || providedSecret !== process.env.APP_SECRET) {
    res.status(403).json({ error: "Yetkisiz istek." });
    return;
  }

  try {
    const { image } = req.body || {};
    if (!image) {
      res.status(400).json({ error: "image alanı gerekli." });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "Sunucu yapılandırma hatası: API anahtarı eksik." });
      return;
    }

    const prompt = [
      "Bu bir market/bakkal rafının fotoğrafı.",
      "Fotoğrafta görünen HER FARKLI ürünü tek tek tespit et.",
      "Her ürün için şu alanları çıkar:",
      '- name: ürün adı ve varsa hacmi/boyutu (örn. "Pepsi 1 Lt")',
      "- brand: marka adı",
      "- category: genel kategori (örn. içecekler, atıştırmalık, temizlik)",
      "- price: fiyat etiketinde açıkça görünüyorsa sayı olarak (örn. 22.5), görünmüyorsa null",
      "",
      "SADECE geçerli bir JSON dizisi döndür, başka hiçbir açıklama, yorum veya metin ekleme.",
      'Format: [{"name":"...","brand":"...","category":"...","price":12.5}]',
      "Aynı üründen birden fazla varsa yalnızca bir kez listele."
    ].join("\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
              { type: "text", text: prompt }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic API hatası:", data);
      res.status(502).json({ error: "AI servisi hata döndürdü.", detail: data });
      return;
    }

    const textBlock = (data.content || []).find((c) => c.type === "text");
    let products = [];
    if (textBlock) {
      const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
      try {
        products = JSON.parse(cleaned);
      } catch (e) {
        console.error("JSON ayrıştırma hatası:", e, textBlock.text);
        products = [];
      }
    }

    res.status(200).json({ products });
  } catch (e) {
    console.error("Genel hata:", e);
    res.status(500).json({ error: "Sunucu hatası.", detail: String(e) });
  }
});
