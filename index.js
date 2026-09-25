const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// حماية البوت من أي كراش مفاجئ
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});
process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

const PREFIX = '+';
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

        // 1. +status (حالة البوت وسرعته)
        if (command === 'status') {
            const ping = client.ws.ping;
            let speedText = '⚡ سريع جداً';
            if (ping > 150 && ping <= 350) speedText = ' متوسط';
            if (ping > 350) speedText = ' بطيء';

            const uptimeSeconds = Math.floor(client.uptime / 1000);
            const hours = Math.floor(uptimeSeconds / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);

            const statusEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('📊 إحصائيات وحالة البوت')
                .addFields(
                    { name: '🏓 البينغ (Ping)', value: `\`${ping}ms\` (${speedText})`, inline: true },
                    { name: '⏱️ وقت التشغيل', value: `\`${hours} ساعة و ${minutes} دقيقة\``, inline: true },
                    { name: '👥 السيرفرات', value: `\`${client.guilds.cache.size} سيرفر\``, inline: true }
                )
                .setTimestamp();
            return message.reply({ embeds: [statusEmbed] });
        }

        // أمر الاستدعاء الجديد (+استدعاء أو +c)
        if (command === 'استدعاء' || command === 'c') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return message.reply('❌ ليس لديك صلاحية لاستخدام أمر الاستدعاء.');
            }

            const targetUser = message.mentions.users.first();
            const reason = args.slice(1).join(' ') || 'بدون سبب محدد';

            if (!targetUser) {
                return message.reply('⚠️ يرجى استخدام الأمر بالشكل الصحيح: \n`+استدعاء @العضو [السبب]` أو `+c @العضو [السبب]`');
            }

            try {
                const embedDM = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🚨 تنبيه استدعاء إداري')
                    .addFields(
                        { name: '🌐 السيرفر', value: message.guild.name, inline: true },
                        { name: '👤 بواسطة الإداري', value: `<@${message.author.id}>`, inline: true },
                        { name: '📌 السبب', value: reason }
                    )
                    .setTimestamp();

                await targetUser.send({ embeds: [embedDM] });
                return message.reply({ embeds: [new EmbedBuilder().setColor('#00FF00'].setDescription(`✅ تم إرسال الاستدعاء إلى ${targetUser} في الخاص بنجاح.`)] });
            } catch (e) {
                return message.reply(`⚠️ تم محاولة استدعاء ${targetUser}، ولكن تعذر إرسال رسالة خاصة له (خاصه مقفل).`);
            }
        }

        // 2. +warn (تحذير شخص بالخاص)
        if (command === 'warn') {
            if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply('❌ لا تمتلك صلاحية التحذير.');
            const target = message.mentions.members.first();
            const reason = args.slice(1).join(' ') || 'بدون سبب';
            if (!target) return message.reply('⚠️ طريقة الاستخدام: `+warn @العضو [السبب]`');

            try {
                await target.send(`⚠️ **تم تحذيرك في سيرفر ${message.guild.name}**\nالسبب: **${reason}**`);
                return message.reply(`✅ تم إرسال التحذير إلى العضو **${target.user.tag}** بالخاص بنجاح.`);
            } catch (e) {
                return message.reply(`⚠️ تم تحذير العضو **${target.user.tag}**، ولكن تعذر إرسال رسالة خاصة له (خاصه مقفل).`);
            }
        }

        // 3. +slowmode (سلو مود بالانجليزي)
        if (command === 'slowmode' || command === 'سلومود') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ لا تمتلك صلاحية إدارة الرومات.');
            const time = parseInt(args[0]);
            if (isNaN(time) || time < 0) return message.reply('⚠️ حدد عدد الثواني (مثال: `+slowmode 5` أو `+slowmode 0` للإلغاء)');
            await message.channel.setRateLimitPerUser(time);
            return message.reply(time === 0 ? '⏱️ تم إلغاء الوضع البطيء (Slowmode).' : `⏱️ تم ضبط الوضع البطيء على **${time}** ثانية.`);
        }

        // 4. +firstmsg @user (أول رسالة للشخص في السيرفر)
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
                return message.reply(`💬 **أول رسالة عُثر عليها لـ ${target}:**\n> "${first.content}"\n[رابط الرسالة](${first.url})`);
            } catch (e) {
                return message.reply('❌ حدث خطأ أثناء البحث عن الرسالة الأولى.');
            }
        }

        // 5. +nick (تغيير النك نيم أو إزالته)
        if (command === 'nick' || command === 'نك') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageNicknames)) return message.reply('❌ لا تمتلك صلاحية تعديل النك نيم.');
            const target = message.mentions.members.first();
            const newNick = args.slice(1).join(' ');
            if (!target) return message.reply('⚠️ طريقة الاستخدام: `+nick @العضو [الاسم الجديد]` (أو اكتب اسم الشخص فقط لتصفيره)');

            try {
                if (!newNick) {
                    await target.setNickname(null);
                    return message.reply(`✅ تم إزالة وتصفير النك نيم لـ **${target.user.tag}**.`);
                } else {
                    await target.setNickname(newNick);
                    return message.reply(`✅ تم تغيير نك نيم **${target.user.tag}** إلى: **${newNick}**`);
                }
            } catch (e) {
                return message.reply('❌ فشل تغيير النك نيم، تأكد من رتبة البوت أنها أعلى من العضو.');
            }
        }

        // 6. +servericon (صورة السيرفر)
        if (command === 'servericon') {
            const iconUrl = message.guild.iconURL({ dynamic: true, size: 1024 });
            if (!iconUrl) return message.reply('❌ هذا السيرفر لا يملك صورة.');
            const iconEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle(`🖼️ صورة سيرفر: ${message.guild.name}`)
                .setImage(iconUrl);
            return message.reply({ embeds: [iconEmbed] });
        }

        // 7. +serverbanner (بانر السيرفر)
        if (command === 'serverbanner') {
            const bannerUrl = message.guild.bannerURL({ size: 1024 });
            if (!bannerUrl) return message.reply('❌ هذا السيرفر لا يملك بانر.');
            const bannerEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle(`🎨 بانر سيرفر: ${message.guild.name}`)
                .setImage(bannerUrl);
            return message.reply({ embeds: [bannerEmbed] });
        }

        // 8. +luck (نسبة الحظ اليومي غير محدودة)
        if (command === 'luck') {
            const target = message.mentions.users.first() || message.author;
            const luckPercentage = Math.floor(Math.random() * 101); // من 0 إلى 100%
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

        // 9. +fortune (توقعات المستقبل عشوائية)
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

        // 10. +challenge @user (تحدي بين العضو وشخص آخر)
        if (command === 'challenge') {
            const target = message.mentions.users.first();
            if (!target || target.id === message.author.id) return message.reply('⚠️ يرجى منشن شخص لتحديه: `+challenge @العضو`');
            
            const challengesList = [
                'تحدي صراع الأقوياء: من يكتب كلمة "سيرفر" أسرع وبدون غلط!',
                'تحدي لعبة الصراحة: أجب عن سؤال محرج يطلبه منك الطرف الآخر.',
                'تحدي من يجمع رسائل أكثر خلال 5 دقائق القادمة في الشات!',
                'تحدي من يملك حظاً أفضل في رمي النرد (اكتب +luck وشوف من يفوز).'
            ];
            const chosenChallenge = challengesList[Math.floor(Math.random() * challengesList.length)];

            const chalEmbed = new EmbedBuilder()
                .setColor('#E67E22')
                .setTitle('⚔️ تحدي جديد أُطلق!')
                .setDescription(`**${message.author}** قام بتحدي ${target}!\n\n🎯 **نوع التحدي:**\n> ${chosenChallenge}\n\nمين قدها؟ ارفعوا التحدي بالروم! 🔥`);
            return message.reply({ embeds: [chalEmbed] });
        }

        // 11. +rep @user (إعطاء سمعة لشخص مع كول داون 24 ساعة)
        if (command === 'rep') {
            const target = message.mentions.users.first();
            if (!target || target.id === message.author.id) return message.reply('⚠️ يرجى منشن عضو لإعطائه سمعة: `+rep @العضو`');

            const cooldownTime = 24 * 60 * 60 * 1000; // 24 ساعة بالميلي ثانية
            const lastRepTime = repCooldowns.get(message.author.id);

            if (lastRepTime && (Date.now() - lastRepTime < cooldownTime)) {
                const remainingTime = cooldownTime - (Date.now() - lastRepTime);
                const hoursLeft = Math.floor(remainingTime / (1000 * 60 * 60));
                const minutesLeft = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
                return message.reply(`⏳ عذراً، يمكنك استخدام أمر \`+rep\` مرة أخرى بعد **${hoursLeft} ساعة و ${minutesLeft} دقيقة**.`);
            }

            repCooldowns.set(message.author.id, Date.now());

            const currentRep = userReputation.get(target.id) || 0;
            userReputation.set(target.id, currentRep + 1);

            const repEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('⭐ نظام السمعة (Reputation)')
                .setDescription(`لقد قمت بإعطاء نقطة سمعة لـ ${target} بنجاح!\nإجمالي نقاط سمعته الآن: **${currentRep + 1} ⭐**\n*(يمكنك استخدام هذا الأمر مرة كل 24 ساعة)*`);
            return message.reply({ embeds: [repEmbed] });
        }

        // 12. +repboard (ترتيب الأشخاص حسب السمعة)
        if (command === 'repboard') {
            const sortedRep = [...userReputation.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
            let desc = sortedRep.length === 0 ? 'لا توجد نقاط سمعة مسجلة بعد.' : '';
            
            sortedRep.forEach((item, index) => {
                desc += `**${index + 1}.** <@${item[0]}> - **${item[1]}** ⭐\n`;
            });

            const repBoardEmbed = new EmbedBuilder()
                .setColor('#F1C40F')
                .setTitle('🏆 لوحة شرف السمعة (Reputation Leaderboard)')
                .setDescription(desc);
            return message.reply({ embeds: [repBoardEmbed] });
        }

        // 13. +activity (معرفة نشاطك بالسيرفر)
        if (command === 'activity') {
            const target = message.mentions.users.first() || message.author;
            const actCount = userActivityCount.get(target.id) || 0;
            const actEmbed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle(`📊 نشاط العضو: ${target.username}`)
                .setDescription(`عدد الرسائل والتفاعلات المسجلة لك في هذا السيرفر: **${actCount} تفاعل** 🚀`);
            return message.reply({ embeds: [actEmbed] });
        }

        // 14. +topactive (أكثر الأشخاص نشاطاً أونلاين)
        if (command === 'topactive') {
            const sortedAct = [...userActivityCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
            let desc = sortedAct.length === 0 ? 'لا توجد بيانات نشاط بعد.' : '';

            sortedAct.forEach((item, index) => {
                desc += `**${index + 1}.** <@${item[0]}> - **${item[1]}** تفاعل\n`;
            });

            const topActEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('🔥 أكثر الأعضاء نشاطاً في السيرفر')
                .setDescription(desc);
            return message.reply({ embeds: [topActEmbed] });
        }

        // الأوامر السابقة
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
                return message.reply('⚠️ **طريقة الاستخدام الصحيحة:**\n`+صرف [المبلغ] [العملة]`\nمثال: `+صرف 50 يورو` أو `+صرف 1000 جنيه`');
            }

            const baseRate = exchangeRates[currency];
            if (!baseRate) {
                return message.reply(`❌ عذراً، العملة **"${currency}"** غير متوفرة في القائمة حالياً.`);
            }

            let convertedUSD;
            if (currency === 'ليرة' || currency === 'lbp' || currency === 'جنيه' || currency === 'egp') {
                convertedUSD = (amount / baseRate).toFixed(2);
            } else if (currency === 'يورو' || currency === 'eur') {
                convertedUSD = (amount * baseRate).toFixed(2);
            } else {
                convertedUSD = (amount / baseRate).toFixed(2);
            }

            const convertEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('💱 تحويل العملات بالسعر المخصص')
                .addFields(
                    { name: '👤 العضو', value: `${message.author}`, inline: true },
                    { name: '💵 المبلغ', value: `\`${amount} ${currency}\``, inline: true },
                    { name: '💲 السعر بالدولار', value: `**$${convertedUSD} USD**`, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Custom Currency Converter' });

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
                .setTitle(`📜 رتب السيرفر (من الأقوى إلى الأصغر)`)
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
                .setDescription(description)
                .setFooter({ text: 'يتم تصفير القائمة تلقائياً كل 24 ساعة.' });
            return message.reply({ embeds: [topEmbed] });
        }

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

        if (command === 'بروفايل' || command === 'اي_دي') {
            const target = message.mentions.users.first() || message.author;
            const member = message.guild.members.cache.get(target.id);
            if (!member) return message.reply('❌ العضو غير موجود.');
            
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

        if (command === 'مسابقة') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply('❌ لا تمتلك صلاحية إدارة السيرفر.');
            const durationArg = args[0];
            const prize = args.slice(1).join(' ');
            if (!durationArg || !prize) return message.reply('⚠️ مثال للاستخدام: `+مسابقة 1h رتبة مميزة` أو `+مسابقة 30m نيترو`');

            const millis = parseDuration(durationArg);
            if (!millis) return message.reply('⚠️ صيغة الوقت غير صحيحة.');

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
                try {
                    if (participants.has(i.user.id)) {
                        return i.reply({ content: '❌ أنت مشارك بالفعل في هذه المسابقة!', ephemeral: true });
                    }
                    participants.add(i.user.id);
                    await i.reply({ content: '✅ تم تسجيل مشاركتك بنجاح في المسابقة!', ephemeral: true });

                    const updatedEmbed = EmbedBuilder.from(gEmbed)
                        .setDescription(`الجائزة: **${prize}**\nتنتهي المسابقة بعد: **${durationArg}** (<t:${Math.floor(endsAt / 1000)}:R>)\n\nاضغط على الزر أدناه للمشاركة! 🎁\n\nالمشاركون حتى الآن: **${participants.size}**`);
                    await gMsg.edit({ embeds: [updatedEmbed] }).catch(() => {});
                } catch (err) {
                    console.error('Error in giveaway collector:', err);
                }
            });

            collector.on('end', async () => {
                try {
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
                    gMsg.channel.send(`🎉 مبروك لـ <@${winnerId}> لقد فزت بـ **${prize}**!`).catch(() => {});
                } catch (err) {
                    console.error('Error in giveaway end:', err);
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
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ هذا الأمر يتطلب صلاحية `Administrator`.');
            const role = message.mentions.roles.first();
            if (!role) return message.reply('⚠️ يرجى منشن الرول المطلوبة: `+رول-جماعي @Role`');

            await message.reply('⏳ جاري إعطاء الرول لجميع أعضاء السيرفر...');
            
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
            if (isNaN(time)) return message.reply('⚠️ حدد عدد الثواني.');
            await message.channel.setRateLimitPerUser(time);
            return message.reply(`⏱️ تم ضبط الشات البطيء على **${time}** ثانية.`);
        }

        // ==========================================
        // أمر +help
        // ==========================================
        if (command === 'help') {
            const totalCommandsCount = 42;

            const getEmbed = (page) => {
                if (page === '1') {
                    return new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle('📌 الأوامر العامة والمعلوماتية')
                        .setDescription(`إجمالي الأوامر: **${totalCommandsCount}**\nاختر القسم المناسب من القائمة أدناه:`)
                        .addFields(
                            { name: '**`+status`**', value: 'إحصائيات البوت والسرعة.', inline: false },
                            { name: '**`+afk [السبب]`**', value: 'تحديد حالتك كغائب.', inline: false },
                            { name: '**`+سيرفر`**', value: 'معلومات السيرفر المفصلة.', inline: false },
                            { name: '**`+servericon` / `+serverbanner`**', value: 'عرض صورة وبانر السيرفر.', inline: false },
                            { name: '**`+بروفايل [@العضو]`**', value: 'معلومات العضو وتاريخ الانضمام.', inline: false },
                            { name: '**`+صورة [@العضو]`**', value: 'عرض صورة بروفايل العضو.', inline: false },
                            { name: '**`+رتب`**', value: 'عرض رتب السيرفر.', inline: false },
                            { name: '**`+توب` / `+topactive`**', value: 'عرض الأعضاء الأكثر تفاعلاً.', inline: false },
                            { name: '**`+activity [@العضو]`**', value: 'معرفة حجم نشاطك وتفاعلك.', inline: false },
                            { name: '**`+firstmsg [@العضو]`**', value: 'جلب أول رسالة أرسلها الشخص.', inline: false },
                            { name: '**`+بنغ`**', value: 'معرفة سرعة الاستجابة.', inline: false }
                        );
                } else if (page === '2') {
                    return new EmbedBuilder()
                        .setColor('#E67E22')
                        .setTitle('🎮 الألعاب، الحظ، والتحديات')
                        .addFields(
                            { name: '**`+luck [@العضو]`**', value: 'اختبار نسبة الحظ اليومي.', inline: false },
                            { name: '**`+fortune`**', value: 'توقع عشوائي لمستقبلك.', inline: false },
                            { name: '**`+challenge [@العضو]`**', value: 'بدء تحدي ممتع.', inline: false },
                            { name: '**`+rep [@العضو]` / `+repboard`**', value: 'نظام السمعة ولوحة الشرف.', inline: false }
                        );
                } else if (page === '3') {
                    return new EmbedBuilder()
                        .setColor('#2ECC71')
                        .setTitle('🛡️ الإشراف، إدارة الرومات والأعضاء')
                        .addFields(
                            { name: '**`+استدعاء` أو `+c` [@العضو] [السبب]`**', value: 'استدعاء إداري للعضو في الخاص.', inline: false },
                            { name: '**`+warn [@العضو] [السبب]`**', value: 'تحذير شخص وإرسال التفاصيل بالخاص.', inline: false },
                            { name: '**`+slowmode [الثواني]`**', value: 'ضبط الوضع البطيء للشات.', inline: false },
                            { name: '**`+nick [@العضو] [الاسم]`**', value: 'تغيير نك نيم الشخص.', inline: false },
                            { name: '**`+بان` / `+كيك` / `+فكبان` / `+تايم`**', value: 'أوامر العقوبات والطرد والميوت.', inline: false },
                            { name: '**`+مسح [العدد]`**', value: 'مسح رسائل الشات.', inline: false },
                            { name: '**`+قفل` / `+فتح` / `+اخفاء` / `+اظهار`**', value: 'التحكم بخصائص الرومات.', inline: false },
                            { name: '**`+رول` / `+رول-جماعي`**', value: 'منح الرتب.', inline: false },
                            { name: '**`+مسابقة [الوقت] [الجائزة]`**', value: 'مسابقات تفاعلية بزر.', inline: false },
                            { name: '**`+صرف [المبلغ] [العملة]`**', value: 'تحويل العملات بدقة.', inline: false }
                        );
                } else if (page === '4') {
                    return new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('👑 قائمة الأونر الخاصة (صاحب السيرفر)')
                        .addFields(
                            { name: '**`+طوارئ` / `+فك-طوارئ`**', value: 'قفل أو فتح جميع رومات السيرفر.', inline: false },
                            { name: '**`+ايقاف-السستم` / `+تشغيل-السستم`**', value: 'إيقاف أو تشغيل نظام البوت.', inline: false }
                        );
                }
            };

            const getMenu = (disabled = false) => {
                return new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('help_menu')
                        .setPlaceholder('📂 اضغط هنا لاختيار القسم المطلوب...')
                        .setDisabled(disabled)
                        .addOptions([
                            { label: 'الأوامر العامة والمعلوماتية', value: '1', emoji: '📌' },
                            { label: 'الألعاب، الحظ، والتحديات', value: '2', emoji: '🎲' },
                            { label: 'الإشراف وإدارة الرومات والاستدعاء', value: '3', emoji: '🛡️' },
                            { label: 'قائمة الأونر (صاحب السيرفر)', value: '4', emoji: '👑' }
                        ])
                );
            };

            const initialMsg = await message.reply({ embeds: [getEmbed('1')], components: [getMenu()] });
            const collector = initialMsg.createMessageComponentCollector({ time: 180000 });

            collector.on('collect', async i => {
                try {
                    const selectedValue = i.values[0];

                    if (selectedValue === '4' && i.user.id !== message.guild.ownerId) {
                        return i.reply({ content: '❌ **غير متوفر!** هذه القائمة مخصصة لصاحب السيرفر (الأونر) فقط.', ephemeral: true });
                    }

                    if (i.user.id !== message.author.id) {
                        return i.reply({ content: '❌ لا يمكنك استخدام هذه القائمة.', ephemeral: true });
                    }

                    await i.update({ embeds: [getEmbed(selectedValue)], components: [getMenu()] });
                } catch (err) {
                    console.error('Error in help collector:', err);
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
