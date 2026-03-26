# ug_examiner_dashboard.py
# Place alongside ug_examiner_dashboard.html in www/

import frappe

def get_context(context):
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=/ug_examiner_dashboard"
        raise frappe.Redirect

    context.no_cache = 1
    context.title = "UG Examiner Dashboard"
