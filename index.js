const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites
    ]
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});
process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

const PREFIX = '#';
let systemActive = true;

const afkUsers = new Map();
const dailyMessages = new Map();
const userReputation = new Map();
const repCooldowns = new Map();
const userActivityCount = new Map();
const inviteTracker = new Map();
const leftMembersCache = new Set();
const snipeCache = new Map();

const exchangeRates = {
    'ريال': 3.75,
    'sar': 3.75,
    'درهم': 3.67,
    'aed': 3.67,
    'يورو': 1.1398,
    'eur': 1.1398,
    'ليرة': 89500,
    'lbp': 89500,
    'جنيه': 42,
    'egp': 42,
    'دولار': 1.0,
    'usd': 1.0,
    'usdt': 1.0
};

function parseDuration(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const match = timeStr.match(/^(\d+)([mhd])$/);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2];
    if (unit === 'm') return value * 60 * 1000;
    if (unit === 'h') return value * 60 * 60 * 1000;
    if (unit === 'd') return value * 24 * 60 * 60 * 1000;
    return null;
}

const guildInvitesCache = new Map();

async function cacheGuildInvites(guild) {
    try {
        const invites = await guild.invites.fetch();
        const codeUses = new Map();
        invites.forEach(inv => codeUses.set(inv.code, inv.uses));
        guildInvitesCache.set(guild.id, codeUses);
    } catch (err) {
        console.error('Error caching invites:', err);
    }
}

setInterval(() => {
    dailyMessages.clear();
    console.log('[System] Daily messages leaderboard has been reset.');
}, 24 * 60 * 60 * 1000);

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    for (const guild of client.guilds.cache.values()) {
        await cacheGuildInvites(guild);
    }
});

client.on('inviteCreate', async invite => {
    cacheGuildInvites(invite.guild);
});

client.on('inviteDelete', async invite => {
    cacheGuildInvites(invite.guild);
});

client.on('messageDelete', message => {
    if (!message.guild || message.author?.bot) return;
    
    if (!snipeCache.has(message.channelId)) {
        snipeCache.set(message.channelId, []);
    }
    
    const channelSnipes = snipeCache.get(message.channelId);
    channelSnipes.unshift({
        content: message.content || 'فقط محتوى ميديا أو فارغ',
        author: message.author,
        time: Date.now()
    });

    if (channelSnipes.length > 20) {
        channelSnipes.pop();
    }
});

client.on('guildMemberAdd', async member => {
    try {
        const cachedInvites = guildInvitesCache.get(member.guild.id);
        const newInvites = await member.guild.invites.fetch();
        let usedInvite = null;

        if (cachedInvites) {
            for (const inv of newInvites.values()) {
                const oldUses = cachedInvites.get(inv.code) || 0;
                if (inv.uses > oldUses) {
                    usedInvite = inv;
                    break;
                }
            }
        }
        cacheGuildInvites(member.guild);

        const inviter = usedInvite ? usedInvite.inviter : null;
        const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
        const isOlderThanMonth = accountAgeDays >= 30;
        const hasLeftBefore = leftMembersCache.has(member.id);

        let valid = true;
        let reason = '';

        if (!inviter) {
            valid = false;
            reason = 'لم يتم تحديد الانفايت بدقة';
        } else if (!isOlderThanMonth) {
            valid = false;
            reason = 'عمر حساب العضو أقل من 30 يوماً';
        } else if (hasLeftBefore) {
            valid = false;
            reason = 'العضو قام بالخروج والعودة مسبقاً';
        }

        inviteTracker.set(member.id, {
            inviter: inviter ? inviter.tag : 'غير معروف',
            inviteCode: usedInvite ? usedInvite.code : 'غير معروف',
            valid: valid,
            reason: reason,
            accountAgeDays: Math.floor(accountAgeDays)
        });

        const welcomeChannel = member.guild.systemChannel;
        if (welcomeChannel) {
            const msg = await welcomeChannel.send(`> أهلاً بك يا ${member} في سيرفر **${member.guild.name}**! نورتنا 🎉`);
            setTimeout(() => msg.delete().catch(() => {}), 7000);
        }
    } catch (err) {
        console.error('Error in guildMemberAdd:', err);
    }
});

client.on('guildMemberRemove', member => {
    leftMembersCache.add(member.id);
});

