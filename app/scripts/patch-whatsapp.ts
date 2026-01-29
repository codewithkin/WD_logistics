/**
 * Patch script for whatsapp-web.js to fix the markedUnread error
 * This patches the sendSeen function in Utils.js to handle cases where
 * chat.markedUnread is undefined (happens with channels and broadcasts)
 * 
 * GitHub Issue: https://github.com/pedroslopez/whatsapp-web.js/issues/5741
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const utilsPath = join(
  process.cwd(),
  'node_modules',
  'whatsapp-web.js',
  'src',
  'util',
  'Injected',
  'Utils.js'
);

const oldCode = `window.WWebJS.sendSeen = async (chatId) => {
    const chat = await window.WWebJS.getChat(chatId, { getAsModel: false })
    if (chat) {
        window.Store.WAWebStreamModel.Stream.markAvailable()
        await window.Store.SendSeen.sendSeen(chat)
        window.Store.WAWebStreamModel.Stream.markUnavailable()
        return true
    }
    return false
}`;

const newCode = `window.WWebJS.sendSeen = async (chatId) => {
    const chat = await window.WWebJS.getChat(chatId, { getAsModel: false });
    if (!chat) return false;

    const isChannel = window.Store.ChatGetters.getIsNewsletter(chat);
    const isStatus = window.Store.ChatGetters.getIsBroadcast(chat);

    const canUseSendSeen = typeof chat.markedUnread !== 'undefined';

    try {
        window.Store.WAWebStreamModel.Stream.markAvailable();

        if (canUseSendSeen && window.Store.SendSeen.sendSeen && !isChannel && !isStatus) {
            await window.Store.SendSeen.sendSeen(chat);
        } else if (window.Store.SendSeen.markSeen) {
            // fallback aman
            await window.Store.SendSeen.markSeen(chat);
        } else {
            return false;
        }

        return true;
    } catch (err) {
        // fallback terakhir (ANTI CRASH)
        try {
            if (window.Store.SendSeen.markSeen) {
                await window.Store.SendSeen.markSeen(chat);
                return true;
            }
        } catch (_) {}
        return false;
    } finally {
        window.Store.WAWebStreamModel.Stream.markUnavailable();
    }
}`;

async function patchWhatsApp() {
  console.log('🔧 Patching whatsapp-web.js for markedUnread fix...');

  if (!existsSync(utilsPath)) {
    console.log('⚠️  whatsapp-web.js Utils.js not found, skipping patch');
    return;
  }

  try {
    let content = readFileSync(utilsPath, 'utf-8');

    if (content.includes('canUseSendSeen')) {
      console.log('✅ whatsapp-web.js already patched');
      return;
    }

    if (!content.includes(oldCode)) {
      console.log('⚠️  Could not find target code to patch, library may have been updated');
      return;
    }

    content = content.replace(oldCode, newCode);
    writeFileSync(utilsPath, content, 'utf-8');

    console.log('✅ Successfully patched whatsapp-web.js');
  } catch (error) {
    console.error('❌ Failed to patch whatsapp-web.js:', error);
  }
}

patchWhatsApp();
