module.exports = {
    async cacheGuildInvites(guild) {
        try {
            const firstInvites = await guild.invites.fetch();
            if (!guild.client.inviteTracker) guild.client.inviteTracker = new Map();
            guild.client.inviteTracker.set(guild.id, new Map(firstInvites.map((invite) => [invite.code, invite.uses])));
        } catch (error) {
        }
    }
};
