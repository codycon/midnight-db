# Midnight DB

> A development build of the real Midnight Bot — a powerful Discord bot with automoderation and ticket management.

## Features

- **Automoderation** — Filter bad words, links, spam, and more
- **Ticket System** — Create, manage, and track support tickets
- **Admin Panel** — Comprehensive moderation tools
- **Thread Management** — Organize conversations with threads

## Prerequisites

- **Node.js** v16.9.0 or higher
- **npm** or **yarn**
- A Discord bot token and client ID

## Installation

1. Clone the repository:

   ```bash
   git clone <repo-url>
   cd midnight-db
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables:

   ```bash
   cp .env.example .env
   ```

   Fill in `.env` with your bot credentials:

   ```
   DISCORD_TOKEN=your_bot_token_here
   DISCORD_CLIENT_ID=your_client_id_here
   GUILD_ID=optional_guild_id_for_testing
   ```

4. Verify installation:
   ```bash
   npm run test-install
   ```

## Deployment

Deploy slash commands:

```bash
npm run deploy-commands
```

## Usage

Start the bot:

```bash
npm start
```

## Project Structure

```
commands/
  ├── admin/       (moderation & configuration commands)
  └── utility/     (help & info commands)
events/            (Discord event handlers)
utils/             (database, automod, tickets)
```

## Configuration

Midnight DB uses environment variables for secure configuration. Reference `.env.example` for all available options including database connection strings, API keys, and logging levels.

## Commands

### Admin Commands

- `/ban` — Ban users with optional duration
- `/kick` — Remove users from the server
- `/mute` — Silence users temporarily
- `/warn` — Issue warnings to users
- `/automod` — Configure automoderation rules

### Utility Commands

- `/help` — Display available commands
- `/info` — Server and bot information
- `/ticket` — Create and manage support tickets

## Database

Midnight DB supports multiple database backends. Configure your preferred database in `.env`:

- SQLite (default, development)
- PostgreSQL (recommended for production)
- MongoDB (alternative option)

## Troubleshooting

**Bot not responding?**

- Verify DISCORD_TOKEN is correct
- Ensure bot has required permissions in your server
- Check logs with `npm run logs`

**Commands not showing?**

- Run `npm run deploy-commands` to sync commands
- Wait 1-5 minutes for Discord to update
- Verify bot has application.commands scope

**Database errors?**

- Confirm database connection string in `.env`
- Check database service is running
- Review error logs for details

## Contributing

Pull requests welcome. Follow the existing code style and include tests for new features.

## Support

For issues and questions, create a GitHub issue or join our Discord server.

## License

Development build — see LICENSE file for details.
