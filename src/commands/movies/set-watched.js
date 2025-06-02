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
                .setDescription('Select a category')
                .setRequired(true)
                .addChoices(
                    { name: 'MCU', value: 'mcu' },
                    // gonna add moreee..
                ))
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

            if (category !== 'mcu') {
                return await interaction.editReply('❌ Only the MCU category is supported right now.');
            }

            // find the movie in MCU category (case insensitive)
            const movie = await Movie.findOne({
                where: where(
                    fn('lower', col('title')),
                    { [Op.like]: `%${movieTitle.toLowerCase()}%` }
                )
            });

            if (!movie) {
                return await interaction.editReply(`❌ Movie "${movieTitle}" not found in the MCU database.`);
            }

            // Check if user already marked this movie as watched
            const alreadyWatched = await WatchedMovie.findOne({
                where: {
                    userId,
                    movieId: movie.id
                }
            });

            if (alreadyWatched) {
                return await interaction.editReply(`✅ You have already marked **${movie.title}** as watched.`);
            }

            // marks movie as watched
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

                // for now, only MCU supported
                const movies = await Movie.findAll({
                    order: [['order', 'ASC']]
                });

                const filtered = movies
                    .filter(m => m.title.toLowerCase().includes(input.toLowerCase()))
                    .slice(0, 25);

                const choices = filtered.map(m => ({
                    name: `${m.order}. ${m.title} (${m.releaseYear})`,
                    value: m.title
                }));

                await interaction.respond(choices);
            }
        } catch (error) {
            console.error('Error in setwatched autocomplete:', error);
            await interaction.respond([]);
        }
    }
};
