/* ug_examiner_filter_page.js */
/* Depends on: frappe-web.min.js  (loaded before this file) */

let selectedTerms = new Set();

/* ── Init ───────────────────────────────────── */
document.addEventListener("DOMContentLoaded", function () {
  loadAcademicYears();
});

/* ── Step 1: Load Academic Years ────────────── */
function loadAcademicYears() {
  frappe.call({
    method: "academic_portal.api.ug_examiner_api.get_filter_options",
    callback: function (r) {
      const data    = r.message || {};
      const yearSel = document.getElementById("academic-year");

      if (data.error) {
        yearSel.innerHTML = '<option value="">— ' + data.error + ' —</option>';
        document.getElementById("filter-msg").textContent = data.error;
        return;
      }

      const years = data.academic_years || [];
      yearSel.innerHTML = '<option value="">— Select a year —</option>';
      years.forEach(function (y) {
        const opt = document.createElement("option");
        opt.value = opt.textContent = y;
        yearSel.appendChild(opt);
      });
    }
  });
}

/* ── Step 1 → 2: Year selected ──────────────── */
function onYearChange() {
  const year    = document.getElementById("academic-year").value;
  const progSel = document.getElementById("program");
  const chips   = document.getElementById("term-chips");

  progSel.innerHTML = '<option value="">— Select —</option>';
  progSel.disabled  = true;
  chips.innerHTML   = '<span class="chips-loading">Select a program first…</span>';
  selectedTerms.clear();
  updateSummary();
  updateGoBtn();
  updateSteps(1);
  document.getElementById("filter-msg").textContent = "";

  if (!year) {
    progSel.innerHTML = '<option value="">— Select a year first —</option>';
    return;
  }

  progSel.innerHTML = '<option value="">Loading…</option>';

  frappe.call({
    method: "academic_portal.api.ug_examiner_api.get_programs_for_year",
    args: { academic_year: year },
    callback: function (r) {
      const programs = r.message || [];
      progSel.innerHTML = '<option value="">— Select a program —</option>';

      if (programs.length === 0) {
        progSel.innerHTML = '<option value="">No programs found</option>';
        return;
      }

      programs.forEach(function (p) {
        const opt = document.createElement("option");
        opt.value = opt.textContent = p;
        progSel.appendChild(opt);
      });

      progSel.disabled = false;
      updateSteps(2);
    }
  });
}

/* ── Step 2 → 3: Program selected ───────────── */
function onProgramChange() {
  const year    = document.getElementById("academic-year").value;
  const program = document.getElementById("program").value;
  const chips   = document.getElementById("term-chips");

  selectedTerms.clear();
  updateSummary();
  updateGoBtn();
  document.getElementById("filter-msg").textContent = "";

  if (!program) {
    chips.innerHTML = '<span class="chips-loading">Select a program first…</span>';
    updateSteps(2);
    return;
  }

  chips.innerHTML = '<span class="chips-loading">Loading terms…</span>';

  frappe.call({
    method: "academic_portal.api.ug_examiner_api.get_terms_for_year_program",
    args: { academic_year: year, program: program },
    callback: function (r) {
      const terms = r.message || [];
      chips.innerHTML = "";

      if (terms.length === 0) {
        chips.innerHTML = '<span class="chips-empty">No terms found for this selection.</span>';
        return;
      }

      terms.forEach(function (term) {
        const chip = document.createElement("div");
        chip.className    = "term-chip";
        chip.textContent  = term;
        chip.dataset.termId = term;
        chip.addEventListener("click", function () {
          toggleTerm(chip, term);
        });
        chips.appendChild(chip);
      });

      updateSteps(3);
    }
  });
}

/* ── Term chip toggle ────────────────────────── */
function toggleTerm(chipEl, termId) {
  if (selectedTerms.has(termId)) {
    selectedTerms.delete(termId);
    chipEl.classList.remove("selected");
  } else {
    selectedTerms.add(termId);
    chipEl.classList.add("selected");
  }
  updateSummary();
  updateGoBtn();
}

function updateSummary() {
  const summary = document.getElementById("selected-summary");
  if (selectedTerms.size === 0) { summary.textContent = ""; return; }
  const labels = Array.from(document.querySelectorAll(".term-chip.selected"))
    .map(function (c) { return c.textContent.replace("✓", "").trim(); });
  summary.textContent = selectedTerms.size + " selected: " + labels.join(", ");
}

/* ── Step indicator ──────────────────────────── */
function updateSteps(active) {
  for (let i = 1; i <= 3; i++) {
    const badge = document.getElementById("step" + i + "-badge");
    if (badge) badge.classList.toggle("inactive", i > active);
  }
  for (let i = 1; i <= 2; i++) {
    const line = document.getElementById("step" + i + "-line");
    if (line) line.classList.toggle("active", i < active);
  }
}

function updateGoBtn() {
  const year    = document.getElementById("academic-year").value;
  const program = document.getElementById("program").value;
  document.getElementById("go-btn").disabled =
    !year || !program || selectedTerms.size === 0;
}

/* ── Navigate to dashboard ───────────────────── */
function goToDashboard() {
  const year    = document.getElementById("academic-year").value;
  const program = document.getElementById("program").value;
  if (!year || !program || selectedTerms.size === 0) return;

  const params = new URLSearchParams({
    academic_year: year,
    program:       program,
    terms:         Array.from(selectedTerms).join(",")
  });

  window.location.href = "/ug_examiner_dashboard?" + params.toString();
}
