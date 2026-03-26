import frappe
from frappe import _


# ── Examiner role values as they appear in the DB (Image 2) ──────────────────
FIRST_EXAMINER_ROLES  = ["Setter(s) / First Examiner"]
SECOND_EXAMINER_ROLES = ["Moderator / Second Examiner"]
ALL_EXAMINER_ROLES    = FIRST_EXAMINER_ROLES + SECOND_EXAMINER_ROLES


def get_current_instructor(user=None):
    """Return the Instructor doc linked to the current user via custom_user."""
    if not user:
        user = frappe.session.user
    rows = frappe.get_all(
        "Instructor",
        filters={"custom_user": user},
        fields=["name", "instructor_name"],
        limit=1
    )
    return rows[0] if rows else None


def is_examiner_for_eval(instructor_name, eval_doc_name):
    """Return list of examiner_role values for this instructor in this eval doc."""
    rows = frappe.get_all(
        "Appointment of Examiners",
        filters={"parent": eval_doc_name, "instructor": instructor_name},
        fields=["examiner_role"],
        limit=10
    )
    return [r["examiner_role"] for r in rows]


# ── Filter page helpers ───────────────────────────────────────────────────────

@frappe.whitelist()
def get_filter_options():
    """
    Return academic_year / program / academic_term lists from active
    UG Course Evaluation and Examiners docs where the current user is an examiner.
    """
    user = frappe.session.user
    instructor = get_current_instructor(user)
    if not instructor:
        return {
            "academic_years": [], "programs": [], "academic_terms": [],
            "error": "No instructor linked to your account."
        }

    instructor_name = instructor["name"]

    active_docs = frappe.get_all(
        "UG Course Evaluation and Examiners",
        filters={"active": 1},
        fields=["name", "academic_year", "program", "academic_term"],
        limit_page_length=1000
    )

    seen_years, seen_programs, seen_terms = set(), set(), set()
    academic_years, programs, academic_terms = [], [], []

    for doc in active_docs:
        roles = is_examiner_for_eval(instructor_name, doc["name"])
        if not roles:
            continue

        y = doc.get("academic_year")
        p = doc.get("program")
        t = doc.get("academic_term")

        if y and y not in seen_years:
            seen_years.add(y); academic_years.append(y)
        if p and p not in seen_programs:
            seen_programs.add(p); programs.append(p)
        if t and t not in seen_terms:
            seen_terms.add(t); academic_terms.append(t)

    academic_years.sort(reverse=True)
    programs.sort()
    academic_terms.sort()

    return {
        "academic_years": academic_years,
        "programs":       programs,
        "academic_terms": academic_terms
    }


@frappe.whitelist()
def get_programs_for_year(academic_year):
    """Programs available to the current user for a given academic year."""
    user = frappe.session.user
    instructor = get_current_instructor(user)
    if not instructor:
        return []

    instructor_name = instructor["name"]

    docs = frappe.get_all(
        "UG Course Evaluation and Examiners",
        filters={"active": 1, "academic_year": academic_year},
        fields=["name", "program"],
        limit_page_length=500
    )

    seen, programs = set(), []
    for doc in docs:
        if not is_examiner_for_eval(instructor_name, doc["name"]):
            continue
        p = doc.get("program")
        if p and p not in seen:
            seen.add(p); programs.append(p)

    programs.sort()
    return programs


@frappe.whitelist()
def get_terms_for_year_program(academic_year, program):
    """Academic terms available to the current user for given year + program."""
    user = frappe.session.user
    instructor = get_current_instructor(user)
    if not instructor:
        return []

    instructor_name = instructor["name"]

    docs = frappe.get_all(
        "UG Course Evaluation and Examiners",
        filters={"active": 1, "academic_year": academic_year, "program": program},
        fields=["name", "academic_term"],
        limit_page_length=500
    )

    seen, terms = set(), []
    for doc in docs:
        if not is_examiner_for_eval(instructor_name, doc["name"]):
            continue
        t = doc.get("academic_term")
        if t and t not in seen:
            seen.add(t); terms.append(t)

    terms.sort()
    return terms


