/* ug_examiner_dashboard.js */
/* Depends on: frappe-web.min.js (loaded before this file) */

document.addEventListener("DOMContentLoaded", function () {

  const params       = new URLSearchParams(window.location.search);
  const academicYear = params.get("academic_year");
  const program      = params.get("program");
  const terms        = params.get("terms");

  if (!academicYear || !program || !terms) {
    document.getElementById("no-filter-notice").style.display = "block";
    return;
  }

  /* Populate filter chips */
  document.getElementById("filter-bar").style.display = "flex";
  const chipContainer = document.getElementById("filter-chips");
  chipContainer.innerHTML =
    '<span class="filter-label">Filters:</span>' +
    '<span class="filter-chip"><span class="chip-dot"></span>' + escHtml(academicYear) + '</span>' +
    '<span class="filter-chip"><span class="chip-dot"></span>' + escHtml(program)      + '</span>' +
    '<span class="filter-chip"><span class="chip-dot"></span>' + escHtml(terms.replace(/,/g, ", ")) + '</span>';

  /* Show loader */
  document.getElementById("loading-state").style.display = "block";

  frappe.call({
    method: "academic_portal.api.ug_examiner_api.get_dashboard_courses",
    args: {
      academic_year: academicYear,
      program:       program,
      terms:         terms
    },
    callback: function (r) {
      document.getElementById("loading-state").style.display  = "none";
      document.getElementById("examiner-sections").style.display = "grid";

      if (!r.message || r.message.error) {
        const err = (r.message && r.message.error) ? r.message.error : "Failed to load courses.";
        document.getElementById("first-examiner-cards").innerHTML  =
          '<div class="empty-state">' + escHtml(err) + '</div>';
        document.getElementById("second-examiner-cards").innerHTML =
          '<div class="empty-state">' + escHtml(err) + '</div>';
        return;
      }

      const courses     = r.message.courses || [];
      const firstCards  = document.getElementById("first-examiner-cards");
      const secondCards = document.getElementById("second-examiner-cards");
      firstCards.innerHTML  = "";
      secondCards.innerHTML = "";

      let firstCount  = 0;
      let secondCount = 0;

      courses.forEach(function (c, idx) {
        if (c.is_first) {
          firstCards.appendChild(buildCard(c, idx, academicYear, program, terms));
          firstCount++;
        }
        if (c.is_second || c.is_moderator) {
          secondCards.appendChild(buildCard(c, idx, academicYear, program, terms));
          secondCount++;
        }
      });

      if (firstCount  === 0) firstCards.innerHTML  = '<div class="empty-state">No courses found.</div>';
      if (secondCount === 0) secondCards.innerHTML = '<div class="empty-state">No courses found.</div>';
    }
  });
});

/* ── Build a course card element ──────────────── */
function buildCard(c, idx, academicYear, program, terms) {
  const card = document.createElement("div");
  card.className = "course-card";
  card.style.animationDelay = (idx * 0.07) + "s";

  card.innerHTML =
    '<h3>'  + escHtml(c.course)              + '</h3>' +
    '<p>'   + escHtml(c.course_name || "")   + '</p>'  +
    '<div class="term-label">' + escHtml(c.academic_term || "") + '</div>' +
    '<span class="status-badge ' + c.badge_class + '">' + escHtml(c.badge_text) + '</span>';

  card.addEventListener("click", function () {
    const p = new URLSearchParams({
      course:        c.course,
      academic_year: academicYear,
      program:       program,
      academic_term: c.academic_term,
      terms:         terms
    });
    window.location.href = "/ug_student_exam_result_sheet?" + p.toString();
  });

  return card;
}

/* ── Utility ──────────────────────────────────── */
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
