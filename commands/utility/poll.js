const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a poll for members to vote on')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('The poll question')
                .setRequired(true)
                .setMaxLength(300))
        .addStringOption(option =>
            option.setName('options')
                .setDescription('Poll options separated by commas (2-10 options)')
                .setRequired(true)
                .setMaxLength(1024))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Duration in hours (1-336, default: 24)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(336)) // 2 weeks max (Discord's limit)
        .addBooleanOption(option =>
            option.setName('multiple')
                .setDescription('Allow multiple votes per person? (default: false)')
                .setRequired(false)),
    
    async execute(interaction) {
        const question = interaction.options.getString('question');
        const optionsString = interaction.options.getString('options');
        const duration = interaction.options.getInteger('duration') || 24;
        const allowMultiple = interaction.options.getBoolean('multiple') || false;
        
        // Parse options
        const options = optionsString.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);
        
        // Validation
        if (options.length < 2) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('❌ Invalid Options')
                .setDescription('You must provide at least 2 options.')
                .addFields({
                    name: '💡 Example',
                    value: '`/poll question:"Pizza or Pasta?" options:"Pizza, Pasta"`'
                })
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
        
        if (options.length > 10) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('❌ Too Many Options')
                .setDescription('You can only have up to 10 options per poll.')
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
        
        // Check option length (Discord limit is 55 characters per option)
        const invalidOptions = options.filter(opt => opt.length > 55);
        if (invalidOptions.length > 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('❌ Option Too Long')
                .setDescription('Each poll option must be 55 characters or less.')
                .addFields({
                    name: '📝 Problematic Options',
                    value: invalidOptions.map(opt => `• ${opt.substring(0, 50)}... (${opt.length} chars)`).join('\n')
                })
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
        
        try {
            // Calculate end time
            const durationHours = duration;
            const endsAt = new Date(Date.now() + (durationHours * 60 * 60 * 1000));
            
            // Create poll message with Discord's native poll
            const pollMessage = await interaction.channel.send({
                poll: {
                    question: {
                        text: question
                    },
                    answers: options.map(opt => ({ text: opt })),
                    duration: durationHours,
                    allowMultiselect: allowMultiple,
                    layoutType: 1 // Default layout
                }
            });
            
            // Save poll data for tracking
            const dataDir = path.join(__dirname, '../../data');
            const pollsPath = path.join(dataDir, 'polls.json');
            
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            
            let pollsConfig = {};
            if (fs.existsSync(pollsPath)) {
                pollsConfig = JSON.parse(fs.readFileSync(pollsPath, 'utf8'));
            }
            
            if (!pollsConfig[interaction.guildId]) {
                pollsConfig[interaction.guildId] = {
                    polls: [],
                    counter: 0
                };
            }
            
            const guildConfig = pollsConfig[interaction.guildId];
            guildConfig.counter++;
            const pollId = guildConfig.counter;
            
            // Store poll metadata
            const pollData = {
                id: pollId,
                messageId: pollMessage.id,
                channelId: interaction.channelId,
                question: question,
                options: options,
                allowMultiple: allowMultiple,
                createdBy: interaction.user.id,
                createdAt: Date.now(),
                endsAt: endsAt.getTime(),
                duration: durationHours
            };
            
            guildConfig.polls.push(pollData);
            fs.writeFileSync(pollsPath, JSON.stringify(pollsConfig, null, 2));
            
            // Send confirmation to user
            const confirmEmbed = new EmbedBuilder()
                .setColor('#6C5CE7')
                .setTitle('✅ Poll Created Successfully')
                .setDescription(`Your poll has been posted in ${interaction.channel}`)
                .addFields(
                    { name: '📊 Question', value: question, inline: false },
                    { name: '🔢 Options', value: `${options.length} options`, inline: true },
                    { name: '⏰ Duration', value: `${durationHours} hour${durationHours !== 1 ? 's' : ''}`, inline: true },
                    { name: '🗳️ Type', value: allowMultiple ? 'Multiple Choice' : 'Single Choice', inline: true },
                    { name: '📅 Ends', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
                    { name: '🆔 Poll ID', value: `#${pollId}`, inline: true }
                )
                .setFooter({ text: 'Midnight Bot • Native Discord Polls' })
                .setTimestamp();
            
            await interaction.reply({ embeds: [confirmEmbed], ephemeral: true });
            
            console.log(`[POLL] ${interaction.user.tag} created native poll #${pollId} with ${options.length} options (${durationHours}h, ${allowMultiple ? 'multi' : 'single'}-select)`);
            
        } catch (error) {
            console.error('[POLL] Error creating poll:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#2D1B69')
                .setTitle('❌ Poll Creation Failed')
                .setDescription('An error occurred while creating the poll. Please try again.')
                .addFields({
                    name: '🔍 Possible Issues',
                    value: '• Check that all options are under 55 characters\n• Ensure question is under 300 characters\n• Verify bot has permissions to send messages'
                })
                .setFooter({ text: 'Midnight Bot' })
                .setTimestamp();
            
            // Handle the reply based on whether we already replied
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },
};
