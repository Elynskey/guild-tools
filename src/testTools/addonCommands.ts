/**
 * The test addon's slash commands, for the cheat-sheet on the Loot Logger Monitor. The addon's own
 * `/gtloottest help` is the source of truth; addonCommands.test.ts fails if a command here is missing from
 * scripts/test-addon/test-extras.lua (or the other way round), so the two can't drift apart.
 */
export interface AddonCommand {
  /** What you type after /gtloottest. */
  command: string;
  /** What it does, in a sentence. */
  does: string;
  /** When to reach for it. */
  when: string;
}

export const ADDON_COMMANDS: AddonCommand[] = [
  { command: 'help', does: 'Lists every test command in chat.', when: 'Any time you forget one.' },
  { command: 'checklist', does: 'Shows or hides the on-screen test checklist. It ticks itself where it can; click the (click) rows yourself.', when: 'Start of a session. Add "text" to print it in chat, or "reset" to clear the ticks.' },
  { command: 'selftest', does: 'Pushes a fake Need win through the real capture code and says PASS or FAIL, and why.', when: 'After logging in and after a /reload: proves capture works in the zone you are standing in.' },
  { command: 'debug', does: 'Zone, difficulty, group size, how loot is handed out (calls out personal loot), chat and combat logging state. Saved to the addon data file.', when: 'Entering any new kind of content, or when nothing gets captured.' },
  { command: 'lootlines', does: 'The raw loot text the game handed the addon, and whether each line would be captured. Add a number for more lines.', when: 'After a drop the Monitor did not show: it says whether the game sent it at all.' },
  { command: 'last', does: 'The last Need wins the addon captured, and where each came from (zone, dungeon or raid, difficulty).', when: 'Right after a roll, to see what was recorded.' },
  { command: 'logmark', does: 'Writes a marker into the chat log so you can search WoWChatLog.txt for it.', when: 'To prove the game is writing the chat log at all.' },
  { command: 'track', does: 'Sets what is tracked: "all" (every kind of content, the default here) or "strict" (the real addon\'s rules).', when: 'Comparing what the real addon would have recorded.' },
  { command: 'check', does: 'Ticks a manual checklist item by name: marker, live_app, reload, discord or verify.', when: 'If you would rather type than click.' },
  { command: 'on', does: 'Turns recording on (same as the real addon; also off, scan, chatlog).', when: 'If recording got switched off.' },
];
