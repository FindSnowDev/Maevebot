const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('speak')
        .setDescription('Make Maeve say anything you want!')
        .addStringOption(option =>
            option.setName('input')
                .setDescription('The text you want Maeve to say')
                .setRequired(true)
        ),
    async execute(interaction) {
        const userInput = interaction.options.getString('input');
        await interaction.reply({ content: `Maeve says: "${userInput}"`, ephemeral: false });
    },
};