import { Client, GatewayIntentBits } from 'discord.js';
import { handleValidateButton, handleRejectButton, handleRejectModal } from './interactions.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once('ready', () => {
  console.log(`✅ Discord bot ready — logged in as ${client.user?.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton()) {
      const { customId } = interaction;
      if (customId.startsWith('validate:')) {
        await handleValidateButton(interaction, customId.slice('validate:'.length));
      } else if (customId.startsWith('reject:')) {
        await handleRejectButton(interaction, customId.slice('reject:'.length));
      }
    } else if (interaction.isModalSubmit()) {
      const { customId } = interaction;
      if (customId.startsWith('reject-modal:')) {
        await handleRejectModal(interaction, customId.slice('reject-modal:'.length));
      }
    }
  } catch (err) {
    console.error('[interactionCreate] Unhandled error:', err);
  }
});

export default client;
