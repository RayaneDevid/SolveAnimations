import { Client, GatewayIntentBits } from 'discord.js';
import {
  handleValidateButton,
  handleRejectButton,
  handleRejectModal,
  handleRequeteAcceptButton,
  handleRequeteRefuseButton,
  handleRequeteRefuseModal,
  handleAnimJoinButton,
  handleAnimJoinModal,
} from './interactions.js';
import {
  handleCreateCommand,
  handleModal1Submit,
  handleModal2Submit,
  handleStep2Button,
  handleCancelButton,
} from './commands/animation-create.js';

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
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'animation-create') {
        await handleCreateCommand(interaction);
      }
    } else if (interaction.isButton()) {
      const { customId } = interaction;
      if (customId.startsWith('anim-create-step2:')) {
        await handleStep2Button(interaction, customId.slice('anim-create-step2:'.length));
      } else if (customId.startsWith('anim-create-cancel:')) {
        await handleCancelButton(interaction, customId.slice('anim-create-cancel:'.length));
      } else if (customId.startsWith('validate:')) {
        await handleValidateButton(interaction, customId.slice('validate:'.length));
      } else if (customId.startsWith('reject:')) {
        await handleRejectButton(interaction, customId.slice('reject:'.length));
      } else if (customId.startsWith('requete-accept:')) {
        await handleRequeteAcceptButton(interaction, customId.slice('requete-accept:'.length));
      } else if (customId.startsWith('requete-refuse:')) {
        await handleRequeteRefuseButton(interaction, customId.slice('requete-refuse:'.length));
      } else if (customId.startsWith('anim-join:')) {
        await handleAnimJoinButton(interaction, customId.slice('anim-join:'.length));
      }
    } else if (interaction.isModalSubmit()) {
      const { customId } = interaction;
      if (customId === 'anim-create-1') {
        await handleModal1Submit(interaction);
      } else if (customId === 'anim-create-2') {
        await handleModal2Submit(interaction);
      } else if (customId.startsWith('reject-modal:')) {
        await handleRejectModal(interaction, customId.slice('reject-modal:'.length));
      } else if (customId.startsWith('requete-refuse-modal:')) {
        await handleRequeteRefuseModal(interaction, customId.slice('requete-refuse-modal:'.length));
      } else if (customId.startsWith('anim-join-modal:')) {
        await handleAnimJoinModal(interaction, customId.slice('anim-join-modal:'.length));
      }
    }
  } catch (err) {
    console.error('[interactionCreate] Unhandled error:', err);
  }
});

export default client;
