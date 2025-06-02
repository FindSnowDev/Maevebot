const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const WatchedMovie = require('../../models/watched-movie');
const UserProgress = require('../../models/user-progress');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resetlist')
        .setDescription('Reset your MCU watch progress (removes all watched movies and current movie)'),

    async execute(interaction) {
        try {
            const userId = interaction.user.id;

            // Check if user has any progress to reset
            const watchedMovies = await WatchedMovie.findAll({
                where: { userId }
            });

            const userProgress = await UserProgress.findOne({
                where: { userId }
            });

            if (watchedMovies.length === 0 && !userProgress?.currentMovieId) {
                return await interaction.reply({
                    content: '❌ You don\'t have any MCU progress to reset!',
                    ephemeral: true
                });
            }

            // Create confirmation embed
            const confirmEmbed = new EmbedBuilder()
                .setTitle('⚠️ Reset MCU Progress')
                .setDescription('Are you sure you want to reset your MCU progress?\n\n**This will:**\n• Remove all watched movies\n• Clear your current movie\n• Reset your progress to 0%\n\n**This action cannot be undone!**')
                .setColor('#FF6B6B')
                .addFields({
                    name: '📊 Current Progress',
                    value: `• ${watchedMovies.length} movies watched\n• Current movie: ${userProgress?.currentMovieId ? 'Set' : 'None'}`,
                    inline: false
                });

            const confirmButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('confirm_reset')
                        .setLabel('Yes, Reset Everything')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('⚠️'),
                    new ButtonBuilder()
                        .setCustomId('cancel_reset')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('❌')
                );

            const response = await interaction.reply({
                embeds: [confirmEmbed],
                components: [confirmButtons],
                ephemeral: true
            });

            // Set up collector for confirmation
            const collector = response.createMessageComponentCollector({
                time: 30000 // 30 seconds
            });

            collector.on('collect', async (buttonInteraction) => {
                if (buttonInteraction.user.id !== interaction.user.id) {
                    return await buttonInteraction.reply({
                        content: '❌ You can only reset your own progress!',
                        ephemeral: true
                    });
                }

                if (buttonInteraction.customId === 'confirm_reset') {
                    try {
                        // Delete all watched movies for this user
                        const deletedWatched = await WatchedMovie.destroy({
                            where: { userId }
                        });

                        // Reset current movie
                        const updatedProgress = await UserProgress.update(
                            { currentMovieId: null },
                            { where: { userId } }
                        );

                        const successEmbed = new EmbedBuilder()
                            .setTitle('✅ Progress Reset Complete!')
                            .setDescription('Your MCU progress has been successfully reset.')
                            .setColor('#00FF00')
                            .addFields({
                                name: '📊 Reset Summary',
                                value: `• ${deletedWatched} watched movies removed\n• Current movie cleared\n• Progress reset to 0%`,
                                inline: false
                            })
                            .setFooter({
                                text: 'Use /setcurrent to set a new current movie and start your MCU journey!'
                            });

                        await buttonInteraction.update({
                            embeds: [successEmbed],
                            components: []
                        });

                    } catch (error) {
                        console.error('Error resetting user progress:', error);
                        await buttonInteraction.update({
                            content: '❌ An error occurred while resetting your progress. Please try again.',
                            embeds: [],
                            components: []
                        });
                    }

                } else if (buttonInteraction.customId === 'cancel_reset') {
                    const cancelEmbed = new EmbedBuilder()
                        .setTitle('❌ Reset Cancelled')
                        .setDescription('Your MCU progress has not been changed.')
                        .setColor('#6C757D');

                    await buttonInteraction.update({
                        embeds: [cancelEmbed],
                        components: []
                    });
                }
            });

            collector.on('end', async (collected) => {
                if (collected.size === 0) {
                    try {
                        const timeoutEmbed = new EmbedBuilder()
                            .setTitle('⏰ Reset Timeout')
                            .setDescription('Reset confirmation timed out. Your progress remains unchanged.')
                            .setColor('#6C757D');

                        await interaction.editReply({
                            embeds: [timeoutEmbed],
                            components: []
                        });
                    } catch (error) {
                        // Ignore errors when updating timed out interactions
                    }
                }
            });

        } catch (error) {
            console.error('Error in resetlist command:', error);
            await interaction.reply({
                content: '❌ An error occurred while processing the reset request.',
                ephemeral: true
            });
        }
    }
};