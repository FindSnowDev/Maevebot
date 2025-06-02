const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Op, fn, col, where } = require('sequelize');
const Movie = require('../../models/movie');
const UserProgress = require('../../models/user-progress');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setcurrent')
        .setDescription('Set your current movie')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Select a category/franchise')
                .setRequired(true)
                .addChoices(
                    { name: 'MCU', value: 'mcu' },
                    { name: 'Final Destination', value: 'final-destination' }
                    // More Franchises coming bra
                )
        )
        .addStringOption(option =>
            option.setName('movie')
                .setDescription('The movie title to set as current')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const userId = interaction.user.id;
            const category = interaction.options.getString('category');
            const movieTitle = interaction.options.getString('movie');

            let movie = await Movie.findOne({
                where: {
                    franchise: category,
                    [Op.and]: where(
                        fn('lower', col('title')),
                        movieTitle.toLowerCase()
                    )
                }
            });

            if (!movie) {
                movie = await Movie.findOne({
                    where: {
                        franchise: category,
                        [Op.and]: where(
                            fn('lower', col('title')),
                            { [Op.like]: `%${movieTitle.toLowerCase()}%` }
                        )
                    }
                });
            }

            if (!movie) {
                return await interaction.editReply({
                    content: `❌ Movie "${movieTitle}" not found in the ${category} database. Use autocomplete or check the available movies.`
                });
            }

            await UserProgress.upsert({
                userId: userId,
                currentMovieId: movie.id
            });

            const embed = new EmbedBuilder()
                .setTitle('🎯 Current Movie Set!')
                .setDescription(`Your current movie has been set to:\n\n**${movie.title}** (${movie.releaseYear})`)
                .setColor('#00FF00')
                .addFields({
                    name: '📍 Chronological Position',
                    value: `#${movie.order} in the ${category} timeline`,
                    inline: true
                })
                .setFooter({
                    text: 'Use /current to view detailed information about this movie!'
                });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in setcurrent command:', error);
            const errorMessage = '❌ An error occurred while setting your current movie.';

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

                const movies = await Movie.findAll({
                    where: {
                        franchise: category,
                        title: { [Op.like]: `%${input}%` }
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
            console.error('Error in setcurrent autocomplete:', error);
            await interaction.respond([]);
        }
    }
};
