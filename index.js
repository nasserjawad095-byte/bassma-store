const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

const PREFIX = "+";
let systemEnabled = true;

// حماية الكود من الانهيار (Crash) في حال حدوث خطأ غير متوقع
process.on('unhandledRejection', error => {
    console.error('⚠️ خطأ تم رصده ومنع البوت من الانهيار:', error);
});

client.once('ready', () => {
    console.log(`[BOT] تم تسجيل الدخول بنجاح باسم: ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    try {
        if (message.author.bot || !message.content.startsWith(PREFIX)) return;

        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // استبدل الايدي أدناه بأيديك الحقيقي (صاحب البوت)
        const ownerId = "ضع_أيدي_صاحب_البوت_هنا"; 

        if (!systemEnabled && command !== "تشغيل-السستم" && command !== "ايقاف-السستم") {
            return message.reply({ content: "❌ **عذراً، السستم متوقف حالياً من قبل صاحب البوت.**" }).catch(() => {});
        }

        // --- أوامر الإدارة والعقوبات ---
        if (command === "باند") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) 
                return message.reply("❌ **ليس لديك رتبة كافية (Ban Members).**");
            const target = message.mentions.members.first();
            if (!target) return message.reply("⚠️ **يرجى منشن العضو المراد تبنيده.**");
            await target.ban();
            return message.reply(`✅ **تم تبنيد العضو:** ${target.user.tag}`);
        }

        if (command === "برا") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) 
                return message.reply("❌ **ليس لديك صلاحية طرد (Kick Members).**");
            const target = message.mentions.members.first();
            if (!target) return message.reply("⚠️ **يرجى منشن العضو المراد طرده.**");
            await target.kick();
            return message.reply(`✅ **تم طرد العضو:** ${target.user.tag}`);
        }

        if (command === "تايم") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) 
                return message.reply("❌ **ليس لديك صلاحية ميوت مؤقت (Timeout).**");
            const target = message.mentions.members.first();
            const minutes = parseInt(args[1]);
            if (!target || isNaN(minutes)) return message.reply("⚠️ **الاستخدام: `+تايم @العضو [الدقائق]`**");
            await target.timeout(minutes * 60 * 1000);
            return message.reply(`✅ **تم إعطاء تايم لـ ${target.user.tag} لمدة ${minutes} دقائق.**`);
        }

        if (command === "انتايم") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) 
                return message.reply("❌ **ليس لديك الصلاحية.**");
            const target = message.mentions.members.first();
            if (!target) return message.reply("⚠️ **يرجى منشن العضو.**");
            await target.timeout(null);
            return message.reply(`✅ **تمت إزالة التايم عن العضو:** ${target.user.tag}`);
        }

        if (command === "قفل" || command === "لوك") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) 
                return message.reply("❌ **لا تملك صلاحية إدارة القنوات.**");
            await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
            return message.reply("🔒 **تم قفل الروم بنجاح.**");
        }

        if (command === "فتح" || command === "انلوك") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) 
                return message.reply("❌ **لا تملك صلاحية إدارة القنوات.**");
            await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: null });
            return message.reply("🔓 **تم فتح الروم بنجاح.**");
        }

        if (command === "اخفاء") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) 
                return message.reply("❌ **لا تملك الصلاحية.**");
            await message.channel.permissionOverwrites.edit(message.guild.id, { ViewChannel: false });
            return message.reply("👁️‍🗨️ **تم إخفاء الروم.**");
        }

        if (command === "ظهور") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) 
                return message.reply("❌ **لا تملك الصلاحية.**");
            await message.channel.permissionOverwrites.edit(message.guild.id, { ViewChannel: null });
            return message.reply("👁️ **تم إظهار الروم.**");
        }

        if (command === "رول") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) 
                return message.reply("❌ **ليس لديك صلاحية إدارة الرتب.**");
            const target = message.mentions.members.first();
            const role = message.mentions.roles.first();
            if (!target || !role) return message.reply("⚠️ **الاستخدام: `+رول @العضو @الرتبة`**");
            await target.roles.add(role);
            return message.reply(`✅ **تمت إضافة الرتبة ${role.name}**`);
        }

        if (command === "شيل") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) 
                return message.reply("❌ **ليس لديك صلاحية إدارة الرتب.**");
            const target = message.mentions.members.first();
            const role = message.mentions.roles.first();
            if (!target || !role) return message.reply("⚠️ **الاستخدام: `+شيل @العضو @الرتبة`**");
            await target.roles.remove(role);
            return message.reply(`✅ **تمت إزالة الرتبة ${role.name}**`);
        }

        if (command === "رول-جماعي") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) 
                return message.reply("❌ **يحتاج صلاحية (Administrator).**");
            const role = message.mentions.roles.first();
            if (!role) return message.reply("⚠️ **يرجى تحديد الرتبة.**");
            message.reply("⏳ **جاري منح الرتبة للجميع...**");
            const members = await message.guild.members.fetch();
            members.forEach(m => { if (!m.user.bot) m.roles.add(role).catch(() => {}); });
            return message.channel.send("✅ **تم الانتهاء بنجاح!**");
        }

        // --- أوامر المعلومات ---
        if (command === "افاتار") {
            const target = message.mentions.users.first() || message.author;
            const embed = new EmbedBuilder()
                .setTitle(`🖼️ صورة ${target.username}`)
                .setImage(target.displayAvatarURL({ dynamic: true, size: 1024 }))
                .setColor(0x00AE86);
            return message.reply({ embeds: [embed] });
        }

        if (command === "سيرفر") {
            const embed = new EmbedBuilder()
                .setTitle(`📊 معلومات سيرفر: ${message.guild.name}`)
                .setThumbnail(message.guild.iconURL({ dynamic: true }))
                .addFields(
                    { name: "👥 الأعضاء:", value: `${message.guild.memberCount}`, inline: true },
                    { name: "📅 تاريخ الإنشاء:", value: `<t:${Math.floor(message.guild.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setColor(0x3498DB);
            return message.reply({ embeds: [embed] });
        }

        if (command === "user") {
            const target = message.mentions.members.first() || message.member;
            const embed = new EmbedBuilder()
                .setTitle(`👤 معلومات المستخدم: ${target.user.tag}`)
                .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: "📅 الانضمام للسيرفر:", value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: true },
                    { name: "🎂 إنشاء الحساب (العمر):", value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setColor(0x9B59B6);
            return message.reply({ embeds: [embed] });
        }

        if (command === "بنج") {
            return message.reply(`🏓 Pong! الاستجابة: **${client.ws.ping}ms**`);
        }

        if (command === "اغلاق-الكل") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
            message.guild.channels.cache.forEach(c => {
                if (c.type === ChannelType.GuildText) c.permissionOverwrites.edit(message.guild.id, { SendMessages: false }).catch(() => {});
            });
            return message.reply("🔒 **تم قفل جميع الرومات النصية.**");
        }

        if (command === "فك-الكل") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
            message.guild.channels.cache.forEach(c => {
                if (c.type === ChannelType.GuildText) c.permissionOverwrites.edit(message.guild.id, { SendMessages: null }).catch(() => {});
            });
            return message.reply("🔓 **تم فتح جميع الرومات النصية.**");
        }

        // --- أوامر صاحب البوت ---
        if (command === "ايقاف-السستم") {
            if (message.author.id !== ownerId) return message.reply("❌ **لصاحب البوت فقط!**");
            systemEnabled = false;
            return message.reply("🔴 **تم إيقاف السستم.**");
        }

        if (command === "تشغيل-السستم") {
            if (message.author.id !== ownerId) return message.reply("❌ **لصاحب البوت فقط!**");
            systemEnabled = true;
            return message.reply("🟢 **تم تشغيل السستم.**");
        }

        // --- نظام الستور والشراء ---
        if (command === "شراء") {
            const embed = new EmbedBuilder()
                .setTitle("🛍️ نظام المتجر والطلبات")
                .setDescription("اختر طريقة الدفع المناسبة من الأزرار بالأسفل:")
                .setColor(0xF1C40F);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('pay_paypal').setLabel('PayPal').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('pay_ababay').setLabel('Aba Pay').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('pay_other').setLabel('طريقة أخرى').setStyle(ButtonStyle.Secondary)
            );

            const sentMsg = await message.reply({ embeds: [embed], components: [row] });
            const collector = sentMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

            collector.on('collect', async i => {
                if (i.user.id !== message.author.id) return i.reply({ content: "❌ **القائمة ليست لك!**", ephemeral: true });

                let paymentMethod = i.customId === 'pay_paypal' ? "PayPal" : (i.customId === 'pay_ababay' ? "Aba Pay" : "طريقة أخرى");

                await i.update({ content: `🛒 **تم اختيار (${paymentMethod})**\n✍️ اكتب تفاصيل طلبك الآن في هذا الروم:`, components: [] });

                const textCollector = message.channel.createMessageCollector({ filter: m => m.author.id === message.author.id, max: 1, time: 60000 });
                textCollector.on('collect', m => {
                    const orderEmbed = new EmbedBuilder()
                        .setTitle("📦 طلب جديد مستلم")
                        .addFields(
                            { name: "👤 العضو:", value: `<@${message.author.id}>`, inline: true },
                            { name: "💳 الدفع:", value: paymentMethod, inline: true },
                            { name: "📝 التفاصيل:", value: m.content }
                        )
                        .setColor(0x2ECC71);
                    message.channel.send({ embeds: [orderEmbed] });
                    m.delete().catch(() => {});
                });
            });
            return;
        }

        // أوامر عامة إضافية
        if (command === "مسح" || command === "كلير") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return message.reply("❌ **ليس لديك صلاحية.**");
            const count = parseInt(args[0]) || 10;
            await message.channel.bulkDelete(count, true).catch(() => {});
            return;
        }

        if (command === "مساعدة" || command === "help") {
            const helpEmbed = new EmbedBuilder()
                .setTitle("📜 قائمة أوامر البوت")
                .setDescription("الأوامر المتاحة: `+باند`, `+برا`, `+تايم`, `+انتايم`, `+قفل`, `+فتح`, `+رول`, `+شيل`, `+افاتار`, `+سيرفر`, `+user`, `+بنج`, `+شراء`, `+اغلاق-الكل`, `+فك-الكل`")
                .setColor(0x1ABC9C);
            return message.reply({ embeds: [helpEmbed] });
        }

    } catch (err) {
        console.error("خطأ داخل أمر معين:", err);
    }
});

// تشغيل البوت باستخدام متغير البيئة DISCORD_TOKEN
client.login(process.env.DISCORD_TOKEN);
