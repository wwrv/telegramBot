const TelegramApi = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const steamApiKey = process.env.STEAM_API_KEY;

const bot = new TelegramApi(token, { polling: true });

async function fetchPlayerData(steamId) {
  try {
    const response = await axios.get(
      `http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${steamApiKey}&steamids=${steamId}`
    );
    return response.data.response.players[0];
  } catch (error) {
    console.error('Steam API Error:', error);
    throw error;
  }
}

async function checkPlayerBans(steamId) {
  try {
    const response = await axios.get(
      `http://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${steamApiKey}&steamids=${steamId}`
    );
    return response.data.players[0];
  } catch (error) {
    console.error('Steam API Error:', error);
    throw error;
  }
}

async function resolveVanityUrl(vanityUrl) {
  try {
    const response = await axios.get(
      `http://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${steamApiKey}&vanityurl=${vanityUrl}`
    );
    const data = response.data.response;
    if (data.success === 1) {
      return data.steamid;
    } else {
      throw new Error('Vanity URL could not be resolved');
    }
  } catch (error) {
    console.error('Steam API Error:', error);
    throw error;
  }
}

async function start() {
  let isSearching = false;

  bot.on('message', async (msg) => {
    const text = msg.text;
    const chatId = msg.chat.id;

    if (text === '/start') {
      await bot.sendMessage(
        chatId,
        `Добро пожаловать в Steam Find Bot.\n` +
        `Чтобы использовать бота, напишите /search и в следующем сообщении укажите ссылку на аккаунт, который вы хотите проверить.\n` +
        `Приятного пользования.`
      );
    }

    if (text === '/info') {
      await bot.sendMessage(
        chatId,
        `Привет, ${msg.from.first_name} (${msg.from.username}).\n` + 
        'Чтобы использовать бота, напишите /start'
      );
    }

    if (text === '/search') {
      isSearching = true;
      await bot.sendMessage(chatId, 'Пожалуйста, введите ссылку:');
    }

    if (isSearching && text.startsWith('http')) {
      isSearching = false;
      let steamId;

      if (text.includes('/id/')) {
        steamId = text.split('/id/')[1].split('/')[0];
        try {
          steamId = await resolveVanityUrl(steamId);
        } catch (error) {
          await bot.sendMessage(chatId, 'Ссылка не корректна. Пожалуйста, проверьте ссылку и попробуйте снова.');
          return;
        }
      } else if (text.includes('/profiles/')) {
        steamId = text.split('/profiles/')[1].split('/')[0];
      } else {
        await bot.sendMessage(chatId, 'Введите корректную ссылку, пожалуйста');
        return;
      }

      try {
        if (/^\d{17}$/.test(steamId)) {
          const bans = await checkPlayerBans(steamId);
          const playerData = await fetchPlayerData(steamId);

          const gameBanStatus = bans.DaysSinceLastBan ? 'Yes ✅' : 'No ❌';
          const tradeBanStatus = bans.EconomyBan !== 'none' ? 'Yes ✅' : 'No ❌';
          const communityBanStatus = bans.CommunityBanned ? 'Yes ✅' : 'No ❌';

          await bot.sendMessage(
            chatId,
            `Nick Name: ${playerData.personaname}\nSteam ID 64: ${steamId}\nVAC Ban: ${gameBanStatus}\nTrade Ban: ${tradeBanStatus}\nCommunity Ban: ${communityBanStatus}`
          );
        } else {
          await bot.sendMessage(chatId, 'Введите корректную ссылку, пожалуйста');
        }
      } catch (error) {
        await bot.sendMessage(
          chatId,
          'Ошибка при получении информации с Steam API: ' + error.message
        );
      }
    }
  });
}

start();
