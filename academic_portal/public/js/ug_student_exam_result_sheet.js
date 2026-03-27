/* ug_student_exam_result_sheet.js */
/* Depends on: frappe-web.min.js, Chart.js 3.9.1 (loaded before this file) */

/* ══════════════════════════════════════════════════════════════
   GRADE TABLE  (Image 1)
   A+ 85-100 | A 70-84 | A- 65-69 | B+ 60-64 | B 55-59 | B- 50-54
   C+ 45-49  | C 40-44 | C- 35-39 | D+ 30-34 | D 25-29 | E 00-24
   F --                              GPV per grade
   ══════════════════════════════════════════════════════════════ */

const GRADE_TABLE = [
  { min: 85, max: 100, grade: "A+", gpv: 4.00 },
  { min: 70, max: 84,  grade: "A",  gpv: 4.00 },
  { min: 65, max: 69,  grade: "A-", gpv: 3.70 },
  { min: 60, max: 64,  grade: "B+", gpv: 3.30 },
  { min: 55, max: 59,  grade: "B",  gpv: 3.00 },
  { min: 50, max: 54,  grade: "B-", gpv: 2.70 },
  { min: 45, max: 49,  grade: "C+", gpv: 2.30 },
  { min: 40, max: 44,  grade: "C",  gpv: 2.00 },
  { min: 35, max: 39,  grade: "C-", gpv: 1.70 },
  { min: 30, max: 34,  grade: "D+", gpv: 1.30 },
  { min: 25, max: 29,  grade: "D",  gpv: 1.00 },
  { min:  0, max: 24,  grade: "E",  gpv: 0.00 }
];

function getGradeInfo(marks) {
  for (const row of GRADE_TABLE) {
    if (marks >= row.min && marks <= row.max) return row;
  }
  return { grade: "E", gpv: 0.00 };
}

/* ══════════════════════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════════════════════ */

const params       = new URLSearchParams(window.location.search);
const COURSE        = params.get("course");
const ACADEMIC_YEAR = params.get("academic_year");
const PROGRAM       = params.get("program");
const ACADEMIC_TERM = params.get("academic_term");
const TERMS_PARAM   = params.get("terms");   // for back-button

let pageData = null;  // result from get_exam_result_sheet

/* ══════════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", function () {

  /* Back button */
  document.getElementById("back-button").addEventListener("click", function () {
    if (ACADEMIC_YEAR && PROGRAM && TERMS_PARAM) {
      window.location.href = "/ug_examiner_dashboard?" + new URLSearchParams({
        academic_year: ACADEMIC_YEAR,
        program: PROGRAM,
        terms: TERMS_PARAM
      }).toString();
    } else {
      window.location.href = "/ug_examiner_filter_page";
    }
  });

  if (!COURSE || !ACADEMIC_YEAR || !PROGRAM || !ACADEMIC_TERM) {
    showError("Missing URL parameters. Please go back and select filters.");
    return;
  }

  frappe.call({
    method: "academic_portal.api.ug_examiner_api.get_exam_result_sheet",
    args: {
      course:        COURSE,
      academic_year: ACADEMIC_YEAR,
      program:       PROGRAM,
      academic_term: ACADEMIC_TERM
    },
    callback: function (r) {
      if (r.exc || !r.message) {
        showError(r.exc || "Failed to load result sheet. You may not have permission.");
        return;
      }
      pageData = r.message;
      renderPage(pageData);
    }
  });
});

/* ══════════════════════════════════════════════════════════════
   RENDER PAGE
   ══════════════════════════════════════════════════════════════ */

function renderPage(data) {
  document.getElementById("page-loader").style.display  = "none";
  document.getElementById("sheet-content").style.display = "block";

  renderHeader(data);
  renderTable(data);
  setupButtonVisibility(data);
  setupValidation();
  setupTableInteractions();
}

/* ── Header ─────────────────────────────────── */
function renderHeader(data) {
  const ed = data.eval_doc;
  const examiners = data.examiners || [];

  // Display each examiner: role label + salutation + name
  var examinerHtml = "";
  examiners.forEach(function(e) {
    var name = esc(e.display_name || e.instructor_name || e.instructor || "");
    examinerHtml += '<div><strong>' + esc(e.examiner_role || "Examiner") + ':</strong> ' + name + '</div>';
  });

  document.getElementById("header-info").innerHTML =
    '<h3>' + esc(ed.program) + '</h3>' +
    '<p>Marks Sheet</p>' +
    '<div class="header-grid">' +
      '<div class="header-section">' +
        '<h4>Examiners</h4>' + examinerHtml +
      '</div>' +
      '<div class="header-section">' +
        '<h4>Course</h4>' +
        '<div><strong>Course Code:</strong> ' + esc(ed.course) + '</div>' +
        '<div><strong>Course Name:</strong> ' + esc(ed.course_name || "") + '</div>' +
        '<div><strong>Assignment %:</strong> ' + esc(ed.continues_assessment || "") + '%</div>' +
        '<div><strong>Paper %:</strong> ' + esc(ed.final_paper || "") + '%</div>' +
      '</div>' +
      '<div class="header-section">' +
        '<h4>Examination Details</h4>' +
        '<div><strong>Exam Year:</strong> ' + esc(ed.examination_year || "") + '</div>' +
        '<div><strong>Exam Date:</strong> ' + esc(ed.examination_date || "") + '</div>' +
        '<div><strong>Intake:</strong> ' + esc(ed.academic_year) + '</div>' +
        '<div><strong>Semester:</strong> ' + esc(ed.academic_term) + '</div>' +
      '</div>' +
    '</div>';
}

