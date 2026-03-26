# Academic Portal

A custom [Frappe](https://frappeframework.com) app for the University of Colombo School of Computing (UCSC) that provides a web-based academic portal for undergraduate examiners, including dashboards and student exam result sheets.

## Features

- UG Examiner Dashboard
- UG Examiner Filter Page
- UG Student Exam Result Sheet

## Requirements

- Frappe Framework v15+
- ERPNext v15+
- Python 3.10+

---

## Installation

### 1. Get the app

```bash
bench get-app https://github.com/NiroshPriyamal/Academic_Portal
```

### 2. Install on your site

```bash
bench --site your-site.local install-app academic_portal
```

Replace `your-site.local` with your actual site name.

### 3. Run migrations (if needed)

```bash
bench --site your-site.local migrate
```

### 4. Build assets

```bash
bench build --app academic_portal
```

### 5. Restart bench

```bash
bench restart
```

---

## Updating

To pull the latest changes from GitHub and update the app:

```bash
cd apps/academic_portal
git pull origin main

bench --site your-site.local migrate
bench build --app academic_portal
bench restart
```

---

## Uninstallation

### 1. Uninstall from the site

```bash
bench --site your-site.local uninstall-app academic_portal
```

### 2. Remove the app from bench

```bash
bench remove-app academic_portal
```

---

## License

MIT — see [license.txt](license.txt)
