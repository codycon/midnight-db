# Changelog

All notable changes to the Midnight Discord Bot.

## [1.1.0] - 2026-02-15

### 🎉 Major Features

#### Native Discord Polls
- **BREAKING**: Migrated poll system to Discord's native poll feature
- Removed custom button/reaction voting system
- Polls now use Discord's built-in poll UI
- Automatic vote counting and poll closure
- Better mobile support and user experience

### ✨ Improvements

#### Poll Command
- Added validation for Discord poll limits (55 chars per option, 300 chars for question)
- Improved error messages with helpful examples
- Better user confirmation with detailed embeds
- Added emojis to error and success messages
- Extended maximum duration to 336 hours (2 weeks, Discord's limit)

#### Code Quality
- **Removed 348 lines of code** across 3 files (-33% reduction)
- Eliminated complex vote tracking logic
- Removed button interaction handlers for polls
- Removed poll timer management
- Simplified scheduled task system

#### Error Handling
- Added unhandled promise rejection handler in index.js
- Added graceful shutdown handlers (SIGINT, SIGTERM)
- Added Discord client warning handler
- Better error messages throughout all commands
- Improved interaction error handling

#### Developer Experience
- Added comprehensive README.md
- Created IMPROVEMENTS.md documentation
- Added .env.example for better configuration management
- Added helpful npm scripts (start, dev, deploy, deploy-commands)
- Improved console logging with emojis and better formatting
- Better startup information (server count, user count, etc.)

### 🐛 Bug Fixes
- Fixed potential memory leaks from orphaned setTimeout timers
- Improved file I/O error handling
- Better handling of replied/deferred interactions

### 📚 Documentation
- Created comprehensive README with setup instructions
- Added detailed IMPROVEMENTS.md with migration guide
- Added inline code comments for clarity
- Created .env.example for environment variable setup

### 🗑️ Removed
- Custom poll voting button handlers (134 lines)
- Poll closing scheduled tasks (102 lines)
- Manual vote tracking and storage (112 lines)
- Reaction-based voting system
- Custom poll embeds with vote counts

### 🔧 Technical Changes
- Simplified `commands/utility/poll.js` (286 → 174 lines)
- Simplified `events/interactionCreate.js` (457 → 319 lines)
- Simplified `utils/scheduledTasks.js` (316 → 214 lines)
- No changes required to data storage format (backward compatible)

### 📦 Dependencies
- Maintained discord.js ^14.25.1 (supports native polls)
- No new dependencies required

### 🔒 Security
- Better environment variable handling with .env.example
- Improved error logging without exposing sensitive data
- Added graceful shutdown to prevent data corruption

---

## [1.0.0] - Previous Release

### Features
- AutoMod system with word filtering
- Warning system with monthly reset
- Ticket system for support
- Suggestion system with voting
- Logging system for server events
- Verification system
- Auto-role on join
- Timeout/untimeout commands
- Purge command
- Slowmode management
- Custom poll system (reactions/buttons)
- Welcome/leave messages

---

## Migration Guide from 1.0.0 to 1.1.0

### For Server Owners
1. **No action required** - All existing features continue to work
2. New `/poll` command creates native Discord polls
3. Old poll data in `polls.json` remains intact

### For Developers
1. **Update Files**:
   - `commands/utility/poll.js`
   - `events/interactionCreate.js`
   - `utils/scheduledTasks.js`
   - `index.js`
   - `package.json`

2. **Deploy Commands**:
   ```bash
   node deploy-commands.js
   ```

3. **Restart Bot**:
   ```bash
   npm start
   ```

4. **Test Polls**:
   ```
   /poll question:"Test?" options:"Yes, No"
   ```

### Breaking Changes
- Poll type option (reactions/buttons) removed - all polls are now native
- Polls.json no longer stores vote data (only metadata)
- Old polls won't automatically convert to native format

---

## Future Roadmap

### Planned Features
- [ ] Poll analytics and statistics
- [ ] Poll templates for common questions
- [ ] Scheduled polls
- [ ] Poll notifications for roles
- [ ] Database migration (MongoDB/PostgreSQL)
- [ ] Redis caching for better performance
- [ ] More automod features (link whitelist, emoji spam)
- [ ] Economy system
- [ ] Level/XP system
- [ ] Custom commands

### Under Consideration
- [ ] Music commands
- [ ] Mini-games
- [ ] Giveaway system
- [ ] Reaction roles
- [ ] Birthday announcements
- [ ] Server statistics dashboard

---

## Version History

- **v1.1.0** (2026-02-15) - Native Discord Polls & Code Improvements
- **v1.0.0** (Previous) - Initial Release

---

**Note**: This bot follows [Semantic Versioning](https://semver.org/).
- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes
