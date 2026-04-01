# Nexora Support System Discord Bot

A full-featured Discord support/ticket system built with Discord.js v14. Designed for communities and servers to handle support requests, staff applications, partnership requests, and general concerns efficiently.

# Features

Slash Commands

/checkstaff [user] – View the number of tickets a staff member has handled.

/serverinfo – Show server info: members, channels, roles, owner, and creation date.

/ticketpanel – Send a dropdown ticket panel to a designated channel.


# Ticket System

Create private tickets via dropdown menu:

Staff Application

Booster Perks

Partnership Requests

General Concerns


Automatic ticket channel creation with proper permissions.

Tickets include buttons to Claim/Unclaim, Close, or Close with Reason.


# Staff Tracking

Tracks tickets handled by each staff member.

View stats with /checkstaff.


Logging & Persistence

Closed tickets are logged via a Discord webhook.

Ticket data and staff stats are saved in JSON files.


# Utilities

Philippine Time timestamps for accurate logs.

Custom embeds for clean, readable messages.

Global error handling to prevent crashes.



# Installation

1. Clone the repository:

git clone https://github.com/yourusername/nexora-support-bot.git


2. Install dependencies:

npm install


3. Configure your config.json with your bot token, roles, channels, and webhook:

{
  "token": "YOUR_BOT_TOKEN",
  "clientId": "YOUR_CLIENT_ID",
  "supportRoleId": "ROLE_ID",
  "adminRoleId": "ROLE_ID",
  "panelChannelId": "CHANNEL_ID",
  "ticketCategoryId": "CATEGORY_ID",
  "logWebhookUrl": "WEBHOOK_URL"
}


4. Run the bot:

node index.js




---

Nexora Support System is perfect for Discord servers that want automated ticket management, staff tracking, and detailed logging in one bot.