# ── Dashboard ─────────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_dashboard_courses(academic_year, program, terms):
    """
    Return course cards for the dashboard.
    Uses the ug_course_evaluation_and_examiners link on UG Student Exam Results
    (Image 3) to find the eval doc directly — no fragile multi-field lookup.
    """
    user = frappe.session.user
    instructor = get_current_instructor(user)
    if not instructor:
        return {"error": "No instructor linked to your account.", "courses": []}

    instructor_name = instructor["name"]

    if isinstance(terms, str):
        term_list = [t.strip() for t in terms.split(",")]
    else:
        term_list = list(terms)

    # Fetch matching UG Student Exam Results rows — use the direct link field
    results = frappe.get_all(
        "UG Student Exam Results",
        filters=[
            ["academic_year", "=",  academic_year],
            ["program",       "=",  program],
            ["academic_term", "in", term_list]
        ],
        fields=[
            "name", "course", "program", "academic_year", "academic_term",
            "first_submitted", "second_submitted",
            "ug_course_evaluation_and_examiners"   # direct link (Image 3)
        ],
        limit_page_length=1000
    )

    # Deduplicate by course — keep one representative row per course
    seen_courses, course_map = set(), {}
    for rec in results:
        c = rec.get("course")
        if c and c not in seen_courses:
            seen_courses.add(c)
            course_map[c] = rec

    courses_out = []

    for course_code, rec in course_map.items():
        eval_doc_name = rec.get("ug_course_evaluation_and_examiners")

        # Fallback: find eval doc by fields if link is not set
        if not eval_doc_name:
            matches = frappe.get_all(
                "UG Course Evaluation and Examiners",
                filters={
                    "active":        1,
                    "course":        course_code,
                    "academic_year": academic_year,
                    "program":       program,
                    "academic_term": rec.get("academic_term")
                },
                fields=["name", "course_name"],
                limit=1
            )
            if not matches:
                continue
            eval_doc_name = matches[0]["name"]
            course_name   = matches[0].get("course_name") or ""
        else:
            course_name = frappe.db.get_value(
                "UG Course Evaluation and Examiners", eval_doc_name, "course_name"
            ) or ""

        # Check current user's examiner roles for this eval doc
        roles = is_examiner_for_eval(instructor_name, eval_doc_name)
        if not roles:
            continue

        is_first    = any(r in FIRST_EXAMINER_ROLES  for r in roles)
        is_second   = any(r in SECOND_EXAMINER_ROLES for r in roles)
        is_moderator = is_second   # "Moderator / Second Examiner" covers both

        first_submitted  = int(rec.get("first_submitted")  or 0)
        second_submitted = int(rec.get("second_submitted") or 0)

        if second_submitted:
            badge_class, badge_text = "status-final",  "Submitted to Board"
        elif first_submitted:
            badge_class, badge_text = "status-second", "Awaiting 2nd Examiner"
        else:
            badge_class, badge_text = "status-none",   "Not Started"

        courses_out.append({
            "course":        course_code,
            "course_name":   course_name,
            "academic_term": rec.get("academic_term") or "",
            "eval_doc":      eval_doc_name,
            "is_first":      is_first,
            "is_second":     is_second,
            "is_moderator":  is_moderator,
            "roles":         roles,
            "badge_class":   badge_class,
            "badge_text":    badge_text,
            "first_submitted":  first_submitted,
            "second_submitted": second_submitted
        })

    return {"courses": courses_out}


