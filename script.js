/*
 * AIフクロウ FAQチャット
 *
 * 公開前に GAS_WEB_APP_URL を実際のGAS WebアプリURLへ変更してください。
 * 例: https://script.google.com/macros/s/xxxxxxxx/exec
 */
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwKXPOMrcX6wSFPWd97Z36-BQ_C_ZMoN8fmDtSEhq_SKVRPiFqGJ49IyCTBMCocCqrB/exec";

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
  bubble.className = `message-bubble ${role === "user" ? "user-bubble" : "bot-bubble"}`;
  // 外部から返された文章をHTMLとして解釈させない
  bubble.textContent = text;
  row.appendChild(bubble);

  chatMessages.appendChild(row);
  scrollToLatest();
  return bubble;
}

function addLinkToBubble(bubble, label, url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Unsupported URL protocol");
    }

    const link = document.createElement("a");
    link.className = "inline-link";
    link.href = parsed.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label || "公式ページを開く";
    bubble.appendChild(document.createElement("br"));
    bubble.appendChild(link);
  } catch (error) {
    const note = document.createElement("p");
    note.textContent = "公式ページのURLを確認できません。教室スタッフへお問い合わせください。";
    bubble.appendChild(note);
  }
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

async function callGas(question, classroomId) {
  if (!GAS_WEB_APP_URL || GAS_WEB_APP_URL.includes("ここにGAS")) {
    throw new Error("GAS_WEB_APP_URLが未設定です。script.jsにGASのWebアプリURLを設定してください。");
  }

  const response = await fetch(GAS_WEB_APP_URL, {
    method: "POST",
    redirect: "follow",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      question: question,
      selectedClassroomId: classroomId || ""
    })
  });

  if (!response.ok) {
    throw new Error(`GASとの通信に失敗しました（HTTP ${response.status}）。`);
  }

  return await response.json();
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

    if (result.type === "classroom_link") {
      // 選択した教室を保持し、回答に公式ページへのリンクを付ける
      selectedClassroomId = result.classroomId || classroomId || "";
      const bubble = addMessageRow("bot", result.answer || "公式ページをご確認ください。");
      if (result.url) {
        addLinkToBubble(bubble, `${result.classroomName || "教室"}の公式ページを開く ↗`, result.url);
      }
      return;
    }

    addMessageRow("bot", result.answer || "回答を取得できませんでした。");
  } catch (error) {
    loadingBubble.remove();
    console.error(error);
    addMessageRow("bot", "申し訳ありません。現在、回答を取得できませんでした。");
    showNotice(
      "接続に失敗しました。GASのURL、Webアプリの公開設定、ブラウザーのCORSエラーを確認してください。詳細は開発者ツール（F12）のConsoleをご確認ください。"
    );
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
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

quickQuestions.addEventListener("click", async (event) => {
  const button = event.target.closest(".quick-question");
  if (!button) return;
  await sendQuestion(button.textContent);
});
