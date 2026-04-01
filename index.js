// ===== IMPORTS =====
const { 
    Client, 
    GatewayIntentBits, 
    Partials,
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionsBitField,
    EmbedBuilder,
    WebhookClient,
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');
const fs = require('fs');
const config = require('./config.json');

// ===== CLIENT =====
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// ===== WEBHOOK =====
const webhook = new WebhookClient({ url: config.logWebhookUrl });
const SUPPORT_ROLE_ID = config.supportRoleId;

// ===== DATABASE =====
let ticketsData = {};
let staffStats = {};

if (fs.existsSync('./ticketsData.json')) {
    try { ticketsData = JSON.parse(fs.readFileSync('./ticketsData.json', 'utf8')); } catch { ticketsData = {}; }
}
if (fs.existsSync('./staffStats.json')) {
    try { staffStats = JSON.parse(fs.readFileSync('./staffStats.json', 'utf8')); } catch { staffStats = {}; }
}

function saveData() {
    fs.writeFileSync('./ticketsData.json', JSON.stringify(ticketsData, null, 2));
    fs.writeFileSync('./staffStats.json', JSON.stringify(staffStats, null, 2));
}

// ===== TIME =====
function getPHTime() {
    return new Date().toLocaleString("en-US", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
}

// ===== EMBED =====
function createEmbed(title, description) {
    const safeDescription = description?.trim() || "Nexora Support System Active";
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(safeDescription)
        .setColor('#7F00FF')
        .setFooter({ text: `Nexora Cutie | ${getPHTime()}` });
}

// ===== SLASH COMMANDS =====
const commands = [
    new SlashCommandBuilder()
        .setName('checkstaff')
        .setDescription('Check handled tickets')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Select user')
                .setRequired(false)
        ),
    new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Show server info'),
    new SlashCommandBuilder()
        .setName('ticketpanel')
        .setDescription('Send the main ticket panel')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(config.token);
(async () => {
    try {
        await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
        console.log('✅ Slash commands loaded');
    } catch (e) { console.error("Slash Command Error:", e); }
})();

// ===== READY =====
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    client.user.setActivity('Nexora Support System', { type: 'WATCHING' });
});

