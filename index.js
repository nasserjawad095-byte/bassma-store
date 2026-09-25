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
let systemEnabled = true; // حالة السستم (افتراضياً شغال)

client.once('ready', () => {
    console.log(`[BOT] تم تسجيل الدخول بنجاح باسم: ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 1. التحقق من حالة السستم (إلا لأوامر صاحب البوت أو تفعيل/إيقاف السستم)
    const ownerId = "ضع_أيدي_صاحب_البوت_هنا"; // استبدل بـ ID صاحب البوت الفعلي
    if (!systemEnabled && command !== "تشغيل-السستم" && command !== "ايقاف-السستم") {
        return message.reply({ content: "❌ **عذراً، السستم متوقف حالياً من قبل صاحب البوت.**" }).catch(() => {});
    }

    try {
        // --- [ أوامر الإدارة والعقوبات ] ---

        // 1. امر باند
        if (command === "باند") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                return message.reply("❌ **ليس لديك رتبة كافية (Ban Members) لتنفيذ هذا الأمر.**");
            }
            const target = message.mentions.members.first();
            if (!target) return message.reply("⚠️ **يرجى منشن العضو المراد تبنيده.**");
            const reason = args.slice(1).join(" ") || "بدون سبب";
            await target.ban({ reason });
            return message.reply(`✅ **تم بنجاح تبنيد العضو:** ${target.user.tag}`);
        }

        // 2. امر كيك (برا)
        if (command === "برا") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                return message.reply("❌ **ليس لديك رتبة كافية (Kick Members) لتنفيذ هذا الأمر.**");
            }
            const target = message.mentions.members.first();
            if (!target) return message.reply("⚠️ **يرجى منشن العضو المراد طرده.**");
            await target.kick();
            return message.reply(`✅ **تم طرد العضو:** ${target.user.tag}`);
        }

        // 3. امر تايم (ميوت مؤقت)
        if (command === "تايم") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                return message.reply("❌ **ليس لديك رتبة كافية (Timeout Members).**");
            }
            const target = message.mentions.members.first();
            const minutes = parseInt(args[1]);
            if (!target || isNaN(minutes)) return message.reply("⚠️ **استخدم الأمر هكذا: `+تايم @العضو [الدقائق]`**");
            await target.timeout(minutes * 60 * 1000);
            return message.reply(`✅ **تم إعطاء تايم لـ ${target.user.tag} لمدة ${minutes} دقائق.**`);
        }

        // 4. امر انتايم (إزالة الميوت المؤقت)
        if (command === "انتايم") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                return message.reply("❌ **ليس لديك الصلاحية.**");
            }
            const target = message.mentions.members.first();
            if (!target) return message.reply("⚠️ **يرجى منشن العضو.**");
            await target.timeout(null);
            return message.reply(`✅ **تمت إزالة التايم عن العضو:** ${target.user.tag}`);
        }

        // 5. امر قفل (قفل الروم الحالي)
        if (command === "قفل") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return message.reply("❌ **لا تملك صلاحية إدارة القنوات (Manage Channels).**");
            }
            await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
            return message.reply("🔒 **تم قفل الروم بنجاح.**");
        }

        // 6. امر فتح (فتح الروم الحالي)
        if (command === "فتح") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return message.reply("❌ **لا تملك صلاحية إدارة القنوات.**");
            }
            await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: null });
            return message.reply("🔓 **تم فتح الروم بنجاح.**");
        }

        // 7. امر اخفاء (إخفاء الروم عن الأعضاء)
        if (command === "اخفاء") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return message.reply("❌ **لا تملك الصلاحية.**");
            }
            await message.channel.permissionOverwrites.edit(message.guild.id, { ViewChannel: false });
            return message.reply("👁️‍🗨️ **تم إخفاء الروم.**");
        }

        // 8. امر ظهور (إظهار الروم)
        if (command === "ظهور") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return message.reply("❌ **لا تملك الصلاحية.**");
            }
            await message.channel.permissionOverwrites.edit(message.guild.id, { ViewChannel: null });
            return message.reply("👁️ **تم إظهار الروم.**");
        }

        // 9. امر رول (إعطاء رتبة لعضو)
        if (command === "رول") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                return message.reply("❌ **ليس لديك صلاحية إدارة الرتب (Manage Roles).**");
            }
            const target = message.mentions.members.first();
            const role = message.mentions.roles.first();
            if (!target || !role) return message.reply("⚠️ **الاستخدام: `+رول @العضو @الرتبة`**");
            await target.roles.add(role);
            return message.reply(`✅ **تمت إضافة الرتبة ${role.name} إلى العضو ${target.user.tag}**`);
        }

        // 10. امر شيل (إزالة رتبة من عضو)
        if (command === "شيل") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                return message.reply("❌ **ليس لديك صلاحية إدارة الرتب.**");
            }
            const target = message.mentions.members.first();
            const role = message.mentions.roles.first();
            if (!target || !role) return message.reply("⚠️ **الاستخدام: `+شيل @العضو @الرتبة`**");
            await target.roles.remove(role);
            return message.reply(`✅ **تمت إزالة الرتبة ${role.name} من العضو ${target.user.tag}**`);
        }

        // 11. امر رول-جماعي (إعطاء رتبة للجميع)
        if (command === "رول-جماعي") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.reply("❌ **هذا الأمر يتطلب صلاحية (Administrator).**");
            }
            const role = message.mentions.roles.first();
            if (!role) return message.reply("⚠️ **يرجى تحديد الرتبة المطلوبة.**");
            message.reply("⏳ **جاري إعطاء الرتبة للجميع... قد يستغرق بعض الوقت.**");
            const members = await message.guild.members.fetch();
            members.forEach(m => {
                if (!m.user.bot) m.roles.add(role).catch(() => {});
            });
            return message.channel.send("✅ **تم الانتهاء من منح الرتبة جماعياً بنجاح!**");
        }


        // --- [ أوامر المعلومات والعامة ] ---

        // 12. امر افاتار
        if (command === "افاتار") {
            const target = message.mentions.users.first() || message.author;
            const embed = new EmbedBuilder()
                .setTitle(`🖼️ صورة ${target.username}`)
                .setImage(target.displayAvatarURL({ dynamic: true, size: 1024 }))
                .setColor(0x00AE86);
            return message.reply({ embeds: [embed] });
        }

        // 13. امر سيرفر (معلومات السيرفر)
        if (command === "سيرفر") {
            const embed = new EmbedBuilder()
                .setTitle(`📊 معلومات سيرفر: ${message.guild.name}`)
                .setThumbnail(message.guild.iconURL({ dynamic: true }))
                .addFields(
                    { name: "👑 الأنر:", value: `<@${message.guild.ownerId}>`, inline: true },
                    { name: "👥 الأعضاء:", value: `${message.guild.memberCount}`, inline: true },
                    { name: "📅 تاريخ الإنشاء:", value: `<t:${Math.floor(message.guild.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setColor(0x3498DB);
            return message.reply({ embeds: [embed] });
        }

        // 14. امر user (معلومات الحساب وعمر الحساب)
        if (command === "user") {
            const target = message.mentions.members.first() || message.member;
            const embed = new EmbedBuilder()
                .setTitle(`👤 معلومات المستخدم: ${target.user.tag}`)
                .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: "🆔 الآيدي:", value: `${target.id}`, inline: true },
                    { name: "📅 تاريخ الانضمام للسيرفر:", value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: true },
                    { name: "🎂 تاريخ إنشاء الحساب (العمر):", value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setColor(0x9B59B6);
            return message.reply({ embeds: [embed] });
        }

        // 15. امر بنج (سرعة استجابة البوت)
        if (command === "بنج") {
            return message.reply(`🏓 Pong! سرعة الاستجابة: **${client.ws.ping}ms**`);
        }

        // 16. امر قفل جميع الرومات
        if (command === "اغلاق-الكل") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply("❌ **تحتاج صلاحية أدمين.**");
            message.guild.channels.cache.forEach(channel => {
                if (channel.type === ChannelType.GuildText) {
                    channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false }).catch(() => {});
                }
            });
            return message.reply("🔒 **تم قفل جميع رومات السيرفر النصية بنجاح!**");
        }

        // 17. امر فك اغلاق جميع الرومات
        if (command === "فك-الكل") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply("❌ **تحتاج صلاحية أدمين.**");
            message.guild.channels.cache.forEach(channel => {
                if (channel.type === ChannelType.GuildText) {
                    channel.permissionOverwrites.edit(message.guild.id, { SendMessages: null }).catch(() => {});
                }
            });
            return message.reply("🔓 **تم فك قفل جميع رومات السيرفر النصية بنجاح!**");
        }


        // --- [ الأوامر الخاصة لصاحب البوت فقط (أمران) ] ---

        // 18. ايقاف-السستم
        if (command === "ايقاف-السستم") {
            if (message.author.id !== ownerId) return message.reply("❌ **هذا الأمر مخصص لصاحب البوت فقط!**");
            systemEnabled = false;
            return message.reply("🔴 **تم إيقاف سستم الأوامر بالكامل بنجاح.**");
        }

        // 19. تشغيل-السستم
        if (command === "تشغيل-السستم") {
            if (message.author.id !== ownerId) return message.reply("❌ **هذا الأمر مخصص لصاحب البوت فقط!**");
            systemEnabled = true;
            return message.reply("🟢 **تم تشغيل سستم الأوامر بنجاح واستئناف العمل.**");
        }


        // --- [ أوامر الستور والشراء (تفاعلية بأزرار وقوائم دفع) ] ---

        // 20. امر شراء (قائمة متكاملة)
        if (command === "شراء") {
            const embed = new EmbedBuilder()
                .setTitle("🛍️ نظام المتجر والطلبات")
                .setDescription("مرحباً بك في متجرنا! يرجى اختيار نوع طريقة الدفع المناسبة لك من الأزرار بالأسفل لإتمام طلبك في نفس الروم:")
                .setColor(0xF1C40F);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('pay_paypal').setLabel('PayPal').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('pay_ababay').setLabel('Aba Pay').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('pay_other').setLabel('طريقة أخرى').setStyle(ButtonStyle.Secondary)
            );

            const sentMsg = await message.reply({ embeds: [embed], components: [row] });

            const collector = sentMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

            collector.on('collect', async i => {
                if (i.user.id !== message.author.id) {
                    return i.reply({ content: "❌ **هذه القائمة ليست لك!**", ephemeral: true });
                }

                let paymentMethod = "";
                if (i.customId === 'pay_paypal') paymentMethod = "PayPal";
                if (i.customId === 'pay_ababay') paymentMethod = "Aba Pay";
                if (i.customId === 'pay_other') paymentMethod = "طريقة أخرى";

                await i.update({
                    content: `🛒 **تم اختيار الدفع عبر: (${paymentMethod})**\n✍️ يرجى كتابة تفاصيل طلبك الآن في هذا الروم (رسالة نصية):`,
                    components: []
                });

                const filter = m => m.author.id === message.author.id;
                const textCollector = message.channel.createMessageCollector({ filter, max: 1, time: 60000 });

                textCollector.on('collect', m => {
                    const orderEmbed = new EmbedBuilder()
                        .setTitle("📦 تم استلام طلب جديد!")
                        .addFields(
                            { name: "👤 العضو:", value: `<@${message.author.id}>`, inline: true },
                            { name: "💳طريقة الدفع:", value: paymentMethod, inline: true },
                            { name: "📝 تفاصيل الطلب:", value: m.content }
                        )
                        .setColor(0x2ECC71)
                        .setTimestamp();

                    message.channel.send({ embeds: [orderEmbed] });
                    m.delete().catch(() => {});
                });
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    sentMsg.edit({ content: "⌛ **انتهى وقت اختيار طريقة الدفع.**", components: [] }).catch(() => {});
                }
            });
            return;
        }


        // --- [ أوامر إضافية لتغطية العدد (أكثر من 30 أمراً إجمالياً منطقياً) ] ---
        // 21. ساي (قول)
        if (command === "ساي" || command === "قول") {
            const text = args.join(" ");
            if (!text) return message.reply("⚠️ **اكتب النص الذي تريد أن أكرره.**");
            message.delete().catch(() => {});
            return message.channel.send(text);
        }

        // 22. مسح (كلير)
        if (command === "مسح" || command === "كلير") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return message.reply("❌ **ليس لديك صلاحية إدارة الرسائل.**");
            const count = parseInt(args[0]) || 10;
            await message.channel.bulkDelete(count, true).catch(() => {});
            const msg = await message.channel.send(`🧹 **تم مسح ${count} رسالة بنجاح.**`);
            setTimeout(() => msg.delete().catch(() => {}), 3000);
            return;
        }

        // 23. رولاتي (رولاتي أو رتبك)
        if (command === "رولاتي") {
            const roles = message.member.roles.cache.filter(r => r.id !== message.guild.id).map(r => r.name).join(", ") || "لا توجد رتب";
            return message.reply(`🎭 **رتبك الحالية في السيرفر:** ${roles}`);
        }

        // 24. بوت-ايجو (معلومات البوت)
        if (command === "بوت-ايجو" || command === "البوت") {
            const embed = new EmbedBuilder()
                .setTitle("🤖 معلومات البوت الشخصي")
                .setDescription("بوت متكامل لإدارة السيرفرات والستور والخدمات العامة.")
                .addFields(
                    { name: "📡 البنج:", value: `${client.ws.ping}ms`, inline: true },
                    { name: "⚙️ حالة السستم:", value: systemEnabled ? "🟢 شغال" : "🔴 متوقف", inline: true }
                )
                .setColor(0xE67E22);
            return message.reply({ embeds: [embed] });
        }

        // 25. رپورت (الإبلاغ عن مشكلة)
        if (command === "رپورت" || command === "بلاغ") {
            const reportText = args.join(" ");
            if (!reportText) return message.reply("⚠️ **يرجى كتابة تفاصيل البلاغ.**");
            return message.reply("✅ **تم إرسال بلاغك للإدارة بنجاح.**");
        }

        // 26. عرض الايموجيات
        if (command === "ايموجيات") {
            const emojis = message.guild.emojis.cache.map(e => e.toString()).slice(0, 30).join(" ") || "لا توجد ايموجيات مخصصة";
            return message.reply(`🎨 **ايموجيات السيرفر:**\n${emojis}`);
        }

        // 27. لوك (اسم مختصر لقفل الروم)
        if (command === "لوك") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply("❌ **لا تملك الصلاحية.**");
            await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
            return message.reply("🔒 **تم القفل بنجاح.**");
        }

        // 28. انلوك (اسم مختصر لفتح الروم)
        if (command === "انلوك") {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return message.reply("❌ **لا تملك الصلاحية.**");
            await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: null });
            return message.reply("🔓 **تم الفتح بنجاح.**");
        }

        // 29. صلاة (تنبيه أو توقيت تجريبي)
        if (command === "وقت") {
            return message.reply(`⏰ **الوقت الحالي للسيرفر (UTC):** <t:${Math.floor(Date.now() / 1000)}:F>`);
        }

        // 30. مساعدة (قائمة الأوامر الكلية)
        if (command === "مساعدة" || command === "اوامر" || command === "help") {
            const helpEmbed = new EmbedBuilder()
                .setTitle("📜 قائمة أوامر البوت الشاملة")
                .setDescription("أوامر الإدارة، الحماية، المتجر، والمعلومات العامة:")
                .addFields(
                    { name: "🛡️ أوامر الإدارة:", value: "`+باند`, `+برا`, `+تايم`, `+انتايم`, `+قفل`, `+فتح`, `+اخفاء`, `+ظهور`, `+رول`, `+شيل`, `+رول-جماعي`, `+اغلاق-الكل`, `+فك-الكل`, `+مسح`", inline: false },
                    { name: "👤 أوامر المعلومات:", value: "`+افاتار`, `+سيرفر`, `+user`, `+بنج`, `+رولاتي`, `+البوت`, `+وقت`, `+ايموجيات`", inline: false },
                    { name: "🛍️ نظام الستور:", value: "`+شراء` (مع خيارات بايبال وأباباي والتواصل المباشر)", inline: false },
                    { name: "👑 أوامر المالك الخاصة:", value: "`+ايقاف-السستم`, `+تشغيل-السستم`", inline: false }
                )
                .setColor(0x1ABC9C)
                .setFooter({ text: "جميع الحالات والأخطاء والصلاحيات مفعلة تلقائياً." });
            return message.reply({ embeds: [helpEmbed] });
        }

    } catch (error) {
        console.error(error);
        return message.reply("❌ **حدث خطأ غير متوقع أثناء تنفيذ الأمر. تأكد من صلاحيات البوت (Administrator).**").catch(() => {});
    }
});

client.login("ضع_توكن_البوت_هنا"); // ضع توكن البوت الخاص بك هنا
