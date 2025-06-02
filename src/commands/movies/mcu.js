const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Movie = require('../../models/movie');
const WatchedMovie = require('../../models/watched-movie');
const UserProgress = require('../../models/user-progress');

const MOVIES_PER_PAGE = 10;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mcu')
        .setDescription('Get a list of MCU movies'),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            const userId = interaction.user.id;

            // Fetch all movies in chronological order
            const movies = await Movie.findAll({ order: [['order', 'ASC']] });

            // Get watched movies
            const watchedMovies = await WatchedMovie.findAll({ where: { userId } });
            const watchedMovieIds = watchedMovies.map(wm => wm.movieId);

            // Get current movie progress
            const userProgress = await UserProgress.findOne({ where: { userId } });

            if (movies.length === 0) {
                return await interaction.editReply({ content: '❌ No MCU movies found in the database.' });
            }

            const page = 0;
            const embed = createMCUEmbed(movies, watchedMovieIds, userProgress?.currentMovieId, page);
            const buttons = createNavigationButtons(page, movies.length);

            const response = await interaction.editReply({
                embeds: [embed],
                components: buttons
            });

            if (buttons.length > 0) {
                const collector = response.createMessageComponentCollector({ time: 300000 });

                collector.on('collect', async (buttonInteraction) => {
                    if (buttonInteraction.user.id !== interaction.user.id) {
                        return buttonInteraction.reply({
                            content: '❌ You can only interact with your own MCU list!',
                            ephemeral: true
                        });
                    }

                    const [action, newPageStr] = buttonInteraction.customId.split('_');
                    const pageNumber = parseInt(newPageStr);
                    if (isNaN(pageNumber)) return;

                    const newEmbed = createMCUEmbed(movies, watchedMovieIds, userProgress?.currentMovieId, pageNumber);
                    const newButtons = createNavigationButtons(pageNumber, movies.length);

                    await buttonInteraction.update({
                        embeds: [newEmbed],
                        components: newButtons
                    });
                });

                collector.on('end', async () => {
                    try {
                        await interaction.editReply({ components: [] });
                    } catch (error) {
                        // console.error('Error clearing components:', error);
                    }
                });
            }
        } catch (error) {
            console.error('Error in MCU command:', error);
            const errorMessage = '❌ An error occurred while fetching the MCU movie list.';
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    }
};

function createMCUEmbed(movies, watchedMovieIds, currentMovieId, page) {
    const startIndex = page * MOVIES_PER_PAGE;
    const endIndex = Math.min(startIndex + MOVIES_PER_PAGE, movies.length);
    const pageMovies = movies.slice(startIndex, endIndex);

    const embed = new EmbedBuilder()
        .setTitle('🎬 MCU Movies - Chronological Order')
        .setColor('#E23636')
        .setFooter({
            text: `Page ${page + 1} of ${Math.ceil(movies.length / MOVIES_PER_PAGE)} • ${movies.length} total movies`
        });

    let description = '';

    for (const movie of pageMovies) {
        const isWatched = watchedMovieIds.includes(movie.id);
        const isCurrent = currentMovieId === movie.id;

        let movieLine = `**${movie.order}.** `;

        if (isWatched) {
            movieLine += `~~${movie.title}~~ ✅`;
        } else {
            movieLine += movie.title;
        }

        if (isCurrent) {
            movieLine += ` 🎯 *(Current)*`;
        }

        movieLine += ` *(${movie.releaseYear})*\n`;
        description += movieLine;
    }

    embed.setDescription(description);

    const watchedCount = watchedMovieIds.length;
    const totalCount = movies.length;
    const progressPercentage = Math.round((watchedCount / totalCount) * 100);

    embed.addFields({
        name: '📊 Progress',
        value: `${watchedCount}/${totalCount} movies watched (${progressPercentage}%)\n${'█'.repeat(Math.floor(progressPercentage / 5))}${'░'.repeat(20 - Math.floor(progressPercentage / 5))} ${progressPercentage}%`,
        inline: false
    });

    return embed;
}

function createNavigationButtons(currentPage, totalMovies) {
    const totalPages = Math.ceil(totalMovies / MOVIES_PER_PAGE);
    if (totalPages <= 1) return [];

    const row = new ActionRowBuilder();

    if (currentPage > 0) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('first_0')
                .setLabel('⏮️')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    if (currentPage > 0) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`prev_${currentPage - 1}`)
                .setLabel('◀️')
                .setStyle(ButtonStyle.Primary)
        );
    }

    row.addComponents(
        new ButtonBuilder()
            .setCustomId('page_info')
            .setLabel(`${currentPage + 1}/${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
    );

    if (currentPage < totalPages - 1) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`next_${currentPage + 1}`)
                .setLabel('▶️')
                .setStyle(ButtonStyle.Primary)
        );
    }

    return [row];
}
