"use strict";

/**
 * Supabase 평가 등록/조회를 게임과 분리한다.
 * 설정 또는 네트워크가 없어도 예외를 화면 안에서 처리하고 게임은 계속 실행된다.
 */
class FeedbackManager {
  constructor(options) {
    this.version = options.version;
    this.getGameStats = options.getGameStats;
    this.onOpen = options.onOpen;
    this.onClose = options.onClose;
    this.onSound = options.onSound;
    this.client = null;
    this.connected = false;
    this.rating = 0;
    this.submitting = false;
    this.activeModal = null;
    this.cacheElements();
    this.bindEvents();
    this.initialize();
  }

  cacheElements() {
    this.feedbackModal = document.getElementById("feedbackModal");
    this.reviewsModal = document.getElementById("reviewsModal");
    this.ratingButtons = [...document.querySelectorAll("#ratingInput button")];
    this.comment = document.getElementById("feedbackComment");
    this.count = document.getElementById("commentCount");
    this.status = document.getElementById("feedbackStatus");
    this.submit = document.getElementById("feedbackSubmit");
    this.reviewList = document.getElementById("reviewList");
    this.reviewSummary = document.getElementById("reviewSummary");
    this.menuSummary = document.getElementById("ratingSummary");
  }

  bindEvents() {
    document.querySelectorAll(".feedback-open").forEach(button => button.addEventListener("click", () => this.openFeedback()));
    document.getElementById("reviewsButton").addEventListener("click", () => this.openReviews());
    document.querySelectorAll(".reviews-open").forEach(button => button.addEventListener("click", () => this.openReviews()));
    this.menuSummary.addEventListener("click", () => this.openReviews());
    this.ratingButtons.forEach(button => button.addEventListener("click", () => this.setRating(Number(button.dataset.rating))));
    this.comment.addEventListener("input", () => { this.count.textContent = String(this.comment.value.length); });
    this.submit.addEventListener("click", () => this.sendFeedback());
    document.querySelectorAll(".modal-close, .modal-close-button").forEach(button => button.addEventListener("click", () => this.closeModal()));
    [this.feedbackModal, this.reviewsModal].forEach(modal => modal.addEventListener("pointerdown", event => { if (event.target === modal) this.closeModal(); }));
    window.addEventListener("keydown", event => { if (event.key === "Escape" && this.activeModal) { event.stopImmediatePropagation(); this.closeModal(); } }, true);
  }

  async initialize() {
    await this.loadOptionalConfig();
    const config = window.BAPSUR_SUPABASE_CONFIG;
    const usable = config && /^https:\/\/.+\.supabase\.co\/?$/.test(config.url || "") && typeof config.key === "string" && config.key.length > 20;
    if (usable && window.supabase?.createClient) {
      try {
        this.client = window.supabase.createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
        this.connected = true;
        await this.retryPendingFeedback();
      } catch (error) {
        console.warn("평가 클라이언트 초기화 실패:", error.message);
      }
    }
    await this.refreshSummary();
  }

  /** 없는 설정 파일은 fetch 응답 상태로 확인하여 불필요한 script 404를 만들지 않는다. */
  async loadOptionalConfig() {
    if (window.BAPSUR_SUPABASE_CONFIG) return;
    try {
      const configUrl = new URL("./supabase-config.js", window.location.href);
      const response = await fetch(configUrl, { cache: "no-store" });
      if (!response.ok) return;
      const source = await response.text();
      const script = document.createElement("script");
      script.text = source;
      document.head.appendChild(script);
      script.remove();
    } catch (_) {
      // file:// 실행 또는 설정 파일 부재는 정상적인 미설정 상태다.
    }
  }

  openFeedback() {
    this.onSound("button");
    this.activeModal = this.feedbackModal;
    this.feedbackModal.classList.remove("hidden");
    this.onOpen();
    this.status.textContent = this.connected ? "" : "현재 평가 저장 기능이 연결되지 않았습니다.";
    this.comment.focus({ preventScroll: true });
  }

  async openReviews() {
    this.onSound("button");
    this.activeModal = this.reviewsModal;
    this.reviewsModal.classList.remove("hidden");
    this.onOpen();
    await this.loadReviews();
  }

  closeModal() {
    if (!this.activeModal) return;
    this.onSound("button");
    this.activeModal.classList.add("hidden");
    this.activeModal = null;
    this.onClose();
  }

  setRating(rating) {
    this.rating = clampFeedback(rating, 1, 5);
    this.ratingButtons.forEach((button, index) => {
      const active = index < this.rating;
      button.classList.toggle("active", active);
      button.setAttribute("aria-checked", String(index + 1 === this.rating));
    });
    this.status.textContent = this.connected ? "" : "현재 평가 저장 기능이 연결되지 않았습니다.";
  }

  validate() {
    const comment = this.comment.value.trim();
    if (!Number.isInteger(this.rating) || this.rating < 1 || this.rating > 5) return "별점을 1점부터 5점 사이에서 선택해 주세요.";
    if (comment.length > 500) return "의견은 500자 이하로 입력해 주세요.";
    return "";
  }

  buildRecord() {
    const stats = this.getGameStats();
    return {
      rating: this.rating,
      comment: this.comment.value.trim(),
      game_version: this.version,
      result: stats.result,
      survival_time: Math.max(0, Math.floor(stats.survival_time || 0)),
      final_level: Math.max(1, Math.floor(stats.final_level || 1)),
      kill_count: Math.max(0, Math.floor(stats.kill_count || 0)),
      max_body_stage: String(stats.max_body_stage || "가벼움").slice(0, 20)
    };
  }

