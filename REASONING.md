# Engineering Reasoning & Problem-Solving Process

## Thought Process
- **Architecture:** Chose Node.js, Express, and SQLite for a lightweight, self-contained full-stack application suitable for local deployment without external cloud DB dependencies.
- **Security:** Implemented JWT-based authentication and bcrypt password hashing to secure administrative endpoints and user data.
- **Pro-rated Billing:** Designed a logic layer calculating active versus paused days against a standard 22-working-day monthly cycle to automate accurate customer billing.

## Testing & Issue Resolution
- **Issue 1:** SQLite concurrent write locks during rapid status toggling.
  - *Fix:* Ensured proper serialization and error handling in database transaction callbacks.
- **Issue 2:** Frontend state synchronization after submitting reviews or toggling subscriptions.
  - *Fix:* Linked asynchronous fetch refreshes directly to UI event handlers (`loadCustomers`, `loadAnalytics`, `loadFeedbacks`).
