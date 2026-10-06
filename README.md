# Lingo Çınar 🌳

Neo-Brutalist tasarımlı, tamamen TDK uyumlu ve "Sıralamalı" mod seçeneği barındıran yerli kelime bulmaca (Lingo) yarışması.

![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android-green)
![Sürüm](https://img.shields.io/github/v/release/Soul-Art-000/lingo-cinar)

## 📥 İndir (Tüm Platformlar)

Oyunun tamamen derlenmiş ve yüklenmeye hazır kurulum dosyalarını **[Releases](https://github.com/Soul-Art-000/lingo-cinar/releases/latest)** sayfasından indirebilirsiniz:

- **📱 Android:** `LingoCinar-v1.0.x.apk` (İmzalı Sürüm)
- **🪟 Windows:** `.msi` veya `.exe` kurulum dosyaları
- **🍎 macOS:** `.dmg` veya `.app.tar.gz` paketleri
- **🐧 Linux:** `.AppImage` tek tıkla çalıştırılabilir dosya

---

## 🎮 Nasıl Oynanır?

Oyun size gizli kelimenin **sadece ilk harfini** ve **harf uzunluğunu** verir. Amacınız deneme haklarınız bitmeden doğru kelimeyi bulmaktır.

* 🟩 **Yeşil Harf:** Harf kelimede var ve yeri **DOĞRU**.
* 🟨 **Sarı Harf:** Harf kelimede var ama yeri **YANLIŞ**.
* ⬜ **Gri Harf:** Bu harf kelimede **YOK**.

*(Yalnızca TDK'da yer alan geçerli Türkçe kelimeleri tahmin olarak girebilirsiniz. Uygulama, içinde küfür veya argo barındıran kelimeleri filtreleyecek şekilde tasarlanmıştır.)*

### Modlar:
1. **Host Modu (Takım Oyunu):** Sunucu gizli kelimeyi ve uzunluğunu kendisi yazar. Takımlar sırayla yarışır. Puanlar tabloya işlenir.
2. **Solo Oyna (Sıralamalı Mode):** Tek başınıza, rastgele 4 ila 7 harfli kelimelere karşı yarışırsınız. Çevrimiçi skor tablosuna (Firebase üzerinden) isminizi yazdırmak için hızlı düşünün!

---

## 🛠️ Geliştirici & Kaynak Kod

Bu proje Vanilla JS (hiçbir Framework veya Webpack derleyicisi kullanılmadan) ve **Tauri v2** altyapısıyla geliştirilmiştir. 

**Kendi bilgisayarınızda çalıştırmak için:**
```bash
# Bağımlılıkları yükleyin
npm install

# Geliştirici modunda (Hot-reload ile) başlatın
npm run tauri dev
```

*Veritabanı (Online Skorlar) Firebase Firestore REST API aracılığıyla çalışmakta olup, güvenlik kuralları (`firestore.rules`) üzerinden sağlanmaktadır.*
