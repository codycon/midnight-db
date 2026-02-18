// Placeholder for future scheduled tasks
// This file is imported by ready.js which passes both the client and the automod database.
// The cleanup tasks (violations + tracking) are handled in ready.js via setInterval.

class ScheduledTasks {
  constructor(client, db) {
    this.client = client;
    this.db = db;
    console.log("[TASKS] Scheduled tasks module loaded");

    // Future scheduled tasks can be added here
    // Example: periodic backups, statistics, announcements, etc.
  }
}

module.exports = ScheduledTasks;
