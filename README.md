# 🌙 Midnight Discord Bot

A feature-rich Discord bot for server moderation, utilities, and community management.

## ✨ Features

### 🛡️ Moderation
- **AutoMod**: Automatic content filtering with customizable word lists
- **Warnings**: Track and manage user warnings with monthly auto-reset
- **Timeouts**: Temporary mute users with duration control
- **Purge**: Bulk delete messages with filters
- **Slowmode**: Configure channel slowmode settings

### 🎫 Community Management
- **Ticket System**: Support ticket creation and management
- **Verification**: Role-based verification system
- **Auto-roles**: Assign roles automatically on join
- **Suggestions**: Community suggestion system with voting
- **Welcome/Leave**: Customizable welcome and goodbye messages

### 🔧 Utilities
- **Native Polls**: Create polls using Discord's native poll feature
- **Logging**: Comprehensive event logging system
- **Ping**: Check bot latency

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) v16.9.0 or higher
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- A Discord Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))

## 🚀 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/midnight-institute/midnight-discord-bot.git
cd midnight-discord-bot
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure the Bot

#### Option A: Using config.json (Current Method)
Create `config.json` in the root directory:
```json
{
    "token": "YOUR_BOT_TOKEN_HERE",
    "clientId": "YOUR_CLIENT_ID_HERE",
    "guildId": "YOUR_TEST_SERVER_ID_HERE"
}
```

#### Option B: Using Environment Variables (Recommended for Production)
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

Edit `.env`:
```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_test_server_id_here
```

### 4. Deploy Slash Commands
```bash
node deploy-commands.js
```

### 5. Start the Bot
```bash
node index.js
```

## 📝 Configuration

### Bot Permissions

The bot requires the following permissions:
- `Manage Roles` - For autoroles and verification
- `Manage Channels` - For ticket system and slowmode
- `Kick Members` - For moderation
- `Ban Members` - For moderation
- `Manage Messages` - For purge and automod
- `Send Messages` - Basic functionality
- `Embed Links` - For rich embeds
- `Add Reactions` - For suggestion voting
- `Manage Guild` - For server-wide configurations

### Intents

Required Gateway Intents:
- `Guilds`
- `GuildMembers`
- `GuildMessages`
- `MessageContent`
- `GuildMessageReactions`

Make sure these are enabled in the [Discord Developer Portal](https://discord.com/developers/applications).

## 📚 Commands

### Moderation Commands
| Command | Description | Permissions Required |
|---------|-------------|---------------------|
| `/automod setup` | Enable automod with default settings | Manage Guild |
| `/automod disable` | Disable automod | Manage Guild |
| `/automod config` | Configure automod filters | Manage Guild |
| `/automod words` | Manage filtered words | Manage Guild |
| `/automod status` | View automod configuration | Manage Guild |
| `/warn <user> <reason>` | Warn a user | Moderate Members |
| `/timeout <user> <duration> <reason>` | Timeout a user | Moderate Members |
| `/untimeout <user>` | Remove a user's timeout | Moderate Members |
| `/purge <amount>` | Delete messages | Manage Messages |
| `/slowmode <duration>` | Set channel slowmode | Manage Channels |

### Utility Commands
| Command | Description |
|---------|-------------|
| `/poll` | Create a native Discord poll |
| `/suggest <suggestion>` | Submit a suggestion |
| `/ping` | Check bot latency |

### Setup Commands
| Command | Description | Permissions Required |
|---------|-------------|---------------------|
| `/logging setup` | Configure logging channels | Manage Guild |
| `/suggestions setup` | Configure suggestions | Manage Guild |
| `/tickets setup` | Configure ticket system | Manage Guild |
| `/verify setup` | Configure verification | Manage Guild |
| `/autorole set` | Set autorole | Manage Guild |

## 🎮 Usage Examples

### Creating a Poll
```
/poll 
  question: "What should we play this weekend?"
  options: "Valorant, League of Legends, Minecraft, Among Us"
  duration: 48
  multiple: true
```

### Setting Up AutoMod
```
/automod setup
/automod config setting:badwords enabled:true
/automod words action:add word:spam
```

### Warning a User
```
/warn user:@BadUser reason:Spamming in chat
```

### Creating a Ticket System
```
/tickets setup 
  channel: #support-tickets
  category: Tickets
  support_role: @Support Team
```

## 🗂️ Project Structure

```
midnightDB/
├── commands/
│   ├── admin/          # Admin/moderation commands
│   │   ├── automod.js
│   │   ├── logging.js
│   │   ├── tickets.js
│   │   ├── warn.js
│   │   └── ...
│   └── utility/        # Utility commands
│       ├── poll.js
│       ├── suggest.js
│       └── ping.js
├── events/             # Discord event handlers
│   ├── interactionCreate.js
│   ├── messageCreate.js
│   ├── ready.js
│   └── ...
├── utils/              # Utility modules
│   ├── scheduledTasks.js
│   └── logging.js
├── data/               # JSON data storage
│   ├── polls.json
│   ├── warnings.json
│   ├── suggestions.json
│   └── ...
├── index.js            # Main bot file
├── deploy-commands.js  # Command deployment script
├── config.json         # Bot configuration
└── package.json        # Dependencies

```

## 📊 Data Storage

The bot uses JSON files for data storage:
- `polls.json` - Poll metadata
- `warnings.json` - User warnings
- `suggestions.json` - Community suggestions
- `tickets.json` - Ticket system data
- `automod.json` - Automod configuration
- `logging.json` - Logging channel configuration

**Note**: For production use with multiple servers, consider migrating to a database (MongoDB, PostgreSQL, etc.).

## 🔄 Recent Updates

### Native Discord Polls (Latest)
- ✅ Migrated to Discord's native poll system
- ✅ Removed custom vote tracking (348 lines removed)
- ✅ Improved user experience with familiar Discord UI
- ✅ Better performance and reliability

See [IMPROVEMENTS.md](IMPROVEMENTS.md) for detailed changelog.

## 🛠️ Development

### Running in Development Mode
```bash
# Install nodemon for auto-restart
npm install --save-dev nodemon

# Add to package.json scripts:
"scripts": {
  "start": "node index.js",
  "dev": "nodemon index.js"
}

# Run in dev mode
npm run dev
```

### Testing Commands Locally
Use the `GUILD_ID` in config.json to register commands only in your test server for instant updates.

### Code Style
- Use 4 spaces for indentation
- Use semicolons
- Use descriptive variable names
- Add comments for complex logic
- Follow ESLint recommendations

## 🐛 Troubleshooting

### Bot doesn't respond to commands
1. Check if commands are deployed: `node deploy-commands.js`
2. Verify bot has proper permissions
3. Check `GuildMessageContent` intent is enabled
4. Review console logs for errors

### AutoMod not working
1. Ensure automod is enabled: `/automod setup`
2. Check bot has `Manage Messages` permission
3. Verify bot role is above user roles
4. Check automod filters are enabled

### Polls not creating
1. Ensure you're using discord.js v14.14.0+
2. Check bot has `Send Messages` permission
3. Verify options are under 55 characters each
4. Check question is under 300 characters

## 📄 License

ISC License - See repository for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📞 Support

For support, questions, or bug reports:
- Open an issue on GitHub
- Join our Discord server
- Check the documentation

## 🙏 Acknowledgments

- Built with [Discord.js](https://discord.js.org/)

---

**Made with ❤️ by the Midnight Institute**
