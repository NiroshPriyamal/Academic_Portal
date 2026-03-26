# ug_student_exam_result_sheet.py
# Place alongside ug_student_exam_result_sheet.html in www/

import frappe

def get_context(context):
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=/ug_student_exam_result_sheet"
        raise frappe.Redirect

    context.no_cache = 1
    context.title = "UG Student Exam Result Sheet"
