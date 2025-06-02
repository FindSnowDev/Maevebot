const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Op, fn, col, where } = require('sequelize');
const Movie = require('../../models/movie');
const UserProgress = require('../../models/user-progress');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setcurrent')
        .setDescription('Set your current MCU movie')
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
            const movieTitle = interaction.options.getString('movie');

            // Case-insensitive search workaround for SQLite:
            const movie = await Movie.findOne({
                where: where(
                    fn('lower', col('title')),
                    {
                        [Op.like]: `%${movieTitle.toLowerCase()}%`
                    }
                )
            });

            if (!movie) {
                return await interaction.editReply({
                    content: `❌ Movie "${movieTitle}" not found in the MCU database. Use the autocomplete feature or check the /mcu command for available movies.`
                });
            }

            // Update or create user progress
            const [userProgress, created] = await UserProgress.upsert({
                userId: userId,
                currentMovieId: movie.id
            });

            const embed = new EmbedBuilder()
                .setTitle('🎯 Current Movie Set!')
                .setDescription(`Your current MCU movie has been set to:\n\n**${movie.title}** (${movie.releaseYear})`)
                .setColor('#00FF00')
                .addFields(
                    {
                        name: '📍 Chronological Position',
                        value: `#${movie.order} in the MCU timeline`,
                        inline: true
                    }
                )
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
            const focusedValue = interaction.options.getFocused();
            
            // Get all movies and filter by the focused value
            const movies = await Movie.findAll({
                order: [['order', 'ASC']]
            });

            const filtered = movies
                .filter(movie => 
                    movie.title.toLowerCase().includes(focusedValue.toLowerCase())
                )
                .slice(0, 25); // Discord limits to 25 choices

            const choices = filtered.map(movie => ({
                name: `${movie.order}. ${movie.title} (${movie.releaseYear})`,
                value: movie.title
            }));

            await interaction.respond(choices);
        } catch (error) {
            console.error('Error in setcurrent autocomplete:', error);
            await interaction.respond([]);
        }
    }
};
