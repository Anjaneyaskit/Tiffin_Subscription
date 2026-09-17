# Full-Stack Tiffin Service Project

## Overview
A comprehensive full-stack application designed to manage daily tiffin subscriptions, dynamic menus, user dietary configurations, real-time analytics, and customer feedback.

## Key Features & Special Technical Twists
* **Morning Clock Delivery Notifications:** Automated trigger system handling time-sensitive delivery alerts at the start of the cycle.
* **Mid-Cycle Subscription Transfers:** Advanced logic allowing users to switch plans mid-way through a billing or meal cycle without breaking constraints.
* **Customer Data Importer:** Bulk ingestion utility for parsing structured files, validating fields, and resolving duplicate entries.
* **Dietary Preferences & Signup Customization:** Signup dropdown supporting Veg/Non-Veg selection and custom medical/dietary prescription notes.
* **Dynamic Non-Veg Photo Gallery:** Conditional media rendering that dynamically loads exclusive non-veg meal previews and tags when non-veg preference is enabled.
* **Unified Full-Stack Architecture:** Express backend configured to serve static frontend files on a single port for seamless deployment.
* **Daily Menu Gallery & Feedback Subsystem:** Interactive catalog paired with user rating tools feeding real-time metric dashboards.
* **Secure Authentication:** Complete user lifecycle management featuring secure password recovery protocols.

## Setup & Installation
1. Clone the repository.
2. Navigate to `backend` and run `npm install`.
3. Start the server using `node server.js`.
4. Open `http://localhost:5000` in your browser.
