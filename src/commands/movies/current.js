const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Movie = require('../../models/movie')
const WatchedMovie = require('../../models/watched-movie');
const UserProgress = require('../../models/user-progress');
const TMDBService = require('../../utils/tmdb-service');
const tmdbService = new TMDBService();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('current')
        .setDescription('View your current MCU movie with detailed information'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const userId = interaction.user.id;

            // Get user's current movie
            const userProgress = await UserProgress.findOne({
                where: { userId },
                include: [{
                    model: Movie,
                    as: 'currentMovie'
                }]
            });

            if (!userProgress || !userProgress.currentMovieId) {
                return await interaction.editReply({
                    content: '❌ You haven\'t set a current movie yet! Use `/setcurrent <movie>` to set one.'
                });
            }

            const movie = await Movie.findByPk(userProgress.currentMovieId);
            
            if (!movie) {
                return await interaction.editReply({
                    content: '❌ Your current movie was not found in the database. Please set a new current movie.'
                });
            }

            // Check if user has already watched this movie
            const watchedMovie = await WatchedMovie.findOne({
                where: {
                    userId: userId,
                    movieId: movie.id
                }
            });

            // Get movie details from TMDB
            let tmdbDetails = null;
            try {
                tmdbDetails = await tmdbService.getMovieDetails(movie.tmdbId);
            } catch (error) {
                console.error(`Failed to fetch TMDB details for ${movie.title}:`, error);
            }

            const embed = createCurrentMovieEmbed(movie, tmdbDetails, watchedMovie);
            const buttons = createActionButtons(watchedMovie);

            const response = await interaction.editReply({
                embeds: [embed],
                components: [buttons]
            });

            // Set up collector for button interactions
            const collector = response.createMessageComponentCollector({
                time: 300000 // 5 minutes
            });

            collector.on('collect', async (buttonInteraction) => {
                if (buttonInteraction.user.id !== interaction.user.id) {
                    return await buttonInteraction.reply({
                        content: '❌ You can only interact with your own movie!',
                        ephemeral: true
                    });
                }

                const action = buttonInteraction.customId;

                if (action === 'mark_watched') {
                    // Mark as watched
                    await WatchedMovie.create({
                        userId: userId,
                        movieId: movie.id
                    });

                    const updatedEmbed = createCurrentMovieEmbed(movie, tmdbDetails, { userId, movieId: movie.id });
                    const updatedButtons = createActionButtons({ userId, movieId: movie.id });

                    await buttonInteraction.update({
                        embeds: [updatedEmbed],
                        components: [updatedButtons]
                    });

                } else if (action === 'mark_unwatched') {
                    // Mark as unwatched
                    await WatchedMovie.destroy({
                        where: {
                            userId: userId,
                            movieId: movie.id
                        }
                    });

                    const updatedEmbed = createCurrentMovieEmbed(movie, tmdbDetails, null);
                    const updatedButtons = createActionButtons(null);

                    await buttonInteraction.update({
                        embeds: [updatedEmbed],
                        components: [updatedButtons]
                    });

                } else if (action === 'view_mcu_list') {
                    // Redirect to MCU list
                    await buttonInteraction.reply({
                        content: '📋 Use the `/mcu` command to view the full chronological list!',
                        ephemeral: true
                    });
                }
            });

            collector.on('end', async () => {
                try {
                    await interaction.editReply({
                        components: []
                    });
                } catch (error) {
                    // Ignore errors when removing components
                }
            });

        } catch (error) {
            console.error('Error in current command:', error);
            const errorMessage = '❌ An error occurred while fetching your current movie.';
            
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    }
};

function createCurrentMovieEmbed(movie, tmdbDetails, watchedMovie) {
    const isWatched = !!watchedMovie;
    
    const embed = new EmbedBuilder()
        .setTitle(`🎬 ${movie.title}`)
        .setColor(isWatched ? '#00FF00' : '#E23636')
        .addFields(
            {
                name: '📅 Release Year',
                value: movie.releaseYear.toString(),
                inline: true
            },
            {
                name: '📍 MCU Order',
                value: `#${movie.order}`,
                inline: true
            },
            {
                name: '✅ Status',
                value: isWatched ? 'Watched' : 'Not Watched',
                inline: true
            }
        );

    if (tmdbDetails) {
        if (tmdbDetails.overview) {
            embed.setDescription(tmdbDetails.overview);
        }
        
        if (tmdbDetails.posterPath) {
            embed.setThumbnail(tmdbDetails.posterPath);
        }

        if (tmdbDetails.backdropPath) {
            embed.setImage(tmdbDetails.backdropPath);
        }

        // Add additional fields from TMDB
        if (tmdbDetails.rating) {
            embed.addFields({
                name: '⭐ Rating',
                value: `${tmdbDetails.rating.toFixed(1)}/10 (${tmdbDetails.voteCount.toLocaleString()} votes)`,
                inline: true
            });
        }

        if (tmdbDetails.runtime) {
            const hours = Math.floor(tmdbDetails.runtime / 60);
            const minutes = tmdbDetails.runtime % 60;
            embed.addFields({
                name: '⏱️ Runtime',
                value: `${hours}h ${minutes}m`,
                inline: true
            });
        }

        if (tmdbDetails.genres && tmdbDetails.genres.length > 0) {
            embed.addFields({
                name: '🎭 Genres',
                value: tmdbDetails.genres.join(', '),
                inline: false
            });
        }
    } else if (movie.description) {
        embed.setDescription(movie.description);
    }

    embed.setFooter({
        text: isWatched ? 
            'You\'ve watched this movie! ✅' : 
            'Mark as watched when you finish watching!'
    });

    return embed;
}

function createActionButtons(watchedMovie) {
    const row = new ActionRowBuilder();
    
    if (watchedMovie) {
        // Movie is watched - show "Mark as Unwatched" button
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('mark_unwatched')
                .setLabel('Mark as Unwatched')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌')
        );
    } else {
        // Movie is not watched - show "Mark as Watched" button
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('mark_watched')
                .setLabel('Mark as Watched')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
        );
    }

    // Always show "View MCU List" button
    row.addComponents(
        new ButtonBuilder()
            .setCustomId('view_mcu_list')
            .setLabel('View MCU List')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📋')
    );

    return row;
}