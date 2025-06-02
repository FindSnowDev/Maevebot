const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Op, fn, col, where } = require('sequelize');
const Movie = require('../../models/movie');
const WatchedMovie = require('../../models/watched-movie');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setwatched')
        .setDescription('Mark a movie as watched')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Select a category/franchise')
                .setRequired(true)
                .addChoices(
                    { name: 'MCU', value: 'mcu' },
                    { name: 'Final Destination', value: 'final-destination' },
                    // adding more franchises gonna copy this line
                )
        )
        .addStringOption(option =>
            option.setName('movie')
                .setDescription('Select the movie you watched')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const userId = interaction.user.id;
            const category = interaction.options.getString('category');
            const movieTitle = interaction.options.getString('movie');

            // Find the movie by title and franchise/category (case insensitive)
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

            // Check if already marked as watched
            const alreadyWatched = await WatchedMovie.findOne({
                where: {
                    userId,
                    movieId: movie.id
                }
            });

            if (alreadyWatched) {
                return await interaction.editReply(`✅ You have already marked **${movie.title}** as watched.`);
            }

            // Mark as watched
            await WatchedMovie.create({
                userId,
                movieId: movie.id
            });

            const embed = new EmbedBuilder()
                .setTitle('✅ Movie Marked as Watched!')
                .setDescription(`You have marked **${movie.title}** (${movie.releaseYear}) as watched.`)
                .setColor('#00FF00');

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in setwatched command:', error);
            const errorMessage = '❌ An error occurred while marking the movie as watched.';
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
                const category = interaction.options.getString('category');

                if (!category) {
                    return await interaction.respond([]);
                }

                // Fetch movies filtered by category and input
                const movies = await Movie.findAll({
                    where: {
                        franchise: category,
                        title: {
                            [Op.like]: `%${input}%`
                        }
                    },
                    order: [['order', 'ASC']],
                    limit: 25
                });

                const choices = movies.map(movie => ({
                    name: `${movie.order}. ${movie.title} (${movie.releaseYear})`,
                    value: movie.title
                }));

                await interaction.respond(choices);
            }
        } catch (error) {
            console.error('Error in setwatched autocomplete:', error);
            await interaction.respond([]);
        }
    }
};
