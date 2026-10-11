/*
 * AI フクロウ FAQ チャット
 *
 * 通信先: Cloudflare Worker（→ GAS）
 * https://faq-api.yespcai.workers.dev/
 */
const GAS_WEB_APP_URL = "https://faq-api.yespcai.workers.dev/";

const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const questionInput = document.getElementById("questionInput");
const sendButton = document.getElementById("sendButton");
const connectionNotice = document.getElementById("connectionNotice");
const quickQuestions = document.getElementById("quickQuestions");

let selectedClassroomId = "";
let pendingClassroomQuestion = "";
let isSending = false;

function showNotice(message) {
  connectionNotice.textContent = message;
  connectionNotice.hidden = false;
}

function hideNotice() {
  connectionNotice.textContent = "";
  connectionNotice.hidden = true;
}

function scrollToLatest() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addMessageRow(role, text) {
  const row = document.createElement("div");
  row.className = `message-row ${role === "user" ? "user-row" : "bot-row"}`;

  if (role !== "user") {
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "🦉";
    row.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  // pre-line: FAQ の回答に含まれる改行を表示する
  bubble.className = `message-bubble ${role === "user" ? "user-bubble" : "bot-bubble pre-line"}`;
  // 外部から返された文章を HTML として解釈させない
  bubble.textContent = text;
  row.appendChild(bubble);

  chatMessages.appendChild(row);
  scrollToLatest();
  return bubble;
}

/** http / https 以外の URL は使わない */
function safeUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.href;
  } catch (error) {
    return null;
  }
}

function addLinkToBubble(bubble, label, url) {
  const href = safeUrl(url);
  if (!href) {
    const note = document.createElement("p");
    note.textContent = "公式ページの URL を確認できません。教室スタッフへお問い合わせください。";
    bubble.appendChild(note);
    return;
  }
  const link = document.createElement("a");
  link.className = "inline-link";
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label || "公式ページを開く";
  bubble.appendChild(document.createElement("br"));
  bubble.appendChild(link);
}

/** 回答の下に「役に立ちましたか？」ボタンを付ける（FAQ 改善用の記録） */
function addFeedback(bubble, logId) {
  if (!logId) return;

  const wrap = document.createElement("div");
  wrap.className = "feedback-row";

  const label = document.createElement("span");
  label.className = "feedback-label";
  label.textContent = "この回答は役に立ちましたか？";
  wrap.appendChild(label);

  const makeButton = (text, value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "feedback-button";
    button.textContent = text;
    button.addEventListener("click", async () => {
      wrap.textContent = value === "good"
        ? "ありがとうございます。"
        : "ご意見ありがとうございます。解決しない場合は、公式ホームページか各教室へお問い合わせください。";
      try {
        await postJson({ action: "feedback", logId: logId, value: value });
      } catch (error) {
        console.error(error);
      }
    });
    return button;
  };

  wrap.appendChild(makeButton("👍 役に立った", "good"));
  wrap.appendChild(makeButton("👎 役に立たなかった", "bad"));
  bubble.appendChild(wrap);
}

/** 選択済みの教室を変えて、同じ質問をもう一度調べられるようにする */
function addChangeClassroomButton(bubble, question) {
  const wrap = document.createElement("div");
  wrap.className = "link-buttons";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "classroom-button";
  button.textContent = "別の教室を選ぶ";
  button.addEventListener("click", async () => {
    selectedClassroomId = "";
    await sendQuestion(question, "", false);
  });

  wrap.appendChild(button);
  bubble.appendChild(wrap);
}

function showClassroomChoices(result, originalQuestion) {
  const bubble = addMessageRow("bot", result.answer || "どちらの教室についてお調べしますか？");
  const options = document.createElement("div");
  options.className = "classroom-options";

  if (!Array.isArray(result.classrooms) || result.classrooms.length === 0) {
    const note = document.createElement("p");
    note.textContent = "教室の選択肢を取得できませんでした。スタッフへお問い合わせください。";
    bubble.appendChild(note);
    return;
  }

  pendingClassroomQuestion = originalQuestion;

  result.classrooms.forEach((classroom) => {
    if (!classroom || !classroom.id || !classroom.name) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "classroom-button";
    button.textContent = classroom.name;
    button.addEventListener("click", async () => {
      // 選択された教室をこの会話中に保持
      selectedClassroomId = String(classroom.id);
      const questionToRetry = pendingClassroomQuestion;
      addMessageRow("user", classroom.name + "について");
      await sendQuestion(questionToRetry, selectedClassroomId, false);
    });
    options.appendChild(button);
  });

  bubble.appendChild(options);
  scrollToLatest();
}

