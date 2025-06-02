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
                .setDescription('Select a category')
                .setRequired(true)
                .addChoices(
                    { name: 'MCU', value: 'mcu' },
                    // Adding more soon :-)
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
            const category = interaction.options.getString('category');
            const movieTitle = interaction.options.getString('movie');

            if (category !== 'mcu') {
                return await interaction.editReply('❌ Only the MCU category is supported right now.');
            }

            // finds the movie in MCU category (case insensitive)
            const movie = await Movie.findOne({
                where: where(
                    fn('lower', col('title')),
                    { [Op.like]: `%${movieTitle.toLowerCase()}%` }
                )
            });

            if (!movie) {
                return await interaction.editReply(`❌ Movie "${movieTitle}" not found in the MCU database.`);
            }

            // checks if the movie is in the user's watched list
            const watchedEntry = await WatchedMovie.findOne({
                where: {
                    userId,
                    movieId: movie.id
                }
            });

            if (!watchedEntry) {
                return await interaction.editReply(`❌ You have not marked **${movie.title}** as watched yet.`);
            }

            // get rid of the watched entry
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

                // Fetch watched movies for this user (and MCU category only)
                const watchedMovies = await WatchedMovie.findAll({
                    where: { userId },
                    include: [{
                        model: Movie,
                        as: 'movie',
                        where: {
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
