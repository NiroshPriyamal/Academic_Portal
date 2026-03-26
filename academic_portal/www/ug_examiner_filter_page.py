# ug_examiner_filter_page.py
# Place alongside ug_examiner_filter_page.html in www/
# This controller tells Frappe to serve this as a proper web page
# so the frappe JS object is automatically available.

import frappe

def get_context(context):
    # Require login
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=/ug_examiner_filter_page"
        raise frappe.Redirect

    context.no_cache = 1
    context.title = "UG Examiner Portal – Select Period"