/* ── Table rows ─────────────────────────────── */
function renderTable(data) {
  const tbody = document.getElementById("marks-tbody");
  tbody.innerHTML = "";

  const isFirst    = data.is_first;
  const isSecond   = data.is_second;
  const assignPct  = parseFloat(data.eval_doc.continues_assessment) || 0;
  const paperPct   = parseFloat(data.eval_doc.final_paper) || 0;

  data.results.forEach(function (row, idx) {
    var tr = document.createElement("tr");
    tr.dataset.id              = row.name;
    tr.dataset.assignPct       = assignPct;
    tr.dataset.paperPct        = paperPct;
    tr.dataset.firstSubmitted  = row.first_submitted  ? "1" : "0";
    tr.dataset.secondSubmitted = row.second_submitted ? "1" : "0";

    // Determine editability
    var canEditFirst   = isFirst  && !row.first_submitted;
    var canEditSecond  = isSecond && row.first_submitted && !row.second_submitted;
    var canEditComment = isFirst || isSecond;

    // FIX: class must come FIRST in the td so querySelector works.
    // Adding locked-cell as an extra class rather than replacing the functional class.
    function makeTd(cls, canEdit, value) {
      var classes = cls + (canEdit ? "" : " locked-cell");
      var ce      = canEdit ? "true" : "false";
      return '<td class="' + classes + '" contenteditable="' + ce + '">' + value + '</td>';
    }
    function makeComputedTd(cls, value) {
      return '<td class="' + cls + ' locked-cell" contenteditable="false">' + value + '</td>';
    }

    var isAbsent = row.exam_day_attend === "Ab";
    var ab = "Ab";

    tr.innerHTML =
      '<td>' + (idx + 1) + '</td>' +
      '<td>' + esc(row.index_number || "") + '</td>' +

      // Attendance
      '<td><select class="exam_day_attend">' +
        '<option value="Precent"' + (row.exam_day_attend !== "Ab" ? " selected" : "") + '>Present</option>' +
        '<option value="Ab"'     + (row.exam_day_attend === "Ab"  ? " selected" : "") + '>Absent</option>' +
      '</select></td>' +

      // Previous assignment
      makeTd("previous_assignment_marks", canEditFirst,
             isAbsent ? ab : esc(row.previous_assignment_marks || "")) +

      // First examiner
      makeTd("assignment_marks", canEditFirst,
             isAbsent ? ab : esc(row.assignment_marks || "")) +
      makeTd("paper_marks", canEditFirst,
             isAbsent ? ab : esc(row.paper_marks || "")) +
      makeComputedTd("total_marks",
             isAbsent ? ab : esc(row.total_marks || "")) +

      // Second examiner
      makeTd("second_assignment_marks", canEditSecond,
             isAbsent ? ab : esc(row.second_assignment_marks || "")) +
      makeTd("second_paper_marks", canEditSecond,
             isAbsent ? ab : esc(row.second_paper_marks || "")) +
      makeTd("second_total_marks", canEditSecond,
             isAbsent ? ab : esc(row.second_total_marks || "")) +

      // Computed — never editable
      makeComputedTd("final_marks",
             isAbsent ? ab : esc(row.final_marks || "")) +
      makeComputedTd("final_grade",
             isAbsent ? ab : esc(row.final_grade || "")) +

      // Examiner comment
      makeTd("examiner_comment", canEditComment,
             esc(row.first_examiner_comment || row.second_examiner_comment || ""));

    tbody.appendChild(tr);

    // Live-calc listeners — attached after innerHTML so cells exist in DOM
    ["assignment_marks", "paper_marks", "second_assignment_marks",
     "second_paper_marks", "second_total_marks", "previous_assignment_marks"].forEach(function (cls) {
      var cell = tr.querySelector("." + cls);
      if (cell) {
        cell.addEventListener("input",  function () { calcRow(tr); });
        cell.addEventListener("keyup",  function () { calcRow(tr); });
      }
    });

    tr.querySelector(".exam_day_attend").addEventListener("change", function () {
      handleAttendanceChange(tr);
      calcRow(tr);
    });
  });
}