// ===== INTERACTIONS =====
client.on('interactionCreate', async (interaction) => {

    // ----- SLASH COMMANDS -----
    if (interaction.isChatInputCommand()) {

        // Check Staff
        if (interaction.commandName === 'checkstaff') {
            const target = interaction.options.getUser('user') || interaction.user;
            const count = staffStats[target.id] || 0;
            const embed = createEmbed('Staff Stats', `${target.tag} handled **${count} tickets**`);
            return interaction.reply({ embeds: [embed] });
        }

        // Server Info
        if (interaction.commandName === 'serverinfo') {
            const g = interaction.guild;
            const embed = createEmbed('Server Info', 
                `**Name:** ${g.name}\n**Members:** ${g.memberCount}\n**Owner:** <@${g.ownerId}>\n**Created:** <t:${Math.floor(g.createdTimestamp/1000)}:R>\n**Channels:** ${g.channels.cache.size}\n**Roles:** ${g.roles.cache.size}`
            );
            return interaction.reply({ embeds: [embed] });
        }

        // Ticket Panel
        if (interaction.commandName === 'ticketpanel') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
                return interaction.reply({ content: "You don't have permission to send the panel.", ephemeral: true });
            }

            const guild = interaction.guild;
            const channel = guild.channels.cache.get(config.panelChannelId);
            if (!channel) return interaction.reply({ content: "Panel channel not found!", ephemeral: true });

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_select')
                    .setPlaceholder('Make a selection...')
                    .addOptions([
                        { 
                            label: 'Staff Application', 
                            value: 'staff', 
                            description: 'Apply for staff', 
                            emoji: { name: 'avviolet', id: '1479087160232775690', animated: false } 
                        },
                        { 
                            label: 'Booster Perks', 
                            value: 'booster', 
                            description: 'Check booster perks', 
                            emoji: { name: 'nxboosterbbg', id: '1468825504474857584', animated: false } 
                        },
                        { 
                            label: 'Partnership', 
                            value: 'partnership', 
                            description: 'Create a partnership request', 
                            emoji: { name: 'purplepixies', id: '1461909146856063197', animated: true } 
                        },
                        { 
                            label: 'Any Concerns', 
                            value: 'concerns', 
                            description: 'Report any issue', 
                            emoji: { name: 'purpleblackblade', id: '1461909038882361466', animated: false } 
                        }
                    ])
            );

            const embed = createEmbed('Nexora Support Panel', 'Need help? Click the menu below to create a ticket.');
            await channel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: `Panel sent in <#${channel.id}>`, ephemeral: true });
        }
    }

    // ----- DROPDOWN (TICKET CREATION) -----
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        await interaction.deferReply({ ephemeral: true });
        const user = interaction.user;
        const guild = interaction.guild;
        const choice = interaction.values[0];

        const safeName = user.username.replace(/[^a-z0-9]/gi, '').toLowerCase();
        const name = `ticket-${choice}-${safeName}`;
        if (guild.channels.cache.find(c => c.name === name)) return interaction.editReply({ content: 'You already have a ticket.' });

        try {
            const ticket = await guild.channels.create({
                name: name,
                type: ChannelType.GuildText,
                parent: config.ticketCategoryId,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] },
                    { id: SUPPORT_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                ]
            });

            ticketsData[ticket.id] = { openedBy: user.tag, openTime: getPHTime(), claimedBy: null, closedBy: null, reason: null };
            saveData();

            let embed;
            switch(choice) {
                case 'staff':
                    embed = createEmbed('Staff Application', 'Apply for staff here. Follow the requirements and wait for staff response.');
                    break;
                case 'booster':
                    embed = createEmbed('Booster Perks', `**1 Boost**\n• <@&1469317331560960225>\n• <@&1459261199572140226> role\n• Custom role\n\n**2 Boost**\n• <@&1464335555939794985>\n• <@&1476195524016345191>\n• Access to <#1471117742349488260>\n• All perks included`);
                    break;
                case 'partnership':
                    embed = createEmbed('Partnership Request', 'Create your partnership request here.');
                    break;
                case 'concerns':
                    embed = createEmbed('Any Concerns', 'Submit your concerns or report any issues here.');
                    break;
                default:
                    embed = createEmbed('Support Ticket', 'Your ticket has been successfully submitted. Our team will review your request shortly.');
                    break;
            }

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim').setLabel('Claim').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('close').setLabel('Close').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('close_reason').setLabel('Close with Reason').setStyle(ButtonStyle.Secondary)
            );

            await ticket.send({ content: `<@&${SUPPORT_ROLE_ID}>`, embeds: [embed], components: [buttons] });
            await interaction.editReply({ content: `Ticket created: ${ticket}` });

        } catch (e) {
            console.error(e);
            await interaction.editReply({ content: 'Failed to create ticket. Check bot permissions.' });
        }
    }

    // ----- BUTTONS -----
    if (interaction.isButton()) {
        const ch = interaction.channel;
        const user = interaction.user;

        //  ADMIN ONLY
        if (!interaction.member.roles.cache.has(config.adminRoleId)) {
            return interaction.reply({ content: "You cannot interact with this button.", ephemeral: true });
        }

        if (!ticketsData[ch.id]) {
            ticketsData[ch.id] = { openedBy: 'Unknown', openTime: 'N/A', claimedBy: null, closedBy: null, reason: null };
        }
        const data = ticketsData[ch.id];

        // CLAIM / UNCLAIM
        if (interaction.customId === 'claim') {
            if (!data.claimedBy) {
                data.claimedBy = user.id;
                saveData();
                const row = ActionRowBuilder.from(interaction.message.components[0]);
                row.components[0].setLabel('Unclaim').setStyle(ButtonStyle.Secondary);
                return interaction.update({ content: `Your ticket will be handled by <@${user.id}>`, components: [row] });
            } else {
                if (data.claimedBy !== user.id) return interaction.reply({ content: "This ticket is already claimed by someone else!", ephemeral: true });
                data.claimedBy = null;
                saveData();
                const row = ActionRowBuilder.from(interaction.message.components[0]);
                row.components[0].setLabel('Claim').setStyle(ButtonStyle.Primary);
                return interaction.update({ content: `Ticket is now unclaimed.`, components: [row] });
            }
        }

        // CLOSE CONFIRMATION
        if (interaction.customId === 'close') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('yes_close').setLabel('Yes').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('no_close').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
            );
            return interaction.reply({ content: 'Confirm close?', components: [row], ephemeral: true });
        }

        // YES CLOSE
        if (interaction.customId === 'yes_close') {
            data.closedBy = user.tag;
            if (data.claimedBy) staffStats[data.claimedBy] = (staffStats[data.claimedBy] || 0) + 1;

            const embed = createEmbed('Ticket Transcript', `Transcript for ${ch.name}`).addFields(
                { name: 'Ticket ID', value: ch.id, inline: true },
                { name: 'Opened by', value: data.openedBy || 'Unknown', inline: true },
                { name: 'Open time', value: data.openTime || 'N/A', inline: true },
                { name: 'Claimed by', value: data.claimedBy ? `<@${data.claimedBy}>` : 'N/A', inline: true },
                { name: 'Closed by', value: data.closedBy, inline: true },
                { name: 'Reason', value: data.reason || 'N/A' }
            );

            try {
                await webhook.send({ embeds: [embed] });
                delete ticketsData[ch.id];
                saveData();
                await interaction.update({ content: '✅ Closing ticket...', components: [] });
                setTimeout(() => ch.delete().catch(() => {}), 3000);
            } catch (e) { console.error("Close Error:", e); }
        }

        if (interaction.customId === 'no_close') return interaction.update({ content: 'Cancelled', components: [] });

        // CLOSE WITH REASON
        if (interaction.customId === 'close_reason') {
            await interaction.reply({ content: 'Type the reason in chat now.', ephemeral: true });
            const collector = ch.createMessageCollector({ filter: m => m.author.id === user.id, max: 1, time: 30000 });
            collector.on('collect', m => {
                data.reason = m.content;
                saveData();
                m.delete().catch(() => {});
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('yes_close').setLabel('Confirm Close').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('no_close').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
                );
                interaction.followUp({ content: `Close with reason: "**${m.content}**"?`, components: [row], ephemeral: true });
            });
        }
    }
});

// ===== GLOBAL ERROR HANDLER =====
process.on('unhandledRejection', e => console.log("Promise Error:", e));
process.on('uncaughtException', e => console.log("Crash Error:", e));

client.login(config.token);