# QazCard AI — отдельный SEO-лендинг

Статическая публичная страница для поиска и рекламы. **Не часть** Next.js-приложения: не импортирует `src/`, не тянет зависимости.

## Содержимое папки

- `index.html` — разметка, SEO meta, Open Graph, Twitter Card, `canonical`, JSON-LD (FAQ)
- `styles.css` — стили
- `script.js` — переменные ссылок `APP_ORIGIN` и `LINKS`, подстановка `data-link` в `href` при загрузке
- `robots.txt`, `sitemap.xml`
- `assets/logo.svg` — логотип-заглушка
- `assets/og-image.png` — картинка для соцсетей (замените при брендировании)
- `assets/photos/*.jpg` — иллюстрации для карточек «Возможности», CTA и «Для кого» ([Unsplash](https://unsplash.com/); при замене сохраняйте имена файлов или пути в `index.html`)

## Как открыть локально

1. Откройте `index.html` в браузере (двойной клик или «Открыть файл»).
2. Либо поднимите статику, чтобы корректно работали пути (например, из этой папки):  
   `npx --yes serve .` (если у вас установлен Node; это не добавляет зависимости в корень репозитория).

## Ссылки в основной сервис (сейчас относительные)

По умолчанию `APP_ORIGIN` в `script.js` пустой — ссылки ведут на **тот же хост**, откуда открыт лендинг:

| Назначение | Путь |
|------------|------|
| Вход | `/login` |
| Регистрация | `/register` |
| Карточка товара | `/register?next=/dashboard/create/product-card` |
| Фото | `/register?next=/dashboard/create/image` |
| Видео | `/register?next=/dashboard/create/video` |
| Юр. страницы | `/terms`, `/privacy`, `/refund-policy`, `/ai-content-policy` |

В HTML дублируются те же пути в `href` (для работы и краулеров); при смене `APP_ORIGIN` в `script.js` атрибуты с `data-link` обновятся.

## Если лендинг на отдельном домене (например, `qazcard.ai`), а приложение — на другом

1. В `script.js` задайте, например:  
   `const APP_ORIGIN = "https://app.qazcard.ai";`  
   Тогда кнопки «Войти», «Регистрация» и т.д. станут абсолютными на приложение.
2. Либо вручную замените в `index.html` все внутренние ссылки на полные URL, например:  
   - `https://app.qazcard.ai/login`  
   - `https://app.qazcard.ai/register`  
   - `https://app.qazcard.ai/dashboard/create/product-card` (в query-параметре `next=`) и аналогично для `image` и `video`.

## Что поменять перед продакшеном

1. **Canonical** в `index.html` (`<link rel="canonical" href="...">`) — поставьте реальный URL главной лендинга, например `https://qazcard.ai/`.
2. **Open Graph / Twitter** — `og:url`, `og:image`, `twitter:image` сейчас с доменом-заглушкой `https://qazcard.ai/`. Укажите:
   - полный URL картинки, доступный извне, например `https://qazcard.ai/assets/og-image.png`;
3. **robots.txt** — строка `Sitemap: https://qazcard.ai/sitemap.xml` → ваш домен.
4. **sitemap.xml** — тег `<loc>https://qazcard.ai/</loc>` → полный URL главной страницы.
5. При необходимости замените `assets/og-image.png` на финальный баннер 1200×630 (или близко).

## Деплой

Загрузите **содержимое** `qazcard-landing/` на любой static hosting (S3+CloudFront, Netlify, Cloudflare Pages, Nginx `root` и т.д.). Нужен только отдача файлов, без `npm install` в этом каталоге.

## Производственная проверка

После публикации проверьте [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) / [Card Validator](https://cards-dev.twitter.com/validator) для превью и `curl`/браузером — что `sitemap.xml` и `robots.txt` открываются с корня сайта.