/* ── Button visibility ──────────────────────── */
function setupButtonVisibility(data) {
  const isFirst    = data.is_first;
  const isSecond   = data.is_second;
  const results    = data.results || [];

  // first_submitted / second_submitted are per-row; check the first row
  const anyFirstSubmitted  = results.some(r => r.first_submitted);
  const anySecondSubmitted = results.some(r => r.second_submitted);
  const allFirstSubmitted  = results.length > 0 && results.every(r => r.first_submitted);

  // Show "Submit to 2nd" if user is first examiner and not yet submitted
  const showFirstSubmit = isFirst && !allFirstSubmitted;
  // Show "Submit to Board" if user is second examiner and first is done but second not yet
  const showSecondSubmit = isSecond && anyFirstSubmitted && !anySecondSubmitted;

  document.querySelectorAll(".first-submit-btn").forEach(b => {
    b.style.display = showFirstSubmit ? "inline-block" : "none";
  });
  document.querySelectorAll(".second-submit-btn").forEach(b => {
    b.style.display = showSecondSubmit ? "inline-block" : "none";
  });

  const userRoles = frappe.user_roles || [];
  if (userRoles.includes("Unlock User 1")) {
    document.querySelectorAll(".unlock1-btn").forEach(b => b.style.display = "inline-block");
  }
  if (userRoles.includes("Unlock User 2")) {
    document.querySelectorAll(".unlock2-btn").forEach(b => b.style.display = "inline-block");
  }
}

/* ══════════════════════════════════════════════════════════════
   CALCULATIONS
   ══════════════════════════════════════════════════════════════ */

function calcRow(tr) {
  const attend = tr.querySelector(".exam_day_attend").value;
  if (attend === "Ab") return;

  const assignPct = parseFloat(tr.dataset.assignPct) || 0;
  const paperPct  = parseFloat(tr.dataset.paperPct)  || 0;

  const assignRaw  = tr.querySelector(".assignment_marks").innerText.trim();
  const paperRaw   = tr.querySelector(".paper_marks").innerText.trim();
  const secAssign  = parseFloat(tr.querySelector(".second_assignment_marks").innerText.trim()) || 0;
  const secPaper   = parseFloat(tr.querySelector(".second_paper_marks").innerText.trim())  || 0;
  const secTotal   = parseFloat(tr.querySelector(".second_total_marks").innerText.trim())  || 0;

  const assign = assignRaw !== "" ? parseFloat(assignRaw) : null;
  const paper  = paperRaw  !== "" ? parseFloat(paperRaw)  : null;

  let total = 0;
  if (assign !== null && paper !== null) {
    total = ((assign * assignPct) + (paper * paperPct)) / 100;
  } else if (paper !== null) {
    total = (paper * paperPct) / 100;
  }
  total = Math.round(total);

  let adjustment = 0;
  if (secAssign) adjustment += (secAssign * assignPct) / 100;
  if (secPaper)  adjustment += (secPaper  * paperPct)  / 100;
  adjustment += secTotal;

  let finalMarks = Math.round(total + adjustment);

  // Auto-push rule: 48 or 49 → 50
  let autoStatus = "";
  if (total === 48 || total === 49) {
    finalMarks = 50;
    autoStatus = "Pushed";
  } else if ([54, 59, 64, 69, 74, 79, 89].includes(finalMarks)) {
    autoStatus = "****";
  }

  const gradeInfo = getGradeInfo(finalMarks);

  tr.querySelector(".total_marks").innerText = total !== null ? String(total) : "";
  tr.querySelector(".final_marks").innerText = finalMarks !== null ? String(finalMarks) : "";
  tr.querySelector(".final_grade").innerText = gradeInfo.grade || "";
}

function handleAttendanceChange(tr) {
  const isAbsent = tr.querySelector(".exam_day_attend").value === "Ab";
  const abFields = [
    ".paper_marks", ".assignment_marks", ".previous_assignment_marks",
    ".second_assignment_marks", ".second_paper_marks", ".second_total_marks",
    ".total_marks", ".final_marks", ".final_grade"
  ];

  if (isAbsent) {
    abFields.forEach(function (cls) {
      const cell = tr.querySelector(cls);
      if (cell) {
        cell.innerText = "Ab";
        cell.setAttribute("contenteditable", "false");
      }
    });
  } else {
    abFields.forEach(function (cls) {
      const cell = tr.querySelector(cls);
      if (!cell) return;
      if (cell.innerText === "Ab") cell.innerText = "";
      // Restore editability based on role/submission status
      restoreCellEditability(tr, cell, cls.replace(".", ""));
    });
  }
}

