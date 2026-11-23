// ============================================================================
// RARE UI INTERACTIVE COMPONENTS ENGINE (Vanilla JS + Spring Motion)
// Components from https://www.rareui.com/:
//   1. Gooey Nav (sliding spring capsule indicator for View Tabs & Runway)
//   2. Theme Selector (miniature Dark / Light UI preview popover)
//   3. Animated Counter (odometer rolling digit wheels)
//   4. Delete Button (in-place trash lid-lift confirmation)
//   5. Stacked Squircle Toasts
//   6. Notification Bell (live conflict alert pulse + jump)
//   7. Code Block Copy Button (copy-to-check morph)
//   8. Floating Scroll Progress Pill & Section Jumper
// ============================================================================

(function () {
  "use strict";

  // --------------------------------------------------------------------------
  // 1. STACKED SQUIRCLE TOASTS (RareUI Toast)
  // --------------------------------------------------------------------------
  const RareToast = {
    show({ type = "info", title = "", description = "", duration = 3200 } = {}) {
      let stack = document.getElementById("rareToastStack");
      if (!stack) {
        stack = document.createElement("div");
        stack.id = "rareToastStack";
        stack.className = "rare-toast-stack";
        document.body.appendChild(stack);
      }

      const iconSvg =
        type === "success"
          ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
          : type === "error"
          ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
          : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

      const toast = document.createElement("div");
      toast.className = `rare-toast ${type}`;
      toast.innerHTML = `
        <div class="rare-toast-icon">${iconSvg}</div>
        <div class="rare-toast-body">
          <strong>${title}</strong>
          ${description ? `<span>${description}</span>` : ""}
        </div>
      `;

      stack.appendChild(toast);

      // Keep at most 4 stacked toasts
      while (stack.children.length > 4) {
        stack.removeChild(stack.firstChild);
      }

      const dismiss = () => {
        if (!toast.parentNode) return;
        toast.classList.add("leaving");
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 230);
      };

      toast.addEventListener("click", dismiss);
      setTimeout(dismiss, duration);
    },
  };

  window.RareToast = RareToast;

  // --------------------------------------------------------------------------
  // 2. ANIMATED COUNTER (RareUI Odometer Rolling Digit Wheel)
  // --------------------------------------------------------------------------
  function renderOdometer(el, value) {
    if (!el) return;
    const str = String(Math.max(0, Math.round(Number(value) || 0)));
    const prevStr = el.getAttribute("data-odo-val");
    if (prevStr === str && el.children.length === str.length) return;
    el.setAttribute("data-odo-val", str);

    // Rebuild columns if digit length changed
    if (el.children.length !== str.length) {
      el.innerHTML = "";
      for (let i = 0; i < str.length; i++) {
        const col = document.createElement("span");
        col.className = "rare-odo-col";
        const track = document.createElement("span");
        track.className = "rare-odo-track";
        for (let d = 0; d <= 9; d++) {
          const digit = document.createElement("span");
          digit.className = "rare-odo-digit";
          digit.textContent = String(d);
          track.appendChild(digit);
        }
        col.appendChild(track);
        el.appendChild(col);
      }
    }

    requestAnimationFrame(() => {
      for (let i = 0; i < str.length; i++) {
        const d = parseInt(str[i], 10);
        const track = el.children[i]?.querySelector(".rare-odo-track");
        if (track && !Number.isNaN(d)) {
          track.style.transform = `translateY(-${d * 10}%)`;
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // 3. GOOEY NAV (Sliding Spring Capsule Indicator)
  // --------------------------------------------------------------------------
  function syncGooeyGroup(groupEl) {
    if (!groupEl) return;
    const indicator = groupEl.querySelector(".rare-gooey-indicator");
    const activeBtn = groupEl.querySelector(".active");
    if (!indicator || !activeBtn) return;

    const left = activeBtn.offsetLeft;
    const width = activeBtn.offsetWidth;
    indicator.style.width = `${width}px`;
    indicator.style.transform = `translateX(${left}px)`;
  }

  function syncAllGooeyNavs() {
    document.querySelectorAll(".rare-gooey-group").forEach(syncGooeyGroup);
  }

  // --------------------------------------------------------------------------
  // 4. THEME SELECTOR (RareUI Dark / Light Miniature Preview Popover)
  // --------------------------------------------------------------------------
  function applyTheme(theme, silent = false) {
    const mode = theme === "light" ? "light" : "dark";
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(mode);
    try {
      localStorage.setItem("rareui_theme", mode);
    } catch (_e) {}

    document.querySelectorAll("[data-rare-theme]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-rare-theme") === mode);
    });

    if (!silent) {
      RareToast.show({
        type: "info",
        title: mode === "dark" ? "OLED Dark Mode" : "Crisp Light Mode",
        description: "Interface theme updated.",
        duration: 1800,
      });
    }
  }

  function initThemeSelector() {
    let saved = "dark";
    try {
      saved = localStorage.getItem("rareui_theme") || "dark";
    } catch (_e) {}
    applyTheme(saved, true);

    const trigger = document.getElementById("rareThemeTrigger");
    const popover = document.getElementById("rareThemePopover");
    if (!trigger || !popover) return;

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = popover.classList.contains("hidden");
      popover.classList.toggle("hidden", !willOpen);
      trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });

    popover.querySelectorAll("[data-rare-theme]").forEach((opt) => {
      opt.addEventListener("click", () => {
        applyTheme(opt.getAttribute("data-rare-theme"), false);
        popover.classList.add("hidden");
        trigger.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("click", (e) => {
      if (!popover.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) {
        popover.classList.add("hidden");
        trigger.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        popover.classList.add("hidden");
        trigger.setAttribute("aria-expanded", "false");
      }
    });
  }

  // --------------------------------------------------------------------------
  // 5. DELETE BUTTON (RareUI In-Place Lid-Lift Confirmation)
  // --------------------------------------------------------------------------
  function initDeleteButton() {
    const wrap = document.getElementById("rareDeleteClearWrap");
    const trigger = document.getElementById("rareDeleteTrigger");
    const confirmBtn = document.getElementById("btnClearAll");
    const cancelBtn = document.getElementById("rareDeleteCancel");
    if (!wrap || !trigger || !confirmBtn || !cancelBtn) return;

    const closeConfirm = () => wrap.classList.remove("confirming");

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      wrap.classList.toggle("confirming");
    });

    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeConfirm();
    });

    confirmBtn.addEventListener("click", () => {
      closeConfirm();
      RareToast.show({
        type: "info",
        title: "Scenario Cleared",
        description: "All aircraft and separation confirmations removed.",
      });
    });

    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) closeConfirm();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeConfirm();
    });
  }

  // --------------------------------------------------------------------------
  // 6. CODE BLOCK COPY BUTTON (RareUI Copy-to-Check)
  // --------------------------------------------------------------------------
  function initCodeBlockCopy() {
    const btn = document.getElementById("btnCopyJsonBox");
    const textarea = document.getElementById("jsonImportTextarea");
    if (!btn || !textarea) return;

    btn.addEventListener("click", async () => {
      const val = textarea.value.trim();
      if (!val) {
        RareToast.show({
          type: "error",
          title: "JSON Box Empty",
          description: "Click Export or Load Example first.",
        });
        return;
      }
      try {
        await navigator.clipboard.writeText(val);
        const orig = btn.innerHTML;
        btn.innerHTML = "✓ Copied";
        RareToast.show({
          type: "success",
          title: "JSON Copied",
          description: "Scenario JSON copied to clipboard.",
        });
        setTimeout(() => {
          btn.innerHTML = orig;
        }, 1600);
      } catch (_e) {
        textarea.select();
        RareToast.show({
          type: "info",
          title: "Selected JSON",
          description: "Press Ctrl+C to copy.",
        });
      }
    });
  }

  // --------------------------------------------------------------------------
  // 7. NOTIFICATION BELL (Jumps to Active Conflicts)
  // --------------------------------------------------------------------------
  function initNotificationBell() {
    const bell = document.getElementById("rareBellBtn");
    if (!bell) return;
    bell.addEventListener("click", () => {
      const calcVisible = !document.getElementById("viewCalc")?.classList.contains("hidden");
      const target = calcVisible
        ? document.getElementById("sectionConflicts")
        : document.getElementById("chartConflictFeed");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  // --------------------------------------------------------------------------
  // 8. FLOATING SCROLL PROGRESS PILL & SECTION JUMPER
  // --------------------------------------------------------------------------
  function initScrollProgress() {
    const pill = document.getElementById("rareScrollPill");
    const circle = document.getElementById("rareScrollRingProgress");
    if (!pill || !circle) return;

    const circumference = 2 * Math.PI * 9; // r = 9
    circle.style.strokeDasharray = `${circumference}`;
    circle.style.strokeDashoffset = `${circumference}`;

    const updateProgress = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? Math.min(1, Math.max(0, window.scrollY / docHeight)) : 0;
      circle.style.strokeDashoffset = `${circumference * (1 - pct)}`;

      const isChartView = !document.getElementById("viewChart")?.classList.contains("hidden");
      pill.classList.toggle("hidden", isChartView);
    };

    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", () => {
      updateProgress();
      syncAllGooeyNavs();
    });

    pill.querySelectorAll("[data-scroll-target]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-scroll-target");
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    updateProgress();
  }

  // --------------------------------------------------------------------------
  // PUBLIC API FOR app.js TO SYNC LIVE METRICS & GOOEY NAVS
  // --------------------------------------------------------------------------
  window.RareUI = {
    syncGooeyNavs: () => {
      requestAnimationFrame(syncAllGooeyNavs);
      const pill = document.getElementById("rareScrollPill");
      if (pill) {
        const isChartView = !document.getElementById("viewChart")?.classList.contains("hidden");
        pill.classList.toggle("hidden", isChartView);
      }
    },

    syncMetrics(solver) {
      if (!solver) return;
      const arr = (solver.computedArrivals || []).length;
      const dep = (solver.computedDepartures || []).length;
      const trn = (solver.computedTransits || []).length;
      const total = arr + dep + trn;
      const conflicts = (solver.conflicts4d || []).length;
      const h2h = (solver.headOnConflicts || []).length;
      const vor = (solver.radialConflicts || []).length;
      const ess = (solver.essentialTraffic || []).length;

      // Update Odometer Animated Counters
      renderOdometer(document.getElementById("odoTotal"), total);
      renderOdometer(document.getElementById("odoArr"), arr);
      renderOdometer(document.getElementById("odoDep"), dep);
      renderOdometer(document.getElementById("odoTrn"), trn);
      renderOdometer(document.getElementById("odoConflicts"), conflicts);

      const confCard = document.getElementById("kpiCardConflicts");
      if (confCard) confCard.classList.toggle("kpi-danger", conflicts > 0);

      // Update RareUI [N] Orange Bracket Counts
      const setCount = (id, n) => {
        const el = document.getElementById(id);
        if (el) el.textContent = `[${n}]`;
      };
      setCount("countSheet", total);
      setCount("countH2h", h2h);
      setCount("countVor", vor);
      setCount("countIls", arr);
      setCount("countEss", ess);

      // Update Top-Bar Notification Bell Pill
      const bell = document.getElementById("rareBellBtn");
      const bellText = document.getElementById("rareBellText");
      if (bell && bellText) {
        bell.classList.toggle("has-alerts", conflicts > 0);
        bellText.textContent =
          conflicts === 0
            ? "Clear"
            : `${conflicts} Conflict${conflicts > 1 ? "s" : ""}`;
      }
    },
  };

  document.addEventListener("DOMContentLoaded", () => {
    initThemeSelector();
    initDeleteButton();
    initCodeBlockCopy();
    initNotificationBell();
    initScrollProgress();

    // Sync Gooey Nav indicators after fonts & layout settle
    syncAllGooeyNavs();
    setTimeout(syncAllGooeyNavs, 120);

    document.querySelectorAll(".rare-gooey-group button").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.RareUI.syncGooeyNavs();
      });
    });
  });
})();
