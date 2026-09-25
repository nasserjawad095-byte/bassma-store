const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const PREFIX = '+';
let systemActive = true;

const afkUsers = new Map();
const dailyMessages = new Map();

// دالة تحويل الوقت (بدون الحاجة لمكتبة خارجية لتجنب أي كراش)
function parseDuration(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.match(/^(\d+)([mhd])$/);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2];
    if (unit === 'm') return value * 60 * 1000;       // دقائق
    if (unit === 'h') return value * 60 * 60 * 1000;  // ساعات
    if (unit === 'd') return value * 24 * 60 * 60 * 1000; // أيام
    return null;
}

// تصفير توب الرسائل تلقائياً كل 24 ساعة
setInterval(() => {
    dailyMessages.clear();
    console.log('[System] Daily messages leaderboard has been reset.');
}, 24 * 60 * 60 * 1000);

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // نظام الـ AFK
    if (afkUsers.has(message.author.id)) {
        afkUsers.delete(message.author.id);
        message.reply('أهلاً بك مجدداً! تم إزالة حالة الـ AFK عنك.').then(msg => setTimeout(() => msg.delete().catch(() => {}), 4000));
    }
    
    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            if (afkUsers.has(user.id)) {
                message.reply(`⚠️ **${user.username}** غائب حالياً (AFK): **${afkUsers.get(user.id)}**`);
            }
        });
    }

    // تتبع الرسائل اليومية
    const currentCount = dailyMessages.get(message.author.id) || 0;
    dailyMessages.set(message.author.id, currentCount + 1);

    // أوامر تحكم الأونر بالنظام بالأسماء الجديدة
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

    // +afk (باللغة الإنجليزية كما طلبت)
    if (command === 'afk') {
        const reason = args.join(' ') || 'بدون سبب';
        afkUsers.set(message.author.id, reason);
        return message.reply(`💤 تم ضبط حالتك إلى **غائب (AFK)**. السبب: **${reason}**`);
    }

    // +رتب (عرض رتب السيرفر من الأقوى للأصغر)
    if (command === 'رتب') {
        const rolesList = message.guild.roles.cache
            .filter(r => r.id !== message.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(r => `${r}`)
            .join(' | ');

        const rEmbed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle(`📜 رتب السيرفر (من الأقوى إلى الأصغر)`)
            .setDescription(rolesList || 'لا توجد رتب.');
        return message.reply({ embeds: [rEmbed] });
    }

    // +توب (توب الرسائل اليومي النشط)
    if (command === 'توب') {
        const sorted = [...dailyMessages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
        let description = sorted.length === 0 ? 'لم يتم تسجيل رسائل اليوم بعد.' : '';
        
        sorted.forEach((item, index) => {
            description += `**${index + 1}.** <@${item[0]}> - **${item[1]}** رسالة\n`;
        });

        const topEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🏆 أكثر 10 أعضاء نشاطاً بالرسائل اليوم')
            .setDescription(description)
            .setFooter({ text: 'يتم تصفير القائمة تلقائياً كل 24 ساعة.' });
        return message.reply({ embeds: [topEmbed] });
    }

    // +سيرفر
    if (command === 'سيرفر') {
        const owner = await message.guild.fetchOwner();
        const sEmbed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle(`📊 معلومات السيرفر: ${message.guild.name}`)
            .setThumbnail(message.guild.iconURL({ dynamic: true }))
            .addFields(
                { name: '👑 الأونر', value: `${owner.user.tag}`, inline: true },
                { name: '👥 عدد الأعضاء', value: `${message.guild.memberCount}`, inline: true },
                { name: '🚀 مستوى البوستات', value: `Level ${message.guild.premiumTier} (${message.guild.premiumSubscriptionCount} Boosts)`, inline: true },
                { name: '📅 عمر السيرفر', value: `<t:${Math.floor(message.guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '🆔 آي دي السيرفر', value: `\`${message.guild.id}\``, inline: true },
                { name: '💬 عدد الرومات', value: `${message.guild.channels.cache.size}`, inline: true }
            );
        return message.reply({ embeds: [sEmbed] });
    }

    // +بروفايل / +اي_دي
    if (command === 'بروفايل' || command === 'اي_دي') {
        const target = message.mentions.users.first() || message.author;
        const member = message.guild.members.cache.get(target.id);
        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle(`👤 معلومات العضو: ${target.username}`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🆔 الآي دي', value: `\`${target.id}\``, inline: true },
                { name: '📅 تاريخ الانضمام للسيرفر', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: '🌐 تاريخ إنشاء الحساب', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true }
            );
        return message.reply({ embeds: [embed] });
    }

    // +صورة
    if (command === 'صورة') {
        const target = message.mentions.users.first() || message.author;
        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle(`🖼️ صورة بروفايل ${target.username}`)
            .setImage(target.displayAvatarURL({ dynamic: true, size: 1024 }));
        return message.reply({ embeds: [embed] });
    }

    // +قفل / +فتح
    if (command === 'قفل') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ لا تمتلك صلاحية `ManageChannels`.');
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        return message.reply('🔒 تم قفل الروم بنجاح.');
    }
    if (command === 'فتح') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ لا تمتلك صلاحية `ManageChannels`.');
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
        return message.reply('🔓 تم فتح الروم.');
    }

    // +اخفاء / +اظهار
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

    // +تايم / +انتايم
    if (command === 'تايم') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply('❌ لا تمتلك صلاحية الميوت.');
        const target = message.mentions.members.first();
        const duration = parseInt(args[1]);
        if (!target || isNaN(duration)) return message.reply('⚠️ طريقة الاستخدام: `+تايم @العضو [الدقائق]`');
        try {
            await target.timeout(duration * 60 * 1000, `بواسطة: ${message.author.tag}`);
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

    // +فكبان
    if (command === 'فكبان') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return message.reply('❌ لا تمتلك صلاحية فك البان.');
        const userId = args[0]?.replace(/[<@!>]/g, '');
        if (!userId) return message.reply('⚠️ يرجى كتابة آي دي صحيح.');
        try {
            await message.guild.members.unban(userId);
            return message.reply(`✅ تم فك البان عن العضو بنجاح.`);
        } catch (e) {
            return message.reply('❌ العضو غير موجود في قائمة المحظورين.');
        }
    }

    // +مسابقة (Giveaway مرتبطة بزر تفاعلي وتوقيت مرن مثل 10m أو 1h أو 1d)
    if (command === 'مسابقة') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply('❌ لا تمتلك صلاحية إدارة السيرفر.');
        const durationArg = args[0];
        const prize = args.slice(1).join(' ');
        if (!durationArg || !prize) return message.reply('⚠️ مثال للاستخدام: `+مسابقة 1h رتبة مميزة` أو `+مسابقة 30m نيترو`');

        const millis = parseDuration(durationArg);
        if (!millis) return message.reply('⚠️ صيغة الوقت غير صحيحة. أمثلة: `10m` (دقائق)، `1h` (ساعات)، `1d` (أيام).');

        const endsAt = Date.now() + millis;
        const participants = new Set();

        const gEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎉 **مسابقة جديدة (GIVEAWAY)** 🎉')
            .setDescription(`الجائزة: **${prize}**\nتنتهي المسابقة بعد: **${durationArg}** (<t:${Math.floor(endsAt / 1000)}:R>)\n\nاضغط على الزر أدناه للمشاركة! 🎁\n\nالمشاركون حتى الآن: **0**`)
            .setTimestamp();

        const gButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('join_giveaway')
                .setLabel('مشاركة (Join)')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎉')
        );

        const gMsg = await message.channel.send({ embeds: [gEmbed], components: [gButton] });
        await message.delete().catch(() => {});

        const collector = gMsg.createMessageComponentCollector({ time: millis });

        collector.on('collect', async i => {
            if (participants.has(i.user.id)) {
                return i.reply({ content: '❌ أنت مشارك بالفعل في هذه المسابقة!', ephemeral: true });
            }
            participants.add(i.user.id);
            await i.reply({ content: '✅ تم تسجيل مشاركتك بنجاح في المسابقة!', ephemeral: true });

            const updatedEmbed = EmbedBuilder.from(gEmbed)
                .setDescription(`الجائزة: **${prize}**\nتنتهي المسابقة بعد: **${durationArg}** (<t:${Math.floor(endsAt / 1000)}:R>)\n\nاضغط على الزر أدناه للمشاركة! 🎁\n\nالمشاركون حتى الآن: **${participants.size}**`);
            await gMsg.edit({ embeds: [updatedEmbed] }).catch(() => {});
        });

        collector.on('end', async () => {
            const disabledButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('join_giveaway')
                    .setLabel('انتهت المسابقة')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

            if (participants.size === 0) {
                const endedEmbed = EmbedBuilder.from(gEmbed).setDescription(`الجائزة: **${prize}**\n❌ **انتهت المسابقة ولم يشارك أحد!**`);
                return gMsg.edit({ embeds: [endedEmbed], components: [disabledButton] }).catch(() => {});
            }

            const winnersArr = Array.from(participants);
            const winnerId = winnersArr[Math.floor(Math.random() * winnersArr.length)];

            const winnerEmbed = EmbedBuilder.from(gEmbed)
                .setDescription(`الجائزة: **${prize}**\n🏆 **الفائز بالمسابقة:** <@${winnerId}>\nمبروك! 🎉`);
            
            await gMsg.edit({ embeds: [winnerEmbed], components: [disabledButton] }).catch(() => {});
            gMsg.channel.send(`🎉 مبروك لـ <@${winnerId}> لقد فزت بـ **${prize}**!`);
        });
    }

    // +كيك / +بان / +مسح
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

    // +رول-جماعي (إعطاء رول لجميع أعضاء السيرفر)
    if (command === 'رول-جماعي') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ هذا الأمر يتطلب صلاحية `Administrator`.');
        const role = message.mentions.roles.first();
        if (!role) return message.reply('⚠️ يرجى منشن الرول المطلوبة: `+رول-جماعي @Role`');

        await message.reply('⏳ جاري إعطاء الرول لجميع أعضاء السيرفر، قد يستغرق ذلك بعض الوقت...');
        
        try {
            await message.guild.members.fetch();
            let count = 0;
            for (const member of message.guild.members.cache.values()) {
                if (!member.user.bot && !member.roles.cache.has(role.id)) {
                    await member.roles.add(role).catch(() => {});
                    count++;
                }
            }
            return message.channel.send(`✅ تم بنجاح منح رول **${role.name}** لـ **${count}** عضو.`);
        } catch (e) {
            return message.channel.send('❌ حدث خطأ أثناء توزيع الرول.');
        }
    }

    // إدارة الرتب الفردية
    if (command === 'رول') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) return message.reply('❌ لا تمتلك صلاحية إدارة الرتب.');
        const target = message.mentions.members.first();
        const role = message.mentions.roles.first();
        if (!target || !role) return message.reply('⚠️ الاستخدام: `+رول @العضو @الرول`');
        if (target.roles.cache.has(role.id)) {
            await target.roles.remove(role);
            return message.reply(`❌ تم إزالة رتبة **${role.name}** من **${target.user.tag}**.`);
        } else {
            await target.roles.add(role);
            return message.reply(`✅ تم إعطاء رتبة **${role.name}** لـ **${target.user.tag}**.`);
        }
    }

    if (command === 'بنغ') {
        return message.reply(`🏓 سرعة استجابة البوت: **${client.ws.ping}ms**`);
    }

    // الأوامر الإضافية
    if (command === 'قول') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply('❌ لا تمتلك صلاحية.');
        const text = args.join(' ');
        if (!text) return message.reply('⚠️ اكتب النص الذي تريد أن يكرره البوت.');
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
        return message.reply('🚨 **تم تفعيل الطوارئ!** تم قفل جميع رومات السيرفر.');
    }

    if (command === 'فك-طوارئ') {
        if (message.author.id !== message.guild.ownerId) return message.reply('❌ للأونر فقط.');
        message.guild.channels.cache.forEach(channel => {
            if (channel.isTextBased()) {
                channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null }).catch(() => {});
            }
        });
        return message.reply('🟢 **تم إلغاء الطوارئ!** تم فتح جميع رومات السيرفر.');
    }

    if (command === 'بطيء') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ لا تمتلك صلاحية.');
        const time = parseInt(args[0]);
        if (isNaN(time)) return message.reply('⚠️ حدد عدد الثواني (اكتب 0 للإلغاء).');
        await message.channel.setRateLimitPerUser(time);
        return message.reply(`⏱️ تم ضبط الشات البطيء على **${time}** ثانية.`);
    }

    // ==========================================
    // أمر +help (مع حماية قائمة الأونر وتأمينها تماماً)
    // ==========================================
    if (command === 'help') {
        const totalCommandsCount = 25;

        const getEmbed = (page) => {
            if (page === '1') {
                return new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('📜 قائمة المساعدة - قسم النظام، الإحصائيات والأونر')
                    .setDescription(`إجمالي الأوامر في البوت: **${totalCommandsCount}**\nاختر القسم المناسب من القائمة أدناه:`)
                    .addFields(
                        { name: '**`+afk [السبب]`**', value: '**تحديد حالتك كغائب وتنبيه من يمنشنك.**', inline: false },
                        { name: '**`+رتب`**', value: '**عرض رتب السيرفر من الأقوى للأصغر.**', inline: false },
                        { name: '**`+توب`**', value: '**عرض أكثر 10 أعضاء تفاعلاً اليوم.**', inline: false },
                        { name: '**`+سيرفر`**', value: '**عرض معلومات السيرفر المفصلة.**', inline: false },
                        { name: '**`+بنغ`**', value: '**معرفة سرعة استجابة البوت.**', inline: false }
                    )
                    .setFooter({ text: 'القائمة الأولى | بواسطة ' + message.author.tag });
            } else if (page === '2') {
                return new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('📜 قائمة المساعدة - قسم الإشراف وإدارة الرومات')
                    .setDescription(`إجمالي الأوامر في البوت: **${totalCommandsCount}**\nاختر القسم المناسب من القائمة أدناه:`)
                    .addFields(
                        { name: '**`+بان [@العضو]`**', value: '**حظر عضو من السيرفر.**', inline: false },
                        { name: '**`+كيك [@العضو]`**', value: '**طرد عضو من السيرفر.**', inline: false },
                        { name: '**`+تايم [@العضو] [الدقائق]`**', value: '**إعطاء ميوت مؤقت للعضو.**', inline: false },
                        { name: '**`+انتايم [@العضو]`**', value: '**إزالة الميوت عن العضو.**', inline: false },
                        { name: '**`+فكبان [الايدي]`**', value: '**فك البان عن العضو بالآي دي.**', inline: false },
                        { name: '**`+مسح [العدد]`**', value: '**مسح رسائل الشات (1-100).**', inline: false },
                        { name: '**`+قفل` / `+فتح`**', value: '**قفل أو فتح الشات الحالي.**', inline: false },
                        { name: '**`+اخفاء` / `+اظهار`**', value: '**إخفاء أو إظهار الروم.**', inline: false }
                    )
                    .setFooter({ text: 'القائمة الثانية | بواسطة ' + message.author.tag });
            } else if (page === '3') {
                return new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('📜 قائمة المساعدة - قسم الرتب والأدوات الإضافية')
                    .setDescription(`إجمالي الأوامر في البوت: **${totalCommandsCount}**\nاختر القسم المناسب من القائمة أدناه:`)
                    .addFields(
                        { name: '**`+رول [@العضو] [@الرول]`**', value: '**تبديل الرتبة (إضافة أو إزالة).**', inline: false },
                        { name: '**`+رول-جماعي [@الرول]`**', value: '**إعطاء رول معينة لجميع أعضاء السيرفر دفعة واحدة.**', inline: false },
                        { name: '**`+مسابقة [الوقت] [الجائزة]`**', value: '**بدء مسابقة تفاعلية بزر المشاركة 🎉.**', inline: false },
                        { name: '**`+قول [النص]`**', value: '**تكرار رسالتك عبر البوت.**', inline: false },
                        { name: '**`+طوارئ` / `+فك-طوارئ`**', value: '**قفل أو فتح جميع رومات السيرفر دفعة واحدة.**', inline: false },
                        { name: '**`+بطيء [الثواني]`**', value: '**تحديد سرعة الشات البطيء للروم.**', inline: false },
                        { name: '**`+بروفايل` / `+صورة`**', value: '**عرض معلومات وبروفايل الأعضاء.**', inline: false }
                    )
                    .setFooter({ text: 'القائمة الثالثة | بواسطة ' + message.author.tag });
            } else if (page === '4') {
                return new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('👑 قائمة المساعدة - أوامر الأونر الخاصة')
                    .setDescription(`هذه القائمة مخصصة **لصاحب السيرفر (الأونر)** فقط!\n\nالأوامر المتاحة هنا:`)
                    .addFields(
                        { name: '**`+ايقاف-السستم`**', value: '**إيقاف نظام البوت بشكل كامل.**', inline: false },
                        { name: '**`+تشغيل-السستم`**', value: '**إعادة تفعيل وتشغيل نظام البوت.**', inline: false }
                    )
                    .setFooter({ text: 'قائمة الأونر | بواسطة ' + message.author.tag });
            }
        };

        const getMenu = (disabled = false) => {
            return new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('help_menu')
                    .setPlaceholder('📂 اضغط هنا لاختيار القسم المطلوب...')
                    .setDisabled(disabled)
                    .addOptions([
                        {
                            label: 'قسم النظام والإحصائيات',
                            description: 'عرض أوامر AFK، توب الرسائل، ومعلومات السيرفر',
                            value: '1',
                            emoji: '📊'
                        },
                        {
                            label: 'قسم الإشراف والرومات',
                            description: 'عرض أوامر البان، الكيك، الميوت، وقفل الرومات',
                            value: '2',
                            emoji: '🛡️'
                        },
                        {
                            label: 'قسم الرتب والأدوات',
                            description: 'عرض أوامر الرول الجماعي، المسابقات، والطوارئ',
                            value: '3',
                            emoji: '⚙️'
                        },
                        {
                            label: 'قائمة الأونر (صاحب السيرفر)',
                            description: 'مخصصة لصاحب السيرفر فقط لإيقاف وتشغيل النظام',
                            value: '4',
                            emoji: '👑'
                        }
                    ])
            );
        };

        const initialMsg = await message.reply({ embeds: [getEmbed('1')], components: [getMenu()] });

        const collector = initialMsg.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            const selectedValue = i.values[0];

            // التحقق إذا حاول أي شخص غير الأونر فتح قائمة الأونر
            if (selectedValue === '4' && i.user.id !== message.guild.ownerId) {
                return i.reply({ content: '❌ **غير متوفر!** هذه القائمة مخصصة لصاحب السيرفر (الأونر) فقط.', ephemeral: true });
            }

            if (i.user.id !== message.author.id) {
                return i.reply({ content: '❌ لا يمكنك استخدام هذه القائمة.', ephemeral: true });
            }

            await i.update({ embeds: [getEmbed(selectedValue)], components: [getMenu()] });
        });

        collector.on('end', () => {
            initialMsg.edit({ components: [getMenu(true)] }).catch(() => {});
        });
    }
});

client.login(process.env.DISCORD_TOKEN);