function restoreCellEditability(tr, cell, className) {
  if (!pageData) return;
  const firstSubmitted  = tr.dataset.firstSubmitted  === "1";
  const secondSubmitted = tr.dataset.secondSubmitted === "1";
  const isFirst   = pageData.is_first;
  const isSecond  = pageData.is_second;

  const firstEditableCls  = ["assignment_marks", "paper_marks", "previous_assignment_marks"];
  const secondEditableCls = ["second_assignment_marks", "second_paper_marks", "second_total_marks"];
  const computedCls       = ["total_marks", "final_marks", "final_grade"];

  if (computedCls.includes(className)) {
    cell.setAttribute("contenteditable", "false");
    return;
  }
  if (firstEditableCls.includes(className)) {
    const editable = isFirst && !firstSubmitted;
    cell.setAttribute("contenteditable", editable ? "true" : "false");
    cell.classList.toggle("locked-cell", !editable);
    return;
  }
  if (secondEditableCls.includes(className)) {
    const editable = isSecond && firstSubmitted && !secondSubmitted;
    cell.setAttribute("contenteditable", editable ? "true" : "false");
    cell.classList.toggle("locked-cell", !editable);
    return;
  }
}

/* ══════════════════════════════════════════════════════════════
   VALIDATION
   ══════════════════════════════════════════════════════════════ */

function setupValidation() {
  const rules = [
    { sel: ".assignment_marks",         min: 0,    max: 100, label: "Assignment Marks" },
    { sel: ".paper_marks",              min: 0,    max: 100, label: "Paper Marks" },
    { sel: ".previous_assignment_marks",min: 0,    max: 100, label: "Previous Assignment" },
    { sel: ".second_assignment_marks",  min: -100, max: 100, label: "2nd Assignment (+/-)" },
    { sel: ".second_paper_marks",       min: -100, max: 100, label: "2nd Paper (+/-)" },
    { sel: ".second_total_marks",       min: -100, max: 100, label: "2nd Total (+/-)" }
  ];

  rules.forEach(function (rule) {
    document.querySelectorAll("#marks-table " + rule.sel).forEach(function (cell) {
      cell.addEventListener("blur", function () {
        validateCell(cell, rule.min, rule.max, rule.label);
      });
      cell.addEventListener("keydown", function (e) {
        allowNumericKeys(e, cell);
      });
    });
  });
}

function validateCell(cell, min, max, label) {
  const val = cell.innerText.trim();
  if (val === "" || val === "Ab") return true;
  const num = parseFloat(val);
  if (isNaN(num) || num < min || num > max) {
    alert("❌ " + label + " must be between " + min + " and " + max + ".");
    cell.innerText = "";
    setTimeout(() => cell.focus(), 0);
    return false;
  }
  return true;
}

function allowNumericKeys(e, cell) {
  const allowed = ["Backspace","Tab","ArrowLeft","ArrowRight","Delete","Enter",
                   "Escape","Home","End","Shift","Control","Alt","Meta"];
  if (/^\d$/.test(e.key)) return;
  if (e.key === "." && !cell.innerText.includes(".")) return;
  if (e.key === "-") {
    const sel  = window.getSelection();
    const pos  = sel.rangeCount ? sel.getRangeAt(0).startOffset : 0;
    if (!cell.innerText.includes("-") && pos === 0) return;
  }
  if (allowed.includes(e.key)) return;
  e.preventDefault();
}

/* ══════════════════════════════════════════════════════════════
   TABLE INTERACTIONS (Enter to move down, hover highlight)
   ══════════════════════════════════════════════════════════════ */

