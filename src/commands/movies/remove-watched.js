const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Op, fn, col, where } = require('sequelize');
const Movie = require('../../models/movie');
const WatchedMovie = require('../../models/watched-movie');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removewatched')
        .setDescription('Remove a movie from your watched list')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Select a category/franchise')
                .setRequired(true)
                .addChoices(
                    { name: 'MCU', value: 'mcu' },
                    { name: 'Final Destination', value: 'final-destination' },
                    // Add more categories/franchises here or load dynamically when bot starts
                ))
        .addStringOption(option =>
            option.setName('movie')
                .setDescription('Select the movie you want to remove from watched list')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const userId = interaction.user.id;
            const category = interaction.options.getString('category');  // franchise/category name
            const movieTitle = interaction.options.getString('movie');

            // Find movie by title AND franchise/category, case insensitive
            const movie = await Movie.findOne({
                where: {
                    franchise: category,
                    [Op.and]: where(
                        fn('lower', col('title')),
                        { [Op.like]: `%${movieTitle.toLowerCase()}%` }
                    )
                }
            });

            if (!movie) {
                return await interaction.editReply(`❌ Movie "${movieTitle}" not found in the ${category} database.`);
            }

            const watchedEntry = await WatchedMovie.findOne({
                where: {
                    userId,
                    movieId: movie.id
                }
            });

            if (!watchedEntry) {
                return await interaction.editReply(`❌ You have not marked **${movie.title}** as watched yet.`);
            }

            await watchedEntry.destroy();

            const embed = new EmbedBuilder()
                .setTitle('🗑️ Removed from Watched List')
                .setDescription(`You have removed **${movie.title}** (${movie.releaseYear}) from your watched movies.`)
                .setColor('#FF0000');

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in removewatched command:', error);
            const errorMessage = '❌ An error occurred while removing the movie from watched list.';
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },

    async autocomplete(interaction) {
        try {
            const focusedOption = interaction.options.getFocused(true);

            if (focusedOption.name === 'movie') {
                const input = focusedOption.value;
                const userId = interaction.user.id;
                const category = interaction.options.getString('category');

                // Fetch watched movies filtered by user AND franchise/category AND partial title match
                const watchedMovies = await WatchedMovie.findAll({
                    where: { userId },
                    include: [{
                        model: Movie,
                        as: 'movie',
                        where: {
                            franchise: category,
                            title: {
                                [Op.like]: `%${input}%`
                            }
                        }
                    }],
                    limit: 25
                });

                const choices = watchedMovies.map(wm => ({
                    name: `${wm.movie.order}. ${wm.movie.title} (${wm.movie.releaseYear})`,
                    value: wm.movie.title
                }));

                await interaction.respond(choices);
            }
        } catch (error) {
            console.error('Error in removewatched autocomplete:', error);
            await interaction.respond([]);
        }
    }
};
