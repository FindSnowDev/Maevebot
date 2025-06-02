require('dotenv').config();

const fs = require('fs');
const path = require('path');

function getCommandFiles(dir) {
    const files = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            files.push(...getCommandFiles(fullPath));
        } else if (item.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = getCommandFiles(commandsPath);

const { REST, Routes } = require('discord.js');
const deployCommands = async () => {
    try {
        const commands = [];

        for (const filePath of commandFiles) {
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                console.log(`Registering command: ${command.data.name} (from ${path.relative(__dirname, filePath)})`);
                commands.push(command.data.toJSON());
            } else {
                console.log(`The command at ${path.relative(__dirname, filePath)} is missing a required "data" or "execute" property.`);
            }
        }

        const rest = new REST().setToken(process.env.BOT_TOKEN);
        console.log(`Started refreshing ${commands.length} application (/) commands.`);
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );
        console.log('Successfully reloaded all commands!')
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
}

const {
    Client,
    GatewayIntentBits,
    Partials,
    Collection,
    ActivityType,
    PresenceUpdateStatus,
    Events
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember
    ]
});

client.commands = new Collection();

for (const filePath of commandFiles) {
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`Loaded command: ${command.data.name} (from ${path.relative(__dirname, filePath)})`);
    } else {
        console.log(`The command at ${path.relative(__dirname, filePath)} is missing a required "data" or "execute" property.`);
    }
}
  
client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    await deployCommands();
    console.log('Commands deployed globally.');

    const statusType = process.env.BOT_STATUS || 'online';
    const activityType = process.env.BOT_ACTIVITY_TYPE || 'WATCHING';
    const activityName = process.env.ACTIVITY_NAME || 'your messages';

    const activityTypeMap = {
        'PLAYING': ActivityType.Playing,
        'WATCHING': ActivityType.Watching,
        'LISTENING': ActivityType.Listening,
        'COMPETING': ActivityType.Competing,
        'STREAMING': ActivityType.Streaming
    };

    const statusMap = {
        'online': PresenceUpdateStatus.Online,
        'idle': PresenceUpdateStatus.Idle,
        'dnd': PresenceUpdateStatus.DoNotDisturb,
        'invisible': PresenceUpdateStatus.Invisible
    };

    client.user.setPresence({
        activities: [{
            name: activityName,
            type: activityTypeMap[activityType] || ActivityType.Watching
        }],
        status: statusMap[statusType] || PresenceUpdateStatus.Online
    });

    console.log(`Bot is set to ${statusType} with activity: ${activityName}`);
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error)
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});

client.login(process.env.BOT_TOKEN)