function setupTableInteractions() {
  const table = document.getElementById("marks-table");

  // Enter key → move to next row, same column
  table.querySelectorAll("td[contenteditable='true']").forEach(function (cell) {
    cell.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        const tr  = cell.parentElement;
        const idx = Array.from(tr.children).indexOf(cell);
        const nextTr = tr.nextElementSibling;
        if (nextTr) {
          const nextCell = nextTr.children[idx];
          if (nextCell) {
            setTimeout(() => {
              nextCell.focus();
              nextTr.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 10);
          }
        }
      }
    });
  });

  // Hover highlight
  table.querySelectorAll("td").forEach(function (cell) {
    cell.style.userSelect = "text";
    cell.addEventListener("mouseenter", function () {
      table.querySelectorAll("tr").forEach(r => r.classList.remove("highlighted"));
      cell.parentElement.classList.add("highlighted");
    });
    cell.addEventListener("mouseleave", function () {
      cell.parentElement.classList.remove("highlighted");
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   SAVE
   ══════════════════════════════════════════════════════════════ */

/* ── Collect all row data into a serialisable array ── */
function collectRows() {
  var isFirst  = pageData && pageData.is_first;
  var isSecond = pageData && pageData.is_second;
  var rows = [];

  document.querySelectorAll("#marks-table tbody tr").forEach(function (tr) {
    var attend = tr.querySelector(".exam_day_attend").value;
    var row = { name: tr.dataset.id, data: {} };

    // Attendance + prev assignment (always)
    row.data.exam_day_attend            = attend;
    row.data.previous_assignment_marks  = tr.querySelector(".previous_assignment_marks").innerText.trim();

    // First examiner fields
    if (isFirst) {
      row.data.assignment_marks       = tr.querySelector(".assignment_marks").innerText.trim();
      row.data.paper_marks            = tr.querySelector(".paper_marks").innerText.trim();
      row.data.first_examiner_comment = tr.querySelector(".examiner_comment").innerText.trim();
    }

    // Second examiner fields
    if (isSecond) {
      row.data.second_assignment_marks = tr.querySelector(".second_assignment_marks").innerText.trim();
      row.data.second_paper_marks      = tr.querySelector(".second_paper_marks").innerText.trim();
      row.data.second_total_marks      = tr.querySelector(".second_total_marks").innerText.trim();
      row.data.second_examiner_comment = tr.querySelector(".examiner_comment").innerText.trim();
    }

    // Computed fields — ALWAYS saved regardless of role
    row.data.total_marks           = tr.querySelector(".total_marks").innerText.trim();
    row.data.final_marks           = tr.querySelector(".final_marks").innerText.trim();
    row.data.final_grade           = tr.querySelector(".final_grade").innerText.trim();


    rows.push(row);
  });

  return rows;
}

/* ── Save without confirm prompt (used internally before submit) ── */
function saveChangesQuiet(callback) {
  var rows = collectRows();
  frappe.call({
    method: "academic_portal.api.ug_examiner_api.bulk_save_results",
    args: { rows_json: JSON.stringify(rows) },
    callback: function (r) {
      if (callback) callback(r);
    }
  });
}

/* ── Save with confirm prompt (triggered by 💾 button) ── */
function saveChanges() {
  if (!confirm("Are you sure you want to save changes?")) return;
  saveChangesQuiet(function (r) {
    if (r.message && r.message.errors && r.message.errors.length) {
      alert("⚠️ Some rows failed to save:\n" +
            r.message.errors.map(function(e) { return e.name + ": " + e.error; }).join("\n"));
    } else {
      alert("🌿 All changes saved successfully.");
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   SUBMIT ACTIONS
   ══════════════════════════════════════════════════════════════ */

function doFirstSubmit() {
  if (!confirm("You cannot change the marks after clicking 'Submit to the Second Examiner'. Continue?")) return;
  // Save all current data first, then submit
  saveChangesQuiet(function () {
    frappe.call({
      method: "academic_portal.api.ug_examiner_api.submit_first",
    args: { course: COURSE, academic_year: ACADEMIC_YEAR, program: PROGRAM, academic_term: ACADEMIC_TERM },
      callback: function (r) {
        if (!r.exc) {
          alert("✅ Submitted to the Second Examiner successfully.");
          document.querySelectorAll("#marks-table tbody tr").forEach(function (tr) {
            tr.dataset.firstSubmitted = "1";
            ["assignment_marks", "paper_marks", "previous_assignment_marks"].forEach(function (cls) {
              var cell = tr.querySelector("." + cls);
              if (cell) { cell.setAttribute("contenteditable", "false"); cell.classList.add("locked-cell"); }
            });
          });
          document.querySelectorAll(".first-submit-btn").forEach(function(b) { b.style.display = "none"; });
        } else {
          alert("❌ Submit failed.");
        }
      }
    });
  });
}

function doSecondSubmit() {
  if (!confirm("You cannot change the marks after clicking 'Submit to the Exam Board'. Continue?")) return;
  // Save all current data first, then submit
  saveChangesQuiet(function () {
    frappe.call({
      method: "academic_portal.api.ug_examiner_api.submit_second",
    args: { course: COURSE, academic_year: ACADEMIC_YEAR, program: PROGRAM, academic_term: ACADEMIC_TERM },
      callback: function (r) {
        if (!r.exc) {
          alert("✅ Submitted to the Exam Board successfully.");
          document.querySelectorAll("#marks-table tbody tr").forEach(function (tr) {
            tr.dataset.secondSubmitted = "1";
            ["second_assignment_marks", "second_paper_marks", "second_total_marks"].forEach(function (cls) {
              var cell = tr.querySelector("." + cls);
              if (cell) { cell.setAttribute("contenteditable", "false"); cell.classList.add("locked-cell"); }
            });
          });
          document.querySelectorAll(".second-submit-btn").forEach(function(b) { b.style.display = "none"; });
        } else {
          alert("❌ Submit failed.");
        }
      }
    });
  });
}

function doUnlock1() {
  if (!confirm("Unlock Assignment and Paper Marks for all rows?")) return;
  frappe.call({
    method: "academic_portal.api.ug_examiner_api.unlock_first_examiner",
    args: { course: COURSE, academic_year: ACADEMIC_YEAR, program: PROGRAM, academic_term: ACADEMIC_TERM },
    callback: function (r) {
      if (!r.exc) {
        alert("✅ First Examiner fields unlocked.");
        document.querySelectorAll("#marks-table tbody tr").forEach(function (tr) {
          tr.dataset.firstSubmitted = "0";
          ["assignment_marks", "paper_marks"].forEach(function (cls) {
            const cell = tr.querySelector("." + cls);
            if (cell) { cell.setAttribute("contenteditable", "true"); cell.classList.remove("locked-cell"); cell.style.backgroundColor = ""; }
          });
        });
        document.querySelectorAll(".first-submit-btn").forEach(b => b.style.display = "inline-block");
      } else {
        alert("❌ Unlock failed. You may not have permission.");
      }
    }
  });
}

function doUnlock2() {
  if (!confirm("Unlock Second Examiner fields for all rows?")) return;
  frappe.call({
    method: "academic_portal.api.ug_examiner_api.unlock_second_examiner",
    args: { course: COURSE, academic_year: ACADEMIC_YEAR, program: PROGRAM, academic_term: ACADEMIC_TERM },
    callback: function (r) {
      if (!r.exc) {
        alert("✅ Second Examiner fields unlocked.");
        document.querySelectorAll("#marks-table tbody tr").forEach(function (tr) {
          tr.dataset.secondSubmitted = "0";
          ["second_assignment_marks", "second_paper_marks", "second_total_marks"].forEach(function (cls) {
            const cell = tr.querySelector("." + cls);
            if (cell) { cell.setAttribute("contenteditable", "true"); cell.classList.remove("locked-cell"); cell.style.backgroundColor = ""; }
          });
        });
        document.querySelectorAll(".second-submit-btn").forEach(b => b.style.display = "inline-block");
      } else {
        alert("❌ Unlock failed. You may not have permission.");
      }
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   STATISTICS
   ══════════════════════════════════════════════════════════════ */

let gradeChartInstance = null;

function showStatistics() {
  calculateAndDisplayStats();
  document.getElementById("statsModal").style.display = "block";
}

function closeStatistics() {
  document.getElementById("statsModal").style.display = "none";
}

window.addEventListener("click", function (e) {
  const modal = document.getElementById("statsModal");
  if (e.target === modal) modal.style.display = "none";
});

function calculateAndDisplayStats() {
  const GRADE_ORDER = ["A+","A","A-","B+","B","B-","C+","C","C-","D+","D","E","Ab"];
  const gradeCounts = {};
  GRADE_ORDER.forEach(g => gradeCounts[g] = 0);

  const marks = [];

  document.querySelectorAll("#marks-table tbody tr").forEach(function (tr) {
    const grade = tr.querySelector(".final_grade").innerText.trim();
    const mark  = tr.querySelector(".final_marks").innerText.trim();
    if (grade && gradeCounts.hasOwnProperty(grade)) gradeCounts[grade]++;
    else if (grade) gradeCounts["Ab"] = (gradeCounts["Ab"] || 0) + 1;
    if (mark && mark !== "Ab" && !isNaN(parseFloat(mark))) marks.push(parseFloat(mark));
  });

  const total = Object.values(gradeCounts).reduce((a, b) => a + b, 0);

  // Grade distribution table
  const tbody = document.getElementById("gradeDistribution");
  tbody.innerHTML = "";
  GRADE_ORDER.forEach(function (g) {
    const count = gradeCounts[g] || 0;
    const pct   = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
    const tr    = document.createElement("tr");
    tr.innerHTML = "<td><strong>" + g + "</strong></td><td>" + count + "</td><td class='percentage'>" + pct + "%</td>";
    tbody.appendChild(tr);
  });

  // Statistical measures
  const stats = calcStats(marks);
  document.getElementById("statisticalMeasures").innerHTML =
    statItem("Average", stats.avg) + statItem("Std Deviation", stats.sd) +
    statItem("Maximum", stats.max) + statItem("Minimum", stats.min) +
    statItem("Median",  stats.median) + statItem("Mode", stats.mode);

  // Pass / fail
  const passing = ["C","C+","B-","B","B+","A-","A","A+"];
  const failing  = ["C-","D+","D","E"];
  let passed = 0, failed = 0, absent = 0;
  GRADE_ORDER.forEach(function (g) {
    const c = gradeCounts[g] || 0;
    if (passing.includes(g)) passed += c;
    else if (failing.includes(g)) failed += c;
    else if (g === "Ab") absent += c;
  });
  document.getElementById("passFailSummary").innerHTML =
    statItem("Passed", passed) + statItem("Failed", failed) +
    statItem("Absent", absent) + statItem("Total Present", passed + failed);

  // Chart
  const ctx = document.getElementById("gradeChart").getContext("2d");
  if (gradeChartInstance) gradeChartInstance.destroy();

  const colors = GRADE_ORDER.map(function (g) {
    if (["A+","A","A-"].includes(g)) return "#22c55e";
    if (["B+","B","B-"].includes(g)) return "#3b82f6";
    if (["C+","C","C-"].includes(g)) return "#f59e0b";
    if (["D+","D","E"].includes(g))  return "#ef4444";
    return "#6b7280";
  });

  gradeChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: GRADE_ORDER,
      datasets: [{
        label: "Students",
        data: GRADE_ORDER.map(g => gradeCounts[g] || 0),
        backgroundColor: colors,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Grade Distribution (Total: " + total + ")",
          font: { size: 16, weight: "bold" }, color: "#2d3748", padding: 16
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { weight: "bold" } } },
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: "#e2e8f0", borderDash: [2,2] } }
      },
      animation: { duration: 1000 }
    }
  });
}

function calcStats(marks) {
  if (!marks.length) return { avg: 0, sd: 0, max: "N/A", min: "N/A", median: 0, mode: "N/A" };
  const sorted = [...marks].sort((a, b) => a - b);
  const sum    = marks.reduce((a, b) => a + b, 0);
  const avg    = sum / marks.length;
  const variance = marks.reduce((a, v) => a + Math.pow(v - avg, 2), 0) / marks.length;
  const sd     = Math.sqrt(variance).toFixed(2);
  const median = sorted.length % 2 === 0
    ? ((sorted[sorted.length/2 - 1] + sorted[sorted.length/2]) / 2).toFixed(2)
    : sorted[Math.floor(sorted.length/2)].toFixed(2);
  const freq = {};
  marks.forEach(m => freq[m] = (freq[m] || 0) + 1);
  let mode = "N/A", maxF = 0;
  Object.entries(freq).forEach(([k, v]) => { if (v > maxF) { maxF = v; mode = k; } });
  if (maxF === 1) mode = "N/A";
  return { avg: avg.toFixed(2), sd, max: sorted[sorted.length-1], min: sorted[0], median, mode };
}

function statItem(label, value) {
  return '<div class="stat-item"><span class="stat-label">' + label + ':</span>' +
         '<span class="stat-value">' + value + '</span></div>';
}

/* ══════════════════════════════════════════════════════════════
   PRINT
   ══════════════════════════════════════════════════════════════ */

function showPrintView() {
  if (!pageData) return;
  const ed = pageData.eval_doc;
  const examiners = pageData.examiners || [];

  let examHtml = "";
  examiners.forEach(function (e) {
    var name = esc(e.display_name || e.instructor_name || "");
    examHtml += '<td style="text-align:center;padding:8px;"><strong>' +
      esc(e.examiner_role) + '<br>' + name + '</strong></td>';
  });

  let rowsHtml = "";
  document.querySelectorAll("#marks-table tbody tr").forEach(function (tr, idx) {
    rowsHtml +=
      '<tr>' +
      '<td>' + (idx + 1) + '</td>' +
      '<td>' + tr.querySelector(".index_number, td:nth-child(2)") + '</td>' +
      '<td>' + (tr.querySelector(".assignment_marks") ? tr.querySelector(".assignment_marks").innerText : "") + '</td>' +
      '<td>' + (tr.querySelector(".paper_marks") ? tr.querySelector(".paper_marks").innerText : "") + '</td>' +
      '<td>' + (tr.querySelector(".total_marks") ? tr.querySelector(".total_marks").innerText : "") + '</td>' +
      '<td>' + (tr.querySelector(".second_assignment_marks") ? tr.querySelector(".second_assignment_marks").innerText : "") + '</td>' +
      '<td>' + (tr.querySelector(".second_paper_marks") ? tr.querySelector(".second_paper_marks").innerText : "") + '</td>' +
      '<td>' + (tr.querySelector(".second_total_marks") ? tr.querySelector(".second_total_marks").innerText : "") + '</td>' +
      '<td>' + (tr.querySelector(".final_marks") ? tr.querySelector(".final_marks").innerText : "") + '</td>' +
      '<td>' + (tr.querySelector(".final_grade") ? tr.querySelector(".final_grade").innerText : "") + '</td>' +

      '</tr>';
  });

  // Better print: read cells directly
  rowsHtml = "";
  document.querySelectorAll("#marks-table tbody tr").forEach(function (tr, idx) {
    const cells = tr.querySelectorAll("td");
    rowsHtml += '<tr>';
    rowsHtml += '<td>' + (idx + 1) + '</td>';
    // Index number (col 1)
    rowsHtml += '<td>' + (cells[1] ? cells[1].innerText : "") + '</td>';
    // assignment_marks, paper_marks, total_marks, 2nd assign, 2nd paper, 2nd total, final, grade, gpv, auto
    [".assignment_marks",".paper_marks",".total_marks",
     ".second_assignment_marks",".second_paper_marks",".second_total_marks",
     ".final_marks",".final_grade"].forEach(function (cls) {
      const cell = tr.querySelector(cls);
      rowsHtml += '<td>' + (cell ? cell.innerText : "") + '</td>';
    });
    rowsHtml += '</tr>';
  });

  const pw = window.open("", "", "width=1200,height=800");
  pw.document.write(`<!DOCTYPE html><html><head><title>Final Mark Sheet</title>
<style>
  @page { margin: 15mm; }
  body { font-family: "Segoe UI", sans-serif; font-size: 12px; color:#333; }
  h3, h4 { text-align: center; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px; text-align: center; }
  th { background: #f1f3f5; font-weight: 600; }
  .info-table td { border: none; text-align: left; padding: 3px 8px; }
</style></head><body>
  <h3>UNIVERSITY OF COLOMBO SCHOOL OF COMPUTING</h3>
  <h3>${esc(ed.program)}</h3>
  <h4>Final Mark Sheet</h4>
  <table class="info-table">
    <tr><td><strong>Course Code:</strong> ${esc(ed.course)}</td><td><strong>Course Name:</strong> ${esc(ed.course_name||"")}</td></tr>
    <tr><td><strong>Examination Year:</strong> ${esc(ed.examination_year||"")}</td><td><strong>Examination Date:</strong> ${esc(ed.examination_date||"")}</td></tr>
    <tr><td><strong>Intake:</strong> ${esc(ed.academic_year)}</td><td><strong>Semester:</strong> ${esc(ed.academic_term)}</td></tr>
    <tr><td><strong>Assignment %:</strong> ${esc(ed.continues_assessment||"")}%</td><td><strong>Paper %:</strong> ${esc(ed.final_paper||"")}%</td></tr>
  </table>
  <table style="margin-top:12px;border:none;"><tr>${examHtml}</tr></table>
  <hr style="margin:12px 0;"/>
  <table>
    <thead>
      <tr>
        <th rowspan="2">#</th><th rowspan="2">Index No.</th>
        <th colspan="3">First Examiner</th>
        <th colspan="3">Second Examiner</th>
        <th rowspan="2">Final</th><th rowspan="2">Grade</th>
      </tr>
      <tr>
        <th>Assign</th><th>Paper</th><th>Total</th>
        <th>Assign(±)</th><th>Paper(±)</th><th>Total(±)</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body></html>`);
  pw.document.close();
  pw.focus();
  pw.onload = function () { setTimeout(() => { pw.print(); }, 400); };
}

function printStatistics() {
  const canvas = document.getElementById("gradeChart");
  const chartImg = canvas ? canvas.toDataURL() : null;

  const clone = document.querySelector(".stats-content").cloneNode(true);
  clone.querySelector(".close")?.remove();
  clone.querySelector(".print-stats-btn")?.remove();

  if (chartImg) {
    const c = clone.querySelector("#gradeChart");
    if (c) {
      const img = document.createElement("img");
      img.src = chartImg; img.style.width = "100%";
      c.parentNode.replaceChild(img, c);
    }
  }

  const pw = window.open("", "_blank", "width=1100,height=800");
  pw.document.write(`<!DOCTYPE html><html><head><title>Statistics</title>
<style>
  @page { margin:15mm; size:A4; }
  body { font-family:"Segoe UI",sans-serif; font-size:12px; }
  .stats-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
  .chart-card { grid-column:1/-1; }
  .stats-card { border:1px solid #ddd; border-radius:6px; padding:12px; page-break-inside:avoid; }
  .stats-card h3 { margin:0 0 8px; font-size:1rem; }
  .grade-stats-table { width:100%; border-collapse:collapse; }
  .grade-stats-table th,.grade-stats-table td { border:1px solid #ccc; padding:5px; font-size:11px; }
  .stat-item { display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #eee; }
</style></head><body><div class="stats-content">${clone.innerHTML}</div></body></html>`);
  pw.document.close();
  pw.onload = function () { setTimeout(() => { pw.focus(); pw.print(); }, 500); };
}

/* ══════════════════════════════════════════════════════════════
   UTILS
   ══════════════════════════════════════════════════════════════ */

function showError(msg) {
  document.getElementById("page-loader").style.display = "none";
  const el = document.getElementById("page-error");
  el.textContent = "🚫 " + msg;
  el.style.display = "block";
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}