  async sendFeedback() {
    if (this.submitting) return;
    const errorMessage = this.validate();
    if (errorMessage) { this.status.textContent = errorMessage; return; }
    this.submitting = true;
    this.submit.disabled = true;
    this.submit.textContent = "보내는 중…";
    const record = this.buildRecord();
    try {
      if (!this.connected || !this.client) throw new Error("not-configured");
      const { error } = await this.client.from("feedback").insert(record);
      if (error) throw error;
      this.status.textContent = "의견을 보내주셔서 감사합니다!";
      this.onSound("submit");
      this.resetFormAfterSuccess();
      await this.refreshSummary();
    } catch (error) {
      this.storePending(record);
      this.status.textContent = error.message === "not-configured"
        ? "현재 평가 저장 기능이 연결되지 않았습니다. 의견을 이 기기에 임시 저장했습니다."
        : "전송에 실패해 의견을 이 기기에 임시 저장했습니다.";
    } finally {
      this.submitting = false;
      this.submit.disabled = false;
      this.submit.textContent = "보내기";
    }
  }

  resetFormAfterSuccess() {
    this.rating = 0;
    this.ratingButtons.forEach(button => { button.classList.remove("active"); button.setAttribute("aria-checked", "false"); });
    this.comment.value = "";
    this.count.textContent = "0";
  }

  storePending(record) {
    try {
      const pending = JSON.parse(localStorage.getItem("bapsur-pending-feedback") || "[]");
      pending.push({ ...record, queued_at: new Date().toISOString() });
      localStorage.setItem("bapsur-pending-feedback", JSON.stringify(pending.slice(-20)));
    } catch (_) { /* 저장 공간이 차도 게임은 중단하지 않는다. */ }
  }

  async retryPendingFeedback() {
    try {
      const pending = JSON.parse(localStorage.getItem("bapsur-pending-feedback") || "[]");
      if (!Array.isArray(pending) || !pending.length) return;
      const rows = pending.map(({ queued_at, ...record }) => record);
      const { error } = await this.client.from("feedback").insert(rows);
      if (!error) localStorage.removeItem("bapsur-pending-feedback");
    } catch (_) { /* 다음 접속에서 다시 시도한다. */ }
  }

  async refreshSummary() {
    if (!this.connected || !this.client) {
      this.setMenuSummary(null, 0, "평가 서버가 연결되지 않았습니다.");
      return;
    }
    try {
      const { data, count, error } = await this.client.from("feedback").select("rating", { count: "exact" });
      if (error) throw error;
      const average = data?.length ? data.reduce((sum, item) => sum + Number(item.rating), 0) / data.length : 0;
      this.setMenuSummary(average, count || 0);
    } catch (_) {
      this.setMenuSummary(null, 0, "평가를 불러오지 못했습니다.");
    }
  }

  setMenuSummary(average, count, fallback = "") {
    const stars = this.menuSummary.querySelector(".stars");
    const text = this.menuSummary.querySelector("b");
    if (average === null) { stars.textContent = "☆☆☆☆☆"; text.textContent = fallback; return; }
    stars.textContent = `${"★".repeat(Math.round(average))}${"☆".repeat(5 - Math.round(average))}`;
    text.textContent = count ? `${average.toFixed(1)} · 평가 ${count}개` : "아직 등록된 평가가 없습니다.";
  }

  async loadReviews() {
    this.reviewList.replaceChildren();
    if (!this.connected || !this.client) {
      this.reviewSummary.replaceChildren(this.makeText("strong", "☆☆☆☆☆"), this.makeText("span", "평가 서버가 연결되지 않았습니다."));
      this.reviewList.appendChild(this.makeText("p", "평가 서버가 연결되지 않았습니다."));
      return;
    }
    this.reviewList.appendChild(this.makeText("p", "평가를 불러오는 중…"));
    try {
      const { data, error } = await this.client.from("feedback").select("rating, comment, created_at").order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      this.reviewList.replaceChildren();
      if (!data?.length) this.reviewList.appendChild(this.makeText("p", "아직 등록된 평가가 없습니다."));
      else data.forEach(review => this.reviewList.appendChild(this.createReviewItem(review)));
      const average = data?.length ? data.reduce((sum, item) => sum + Number(item.rating), 0) / data.length : 0;
      this.reviewSummary.replaceChildren(this.makeText("strong", data?.length ? `${"★".repeat(Math.round(average))}${"☆".repeat(5 - Math.round(average))}` : "☆☆☆☆☆"), this.makeText("span", data?.length ? `최근 평가 평균 ${average.toFixed(1)}점` : "아직 등록된 평가가 없습니다."));
    } catch (_) {
      this.reviewList.replaceChildren(this.makeText("p", "평가를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."));
    }
  }

  createReviewItem(review) {
    const article = document.createElement("article"); article.className = "review-item";
    const header = document.createElement("header");
    const rating = this.makeText("span", `${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}`);
    const date = this.makeText("time", new Date(review.created_at).toLocaleDateString("ko-KR")); date.dateTime = review.created_at;
    const comment = this.makeText("p", review.comment || "(내용 없음)");
    header.append(rating, date); article.append(header, comment); return article;
  }

  makeText(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
}

const clampFeedback = (value, min, max) => Math.max(min, Math.min(max, value));
window.FeedbackManager = FeedbackManager;
