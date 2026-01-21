// public/main.js

// Floating nav (mobile toggle + auto-close)
const nav = document.querySelector(".nav");
const navToggle = nav?.querySelector(".nav-toggle");
const navLinks = nav?.querySelectorAll(".nav-links a, .nav-cta");

if (nav && navToggle) {
  const closeMenu = () => {
    nav.classList.remove("nav--open");
    navToggle.setAttribute("aria-expanded", "false");
  };

  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("nav--open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks?.forEach((link) => {
    link.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 900px)").matches) {
        closeMenu();
      }
    });
  });

  const navMediaQuery = window.matchMedia("(max-width: 900px)");
  navMediaQuery.addEventListener("change", (event) => {
    if (!event.matches) {
      closeMenu();
    }
  });
}

// AI chat widget (FAB + simple backend call)
const fab = document.querySelector(".ai-fab");
const chat = document.querySelector(".ai-chat");
const closeButton = document.querySelector(".ai-chat__close");
const form = document.querySelector(".ai-chat__input");
const textarea = document.querySelector("#ai-question");
const messages = document.querySelector(".ai-chat__messages");

const cannedResponses = [
  "JV Solutions specializes in digital modernization, automation, and data analytics for growing organizations.",
  "We help teams with cloud planning, workflow automation, and data governance to deliver measurable outcomes.",
  "You can reach us at info@jvsolutions-llc.com to schedule a consultation or request a service overview."
];

const appendMessage = (text, type) => {
  const message = document.createElement("div");
  message.className = `ai-message ${type}`;
  message.textContent = text;
  messages.appendChild(message);
  void message.offsetHeight;
  message.classList.add("new");
  message.addEventListener(
    "animationend",
    () => {
      message.classList.remove("new");
    },
    { once: true }
  );
  messages.scrollTop = messages.scrollHeight;
};

const getFallbackReply = () => cannedResponses[Math.floor(Math.random() * cannedResponses.length)];

const toggleChat = (open) => {
  chat.classList.toggle("open", open);
  if (open) {
    textarea.focus();
  }
};

fab.addEventListener("click", () => toggleChat(true));
closeButton.addEventListener("click", () => toggleChat(false));

const setStatusMessage = (message, isError = false) => {
  appendMessage(message, "bot");
  const latestMessage = messages.lastElementChild;
  if (isError) {
    latestMessage.style.background = "#ffe4e6";
    latestMessage.style.borderColor = "#fca5a5";
  }
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = textarea.value.trim();
  if (!question) return;

  appendMessage(question, "user");
  textarea.value = "";

  appendMessage("Thinking...", "bot");
  const thinkingMessage = messages.lastElementChild;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      thinkingMessage.textContent = getFallbackReply();
      return;
    }

    const reply = payload.reply?.trim();
    thinkingMessage.textContent = reply || getFallbackReply();
  } catch (error) {
    thinkingMessage.textContent = getFallbackReply();
  }
});