/** 該当する FAQ が無い時：公式ホームページと各教室ページへ誘導する */
function showNotFound(result) {
  const bubble = addMessageRow(
    "bot",
    result.answer || "ご質問に合う情報が見つかりませんでした。公式ホームページか各教室へお問い合わせください。"
  );

  const links = document.createElement("div");
  links.className = "link-buttons";

  const addButton = (label, url) => {
    const href = safeUrl(url);
    if (!href) return;
    const a = document.createElement("a");
    a.className = "link-button";
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = label;
    links.appendChild(a);
  };

  if (result.homeUrl) addButton("公式ホームページを開く ↗", result.homeUrl);
  if (Array.isArray(result.classrooms)) {
    result.classrooms.forEach((classroom) => {
      if (classroom && classroom.name && classroom.url) {
        addButton(classroom.name + "のページ ↗", classroom.url);
      }
    });
  }

  if (links.childElementCount > 0) bubble.appendChild(links);
  scrollToLatest();
}

async function postJson(payload) {
  if (!GAS_WEB_APP_URL) {
    throw new Error("GAS_WEB_APP_URL が未設定です。");
  }

  const response = await fetch(GAS_WEB_APP_URL, {
    method: "POST",
    redirect: "follow",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`サーバーとの通信に失敗しました（HTTP ${response.status}）。`);
  }
  return await response.json();
}

async function callGas(question, classroomId) {
  return postJson({
    question: question,
    selectedClassroomId: classroomId || ""
  });
}

async function sendQuestion(question, classroomId = selectedClassroomId, showUserMessage = true) {
  const cleanQuestion = String(question || "").trim();
  if (!cleanQuestion || isSending) return;

  hideNotice();

  if (showUserMessage) {
    addMessageRow("user", cleanQuestion);
  }

  isSending = true;
  sendButton.disabled = true;
  questionInput.disabled = true;

  const loadingBubble = addMessageRow("bot", "確認しています…");

  try {
    const result = await callGas(cleanQuestion, classroomId);
    loadingBubble.remove();

    if (!result || typeof result !== "object") {
      addMessageRow("bot", "回答を取得できませんでした。時間をおいて再度お試しください。");
      return;
    }

    if (result.type === "select_classroom") {
      showClassroomChoices(result, cleanQuestion);
      return;
    }

    if (result.type === "not_found") {
      showNotFound(result);
      return;
    }

    if (result.type === "classroom_link") {
      // 選択した教室を保持し、回答に公式ページへのリンクを付ける
      selectedClassroomId = result.classroomId || classroomId || "";
      const bubble = addMessageRow("bot", result.answer || "公式ページをご確認ください。");
      if (result.url) {
        addLinkToBubble(bubble, `${result.classroomName || "教室"}の公式ページを開く ↗`, result.url);
      }
      addChangeClassroomButton(bubble, cleanQuestion);
      addFeedback(bubble, result.logId);
      return;
    }

    const bubble = addMessageRow("bot", result.answer || "回答を取得できませんでした。");
    if (result.type === "faq") {
      addFeedback(bubble, result.logId);
    }
  } catch (error) {
    loadingBubble.remove();
    console.error(error);
    addMessageRow("bot", "申し訳ありません。現在、回答を取得できませんでした。");
    showNotice("接続に失敗しました。時間をおいて、もう一度お試しください。");
  } finally {
    isSending = false;
    sendButton.disabled = false;
    questionInput.disabled = false;
    questionInput.focus();
    scrollToLatest();
  }
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question) return;
  questionInput.value = "";
  await sendQuestion(question);
});

questionInput.addEventListener("keydown", (event) => {
  // 日本語入力の変換確定の Enter では送信しない
  if (event.isComposing || event.keyCode === 229) return;
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

quickQuestions.addEventListener("click", async (event) => {
  const button = event.target.closest(".quick-question");
  if (!button) return;
  await sendQuestion(button.textContent.trim());
});
