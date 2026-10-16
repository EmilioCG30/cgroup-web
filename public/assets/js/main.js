/*
 * C-GROUP México — page behaviour
 * All content lives in index.html; this script only adds interaction:
 *  - Sector tabs open their dropdown (click / tap; hover with a mouse).
 *  - Company description: hover (mouse) or first tap (touch) shows it;
 *    click / second tap opens the company website.
 *  - /#company-id links open that company's description.
 */
(function () {
  "use strict";

  var companiesSection = document.querySelector(".companies");
  var companies = Array.prototype.slice.call(document.querySelectorAll(".company"));
  var navItems = Array.prototype.slice.call(document.querySelectorAll(".main-nav__item"));

  var sheetMQ = window.matchMedia("(max-width: 1099px)");
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var state = { company: null, mode: null }; // mode: "hover" | "pinned"
  var hideTimer = null;
  var hoverTimer = null;
  var lastPointer = "";
  var returnFocus = null;

  var PANEL_CHROME =
    '<span class="company-panel__arrow" aria-hidden="true"></span>' +
    '<button class="company-panel__close" type="button" aria-label="Cerrar">' +
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg></button>';

  function cardOf(company) { return company.querySelector(".logo-card"); }
  function panelOf(company) { return company.querySelector(".company-panel"); }

  /* ---------- Company cards ---------- */

  companies.forEach(function (company) {
    var card = cardOf(company);
    var panel = panelOf(company);
    var hasSite = card.tagName === "A";

    panel.insertAdjacentHTML("afterbegin", PANEL_CHROME);
    panel.querySelector(".company-panel__close").addEventListener("click", function () {
      closePanel();
      if (lastPointer === "") card.focus();
    });

    card.addEventListener("pointerenter", function (e) {
      if (e.pointerType !== "mouse") return;
      // Short delay so sweeping the mouse across the logos doesn't flash panels;
      // once a panel is showing, moving to another card switches immediately.
      window.clearTimeout(hoverTimer);
      if (state.company) openPanel(company, "hover");
      else hoverTimer = window.setTimeout(function () { openPanel(company, "hover"); }, 90);
    });
    card.addEventListener("pointerleave", function (e) {
      if (e.pointerType !== "mouse") return;
      window.clearTimeout(hoverTimer);
      if (state.mode === "hover") scheduleClose();
    });
    panel.addEventListener("pointerenter", function (e) {
      if (e.pointerType === "mouse" && state.company === company) window.clearTimeout(hideTimer);
    });
    panel.addEventListener("pointerleave", function (e) {
      if (e.pointerType === "mouse" && state.mode === "hover") scheduleClose();
    });

    // Keyboard: focusing the card (or the website link) shows the description.
    card.addEventListener("focus", function () {
      if (card.matches(":focus-visible")) openPanel(company, "hover");
    });
    company.addEventListener("focusin", function (e) {
      if (panel.contains(e.target)) openPanel(company, state.company === company ? state.mode : "hover");
    });
    company.addEventListener("focusout", function (e) {
      if (state.company === company && state.mode === "hover" && !company.contains(e.relatedTarget)) scheduleClose();
    });

    card.addEventListener("click", function (e) {
      var showing = state.company === company;
      if (!hasSite) {
        // No website: the card just shows / hides the description.
        if (showing && state.mode === "pinned") closePanel();
        else openPanel(company, "pinned");
        return;
      }
      // Touch: first tap shows the description, second tap follows the link.
      // Mouse / keyboard: the description is already showing, so follow the link.
      var touchLike = lastPointer === "touch" || lastPointer === "pen";
      if (touchLike && !showing) {
        e.preventDefault();
        openPanel(company, "pinned");
      }
    });
  });

  /* ---------- Sector tabs and dropdowns ---------- */

  navItems.forEach(function (item) {
    var button = item.querySelector(".main-nav__link");
    var list = item.querySelector(".dropdown");

    button.addEventListener("click", function () {
      var willOpen = !item.classList.contains("is-open");
      closeDropdowns();
      if (willOpen) {
        item.classList.add("is-open");
        button.setAttribute("aria-expanded", "true");
        button.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    });

    // With a mouse, hovering a tab replaces any tab that was opened by click.
    item.addEventListener("pointerenter", function (e) {
      if (e.pointerType === "mouse" && !item.classList.contains("is-open")) closeDropdowns();
    });

    list.addEventListener("click", function (e) {
      var link = e.target.closest(".dropdown__link");
      var company = link && findCompany(link.hash);
      if (!company) return;
      e.preventDefault();
      closeDropdowns();
      returnFocus = button;
      showCompany(company);
    });
  });

  function closeDropdowns() {
    navItems.forEach(function (item) {
      item.classList.remove("is-open");
      item.querySelector(".main-nav__link").setAttribute("aria-expanded", "false");
    });
  }

  function findCompany(hash) {
    if (!hash || hash.length < 2) return null;
    var el = document.getElementById(decodeURIComponent(hash.slice(1)));
    return el && el.classList.contains("company") ? el : null;
  }

  function showCompany(company) {
    if (window.history.replaceState) window.history.replaceState(null, "", "#" + company.id);
    if (sheetMQ.matches) {
      // The sheet scrolls the card into view itself.
      openPanel(company, "pinned");
      panelOf(company).focus({ preventScroll: true });
      return;
    }
    var smooth = !reducedMotion.matches;
    cardOf(company).scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
    window.setTimeout(function () {
      openPanel(company, "pinned");
      panelOf(company).focus({ preventScroll: true });
    }, smooth ? 380 : 0);
  }

  /* ---------- Description panel ---------- */

  function openPanel(company, mode) {
    window.clearTimeout(hideTimer);
    if (state.company !== company) {
      if (state.company) resetPanel(state.company);
      state.company = company;
      state.mode = mode;
      cardOf(company).setAttribute("aria-expanded", "true");
      panelOf(company).classList.add("is-open");
    } else if (mode === "pinned") {
      state.mode = "pinned";
    }
    panelOf(company).classList.toggle("is-pinned", state.mode === "pinned");
    positionPanel(true);
  }

  function positionPanel(keepCardVisible) {
    var company = state.company;
    if (!company) return;
    var card = cardOf(company);
    var panel = panelOf(company);

    if (sheetMQ.matches) {
      panel.classList.add("is-sheet");
      panel.classList.remove("is-above", "is-below");
      panel.style.left = "";
      panel.style.top = "";
      // Room under the page so every card can scroll clear of the sheet.
      document.body.style.paddingBottom = panel.offsetHeight + "px";
      if (keepCardVisible === true) {
        // Keep the tapped card above the sheet so it can be tapped again.
        var rect = card.getBoundingClientRect();
        var limit = window.innerHeight - panel.offsetHeight - 16;
        var delta = rect.bottom > limit ? rect.bottom - limit : rect.top < 16 ? rect.top - 16 : 0;
        if (delta) window.scrollBy({ top: delta, behavior: reducedMotion.matches ? "auto" : "smooth" });
      }
      return;
    }

    document.body.style.paddingBottom = "";
    panel.classList.remove("is-sheet");
    var r = card.getBoundingClientRect();
    var ref = companiesSection.getBoundingClientRect();
    var pw = panel.offsetWidth;
    var ph = panel.offsetHeight;
    var vw = document.documentElement.clientWidth;
    var gap = 16;
    var margin = 12;
    var cx = r.left + r.width / 2;
    var left = Math.min(Math.max(cx - pw / 2, margin), vw - pw - margin);
    var above = r.top - gap - ph >= margin || r.top > window.innerHeight - r.bottom;
    var top = above ? r.top - gap - ph : r.bottom + gap;

    panel.classList.toggle("is-above", above);
    panel.classList.toggle("is-below", !above);
    panel.style.left = left - ref.left + "px";
    panel.style.top = top - ref.top + "px";
    panel.style.setProperty("--arrow-x", cx - left + "px");
  }

  function resetPanel(company) {
    var panel = panelOf(company);
    panel.classList.remove("is-open", "is-pinned", "is-sheet", "is-above", "is-below");
    panel.style.left = "";
    panel.style.top = "";
    cardOf(company).setAttribute("aria-expanded", "false");
  }

  function closePanel() {
    window.clearTimeout(hideTimer);
    if (state.company) {
      if (window.location.hash === "#" + state.company.id && window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      resetPanel(state.company);
    }
    state.company = null;
    state.mode = null;
    document.body.style.paddingBottom = "";
  }

  function scheduleClose() {
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(closePanel, 160);
  }

  /* ---------- Global listeners ---------- */

  document.addEventListener("pointerdown", function (e) { lastPointer = e.pointerType; }, true);

  document.addEventListener("keydown", function (e) {
    lastPointer = "";
    if (e.key !== "Escape") return;
    var openItem = document.querySelector(".main-nav__item.is-open");
    if (openItem) {
      closeDropdowns();
      openItem.querySelector(".main-nav__link").focus();
    } else if (state.company) {
      var target = state.company.contains(document.activeElement) ? returnFocus || cardOf(state.company) : null;
      closePanel();
      if (target) target.focus();
    }
    returnFocus = null;
  }, true);

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".main-nav__item")) closeDropdowns();
    if (state.company && !state.company.contains(e.target) && !e.target.closest(".dropdown")) closePanel();
  });

  window.addEventListener("resize", positionPanel);

  // Links like cgroup.com.mx/#biomedica open that company's description,
  // both on page load and when the address changes on an open page.
  function openFromHash() {
    var company = findCompany(window.location.hash);
    if (company && company !== state.company) showCompany(company);
  }
  window.addEventListener("hashchange", openFromHash);
  openFromHash();
})();
