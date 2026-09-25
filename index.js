const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ]
});

const PREFIX = '+';
const OWNER_ID = '1387037379046674543'; // أيدي صاحب البوت الأساسي
let systemActive = true;

const afkUsers = new Map();
const dailyMessages = new Map();
const userReputation = new Map(); // لتخزين السمعة +rep
const repCooldowns = new Map();   // لتتبع وقت الـ 24 ساعة لأمر +rep
const userActivityCount = new Map(); // لتتتبع نشاط الأعضاء

// أسعار الصرف المحدثة
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

setInterval(() => {
    dailyMessages.clear();
    console.log('[System] Daily messages leaderboard has been reset.');
}, 24 * 60 * 60 * 1000);

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('guildMemberAdd', async member => {
    try {
        const welcomeChannel = member.guild.systemChannel;
        if (!welcomeChannel) return;
        const msg = await welcomeChannel.send(`> أهلاً بك يا ${member} في سيرفر **${member.guild.name}**! نورتنا 🎉`);
        setTimeout(() => msg.delete().catch(() => {}), 7000);
    } catch (err) {
        console.error('Error in guildMemberAdd:', err);
    }
});

client.on('messageCreate', async message => {
    try {
        if (!message.guild || message.author.bot) return;

        // دالة التحقق هل المستخدم هو صاحب البوت أو صاحب السيرفر
        const isOwnerOrServerOwner = (user) => {
            return user.id === OWNER_ID || user.id === message.guild.ownerId;
        };

        // ==========================================
        // أوامر التحكم في تفعيل أو تعطيل السستم (صاحب البوت أو صاحب السيرفر)
        // ==========================================
        if (message.content.startsWith(PREFIX + 'system')) {
            if (!isOwnerOrServerOwner(message.author)) {
                return message.reply({ content: '❌ هذا الأمر مخصص لصاحب البوت أو صاحب السيرفر فقط!', ephemeral: true });
            }
            const argsSys = message.content.slice(PREFIX.length).trim().split(/ +/);
            argsSys.shift();
            const action = argsSys[0]?.toLowerCase();

            if (action === 'off') {
                systemActive = false;
                return message.reply('🔒 **تم تعطيل السستم بنجاح.**');
            } else if (action === 'on') {
                systemActive = true;
                return message.reply('🔓 **تم تفعيل السستم بنجاح.**');
            } else {
                return message.reply('⚠️ الاستخدام الصحيح: `+system on` أو `+system off`');
            }
        }

        if (message.content === PREFIX + 'ايقاف-السستم' || message.content === PREFIX + 'تشغيل-السستم') {
            if (!isOwnerOrServerOwner(message.author)) return message.reply('❌ هذا الأمر مخصص لصاحب البوت أو صاحب السيرفر فقط.');
            if (message.content.includes('ايقاف')) {
                systemActive = false;
                return message.reply('🔴 تم إيقاف نظام البوت بشكل كامل.');
            } else {
                systemActive = true;
                return message.reply('🟢 تم تفعيل نظام البوت وعمله بنجاح.');
            }
        }

        if (!systemActive) return;

        // تتبع النشاط والرسائل
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

        if (!message.content.startsWith(PREFIX)) return;

        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // أمر +استدعاء الجديد
        if (command === 'استدعاء') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                return message.reply('❌ ليس لديك صلاحية لاستخدام أمر الاستدعاء.');
            }

            const targetUser = message.mentions.users.first();
            const reason = args.slice(1).join(' ');

            if (!targetUser || !reason) {
                return message.reply('⚠️ يرجى استخدام الأمر بالشكل الصحيح: \n`+استدعاء @User [السبب]`');
            }

            try {
                const embedDM = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🚨 تنبيه استدعاء إداري')
                    .addFields(
                        { name: '🌐 السيرفر', value: message.guild.name, inline: true },
                        { name: '👤 بواسطة', value: `<@${message.author.id}>`, inline: true },
                        { name: '📌 السبب', value: reason }
                    )
                    .setTimestamp();

                await targetUser.send({ embeds: [embedDM] });
                return message.reply({ embeds: [new EmbedBuilder().setColor('#00FF00').setDescription(`✅ تم إرسال استدعاء إلى ${targetUser} بنجاح في الخاص.`)] });
            } catch (error) {
                return message.reply('❌ فشل إرسال الاستدعاء، قد يكون العضو مقفل الخاص (DM).');
            }
        }

        // الأوامر العامة والألعاب والإشراف السابقة...
        if (command === 'status') {
            const ping = client.ws.ping;
            const statusEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('📊 إحصائيات وحالة البوت')
                .addFields(
                    { name: '🏓 البينغ (Ping)', value: `\`${ping}ms\``, inline: true },
                    { name: '👥 السيرفرات', value: `\`${client.guilds.cache.size}\``, inline: true }
                );
            return message.reply({ embeds: [statusEmbed] });
        }

        if (command === 'warn') {
            if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply('❌ لا تمتلك صلاحية التحذير.');
            const target = message.mentions.members.first();
            const reason = args.slice(1).join(' ') || 'بدون سبب';
            if (!target) return message.reply('⚠️ `+warn @العضو [السبب]`');
            try {
                await target.send(`⚠️ **تم تحذيرك في سيرفر ${message.guild.name}**\nالسبب: **${reason}**`);
                return message.reply(`✅ تم تحذير العضو **${target.user.tag}** بنجاح.`);
            } catch (e) {
                return message.reply(`⚠️ تم التحذير ولكن تعذر إرسال رسالة خاصة للعضو.`);
            }
        }

        if (command === 'slowmode') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ لا تمتلك صلاحية.');
            const time = parseInt(args[0]);
            if (isNaN(time) || time < 0) return message.reply('⚠️ حدد عدد الثواني (مثال: `+slowmode 5`)');
            await message.channel.setRateLimitPerUser(time);
            return message.reply(`⏱️ تم ضبط الوضع البطيء على **${time}** ثانية.`);
        }

        if (command === 'luck') {
            const target = message.mentions.users.first() || message.author;
            const luckPercentage = Math.floor(Math.random() * 101);
            return message.reply({ embeds: [new EmbedBuilder().setColor('#FFD700').setTitle('🎲 الحظ اليومي').setDescription(`حظ **${target.username}** اليوم: **${luckPercentage}%**`)] });
        }

        if (command === 'fortune') {
            const fortunes = ['ستحقق إنجازاً عظيماً قريباً! 🌟', 'ستحصل على مفاجأة سارة قريباً 🎁.', 'فرصة ذهبية ستطرق بابك قريباً 🚪✨.'];
            return message.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6').setTitle('🔮 التوقعات').setDescription(`> "${fortunes[Math.floor(Math.random() * fortunes.length)]}"`)] });
        }

        if (command === 'rep') {
            const target = message.mentions.users.first();
            if (!target || target.id === message.author.id) return message.reply('⚠️ `+rep @العضو`');
            const currentRep = userReputation.get(target.id) || 0;
            userReputation.set(target.id, currentRep + 1);
            return message.reply(`⭐ أصبحت نقاط سمعة ${target} هي **${currentRep + 1}**`);
        }

        if (command === 'repboard') {
            const sortedRep = [...userReputation.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
            let desc = sortedRep.length === 0 ? 'لا توجد نقاط مسجلة بعد.' : '';
            sortedRep.forEach((item, index) => { desc += `**${index + 1}.** <@${item[0]}> - **${item[1]}** ⭐\n`; });
            return message.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F').setTitle('🏆 لوحة شرف السمعة').setDescription(desc)] });
        }

        if (command === 'activity') {
            const target = message.mentions.users.first() || message.author;
            return message.reply(`📊 نشاطك/نشاط العضو: **${userActivityCount.get(target.id) || 0}** تفاعل.`);
        }

        if (command === 'topactive') {
            const sortedAct = [...userActivityCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
            let desc = sortedAct.length === 0 ? 'لا بيانات.' : '';
            sortedAct.forEach((item, index) => { desc += `**${index + 1}.** <@${item[0]}> - **${item[1]}** تفاعل\n`; });
            return message.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('🔥 الأكثر نشاطاً').setDescription(desc)] });
        }

        if (command === 'afk') {
            const reason = args.join(' ') || 'بدون سبب';
            afkUsers.set(message.author.id, reason);
            return message.reply(`💤 تم ضبط حالتك AFK: **${reason}**`);
        }

        if (command === 'صرف' || command === 'تحويل') {
            const amount = parseFloat(args[0]);
            const currency = args[1]?.toLowerCase();
            if (isNaN(amount) || !currency || !exchangeRates[currency]) return message.reply('⚠️ طريقة الاستخدام: `+صرف [المبلغ] [العملة]`');
            const rate = exchangeRates[currency];
            const converted = currency === 'يورو' || currency === 'eur' ? amount * rate : amount / rate;
            return message.reply(`💱 **$${converted.toFixed(2)} USD**`);
        }

        if (command === 'رتب') {
            const roles = message.guild.roles.cache.filter(r => r.id !== message.guild.id).map(r => `${r}`).join(' | ');
            return message.reply({ embeds: [new EmbedBuilder().setTitle('📜 رتب السيرفر').setDescription(roles || 'لا رتب')] });
        }

        if (command === 'توب') {
            const sorted = [...dailyMessages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
            let desc = sorted.length === 0 ? 'لا توجد رسائل.' : '';
            sorted.forEach((item, index) => { desc += `**${index + 1}.** <@${item[0]}> - **${item[1]}** رسالة\n`; });
            return message.reply({ embeds: [new EmbedBuilder().setTitle('🏆 توب الرسائل اليومي').setDescription(desc)] });
        }

        if (command === 'سيرفر') {
            const owner = await message.guild.fetchOwner();
            return message.reply({ embeds: [new EmbedBuilder().setTitle(`📊 معلومات ${message.guild.name}`).addFields({ name: '👑 الأونر', value: owner.user.tag, inline: true })] });
        }

        if (command === 'بروفايل' || command === 'اي_دي') {
            const target = message.mentions.users.first() || message.author;
            return message.reply({ embeds: [new EmbedBuilder().setTitle(`👤 ${target.username}`).addFields({ name: '🆔 الآي دي', value: `\`${target.id}\`` })] });
        }

        if (command === 'صورة') {
            const target = message.mentions.users.first() || message.author;
            return message.reply({ embeds: [new EmbedBuilder().setImage(target.displayAvatarURL({ size: 1024 })))] });
        }

        if (command === 'قفل') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ لا تمتلك صلاحية.');
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
            return message.reply('🔒 قُفل الروم.');
        }
        if (command === 'فتح') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ لا تمتلك صلاحية.');
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
            return message.reply('🔓 فُتح الروم.');
        }

        if (command === 'مسح') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply('❌ لا تمتلك صلاحية.');
            const amount = parseInt(args[0]);
            if (isNaN(amount) || amount <= 0 || amount > 100) return message.reply('⚠️ حدد بين 1 و 100.');
            await message.channel.bulkDelete(amount, true);
            const m = await message.channel.send(`🧹 تم مسح **${amount}** رسالة.`);
            setTimeout(() => m.delete().catch(() => {}), 3000);
        }

        // ==========================================
        // أمر +help المتطور مع حماية قسم الأونر (متاح لصاحب البوت وصاحب السيرفر)
        // ==========================================
        if (command === 'help') {
            const getEmbed = (page) => {
                if (page === '1') {
                    return new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle('📌 الأوامر العامة والمعلوماتية')
                        .addFields(
                            { name: '**`+status`**', value: 'إحصائيات وحالة البوت.', inline: false },
                            { name: '**`+afk [السبب]`**', value: 'تحديد حالتك كغائب.', inline: false },
                            { name: '**`+سيرفر`**', value: 'معلومات السيرفر.', inline: false },
                            { name: '**`+بروفايل [@العضو]`**', value: 'معلومات العضو.', inline: false }
                        );
                } else if (page === '2') {
                    return new EmbedBuilder()
                        .setColor('#E67E22')
                        .setTitle('🎮 الألعاب، الحظ، والتحديات')
                        .addFields(
                            { name: '**`+luck [@العضو]`**', value: 'اختبار الحظ اليومي.', inline: false },
                            { name: '**`+fortune`**', value: 'توقعات المستقبل.', inline: false },
                            { name: '**`+rep [@العضو]`**', value: 'إعطاء نقطة سمعة.', inline: false }
                        );
                } else if (page === '3') {
                    return new EmbedBuilder()
                        .setColor('#2ECC71')
                        .setTitle('🛡️ الإشراف والاستدعاء')
                        .addFields(
                            { name: '**`+استدعاء [@العضو] [السبب]`**', value: 'إرسال استدعاء خاص للعضو.', inline: false },
                            { name: '**`+warn [@العضو] [السبب]`**', value: 'تحذير شخص بالخاص.', inline: false },
                            { name: '**`+slowmode [الثواني]`**', value: 'ضبط الوضع البطيء.', inline: false },
                            { name: '**`+مسح [العدد]`**', value: 'مسح الرسائل.', inline: false }
                        );
                } else if (page === '4') {
                    return new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('👑 قائمة المالكين (صاحب البوت أو صاحب السيرفر)')
                        .setDescription('الأوامر المتاحة هنا:\n- `+system on` أو `+system off` لتشغيل أو إيقاف السستم.')
                        .addFields(
                            { name: '**`+system on` / `+system off`**', value: 'التحكم بنظام البوت بشكل كامل.', inline: false }
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
                            { label: 'الأوامر العامة', value: '1', emoji: '📌' },
                            { label: 'الألعاب والحظ', value: '2', emoji: '🎲' },
                            { label: 'الإشراف والاستدعاء', value: '3', emoji: '🛡️' },
                            { label: 'قائمة المالكين (Owner)', value: '4', emoji: '👑' }
                        ])
                );
            };

            const initialMsg = await message.reply({ embeds: [getEmbed('1')], components: [getMenu()] });
            const collector = initialMsg.createMessageComponentCollector({ time: 180000 });

            collector.on('collect', async i => {
                try {
                    const selectedValue = i.values[0];

                    // التحقق من صلاحية فتح قسم الأونر (يجب أن يكون صاحب البوت أو صاحب السيرفر)
                    if (selectedValue === '4' && !isOwnerOrServerOwner(i.user)) {
                        return i.reply({ content: '❌ **عذراً!** هذه القائمة مخصصة لصاحب البوت وصاحب السيرفر فقط.', ephemeral: true });
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
        console.error(err);
    }
});

client.login(process.env.DISCORD_TOKEN);