client.on('messageCreate', async message => {
    try {
        if (!message.guild || message.author.bot) return;

        const currentCount = dailyMessages.get(message.author.id) || 0;
        dailyMessages.set(message.author.id, currentCount + 1);

        const totalAct = userActivityCount.get(message.author.id) || 0;
        userActivityCount.set(message.author.id, totalAct + 1);

        if (afkUsers.has(message.author.id)) {
            afkUsers.delete(message.author.id);
            message.reply('أهلاً بك مجدداً! تم إزالة حالة الـ AFK عنك.').then(msg => setTimeout(() => msg.delete().catch(() => {}), 4000)).catch(() => {});
        }
        
        if (message.mentions.users.size > 0) {
            message.mentions.users.forEach(user => {
                if (afkUsers.has(user.id)) {
                    message.reply(`⚠️ **${user.username}** غائب حالياً (AFK): **${afkUsers.get(user.id)}**`).catch(() => {});
                }
            });
        }

        if (message.content === PREFIX + 'ايقاف-السستم') {
            if (message.author.id !== message.guild.ownerId) return message.reply('❌ هذا الأمر مخصص لأونر السيرفر فقط.');
            systemActive = false;
            return message.reply('🔴 تم إيقاف نظام البوت بشكل كامل.');
        }

        if (message.content === PREFIX + 'تشغيل-السستم') {
            if (message.author.id !== message.guild.ownerId) return message.reply('❌ هذا الأمر مخصص لأونر السيرفر فقط.');
            systemActive = true;
            return message.reply('🟢 تم تفعيل نظام البوت وعمله بنجاح.');
        }

        if (!systemActive) return;
        if (!message.content.startsWith(PREFIX)) return;

        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === 'snipe') {
            const channelSnipes = snipeCache.get(message.channel.id);
            if (!channelSnipes || channelSnipes.length === 0) {
                return message.reply('❌ لا توجد رسائل محذوفه مسجلة في هذا الروم حالياً.');
            }

            const latest = channelSnipes[0];
            const snipeEmbed = new EmbedBuilder()
                .setColor('#FF5733')
                .setAuthor({ name: latest.author.tag, iconURL: latest.author.displayAvatarURL({ dynamic: true }) })
                .setTitle('🎯 آخر رسالة تم حذفها')
                .setDescription(`> ${latest.content}`)
                .addFields(
                    { name: '👤 صاحب الرسالة', value: `<@${latest.author.id}>`, inline: true },
                    { name: '⏱️ وقت الحذف', value: `<t:${Math.floor(latest.time / 1000)}:R>`, inline: true }
                )
                .setTimestamp();

            return message.reply({ embeds: [snipeEmbed] });
        }

        if (command === 'snipeall') {
            const channelSnipes = snipeCache.get(message.channel.id);
            if (!channelSnipes || channelSnipes.length === 0) {
                return message.reply('❌ لا توجد رسائل محذوفه مسجلة في هذا الروم حالياً.');
            }

            let desc = '';
            channelSnipes.slice(0, 10).forEach((item, index) => {
                desc += `**${index + 1}.** <@${item.author.id}>: \`${item.content}\` (<t:${Math.floor(item.time / 1000)}:R>)\n`;
            });

            const snipeAllEmbed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle('🗑️ سجل آخر الرسائل المحذوفة في هذا الروم')
                .setDescription(desc)
                .setFooter({ text: `إجمالي المحفوظات: ${channelSnipes.length} رسالة` })
                .setTimestamp();

            return message.reply({ embeds: [snipeAllEmbed] });
        }

        if (command === 'status') {
            const ping = client.ws.ping;
            const uptimeSeconds = Math.floor(client.uptime / 1000);
            const hours = Math.floor(uptimeSeconds / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);

            const statusEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('📊 إحصائيات وحالة البوت')
                .addFields(
                    { name: 'البينغ (سرعة الاستجابة)', value: `\`${ping}ms\``, inline: true },
                    { name: 'وقت التشغيل', value: `\`${hours} ساعة و ${minutes} دقيقة\``, inline: true },
                    { name: 'السيرفرات', value: `\`${client.guilds.cache.size} سيرفر\``, inline: true }
                )
                .setTimestamp();
            return message.reply({ embeds: [statusEmbed] });
        }

        if (command === 'i') {
            const target = message.mentions.users.first() || message.author;
            const inviteData = inviteTracker.get(target.id);

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`🔍 تفاصيل الانفايت للعضو: ${target.username}`)
                .setThumbnail(target.displayAvatarURL({ dynamic: true }));

            if (!inviteData) {
                embed.setDescription('⚠️ لا توجد بيانات مسجلة لهذا العضو أو أنه انضم قبل تشغيل البوت.');
            } else {
                embed.addFields(
                    { name: 'تمت دعوته بواسطة', value: `\`${inviteData.inviter}\` (كود: \`${inviteData.inviteCode}\`)`, inline: false },
                    { name: 'هل يُحسب الانفايت؟', value: inviteData.valid ? '✅ نعم' : '❌ لا', inline: false }
                );
                if (!inviteData.valid) {
                    embed.addFields({ name: 'سبب عدم الاحتساب', value: `> ${inviteData.reason}`, inline: false });
                }
            }
            return message.reply({ embeds: [embed] });
        }

        if (command === 'استدعاء' || command === 'c') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return message.reply('❌ ليس لديك صلاحية لاستخدام أمر الاستدعاء.');
            }

            const targetUser = message.mentions.users.first();
            const reason = args.slice(1).join(' ') || 'بدون سبب محدد';

            if (!targetUser) {
                return message.reply('⚠️ طريقة الاستخدام: `#استدعاء @العضو [السبب]`');
            }

            try {
                const embedDM = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🚨 تنبيه استدعاء إداري')
                    .addFields(
                        { name: 'السيرفر', value: message.guild.name, inline: true },
                        { name: 'بواسطة الإداري', value: `<@${message.author.id}>`, inline: true },
                        { name: 'السبب', value: reason }
                    )
                    .setTimestamp();

                await targetUser.send({ embeds: [embedDM] });
                return message.reply({ embeds: [new EmbedBuilder().setColor('#00FF00').setDescription(`✅ تم إرسال الاستدعاء إلى ${targetUser} بالخاص بنجاح.`)] });
            } catch (e) {
                return message.reply(`⚠️ تعذر إرسال رسالة خاصة إلى ${targetUser} (الخاص مغلق).`);
            }
        }

        if (command === 'warn') {
            if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply('❌ لا تمتلك صلاحية التحذير.');
            const target = message.mentions.members.first();
            const reason = args.slice(1).join(' ') || 'بدون سبب';
            if (!target) return message.reply('⚠️ طريقة الاستخدام: `#warn @العضو [السبب]`');

            try {
                await target.send(`⚠️ **تم تحذيرك في سيرفر ${message.guild.name}**\nالسبب: **${reason}**`);
                return message.reply(`✅ تم إرسال التحذير إلى العضو **${target.user.tag}** بالخاص.`);
            } catch (e) {
                return message.reply(`⚠️ تم تحذير العضو، ولكن تعذر إرسال رسالة خاصة له.`);
            }
        }

        if (command === 'slowmode') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ لا تمتلك صلاحية إدارة الرومات.');
            const time = parseInt(args[0]);
            if (isNaN(time) || time < 0) return message.reply('⚠️ حدد عدد الثواني (مثال: `#slowmode 5`)');
            await message.channel.setRateLimitPerUser(time);
            return message.reply(time === 0 ? '⏱️ تم إلغاء الوضع البطيء.' : `⏱️ تم ضبط الوضع البطيء على **${time}** ثانية.`);
        }

        if (command === 'firstmsg') {
            const target = message.mentions.users.first() || message.author;
            await message.channel.sendTyping();
            try {
                let fetchedMessages = await message.channel.messages.fetch({ limit: 100 });
                let userMessages = fetchedMessages.filter(m => m.author.id === target.id);
                
                if (userMessages.size === 0) {
                    return message.reply(`❌ لم يتم العثور على رسائل حديثة لـ ${target} في هذا الروم.`);
                }
                let first = userMessages.last();
                return message.reply(`💬 **أول رسالة عُثر عليها:**\n> "${first.content}"\n[رابط الرسالة](${first.url})`);
            } catch (e) {
                return message.reply('❌ حدث خطأ أثناء البحث.');
            }
        }

        if (command === 'nick') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageNicknames)) return message.reply('❌ لا تمتلك صلاحية تعديل النك نيم.');
            const target = message.mentions.members.first();
            const newNick = args.slice(1).join(' ');
            if (!target) return message.reply('⚠️ طريقة الاستخدام: `#nick @العضو [الاسم الجديد]`');

            try {
                if (!newNick) {
                    await target.setNickname(null);
                    return message.reply(`✅ تم إزالة وتصفير النك نيم لـ **${target.user.tag}**.`);
                } else {
                    await target.setNickname(newNick);
                    return message.reply(`✅ تم تغيير نك نيم **${target.user.tag}** إلى: **${newNick}**`);
                }
            } catch (e) {
                return message.reply('❌ فشل تغيير النك نيم، تأكد من رتبة البوت.');
            }
        }

        if (command === 'servericon') {
            const iconUrl = message.guild.iconURL({ dynamic: true, size: 1024 });
            if (!iconUrl) return message.reply('❌ هذا السيرفر لا يملك صورة.');
            const iconEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle(`🖼️ صورة سيرفر: ${message.guild.name}`)
                .setImage(iconUrl);
            return message.reply({ embeds: [iconEmbed] });
        }

        if (command === 'serverbanner') {
            const bannerUrl = message.guild.bannerURL({ size: 1024 });
            if (!bannerUrl) return message.reply('❌ هذا السيرفر لا يملك بانر.');
            const bannerEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle(`🎨 بانر سيرفر: ${message.guild.name}`)
                .setImage(bannerUrl);
            return message.reply({ embeds: [bannerEmbed] });
        }

        if (command === 'luck') {
            const target = message.mentions.users.first() || message.author;
            const luckPercentage = Math.floor(Math.random() * 101);
            let luckMsg = 'حظ عادي جداً اليوم 😐';
            if (luckPercentage > 80) luckMsg = 'حسدونا حظك اليوم خارق وفوق الخيال! 🔥🍀';
            else if (luckPercentage > 50) luckMsg = 'حظك اليوم ممتاز وموفق! ✨';
            else if (luckPercentage < 20) luckMsg = 'انتبه لنفسك اليوم، الحظ سيء قليلاً 😅';

            const luckEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🎲 اختبار الحظ اليومي')
                .setDescription(`حظ **${target.username}** اليوم هو: **${luckPercentage}%**\n💬 ${luckMsg}`);
            return message.reply({ embeds: [luckEmbed] });
        }

        if (command === 'fortune') {
            const fortunes = [
                'ستحقق إنجازاً عظيماً قريباً وتفاجئ الجميع! 🌟',
                'ستحصل على هدية غير متوقعة في الأيام القادمة 🎁.',
                'فرصة ذهبية ستطرق بابك قريبًا، كن مستعداً لها 🚪✨.',
                'ستقابل شخصاً جديداً سيغير مجرى بعض الأمور في حياتك 🤝.',
                'اليوم مناسب جداً للبدء بمشروع جديد أو هواية جديدة 💡.',
                'ستواجه تحدياً بسيطاً لكنك ستتجاوزه بذكائك المعتاد 💪.',
                'الكثير من الضحك والأوقات الجميلة بانتظارك هذا الأسبوع 😂❤️.'
            ];
            const randomFortune = fortunes[Math.floor(Math.random() * fortunes.length)];
            const fortuneEmbed = new EmbedBuilder()
                .setColor('#9B59B6')
                .setTitle('🔮 كرة التوقعات المستقبلية')
                .setDescription(`> "${randomFortune}"`);
            return message.reply({ embeds: [fortuneEmbed] });
        }

        if (command === 'challenge') {
            const target = message.mentions.users.first();
            if (!target || target.id === message.author.id) return message.reply('⚠️ يرجى منشن شخص لتحديه: `#challenge @العضو`');
            
            const challengesList = [
                'تحدي صراع الأقوياء: من يكتب كلمة "سيرفر" أسرع وبدون غلط!',
                'تحدي لعبة الصراحة: أجب عن سؤال محرج يطلبه منك الطرف الآخر.',
                'تحدي من يجمع رسائل أكثر خلال 5 دقائق القادمة في الشات!',
                'تحدي من يملك حظاً أفضل في رمي النرد.'
            ];
            const chosenChallenge = challengesList[Math.floor(Math.random() * challengesList.length)];

            const chalEmbed = new EmbedBuilder()
                .setColor('#E67E22')
                .setTitle('⚔️ تحدي جديد أُطلق!')
                .setDescription(`**${message.author}** قام بتحدي ${target}!\n\n🎯 **نوع التحدي:**\n> ${chosenChallenge}`);
            return message.reply({ embeds: [chalEmbed] });
        }

        if (command === 'rep') {
            const target = message.mentions.users.first();
            if (!target || target.id === message.author.id) return message.reply('⚠️ يرجى منشن عضو لإعطائه سمعة: `#rep @العضو`');

            const cooldownTime = 24 * 60 * 60 * 1000;
            const lastRepTime = repCooldowns.get(message.author.id);

            if (lastRepTime && (Date.now() - lastRepTime < cooldownTime)) {
                const remainingTime = cooldownTime - (Date.now() - lastRepTime);
                const hoursLeft = Math.floor(remainingTime / (1000 * 60 * 60));
                const minutesLeft = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
                return message.reply(`⏳ عذراً، يمكنك استخدام الأمر مرة أخرى بعد **${hoursLeft} ساعة و ${minutesLeft} دقيقة**.`);
            }

            repCooldowns.set(message.author.id, Date.now());

            const currentRep = userReputation.get(target.id) || 0;
            userReputation.set(target.id, currentRep + 1);

            const repEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('⭐ نظام السمعة')
                .setDescription(`لقد قمت بإعطاء نقطة سمعة لـ ${target} بنجاح!\nإجمالي نقاط سمعته الآن: **${currentRep + 1} ⭐**`);
            return message.reply({ embeds: [repEmbed] });
        }

        if (command === 'repboard') {
            const sortedRep = [...userReputation.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
            let desc = sortedRep.length === 0 ? 'لا توجد نقاط سمعة مسجلة بعد.' : '';
            
            sortedRep.forEach((item, index) => {
                desc += `**${index + 1}.** <@${item[0]}> - **${item[1]}** ⭐\n`;
            });

            const repBoardEmbed = new EmbedBuilder()
                .setColor('#F1C40F')
                .setTitle('🏆 لوحة شرف السمعة')
                .setDescription(desc);
            return message.reply({ embeds: [repBoardEmbed] });
        }

        if (command === 'activity') {
            const target = message.mentions.users.first() || message.author;
            const actCount = userActivityCount.get(target.id) || 0;
            const actEmbed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle(`📊 نشاط العضو: ${target.username}`)
                .setDescription(`عدد التفاعلات المسجلة لك في هذا السيرفر: **${actCount} تفاعل** 🚀`);
            return message.reply({ embeds: [actEmbed] });
        }

        if (command === 'topactive') {
            const sortedAct = [...userActivityCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
            let desc = sortedAct.length === 0 ? 'لا توجد بيانات نشاط بعد.' : '';

            sortedAct.forEach((item, index) => {
                desc += `**${index + 1}.** <@${item[0]}> - **${item[1]}** تفاعل\n`;
            });

            const topActEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('🔥 أكثر الأعضاء نشاطاً')
                .setDescription(desc);
            return message.reply({ embeds: [topActEmbed] });
        }

        if (command === 'afk') {
            const reason = args.join(' ') || 'بدون سبب';
            afkUsers.set(message.author.id, reason);
            return message.reply(`💤 تم ضبط حالتك إلى **غائب (AFK)**. السبب: **${reason}**`);
        }

        if (command === 'greet') {
            const target = message.mentions.members.first() || message.member;
            await message.delete().catch(() => {});
            const greetMsg = await message.channel.send(`> مرحباً بك يا ${target} في سيرفرنا! نورت الروم ✨`);
            setTimeout(() => greetMsg.delete().catch(() => {}), 5000);
            return;
        }

        if (command === 'صرف' || command === 'تحويل') {
            const amount = parseFloat(args[0]);
            const currency = args[1] ? args[1].toLowerCase() : '';

            if (isNaN(amount) || !currency) {
                return message.reply('⚠️ **طريقة الاستخدام الصحيحة:**\n`#صرف [المبلغ] [العملة]`');
            }

            const baseRate = exchangeRates[currency];
            if (!baseRate) {
                return message.reply(`❌ عذراً، العملة **"${currency}"** غير متوفرة حالياً.`);
            }

            let convertedUSD = (amount / baseRate).toFixed(2);

            const convertEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('💱 تحويل العملات')
                .addFields(
                    { name: 'العضو', value: `${message.author}`, inline: true },
                    { name: 'المبلغ', value: `\`${amount} ${currency}\``, inline: true },
                    { name: 'السعر بالدولار', value: `**$${convertedUSD} USD**`, inline: false }
                );

            return message.reply({ embeds: [convertEmbed] });
        }

        if (command === 'رتب') {
            const rolesList = message.guild.roles.cache
                .filter(r => r.id !== message.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => `${r}`)
                .join(' | ');

            const rEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('📜 رتب السيرفر')
                .setDescription(rolesList || 'لا توجد رتب.');
            return message.reply({ embeds: [rEmbed] });
        }

        if (command === 'توب') {
            const sorted = [...dailyMessages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
            let description = sorted.length === 0 ? 'لم يتم تسجيل رسائل اليوم بعد.' : '';
            
            sorted.forEach((item, index) => {
                description += `**${index + 1}.** <@${item[0]}> - **${item[1]}** رسالة\n`;
            });

            const topEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🏆 أكثر 10 أعضاء نشاطاً بالرسائل اليوم')
                .setDescription(description);
            return message.reply({ embeds: [topEmbed] });
        }

        if (command === 'سيرفر') {
            const owner = await message.guild.fetchOwner();
            const sEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle(`📊 معلومات السيرفر: ${message.guild.name}`)
                .setThumbnail(message.guild.iconURL({ dynamic: true }))
                .addFields(
                    { name: 'الأونر', value: `${owner.user.tag}`, inline: true },
                    { name: 'عدد الأعضاء', value: `${message.guild.memberCount}`, inline: true },
                    { name: 'مستوى البوستات', value: `Level ${message.guild.premiumTier}`, inline: true }
                );
            return message.reply({ embeds: [sEmbed] });
        }

        if (command === 'بروفايل' || command === 'اي_دي') {
            const target = message.mentions.users.first() || message.author;
            const member = message.guild.members.cache.get(target.id);
            if (!member) return message.reply('❌ العضو غير موجود.');
            
            const embed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle(`👤 معلومات العضو: ${target.username}`)
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: 'الآي دي', value: `\`${target.id}\``, inline: true },
                    { name: 'تاريخ الانضمام', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true }
                );
            return message.reply({ embeds: [embed] });
        }

        if (command === 'صورة') {
            const target = message.mentions.users.first() || message.author;
            const embed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle(`🖼️ صورة بروفايل ${target.username}`)
                .setImage(target.displayAvatarURL({ dynamic: true, size: 1024 }));
            return message.reply({ embeds: [embed] });
        }

        if (command === 'قفل') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ لا تمتلك صلاحية.');
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
            return message.reply('🔒 تم قفل الروم بنجاح.');
        }
        if (command === 'فتح') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ لا تمتلك صلاحية.');
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
            return message.reply('🔓 تم فتح الروم.');
        }

        if (command === 'اخفاء') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ لا تمتلك صلاحيات كافية.');
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: false });
            return message.reply('🙈 تم إخفاء الروم.');
        }
        if (command === 'اظهار') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ لا تمتلك صلاحيات كافية.');
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: null });
            return message.reply('👁️ الروم مرئي الآن للجميع.');
        }

        if (command === 'تايم') {
            if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply('❌ لا تمتلك صلاحية الميوت.');
            const target = message.mentions.members.first();
            const duration = parseInt(args[1]);
            if (!target || isNaN(duration)) return message.reply('⚠️ طريقة الاستخدام: `#تايم @العضو [الدقائق]`');
            try {
                await target.timeout(duration * 60 * 1000);
                return message.reply(`🔇 تم إعطاء ميوت لـ ${target.user.tag} لمدة **${duration}** دقيقة.`);
            } catch (e) {
                return message.reply('❌ خطأ: تحقق من رتبة العضو.');
            }
        }
        if (command === 'انتايم') {
            if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply('❌ لا تمتلك صلاحية إزالة الميوت.');
            const target = message.mentions.members.first();
            if (!target) return message.reply('⚠️ يرجى منشن العضو.');
            try {
                await target.timeout(null);
                return message.reply(`🔊 تم إزالة الميوت عن ${target.user.tag}.`);
            } catch (e) {
                return message.reply('❌ فشل في إزالة الميوت.');
            }
        }

        if (command === 'فكبان') {
            if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return message.reply('❌ لا تمتلك صلاحية فك البان.');
            const userId = args[0]?.replace(/[<@!>]/g, '');
            if (!userId) return message.reply('⚠️ يرجى كتابة آي دي صحيح.');
            try {
                await message.guild.members.unban(userId);
                return message.reply('✅ تم فك البان عن العضو بنجاح.');
            } catch (e) {
                return message.reply('❌ العضو غير موجود في قائمة المحظورين.');
            }
        }

        // أمر #gstart الجديد للمسابقات
        if (command === 'gstart') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply('❌ لا تمتلك صلاحية إدارة السيرفر.');
            const durationArg = args[0];
            const prize = args.slice(1).join(' ');
            if (!durationArg || !prize) return message.reply('⚠️ مثال للاستخدام: `#gstart 1h رتبة مميزة`');

            const millis = parseDuration(durationArg);
            if (!millis) return message.reply('⚠️ صيغة الوقت غير صحيحة. استخدم الحروف m أو h أو d (مثال: 30m أو 1h أو 2d).');

            const participants = new Set();

            const gEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🎉 **مسابقة جديدة (GIVEAWAY)** 🎉')
                .setDescription(`الجائزة: **${prize}**\nتنتهي بعد: **${durationArg}**\n\nاضغط على الزر أدناه للمشاركة! 🎁`);

            const gButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('join_giveaway')
                    .setLabel('مشاركة في المسابقة')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🎉')
            );

            const gMsg = await message.channel.send({ embeds: [gEmbed], components: [gButton] });
            await message.delete().catch(() => {});

            const collector = gMsg.createMessageComponentCollector({ time: millis });

            collector.on('collect', async i => {
                try {
                    if (participants.has(i.user.id)) {
                        return i.reply({ content: '❌ أنت مشارك بالفعل في المسابقة!', ephemeral: true });
                    }
                    participants.add(i.user.id);
                    await i.reply({ content: '✅ تم تسجيل مشاركتك بنجاح!', ephemeral: true });
                } catch (err) {
                    console.error(err);
                }
            });
        }

        if (command === 'كيك') {
            if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) return message.reply('❌ لا تمتلك صلاحية الطرد.');
            const target = message.mentions.members.first();
            if (!target) return message.reply('⚠️ يرجى منشن العضو.');
            await target.kick();
            return message.reply(`👢 تم طرد ${target.user.tag} بنجاح.`);
        }

        if (command === 'بان') {
            if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return message.reply('❌ لا تمتلك صلاحية البان.');
            const target = message.mentions.members.first();
            if (!target) return message.reply('⚠️ يرجى منشن العضو.');
            await target.ban();
            return message.reply(`🔨 تم تبنيد ${target.user.tag} بنجاح.`);
        }

        if (command === 'مسح') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply('❌ لا تمتلك صلاحية مسح الرسائل.');
            const amount = parseInt(args[0]);
            if (isNaN(amount) || amount <= 0 || amount > 100) return message.reply('⚠️ حدد رقماً بين 1 و 100.');
            await message.channel.bulkDelete(amount, true);
            const reply = await message.channel.send(`🧹 تم مسح **${amount}** رسالة.`);
            setTimeout(() => reply.delete().catch(() => {}), 3000);
        }

        if (command === 'رول-جماعي') {
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ يتطلب صلاحية Administrator.');
            const role = message.mentions.roles.first();
            if (!role) return message.reply('⚠️ يرجى منشن الرول.');

            await message.reply('⏳ جاري إعطاء الرول لجميع الأعضاء...');
            try {
                await message.guild.members.fetch();
                let count = 0;
                for (const member of message.guild.members.cache.values()) {
                    if (!member.user.bot && !member.roles.cache.has(role.id)) {
                        await member.roles.add(role).catch(() => {});
                        count++;
                    }
                }
                return message.channel.send(`✅ تم منح رول **${role.name}** لـ **${count}** عضو.`);
            } catch (e) {
                return message.channel.send('❌ حدث خطأ.');
            }
        }

        if (command === 'رول') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) return message.reply('❌ لا تمتلك صلاحية.');
            const target = message.mentions.members.first();
            const role = message.mentions.roles.first();
            if (!target || !role) return message.reply('⚠️ الاستخدام: `#رول @العضو @الرول`');
            if (target.roles.cache.has(role.id)) {
                await target.roles.remove(role);
                return message.reply('❌ تم إزالة الرتبة.');
            } else {
                await target.roles.add(role);
                return message.reply('✅ تم إعطاء الرتبة.');
            }
        }

        if (command === 'بنغ') {
            return message.reply(`🏓 سرعة استجابة البوت: **${client.ws.ping}ms**`);
        }

        if (command === 'قول') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply('❌ لا تمتلك صلاحية.');
            const text = args.join(' ');
            if (!text) return message.reply('⚠️ اكتب النص.');
            await message.delete().catch(() => {});
            return message.channel.send(text);
        }

        if (command === 'طوارئ') {
            if (message.author.id !== message.guild.ownerId) return message.reply('❌ للأونر فقط.');
            message.guild.channels.cache.forEach(channel => {
                if (channel.isTextBased()) {
                    channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false }).catch(() => {});
                }
            });
            return message.reply('🚨 **تم تفعيل الطوارئ!**');
        }

        if (command === 'فك-طوارئ') {
            if (message.author.id !== message.guild.ownerId) return message.reply('❌ للأونر فقط.');
            message.guild.channels.cache.forEach(channel => {
                if (channel.isTextBased()) {
                    channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null }).catch(() => {});
                }
            });
            return message.reply('🟢 **تم إلغاء الطوارئ!**');
        }

        if (command === 'بطيء') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ لا تمتلك صلاحية.');
            const time = parseInt(args[0]);
            if (isNaN(time)) return message.reply('⚠️ حدد عدد الثواني.');
            await message.channel.setRateLimitPerUser(time);
            return message.reply(`⏱️ تم ضبط الشات البطيء على **${time}** ثانية.`);
        }

        // قائمة #help المعدلة (بدون إنجليزي، كل أمر تحته شرحه بشكل منفصل تماماً)
        if (command === 'help') {
            const totalCommandsCount = 45;

            const getEmbed = (page) => {
                if (page === '1') {
                    return new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle('📌 أوامر عامة')
                        .setDescription(`إجمالي الأوامر: **${totalCommandsCount}**\nاختر القسم المناسب من القائمة بالأسفل:`)
                        .addFields(
                            { name: '#status', value: 'إحصائيات البوت وسرعة البينغ ووقت التشغيل.', inline: false },
                            { name: '#afk [السبب]', value: 'لتحديد حالتك كغائب في السيرفر وتنبيه من يمنشنك.', inline: false },
                            { name: '#سيرفر', value: 'لعرض معلومات السيرفر المفصلة وأعداد الأعضاء.', inline: false },
                            { name: '#servericon', value: 'لعرض وصورة شعار السيرفر الحالي.', inline: false },
                            { name: '#serverbanner', value: 'لعرض بانر السيرفر إن وجد.', inline: false },
                            { name: '#بروفايل [@العضو]', value: 'لعرض معلومات العضو وتاريخ انضمامه للسيرفر.', inline: false },
                            { name: '#صورة [@العضو]', value: 'لعرض صورة بروفايل العضو بحجم كبير.', inline: false },
                            { name: '#رتب', value: 'لعرض قائمة جميع رتب السيرفر مرتبة من الأقوى.', inline: false },
                            { name: '#توب', value: 'لعرض أكثر 10 أعضاء نشاطاً بالرسائل اليومية.', inline: false },
                            { name: '#topactive', value: 'لعرض أكثر الأعضاء تفاعلاً ونشاطاً.', inline: false },
                            { name: '#activity [@العضو]', value: 'لمعرفة عدد رسائل وتفاعلات العضو.', inline: false },
                            { name: '#firstmsg [@العضو]', value: 'لجلب أول رسالة أرسلها الشخص في الروم.', inline: false },
                            { name: '#بنغ', value: 'لمعرفة سرعة استجابة البوت الحالية.', inline: false }
                        );
                } else if (page === '2') {
                    return new EmbedBuilder()
                        .setColor('#E67E22')
                        .setTitle('🎲 أوامر ألعاب')
                        .addFields(
                            { name: '#luck [@العضو]', value: 'اختبار نسبة الحظ اليومي.', inline: false },
                            { name: '#fortune', value: 'الحصول على توقع عشوائي وممتع لمستقبلك.', inline: false },
                            { name: '#challenge [@العضو]', value: 'لبدء تحدي عشوائي وممتع مع أحد الأعضاء.', inline: false },
                            { name: '#rep [@العضو]', value: 'لإعطاء نقطة سمعة لعضو متميز.', inline: false },
                            { name: '#repboard', value: 'لعرض لوحة شرف السمعة وأعلى الأعضاء نقاطاً.', inline: false }
                        );
                } else if (page === '3') {
                    return new EmbedBuilder()
                        .setColor('#2ECC71')
                        .setTitle('🛡️ أوامر ادارية')
                        .addFields(
                            { name: '#snipe', value: 'لعرض آخر رسالة تم حذفها في الروم بأمبيد.', inline: false },
                            { name: '#snipeall', value: 'لعرض سجل آخر الرسائل المحذوفة في الروم.', inline: false },
                            { name: '#i [@العضو]', value: 'لفحص تفاصيل الانفايت وحالة احتسابه.', inline: false },
                            { name: '#استدعاء [@العضو] [السبب]', value: 'لاستدعاء عضو إدارياً عبر رسالة خاصة.', inline: false },
                            { name: '#warn [@العضو] [السبب]', value: 'لتحذير عضو وإرسال التفاصيل بالخاص.', inline: false },
                            { name: '#slowmode [الثواني]', value: 'لضبط وضع الشات البطيء للروم.', inline: false },
                            { name: '#nick [@العضو] [الاسم]', value: 'تغيير أو تصفير نك نيم العضو.', inline: false },
                            { name: '#بان [@العضو]', value: 'لتبنيد العضو من السيرفر نهائياً.', inline: false },
                            { name: '#كيك [@العضو]', value: 'لطرد العضو من السيرفر.', inline: false },
                            { name: '#فكبان [آي دي العضو]', value: 'لفك البان عن عضو محظور.', inline: false },
                            { name: '#تايم [@العضو] [الدقائق]', value: 'لإعطاء العضو ميوت مؤقت (تايم آوت).', inline: false },
                            { name: '#انتايم [@العضو]', value: 'لإزالة الميوت المؤقت عن العضو.', inline: false },
                            { name: '#مسح [العدد]', value: 'لمسح رسائل الشات بسرعة (بين 1 و 100).', inline: false },
                            { name: '#قفل', value: 'لقفل الروم الحالي ومنع الأعضاء من الكتابة.', inline: false },
                            { name: '#فتح', value: 'لفتح الروم الحالي والسماح بالكتابة.', inline: false },
                            { name: '#اخفاء', value: 'لإخفاء الروم عن الأعضاء.', inline: false },
                            { name: '#اظهار', value: 'لإظهار الروم وجعله مرئياً.', inline: false },
                            { name: '#رول [@العضو] [@الرول]', value: 'لإعطاء أو إزالة رتبة عن عضو.', inline: false },
                            { name: '#رول-جماعي [@الرول]', value: 'لإعطاء رتبة معينة لجميع أعضاء السيرفر.', inline: false },
                            { name: '#gstart [الوقت] [الجائزة]', value: 'لبدء مسابقة جديدة مع زر تفاعلي.', inline: false },
                            { name: '#صرف [المبلغ] [العملة]', value: 'لتحويل العملات بدقة.', inline: false }
                        );
                } else if (page === '4') {
                    return new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('👑 أوامر الأونر')
                        .addFields(
                            { name: '#طوارئ', value: 'لقفل جميع رومات السيرفر في حالات الطوارئ.', inline: false },
                            { name: '#فك-طوارئ', value: 'لإلغاء الطوارئ وفتح جميع الرومات.', inline: false },
                            { name: '#ايقاف-السستم', value: 'لإيقاف نظام البوت بشكل كامل.', inline: false },
                            { name: '#تشغيل-السستم', value: 'لتشغيل نظام البوت وعمله بنجاح.', inline: false }
                        );
                }
            };

            const getMenu = (disabled = false) => {
                return new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('help_menu')
                        .setPlaceholder('📂 اختر القسم المطلوب من القائمة...')
                        .setDisabled(disabled)
                        .addOptions([
                            { label: 'أوامر عامة', value: '1', emoji: '📌' },
                            { label: 'أوامر ألعاب', value: '2', emoji: '🎲' },
                            { label: 'أوامر ادارية', value: '3', emoji: '🛡️' },
                            { label: 'أوامر الأونر', value: '4', emoji: '👑' }
                        ])
                );
            };

            const initialMsg = await message.reply({ embeds: [getEmbed('1')], components: [getMenu()] });
            const collector = initialMsg.createMessageComponentCollector({ time: 180000 });

            collector.on('collect', async i => {
                try {
                    const selectedValue = i.values[0];

                    if (selectedValue === '4' && i.user.id !== message.guild.ownerId) {
                        return i.reply({ content: '❌ هذه القائمة مخصصة لصاحب السيرفر (الأونر) فقط.', ephemeral: true });
                    }

                    if (i.user.id !== message.author.id) {
                        return i.reply({ content: '❌ لا يمكنك استخدام هذه القائمة.', ephemeral: true });
                    }

                    await i.update({ embeds: [getEmbed(selectedValue)], components: [getMenu()] });
                } catch (err) {
                    console.error(err);
                }
            });

            collector.on('end', () => {
                initialMsg.edit({ components: [getMenu(true)] }).catch(() => {});
            });
        }
    } catch (err) {
        console.error('An unexpected error occurred in messageCreate:', err);
    }
});

client.login(process.env.DISCORD_TOKEN);
