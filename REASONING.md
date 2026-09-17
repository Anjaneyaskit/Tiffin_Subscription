# Project Engineering & Architectural Reasoning Log

## 1. Core Architecture & Technology Stack Decisions
* **Unified Server Setup:** Configured Node.js and Express to serve frontend static assets (`index.html`) directly, minimizing port mismatches and simplifying deployment architecture.
* **Modular Schema Design:** Relational and in-memory data structures enhanced to cleanly track user preferences, subscriptions, mid-cycle transfers, and delivery notifications.

## 2. Feature-Specific Engineering Log & Trade-offs (Including Special Twists)
### A. Dietary Preferences & Signup Dropdown (New Feature Add-on)
* **Challenge:** Capturing detailed user dietary restrictions (Veg vs. Non-Veg selection and specific medical/dietary prescriptions) at the initial registration stage without cluttering the UI.
* **Resolution:** Implemented a structured dropdown and optional text area in the signup form schema, saving state directly to the user profile table to customize downstream meal fulfillment logic.

### B. Dynamic Non-Veg Photo Rendering (UI/UX Twist)
* **Challenge:** Conditionally showing specific food item imagery based on user preferences without bloating initial load times.
* **Resolution:** Added conditional frontend state listeners tied to the user's Veg/Non-Veg profile flag, dynamically fetching and displaying corresponding meal preview galleries only when non-veg options are enabled.

### C. Morning Clock Delivery Notifications (Technical Twist)
* **Challenge:** Ensuring real-time, high-concurrency delivery alerts fire precisely during the morning window without choking the database.
* **Resolution:** Optimized connection pooling and indexed delivery status columns to manage high-frequency morning notification traffic smoothly.

### D. Mid-Cycle Subscription Transfers (Technical Twist)
* **Challenge:** Handling mid-cycle plan switches without disrupting active meal schedules, prorating balances, or corrupting historical billing cycles.
* **Resolution:** Implemented strict state transition validation logic checking current plan endpoints before re-assigning meal configurations.

### E. Customer Data Importer (Operational Addon)
* **Challenge:** Efficiently onboarding bulk customer records while handling formatting inconsistencies and duplicate data.
* **Resolution:** Built a robust data parsing utility with built-in schema validation rules and automated duplicate conflict resolution.

### F. Feedback Rating & Real-Time Analytics
* **Challenge:** Aggregating user ratings across daily menus while keeping dashboard analytics responsive.
* **Resolution:** Dedicated feedback schema tied directly to daily menu instances for instant average calculations and live metric rendering.

## 3. Debugging & System Troubleshooting History
* **Port Synchronization & Static Routing:** Resolved frontend-backend communication disconnects by configuring Express static middleware to host the React UI on port 5000.
* **Database Locks & Concurrency:** Resolved table-locking issues during morning notification windows via connection pooling and indexing.
* **UI State Synchronization:** Aligned frontend component states with backend API responses to eliminate stale data bugs and preference mismatch states.
