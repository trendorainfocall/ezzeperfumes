# EZZE Parfumes – Onlayn Mağaza (MERN)
React (Vite) + Node.js/Express + MongoDB (Mongoose) + JWT. Node 18+ tələb olunur.

## Quraşdırma
1. `npm run install-all`
2. `server/.env` faylını yoxlayın (nümunə: `server/.env.example`): `MONGO_URI`, `JWT_SECRET`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `SUPERADMIN_PIN`
3. `npm run seed` → məhsullar + Süper Admin (Süleyman Kengerli); admin girişi `.env`-dəki məlumatlarla olur
4. `npm run dev` → Mağaza: http://localhost:5173 · API: http://localhost:5000

> `npm run dev`-i **layihənin ƏSAS qovluğunda** (`ezze-perfumes`) işlədin — o həm serveri, həm saytı birlikdə başladır. `client` qovluğunda işlətsəniz yalnız sayt açılır, API (5000) işləmir və giriş/ayarlar `ECONNREFUSED` verir. Serverin başladığını `✅ MongoDB bağlandı` və `🚀 Server: http://localhost:5000` sətirləri göstərir.

> `.env` faylını heç kimlə paylaşmayın və Git-ə yükləməyin (`.gitignore`-da bağlıdır). Süper Admin şifrəsini və PIN-i ilk girişdən sonra dəyişin.

## İstehsalat (production)
`npm run build` → `npm start` (Express `client/dist` qovluğunu da təqdim edir; `index.html` keşlənmir, hash-li `/assets` faylları uzun müddət keşlənir, `/api` cavabları heç vaxt keşlənmir).

## Bazanın təmizlənməsi və yenilənməsi
| Əmr | Nə edir |
|---|---|
| `npm run db:clean -- --dry` | Heç nə dəyişmədən nəyin düzəldiləcəyini göstərir |
| `npm run db:clean` | Köhnə/yanlış məhsul sahələrini (həcm, cins, endirim, stok) düzəldir; sahibi silinmiş bildiriş və mesajları, 180 gündən köhnə oxunmuş bildirişləri silir; vaxtı bitmiş PIN bloklarını açır |
| `npm run db:clean -- --files` | Yuxarıdakılara əlavə olaraq heç bir məhsul/xəbər/filial/sifarişdə istifadə olunmayan yüklənmiş faylları silir |
| `npm run db:reset` | Məhsul, sifariş, promokod, bildiriş, mesaj, xəbər, filial və yüklənmiş faylları silir, sonra `seed` işlədir. **İstifadəçilər və adminlər qalır.** Təsdiq üçün `RESET` yazılır |
| `npm run db:superadmin` | `server/.env`-dəki `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `SUPERADMIN_PIN` dəyərlərini bazadakı Süper Admin-ə yazır (hesab yoxdursa yaradır). Şifrəni dəyişmək üçün əvvəl `.env`-i dəyişin, sonra bunu işlədin |
| `npm run db:superadmin -- --check` | Heç nə dəyişmədən `.env`-dəki şifrə/PIN-in bazadakı Süper Admin ilə uyğun olub-olmadığını yoxlayır (giriş işləməyəndə ilk bunu işlədin) |
| `npm run seed` | Təhlükəsizdir: yalnız çatışmayanı yaradır (məhsullar boşdursa nümunə məhsullar, Süper Admin, ayarlar) |

## Funksiyalar
- **Hesab**: qeydiyyat/giriş (JWT), PIN ilə şifrə bərpası (5 uğursuz cəhddən sonra 15 dəq. blok), yanlış giriş cəhdlərinə limit (10 yanlış / 10 dəq.; uğurlu giriş sayğacı sıfırlayır; server yenidən başladılanda da sıfırlanır), profil.
- **Mağaza**: məhsul filtri (cins, 5–200 ml həcm, mövsüm), endirim (%), promokodlar, səbət (qiymət/stok açılışda yenilənir).
- **Sifarişlər**: atomik stok/promokod rezervi (eyni anda sifariş verənlər stoku mənfiyə sala bilməz), 5 dəqiqəlik ləğv (`POST /api/orders/:id/cancel`, server saatı ilə), PDF qəbz (pdfkit), admin tərəfindən müştəriyə PDF göndərmə, bildirişlər.
- **Dəstək çatı**: müştəri `Dəstək`, admin `Admin → Dəstək` (4 san. polling, tarixçə MongoDB-də).
- **Xəbərlər** (`/news`) və **Filiallar** (`/branches`): admin paneldən idarə olunur, şəkil yükləmə (JPG/PNG/WEBP, maks. 5 MB, `server/uploads/img`).
- **Admin**: dashboard, ən çox/az satılan, məhsul, sifariş, promokod, footer & WhatsApp, adminlər (yalnız Süper Admin).

## Struktur
```
server/  app.js (marşrutlar) · index.js (başlatma) · models.js · seed.js · maintenance.js · invoice.js
client/  src/App.jsx · src/api.js · src/pages/*
```


## Render (canlı sayt) — vacib
`server/.env` Git-ə və Render-ə getmir. Render → servis → **Environment** bölməsində bunlar OLMALIDIR:
`MONGO_URI` (sonu `/ezze` ilə), `JWT_SECRET`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `SUPERADMIN_PIN`.
Server hər başlayanda Süper Admin-i bazada yoxlayıb lazım gələrsə yaradır/yeniləyir.
Diaqnostika: `https://SAYTINIZ/api/health` — sayt hansı bazaya baxır və Süper Admin orada varmı.