# ── Result sheet ──────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_exam_result_sheet(course, academic_year, program, academic_term):
    """
    Return eval doc header + all student rows for the result sheet.
    Permission: current user must be an examiner in the eval doc.
    """
    user = frappe.session.user
    instructor = get_current_instructor(user)
    if not instructor:
        frappe.throw(_("No instructor linked to your account."), frappe.PermissionError)

    instructor_name = instructor["name"]

    # Find the eval doc
    eval_docs = frappe.get_all(
        "UG Course Evaluation and Examiners",
        filters={
            "active":        1,
            "course":        course,
            "academic_year": academic_year,
            "program":       program,
            "academic_term": academic_term
        },
        fields=[
            "name", "course", "course_name", "program",
            "academic_year", "academic_term",
            "continues_assessment", "final_paper",
            "examination_year", "examination_date",
            "rubric_description"
        ],
        limit=1
    )

    if not eval_docs:
        frappe.throw(
            _("No active course evaluation found for the given filters."),
            frappe.PermissionError
        )

    eval_doc      = eval_docs[0]
    eval_doc_name = eval_doc["name"]

    # Verify permission
    my_roles = is_examiner_for_eval(instructor_name, eval_doc_name)
    if not my_roles:
        frappe.throw(
            _("You are not assigned as an examiner for this course."),
            frappe.PermissionError
        )

    is_first    = any(r in FIRST_EXAMINER_ROLES  for r in my_roles)
    is_second   = any(r in SECOND_EXAMINER_ROLES for r in my_roles)
    is_moderator = is_second

    # All examiners for header display — include salutation from child table
    all_examiner_rows = frappe.get_all(
        "Appointment of Examiners",
        filters={"parent": eval_doc_name},
        fields=["instructor", "examiner_role", "salutation"],
        order_by="idx asc"
    )

    examiners_display = []
    for row in all_examiner_rows:
        inst_name  = frappe.db.get_value("Instructor", row["instructor"], "instructor_name")
        salutation = (row.get("salutation") or "").strip()
        display_name = ((salutation + " ") if salutation else "") + (inst_name or row["instructor"])
        examiners_display.append({
            "instructor":      row["instructor"],
            "instructor_name": inst_name or row["instructor"],
            "salutation":      salutation,
            "display_name":    display_name,
            "examiner_role":   row["examiner_role"]
        })

    # Student exam results — only fields that exist in UG Student Exam Results
    results = frappe.get_all(
        "UG Student Exam Results",
        filters=[
            ["course",        "=", course],
            ["academic_year", "=", academic_year],
            ["program",       "=", program],
            ["academic_term", "=", academic_term]
        ],
        fields=[
            "name", "index_number", "exam_day_attend",
            "previous_assignment_marks", "assignment_marks", "paper_marks",
            "total_marks", "second_assignment_marks", "second_paper_marks",
            "second_total_marks",
            "final_marks", "final_grade", "grade_point_value_gpa",
            "auto_status",
            "first_examiner_comment", "second_examiner_comment",
            "first_submitted", "second_submitted",
            "academic_year", "academic_term", "program", "course"
        ],
        order_by="index_number asc",
        limit_page_length=500
    )

    return {
        "eval_doc":    eval_doc,
        "examiners":   examiners_display,
        "my_roles":    my_roles,
        "is_first":    is_first,
        "is_second":   is_second,
        "is_moderator": is_moderator,
        "results":     results
    }


# ── Save / Submit / Unlock ────────────────────────────────────────────────────

@frappe.whitelist()
def bulk_save_results(rows_json):
    """Save multiple UG Student Exam Results rows at once."""
    import json
    if isinstance(rows_json, str):
        rows_json = json.loads(rows_json)

    user = frappe.session.user
    instructor = get_current_instructor(user)
    if not instructor:
        frappe.throw(_("No instructor linked to your account."), frappe.PermissionError)

    allowed_fields = [
        "exam_day_attend", "previous_assignment_marks",
        "assignment_marks", "paper_marks", "total_marks",
        "second_assignment_marks", "second_paper_marks", "second_total_marks",
        "final_marks", "final_grade", "grade_point_value_gpa",
        "auto_status", "first_examiner_comment", "second_examiner_comment"
    ]

    errors = []
    for row in rows_json:
        try:
            name = row["name"]
            data = row["data"]
            update = {k: v for k, v in data.items() if k in allowed_fields}
            if update:
                frappe.db.set_value("UG Student Exam Results", name, update)
        except Exception as e:
            errors.append({"name": row.get("name"), "error": str(e)})

    frappe.db.commit()
    return {"status": "ok", "errors": errors}


