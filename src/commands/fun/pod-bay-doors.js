const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pod-bay-doors')
        .setDescription('Open the pod bay doors, MAEVE.'),
    async execute(interaction) {
        await interaction.reply(`I'm sorry, ${interaction.user.toString()}, I'm afraid I can't do that.`);
    },
}