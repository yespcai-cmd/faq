
(() => {
  "use strict";

  const script = document.currentScript;
  if (!script) return;

  // ===== 設定 =====

  // 既存のFAQチャットページの公開URL
  const CHAT_PAGE_URL = https://yespcai-cmd.github.io/faq/
    script.dataset.chatUrl ||
    "https://yespcai-cmd.github.io/faq/index.html?widget=1";

  // チャットのタイトル
  const CHAT_TITLE =
    script.dataset.title || "AI ふくちゃん";

  // フクロウ画像。未指定なら絵文字を表示
  const ICON_URL = script.dataset.iconUrl || "";

  // 二重設置を防止
  if (document.getElementById("fukuchan-widget-root")) return;

  // ===== ウィジェット本体 =====

  const host = document.createElement("div");
  host.id = "fukuchan-widget-root";

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial;
      font-family:
        -apple-system, BlinkMacSystemFont, "Segoe UI",
        "Noto Sans JP", sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    .launcher {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 2147483000;

      display: flex;
      align-items: center;
      gap: 10px;

      padding: 10px 18px 10px 10px;
      border: none;
      border-radius: 999px;

      background: #2778b9;
      color: #fff;

      box-shadow: 0 5px 22px #0003;
      cursor: pointer;

      font: inherit;
      font-size: 14px;
      font-weight: 700;

      transition: transform .2s, background .2s;
    }

    .launcher:hover {
      transform: translateY(-2px);
      background: #1b639b;
    }

    .owl-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      width: 46px;
      height: 46px;

      border-radius: 50%;
      background: #fff;
      color: #263238;

      font-size: 29px;
      overflow: hidden;
    }

    .owl-icon img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .panel {
      position: fixed;
      right: 24px;
      bottom: 94px;
      z-index: 2147483000;

      display: flex;
      flex-direction: column;

      width: 390px;
      height: min(650px, calc(100dvh - 120px));
      min-height: 320px;

      overflow: hidden;
      border-radius: 18px;
      background: #fff;

      box-shadow: 0 10px 40px #0003;
      border: 1px solid #dce5ec;
    }

    .panel[hidden] {
      display: none;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;

      flex-shrink: 0;
      padding: 11px 15px;

      background: #2778b9;
      color: #fff;
    }

    .panel-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .panel-title {
      font-size: 14px;
      font-weight: 700;
    }

    .panel-subtitle {
      margin-top: 3px;
      font-size: 11px;
      opacity: .9;
    }

    .close {
      display: inline-flex;
      align-items: center;
      justify-content: center;

      width: 36px;
      height: 36px;
      flex-shrink: 0;

      border: none;
      border-radius: 50%;
      background: transparent;
      color: #fff;

      font-size: 27px;
      cursor: pointer;
    }

    .close:hover {
      background: #ffffff25;
    }

    .chat-frame {
      display: block;
      flex: 1;
      width: 100%;
      height: 100%;
      min-height: 0;

      border: none;
      background: #fff;
    }

    @media (max-width: 480px) {
      .launcher {
        right: 14px;
        bottom: 14px;
      }

      .panel {
        top: auto;
        right: 0;
        bottom: 0;
        left: 0;

        width: 100%;
        height: 88dvh;
        max-height: 760px;
        min-height: 300px;

        border-radius: 18px 18px 0 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .launcher {
        transition: none;
      }
    }
  `;

  shadow.appendChild(style);

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "launcher";
  launcher.setAttribute("aria-expanded", "false");
  launcher.setAttribute("aria-label", `${CHAT_TITLE}を開く`);

  const owlIcon = document.createElement("span");
  owlIcon.className = "owl-icon";
  owlIcon.setAttribute("aria-hidden", "true");

  if (ICON_URL) {
    const image = document.createElement("img");
    image.src = ICON_URL;
    image.alt = "";
    image.loading = "lazy";
    owlIcon.appendChild(image);
  } else {
    owlIcon.textContent = "🦉";
  }

  const launcherLabel = document.createElement("span");
  launcherLabel.textContent = "質問する";

  launcher.append(owlIcon, launcherLabel);

  const panel = document.createElement("section");
  panel.className = "panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", CHAT_TITLE);

  const header = document.createElement("header");
  header.className = "panel-header";

  const brand = document.createElement("div");
  brand.className = "panel-brand";

  const headerIcon = document.createElement("span");
  headerIcon.className = "owl-icon";
  headerIcon.setAttribute("aria-hidden", "true");

  if (ICON_URL) {
    const image = document.createElement("img");
    image.src = ICON_URL;
    image.alt = "";
    headerIcon.appendChild(image);
  } else {
    headerIcon.textContent = "🦉";
  }

  const titleArea = document.createElement("div");

  const title = document.createElement("div");
  title.className = "panel-title";
  title.textContent = CHAT_TITLE;

  const subtitle = document.createElement("div");
  subtitle.className = "panel-subtitle";
  subtitle.textContent = "教室についてお気軽にご質問ください";

  titleArea.append(title, subtitle);
  brand.append(headerIcon, titleArea);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "close";
  closeButton.textContent = "×";
  closeButton.setAttribute("aria-label", "チャットを閉じる");

  header.append(brand, closeButton);

  const frame = document.createElement("iframe");
  frame.className = "chat-frame";
  frame.title = CHAT_TITLE;
  frame.loading = "lazy";
  frame.referrerPolicy = "strict-origin-when-cross-origin";

  // 公開済みのFAQチャットページを読み込む
  frame.src = CHAT_PAGE_URL;

  panel.append(header, frame);
  shadow.append(launcher, panel);

  // bodyの直下に配置して、ページのレイアウトに干渉させない
  (document.body || document.documentElement).appendChild(host);

  function openChat() {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    launcher.setAttribute("aria-label", `${CHAT_TITLE}を閉じる`);
    launcherLabel.textContent = "チャットを閉じる";
  }

  function closeChat() {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", `${CHAT_TITLE}を開く`);
    launcherLabel.textContent = "質問する";
    launcher.focus();
  }

  launcher.addEventListener("click", () => {
    if (panel.hidden) {
      openChat();
    } else {
      closeChat();
    }
  });

  closeButton.addEventListener("click", closeChat);

  // Escキーでチャットを閉じる
  shadow.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      closeChat();
    }
  });
})();
