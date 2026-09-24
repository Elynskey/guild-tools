const { app, BrowserWindow, ipcMain, shell, clipboard, dialog, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { getProxyConfig } = require('./dataSources/proxyConfig.cjs');
const proxyClient = require('./dataSources/proxyClient.cjs');

// Without this, Electron derives the app name (and therefore the userData path)
// from package.json's "name" field ("raider-status"), not the "Guild Tools"
// branding an officer would actually look for on disk. A test-mode build gets its own
// distinct name -- and therefore its own userData directory (addon install path, local
// .env, everything) -- entirely separate from a real install on the same machine, on
// top of Raid Signups/GOTM already being data-isolated server-side (see proxyClient.cjs).
const isTestModeBuild = getProxyConfig().testMode;
app.setName(isTestModeBuild ? 'Guild Tools (Test)' : 'Guild Tools');

// .env location: prefer the writable userData dir (the app's own install directory
// becomes a read-only asar archive once packaged, so that's the only place a
// packaged install can persist an officer-edited .env). Falls back to the
// repo-relative path so `npm run electron:dev` keeps working unchanged.
const userDataEnvPath = path.join(app.getPath('userData'), '.env');
const devEnvPath = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: fs.existsSync(userDataEnvPath) ? userDataEnvPath : devEnvPath });

const { fetchRoster } = require('./dataSources/fetchRoster.cjs');
const { fetchProfessions, getCachedProfessions } = require('./dataSources/fetchProfessions.cjs');
const { fetchRecipeCatalogue, getCachedRecipeCatalogue } = require('./dataSources/fetchRecipeCatalogue.cjs');
const { fetchRaidNightsList, fetchPullFeedback } = require('./dataSources/fetchPullFeedback.cjs');
const { fetchNightSnapshotForCode } = require('./dataSources/fetchNightSnapshot.cjs');
const { checkForUpdate } = require('./dataSources/updateCheck.cjs');
const { listCraftRequests, addCraftRequest, fulfillCraftRequest, removeCraftRequest } = require('./dataSources/fetchCraftRequests.cjs');
const { signIn: bnetSignIn } = require('./dataSources/bnetAuth.cjs');
const { signIn: discordSignIn } = require('./dataSources/discordAuth.cjs');
const { loadSession, saveSession, clearSession } = require('./dataSources/authSession.cjs');
const { getWowPathConfig, setWowPath, installAddon, setCharacterName, getAddonVersionInfo, getLootRecords, withAddonFlavor, getAddonCalendar } = require('./dataSources/lootLog.cjs');
const { getChatLogStatus } = require('./dataSources/lootChatTail.cjs');
const { getCombatLogStatus, recentKills } = require('./dataSources/lootCombatLog.cjs');
const pipelineLog = require('./dataSources/pipelineLog.cjs');
const { getGuildKeyers, lookupCharacter } = require('./dataSources/mplusGuild.cjs');
const { recentLootLines, recentEncounters } = require('./dataSources/rawFeeds.cjs');
const { isLoggingOn } = require('./dataSources/chatLogState.cjs');
const { fetchLootLog, syncAddonDataIfChanged, addManualLootRecord, updateLootRecord, removeLootRecord, removeLootTrade, deleteLootNight, syncChatTailCapture } = require('./dataSources/fetchLootLog.cjs');

