
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { TOKEN } = require('./config');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites
    ]
});

client.afkUsers = new Map();
client.dailyMessages = new Map();
client.userReputation = new Map();
client.repCooldowns = new Map();
client.userActivityCount = new Map();
client.inviteTracker = new Map();
client.leftMembersCache = new Set();
client.snipeCache = new Map();
client.ticketSetups = new Map();
client.ticketDataMap = new Map();
client.systemActive = true;

process.on('unhandledRejection', error => {});
process.on('uncaughtException', error => {});

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

setInterval(() => {
    client.dailyMessages.clear();
}, 24 * 60 * 60 * 1000);

client.login(TOKEN);