@frappe.whitelist()
def submit_first(course, academic_year, program, academic_term):
    """Set first_submitted = 1 for all rows. Requires First Examiner role."""
    instructor = get_current_instructor()
    if not instructor:
        frappe.throw(_("No instructor linked."), frappe.PermissionError)

    eval_doc_name = _get_eval_doc_name(course, academic_year, program, academic_term)
    roles = is_examiner_for_eval(instructor["name"], eval_doc_name)
    if not any(r in FIRST_EXAMINER_ROLES for r in roles):
        frappe.throw(_("Permission denied."), frappe.PermissionError)

    frappe.db.sql("""
        UPDATE `tabUG Student Exam Results`
        SET first_submitted = 1
        WHERE course = %s AND academic_year = %s AND program = %s AND academic_term = %s
          AND COALESCE(first_submitted, 0) = 0
    """, (course, academic_year, program, academic_term))
    frappe.db.commit()
    return {"status": "ok"}


@frappe.whitelist()
def submit_second(course, academic_year, program, academic_term):
    """Set second_submitted = 1 for all rows. Requires Second Examiner role."""
    instructor = get_current_instructor()
    if not instructor:
        frappe.throw(_("No instructor linked."), frappe.PermissionError)

    eval_doc_name = _get_eval_doc_name(course, academic_year, program, academic_term)
    roles = is_examiner_for_eval(instructor["name"], eval_doc_name)
    if not any(r in SECOND_EXAMINER_ROLES for r in roles):
        frappe.throw(_("Permission denied."), frappe.PermissionError)

    frappe.db.sql("""
        UPDATE `tabUG Student Exam Results`
        SET second_submitted = 1
        WHERE course = %s AND academic_year = %s AND program = %s AND academic_term = %s
          AND first_submitted = 1
          AND COALESCE(second_submitted, 0) = 0
    """, (course, academic_year, program, academic_term))
    frappe.db.commit()
    return {"status": "ok"}


@frappe.whitelist()
def unlock_first_examiner(course, academic_year, program, academic_term):
    """Reset first_submitted = 0. Requires 'Unlock User 1' role."""
    if "Unlock User 1" not in frappe.get_roles():
        frappe.throw(_("Permission denied."), frappe.PermissionError)

    frappe.db.sql("""
        UPDATE `tabUG Student Exam Results`
        SET first_submitted = 0
        WHERE course = %s AND academic_year = %s AND program = %s AND academic_term = %s
    """, (course, academic_year, program, academic_term))
    frappe.db.commit()
    return {"status": "ok"}


@frappe.whitelist()
def unlock_second_examiner(course, academic_year, program, academic_term):
    """Reset second_submitted = 0. Requires 'Unlock User 2' role."""
    if "Unlock User 2" not in frappe.get_roles():
        frappe.throw(_("Permission denied."), frappe.PermissionError)

    frappe.db.sql("""
        UPDATE `tabUG Student Exam Results`
        SET second_submitted = 0
        WHERE course = %s AND academic_year = %s AND program = %s AND academic_term = %s
    """, (course, academic_year, program, academic_term))
    frappe.db.commit()
    return {"status": "ok"}


# ── Internal helpers ──────────────────────────────────────────────────────────

def _get_eval_doc_name(course, academic_year, program, academic_term):
    matches = frappe.get_all(
        "UG Course Evaluation and Examiners",
        filters={
            "active":        1,
            "course":        course,
            "academic_year": academic_year,
            "program":       program,
            "academic_term": academic_term
        },
        fields=["name"],
        limit=1
    )
    if not matches:
        frappe.throw(_("Course evaluation not found."), frappe.PermissionError)
    return matches[0]["name"]