// In-memory only (not persisted) -- this session's record of whether live loot capture
// is actually running, for Loot History's status card. Reset to zeros on every app
// launch, which is exactly what "this session" should mean here.
const appStartedAt = Date.now();
const chatTailStatus = { lastPollAt: null, lastStatus: null, capturedThisSession: 0, lastCaptureAt: null };
const { getItemIconUrls } = require('./dataSources/fetchItemIcons.cjs');
const { fetchBossLootTable } = require('./dataSources/fetchBossLootTable.cjs');
const { postLootNightToDiscord } = require('./dataSources/postLootNight.cjs');
const { submitFeedback } = require('./dataSources/fetchFeedback.cjs');
const { trackAnalyticsEvent, listAnalyticsEvents } = require('./dataSources/fetchAnalytics.cjs');
const { getSettings, saveSettings } = require('./dataSources/fetchSettings.cjs');
const {
  listRaidSignups,
  getRaidSignup,
  createRaidSignup,
  setRaidSignupAssignments,
  finalizeRaidSignup,
} = require('./dataSources/fetchRaidSignups.cjs');
const {
  listGotmPosts,
  getGotmPost,
  getCurrentGotmPost,
  createGotmPost,
  remindGotmVoters,
  closeGotmVoting,
  chooseGotmTieWinner,
  announceGotmWinner,
} = require('./dataSources/fetchGotm.cjs');

// Sign-in state is remembered for 14 days (see authSession.cjs) so an officer isn't
// re-proving guild membership through a browser every single launch -- restored here at
// startup, refreshed on every sign-in, cleared on explicit sign-out. Either provider
// satisfies the gate; whichever was used last is what's stored -- Discord additionally
// proves CRD Discord-server membership (see discordAuth.cjs), Battle.net only proves
// account ownership (unchanged from its original scope).
let authState = loadSession();
ipcMain.handle('auth:getState', async () => authState);
ipcMain.handle('auth:signIn', async () => {
  const user = await bnetSignIn();
  authState = { provider: 'battlenet', displayName: user.battletag, id: user.id };
  saveSession(authState);
  track('sign_in', null);
  return authState;
});
ipcMain.handle('auth:signInDiscord', async () => {
  authState = await discordSignIn();
  saveSession(authState);
  track('sign_in', null);
  return authState;
});
ipcMain.handle('auth:signOut', async () => {
  authState = null;
  clearSession();
});

// App usage log (screen visits, key officer actions, which version each officer is
// running) -- fired from inside this file for every curated action below rather than
// from each screen's own hook, since main.cjs already centralizes every IPC handler in
// one place and already has displayName/appVersion/mode in scope, same as
// feedback:send already does. Failures are swallowed (console-logged only) -- analytics
// must never surface an error to the officer or block the real action it's attached to.
function track(event, screen, meta) {
  trackAnalyticsEvent(
    { event, screen, meta: meta ?? null, displayName: authState?.displayName ?? null, appVersion: app.getVersion() },
    isTestModeBuild ? 'test' : 'prod',
  ).catch((err) => console.error('[analytics] track failed (non-fatal):', err));
}
ipcMain.handle('analytics:track', async (_event, event, screen, meta) => {
  track(event, screen, meta);
  return { ok: true };
});
// Analytics is a TEST-BUILD tool now: a normal install can't list anything. From a test build, `which` picks
// what to look at -- 'prod' (default: how officers are actually using the real app) or 'test' (test builds).
ipcMain.handle('analytics:list', async (_event, which) => {
  if (!isTestModeBuild) return [];
  return listAnalyticsEvents(which === 'test' ? 'test' : 'prod');
});

// The loot diary is also written to a file in test builds, so a whole play session can be read afterwards (or
// from outside the app while you play): <userData>\pipeline-events.jsonl, one JSON event per line.
if (isTestModeBuild) pipelineLog.enablePersistence(path.join(app.getPath('userData'), 'pipeline-events.jsonl'));

// M+ Comp's pool (test builds): guild members with keys this season, and any character an
// officer types in. Through the proxy (which holds the shared archive) when there is one.
function mplusGuildConfig() {
  return { name: process.env.GUILD_NAME, realm: process.env.GUILD_REALM, region: process.env.GUILD_REGION || 'us' };
}
ipcMain.handle('testTools:mplusGuild', async () => {
  if (!isTestModeBuild) return null;
  if (proxyClient.isAvailable()) return proxyClient.fetchMplusGuild();
  const guild = mplusGuildConfig();
  return guild.name && guild.realm ? getGuildKeyers(guild) : null;
});
ipcMain.handle('testTools:mplusCharacter', async (_event, name, realm) => {
  if (!isTestModeBuild) return null;
  if (typeof name !== 'string' || !name.trim()) return null;
  const guild = mplusGuildConfig();
  const r = typeof realm === 'string' && realm.trim() ? realm.trim() : guild.realm;
  if (proxyClient.isAvailable()) return proxyClient.lookupMplusCharacter(name.trim(), r);
  return lookupCharacter(guild.region, r, name.trim());
});

