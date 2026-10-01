const { Events } = require('discord.js');
const { cacheGuildInvites } = require('../handlers/tickets');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Logged in as ${client.user.tag}!`);
        for (const guild of client.guilds.cache.values()) {
            await cacheGuildInvites(guild);
        }
    },
};
