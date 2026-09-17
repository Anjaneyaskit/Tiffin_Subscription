# Project Engineering & Architectural Reasoning Log

## 1. Core Architecture & Technology Stack Decisions
* Modular, scalable architecture supporting user management, dynamic daily menus, and subscription handling.
* Relational constraints enforced to cleanly track user subscriptions, mid-cycle transfers, and delivery notifications.

## 2. Feature-Specific Engineering Log & Trade-offs (Including Special Twists)
### A. Morning Clock Delivery Notifications (Technical Twist)
* **Challenge:** Ensuring real-time, high-concurrency delivery alerts fire precisely during the morning window without choking the database.
* **Resolution:** Optimized connection pooling and indexed delivery status columns to manage high-frequency morning notification traffic smoothly.

### B. Mid-Cycle Subscription Transfers (Technical Twist)
* **Challenge:** Handling mid-cycle plan switches without disrupting active meal schedules, prorating balances, or corrupting historical billing cycles.
* **Resolution:** Implemented strict state transition validation logic checking current plan endpoints before re-assigning meal configurations.

### C. Customer Data Importer (Operational Addon)
* **Challenge:** Efficiently onboarding bulk customer records while handling formatting inconsistencies and duplicate data.
* **Resolution:** Built a robust data parsing utility with built-in schema validation rules and automated duplicate conflict resolution.

### D. Feedback Rating & Real-Time Analytics
* **Challenge:** Aggregating user ratings across daily menus while keeping dashboard analytics responsive.
* **Resolution:** Dedicated feedback schema tied directly to daily menu instances for instant average calculations and live metric rendering.

### E. Authentication & Security (Forgot Password Feature)
* **Challenge:** Securing password reset workflows against token brute-forcing or replay attacks.
* **Resolution:** Integrated time-limited, cryptographically secure reset tokens paired with backend expiration checks.

## 3. Debugging & System Troubleshooting History
* **Database Locks & Concurrency:** Resolved table-locking issues during morning notification windows via connection pooling and indexing.
* **UI State Synchronization:** Aligned frontend component states with backend API responses to eliminate stale data bugs.