// The in-game calendar the test addon saved (/gtloottest calendar, or automatically at login):
// who's coming to which event, for M+ Comp's event picker. Test addon only, so test builds only.
ipcMain.handle('testTools:calendar', async () => {
  if (!isTestModeBuild) return null;
  return getAddonCalendar();
});

// The unprocessed truth behind the pipeline: what WoW actually wrote (loot lines, boss pulls).
ipcMain.handle('testTools:rawFeeds', async () => {
  if (!isTestModeBuild) return null;
  return { lootLines: recentLootLines(30), pulls: recentEncounters(20) };
});

// Sends one synthetic win (fake winner, fake boss, Heroic, marked live so it counts as confirmed) through the same
// path a real one takes -- app -> proxy -> TEST store -> auto-post to the TEST Discord channel -- and reports what
// happened at each step, then removes the record. Needs no WoW at all, so "is the server side working?" is one click.
ipcMain.handle('testTools:injectWin', async () => {
  if (!isTestModeBuild) return { ok: false, error: 'Only available in a test build.' };
  if (!proxyClient.isAvailable()) return { ok: false, error: 'No proxy configured.' };
  const time = Math.floor(Date.now() / 1000);
  const winner = `PipelineTest${String(time).slice(-4)}`;
  const record = { itemId: 25, itemLink: '[Worn Shortsword]', winner, boss: 'Pipeline Test Boss', slot: 'One-Hand', time, difficulty: 'Heroic', source: 'live' };
  const steps = [];
  try {
    pipelineLog.record('store-sync', `Sent a synthetic win (${winner}) through the pipeline`, { synthetic: true });
    await proxyClient.syncLootRecords([record], [], []);
    steps.push('sent to the proxy');
    let found = null;
    const startedAt = Date.now();
    while (Date.now() - startedAt < 15000) {
      const shared = await proxyClient.getSharedLootRecords();
      found = shared.records.find((r) => r.winner === winner) ?? null;
      if (found?.discordPostedAt) break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    const result = { ok: true, winner, stored: !!found, posted: !!found?.discordPostedAt, steps };
    if (found) {
      try {
        await proxyClient.removeLootRecord(found.id);
        steps.push('test record removed again');
      } catch {
        steps.push('could not remove the test record (harmless: it is in the test store)');
      }
    }
    pipelineLog.record('store-sync', `Synthetic win: ${result.stored ? 'reached the store' : 'NEVER reached the store'}, ${result.posted ? 'posted to Discord' : 'not posted to Discord'}`, { synthetic: true, ...result });
    return result;
  } catch (err) {
    return { ok: false, error: err.message || String(err), steps };
  }
});

// Empties the TEST loot store (never the real one -- this build talks to the test store only) so a run can start clean.
ipcMain.handle('testTools:clearTestLoot', async () => {
  if (!isTestModeBuild) return { ok: false, error: 'Only available in a test build.' };
  try {
    const result = await deleteLootNight(0, 9_999_999_999);
    return { ok: true, removed: result?.removed ?? null };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

// The REAL guild's shared loot store, read-only, for the Monitor's Live view. Never writes, and unlike getLootLog it does
// not offer this PC's addon data to the store.
ipcMain.handle('testTools:liveLootStore', async () => {
  if (!isTestModeBuild) return null;
  if (!proxyClient.isAvailable()) return null;
  const shared = await proxyClient.getSharedLootRecords('prod');
  return { records: shared.records ?? [] };
});

// Loot Logger Monitor (test builds only): one read-only snapshot of every stage of the loot pipeline on this PC.
// `which` 'live' reads the REAL addon's saved data and version; this app's own diary and session (which are about the
// test pipeline) are left empty there.
ipcMain.handle('testTools:lootMonitor', async (_event, which) => {
  if (!isTestModeBuild) return null;
  const live = which === 'live';
  return live ? withAddonFlavor('real', () => buildMonitorSnapshot(true)) : buildMonitorSnapshot(false);
});

function buildMonitorSnapshot(live) {
  const now = Date.now();
  const addonData = getLootRecords();
  const winTimes = addonData.records.map((r) => r.time).filter((t) => Number.isFinite(t));
  return {
    now,
    wow: getWowPathConfig(),
    addon: getAddonVersionInfo(),
    chatLog: getChatLogStatus(),
    combatLog: getCombatLogStatus(),
    session: live ? { lastPollAt: null, lastStatus: null, capturedThisSession: 0, lastCaptureAt: null } : { ...chatTailStatus },
    sessionStartedAt: appStartedAt,
    kills: recentKills(now, 6 * 60 * 60 * 1000).slice(0, 25),
    addonData: {
      status: addonData.status,
      wins: addonData.records.length,
      losses: addonData.needLosses.length,
      trades: addonData.trades.length,
      lastWinAt: winTimes.length ? Math.max(...winTimes) : null,
      recentWins: [...addonData.records].sort((a, b) => b.time - a.time).slice(0, 12).map((r) => ({ winner: r.winner, itemLink: r.itemLink, boss: r.boss ?? null, zone: r.zone ?? null, contentType: r.contentType ?? null, difficulty: r.difficulty ?? null, time: r.time })),
    },
    events: live ? [] : pipelineLog.recent(150),
  };
}

ipcMain.handle('roster:fetch', async () => fetchRoster());
ipcMain.handle('professions:getCached', async () => getCachedProfessions());
ipcMain.handle('professions:fetch', async (event) => fetchProfessions((progress) => event.sender.send('professions:progress', progress)));
ipcMain.handle('recipeCatalogue:getCached', async () => getCachedRecipeCatalogue());
ipcMain.handle('recipeCatalogue:fetch', async () => fetchRecipeCatalogue());
ipcMain.handle('raidNights:list', async () => fetchRaidNightsList());
ipcMain.handle('pullFeedback:fetch', async (_event, code) => fetchPullFeedback(code));
ipcMain.handle('nightSnapshot:fetch', async (_event, code) => fetchNightSnapshotForCode(code));
ipcMain.handle('warcraftlogs:openReport', async (_event, code) => {
  if (typeof code === 'string' && /^[A-Za-z0-9]+$/.test(code)) shell.openExternal(`https://www.warcraftlogs.com/reports/${code}`);
});
ipcMain.handle('update:check', async () => checkForUpdate(app.getVersion()));
ipcMain.handle('update:openReleasePage', async (_event, url) => {
  if (typeof url === 'string' && url.startsWith('https://github.com/')) shell.openExternal(url);
});

// One-click update: the proxy holds the only credential (GITHUB_TOKEN) that can read a
// release asset from this private repo, so the app asks it to fetch on its behalf rather
// than talking to GitHub directly. Downloads the installer, launches it (shell.openPath
// runs an .exe on Windows, prompting UAC same as double-clicking it), then quits so the
// installer's overwrite of this app's own files doesn't conflict with it still running --
// the same close-then-install sequence used for every manual release this session.
ipcMain.handle('update:downloadAndInstall', async () => {
  const { baseUrl, apiKey } = getProxyConfig();
  if (!baseUrl || !apiKey) throw new Error('Update download requires the API proxy to be configured.');

  // Re-check the manifest right before downloading (rather than trusting a value the
  // renderer might pass in) to get the expected hash -- the manifest itself comes from
  // gist.githubusercontent.com over HTTPS, so this is a real, independently-sourced
  // integrity check on the installer the proxy hands back, not just a formality.
  const manifest = await checkForUpdate(app.getVersion());
  if (!manifest?.sha256) throw new Error('Could not verify this update -- no checksum is published for it yet. Try again shortly, or download it manually from the release page.');

  const res = await fetch(`${baseUrl}/update/download`, { headers: { 'X-Proxy-Key': apiKey } });
  if (!res.ok) throw new Error(`Update download failed: ${res.status} ${res.statusText}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const actualHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const expectedHash = manifest.sha256.trim().toLowerCase();
  const isValid = actualHash.length === expectedHash.length
    && crypto.timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedHash));
  if (!isValid) throw new Error('Downloaded installer failed checksum verification -- refusing to run it. Please try again, and let an officer know if this keeps happening.');

  // Fired here, before shell.openPath/the quit delay below, so the network call has
  // time to actually complete rather than racing app.quit().
  track('update_downloaded', null);

  const dest = path.join(app.getPath('temp'), 'Guild-Tools-Setup-latest.exe');
  fs.writeFileSync(dest, buffer);

  const openErr = await shell.openPath(dest);
  if (openErr) throw new Error(`Could not launch the installer: ${openErr}`);

  setTimeout(() => app.quit(), 800);
  return { ok: true };
});

// Fixed to this app's own Discord application -- not user/client-supplied, so there's no
// open-redirect concern in exposing it over IPC. Guild scope only (no applications.commands
// -- this bot uses buttons on messages it posts, not slash commands); permissions=83968 is
// Send Messages + Embed Links + Read Message History. Adding the bot to a server needs
// "Manage Server," so this is usually something to hand to the GM rather than click here.
const DISCORD_BOT_INVITE_URL = 'https://discord.com/api/oauth2/authorize?client_id=1543017047884304474&permissions=83968&scope=bot';
ipcMain.handle('discordBot:getInviteUrl', async () => DISCORD_BOT_INVITE_URL);
ipcMain.handle('discordBot:openInvite', async () => {
  shell.openExternal(DISCORD_BOT_INVITE_URL);
});
ipcMain.handle('clipboard:write', async (_event, text) => {
  if (typeof text === 'string') clipboard.writeText(text);
});
ipcMain.handle('craftRequests:list', async () => listCraftRequests());
ipcMain.handle('craftRequests:add', async (_event, requester, profession, description) => {
  const result = await addCraftRequest(requester, profession, description);
  track('craft_request_added', 'Professions');
  return result;
});
ipcMain.handle('craftRequests:fulfill', async (_event, id, fulfilledBy) => {
  const result = await fulfillCraftRequest(id, fulfilledBy);
  track('craft_request_fulfilled', 'Professions');
  return result;
});
ipcMain.handle('app:isTestMode', async () => isTestModeBuild);
ipcMain.handle('feedback:send', async (_event, { message, screen, sender }) => {
  const result = await submitFeedback({ message, screen, sender, appVersion: app.getVersion(), mode: isTestModeBuild ? 'test' : 'prod' });
  track('feedback_sent', screen);
  return result;
});
ipcMain.handle('craftRequests:remove', async (_event, id) => removeCraftRequest(id));
ipcMain.handle('lootLog:get', async () => fetchLootLog());
ipcMain.handle('lootLog:addManual', async (_event, record) => {
  const result = await addManualLootRecord(record);
  track('loot_manual_added', 'Loot History');
  return result;
});
ipcMain.handle('lootLog:update', async (_event, id, patch) => updateLootRecord(id, patch));
ipcMain.handle('lootLog:remove', async (_event, id) => removeLootRecord(id));
ipcMain.handle('lootLog:removeTrade', async (_event, id) => removeLootTrade(id));
ipcMain.handle('lootLog:deleteNight', async (_event, startTime, endTime) => deleteLootNight(startTime, endTime));
ipcMain.handle('itemIcons:get', async (_event, itemIds) => getItemIconUrls(itemIds));
ipcMain.handle('bossLootTable:get', async () => fetchBossLootTable());
ipcMain.handle('lootLog:postNightToDiscord', async (_event, messages) => {
  const result = await postLootNightToDiscord(messages);
  track('loot_night_posted', 'Loot History');
  return result;
});
ipcMain.handle('lootLog:getWowPath', async () => getWowPathConfig());
ipcMain.handle('lootLog:setWowPath', async (_event, wowPath) => {
  setWowPath(wowPath);
  return getWowPathConfig();
});
ipcMain.handle('lootLog:setCharacterName', async (_event, name) => {
  setCharacterName(name);
  return getWowPathConfig();
});
ipcMain.handle('lootLog:getAddonVersion', async () => getAddonVersionInfo());
ipcMain.handle('lootLog:getChatTailStatus', async () => ({ ...chatTailStatus, chatLog: getChatLogStatus(), combatLog: getCombatLogStatus() }));
ipcMain.handle('lootLog:getCaptureHeartbeats', async () => {
  if (!proxyClient.isAvailable()) return { heartbeats: [] };
  try {
    return await proxyClient.getLootCaptureHeartbeats();
  } catch (err) {
    console.error('[lootCaptureHeartbeats] Fetch failed:', err);
    return { heartbeats: [] };
  }
});
ipcMain.handle('lootLog:pickFolder', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'], title: 'Select your World of Warcraft folder (the one containing "_retail_")' });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});
ipcMain.handle('settings:get', async () => getSettings());
ipcMain.handle('settings:save', async (_event, settings) => {
  const result = await saveSettings(settings);
  track('settings_saved', 'Settings');
  return result;
});
ipcMain.handle('raidSignups:list', async () => listRaidSignups());
ipcMain.handle('raidSignups:get', async (_event, id) => getRaidSignup(id));
ipcMain.handle('raidSignups:create', async (_event, raidName, teamType, signupText, channelId) => {
  const result = await createRaidSignup(raidName, teamType, signupText, channelId);
  track('raid_signup_created', 'Raid Signups');
  return result;
});
ipcMain.handle('raidSignups:setAssignments', async (_event, id, assignments) => {
  const result = await setRaidSignupAssignments(id, assignments);
  track('raid_signup_assignment_set', 'Raid Signups');
  return result;
});
ipcMain.handle('raidSignups:finalize', async (_event, id) => {
  const result = await finalizeRaidSignup(id);
  track('raid_signup_finalized', 'Raid Signups');
  return result;
});
ipcMain.handle('gotm:list', async () => listGotmPosts());
ipcMain.handle('gotm:get', async (_event, id) => getGotmPost(id));
ipcMain.handle('gotm:getCurrent', async () => getCurrentGotmPost());
ipcMain.handle('gotm:create', async (_event, openedBy, introText) => {
  const result = await createGotmPost(openedBy, introText);
  track('gotm_created', 'Guildie of the Month');
  return result;
});
ipcMain.handle('gotm:remind', async (_event, id, reminderText) => {
  const result = await remindGotmVoters(id, reminderText);
  track('gotm_reminder_sent', 'Guildie of the Month');
  return result;
});
ipcMain.handle('gotm:close', async (_event, id) => {
  // A tie is left for an officer to break (see gotm:tiebreak), not drawn at random.
  const result = await closeGotmVoting(id, true);
  track('gotm_closed', 'Guildie of the Month');
  return result;
});
ipcMain.handle('gotm:tiebreak', async (_event, id, nomineeId) => {
  const result = await chooseGotmTieWinner(id, nomineeId, authState?.displayName ?? null);
  track('gotm_tie_broken', 'Guildie of the Month');
  return result;
});
ipcMain.handle('gotm:announce', async (_event, id, winnerAnnounceText) => {
  const result = await announceGotmWinner(id, winnerAnnounceText);
  track('gotm_announced', 'Guildie of the Month');
  return result;
});
ipcMain.handle('lootLog:installAddon', async () => {
  try {
    const dest = installAddon();
    track('addon_installed', 'Loot History');
    return { ok: true, dest };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    backgroundColor: '#12100c',
    autoHideMenuBar: true,
    title: 'Guild Tools',
    icon: path.join(__dirname, '..', 'build-resources', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  const devServerUrl = process.env.ELECTRON_START_URL;
  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // Production only -- dev mode loads Vite's own server (HMR client, etc.) which has
  // different script/style needs and already runs on the developer's own trusted machine.
  // Fonts come from Google Fonts (design-system/tokens/fonts.css), item icons from
  // Blizzard's render CDN (fetchItemIcons.cjs) -- the renderer only ever talks to those two
  // third parties directly (everything else goes through the IPC bridge to this process),
  // so connect-src stays 'self'. session.defaultSession is only available once the app is
  // ready, so this has to live in here rather than at module scope.
  if (!process.env.ELECTRON_START_URL) {
    const CSP = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https://*.worldofwarcraft.com",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; ');

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      if (details.resourceType !== 'mainFrame') return callback({ cancel: false });
      callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [CSP] } });
    });
  }

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Live loot capture: tails WoW's chat log (see lootChatTail.cjs) so a Need win shows
  // up without the officer having to /reload -- the addon's SavedVariables read (which
  // DOES have real boss/slot data, but only flushes to disk on reload/logout) remains
  // the authoritative source and reconciles these on whatever reload cadence actually
  // happens. Runs immediately once, then every 10s; a stat()-only check on ticks with
  // nothing new keeps this cheap for the rest of the app's lifetime.
  //
  // chatTailStatus feeds Loot History's live-capture status card (lootLog:getChatTailStatus
  // above) -- the whole point of that card is to make "is this actually working right
  // now" observable from inside the app, after this exact mechanism silently captured
  // nothing for a full raid night with no error anywhere pointing at why.
  //
  // Also reports a heartbeat to the proxy (when configured) so an officer can see
  // whether ANYONE's Guild Tools app is actively watching a live chat log right now --
  // a single officer's own local status only answers "am I logging," not "is the raid
  // covered at all." Fire-and-forget: a failed heartbeat just means this officer drops
  // out of everyone else's list for a beat, never worth surfacing as an error here.
  const runChatTailPoll = () => {
    syncChatTailCapture()
      .then((result) => {
        chatTailStatus.lastPollAt = Date.now();
        chatTailStatus.lastStatus = result.status;
        if (result.added > 0) {
          chatTailStatus.capturedThisSession += result.added;
          chatTailStatus.lastCaptureAt = Date.now();
        }
      })
      .catch((err) => {
        console.error('[lootChatTail] Poll failed:', err);
        chatTailStatus.lastPollAt = Date.now();
        chatTailStatus.lastStatus = 'error';
      })
      // After the chat log, so a flush that lands both at once (a /reload) is seen by the chat tail first and then
      // reconciled with the addon's own records.
      .then(() => syncAddonDataIfChanged())
      .catch((err) => console.error('[lootAddonSync] Sync failed:', err));

    if (proxyClient.isAvailable() && authState?.displayName) {
      const chatLog = getChatLogStatus();
      // "Logging is on" for the raid-wide coverage: recently written OR the game says it is on (WoW buffers the file, so a
      // quiet file is not evidence of off). The size still goes along so the proxy can tell when a write really lands.
      proxyClient.sendLootCaptureHeartbeat(authState.displayName, isLoggingOn(chatLog.state), chatLog.sizeBytes).catch(() => {});
    }
  };
  runChatTailPoll();
  const chatTailInterval = setInterval(runChatTailPoll, 10_000);
  app.on('will-quit', () => clearInterval(chatTailInterval));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
