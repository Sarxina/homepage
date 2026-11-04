// Made-up chatters for the "chat furiously generates" beat. Each one pulls like a real login would
// (their name through the same hash), so a name always gets the same Sarxinas in the same order.
// turnaround_tim559's first pull is the secret back view; he sits early in the list so the secret
// shows up a few seconds into a frenzy.
export const FAKE_CHAT = [
  'overdue_books', 'pityat89', 'elfearenjoyer', 'gachagremlin', 'just1morepull', 'dewey_decimate',
  'shhh_library', 'braidpuller99', 'f2p_forever', 'capsule_cracker', 'lofi_librarian', 'rerollrat',
  'glasses_glint', 'points_goblin', 'ssr_or_bust', 'spinecracker', 'late_fee_larry', 'copium_dealer',
  'whaleofatime', 'bookmark_bandit', 'first_time_chatter', 'inkwell_imp', 'turnaround_tim559', 'tomeraider',
  'salt_mine_ceo', 'moonlit_margins', 'clipthatbro', 'pog_champion_ish', 'archive_rat', 'quietplease_',
  'hydrate_or_die', 'backseat_bard', 'footnote_fan', 'raid_refugee', 'spark_saver', 'gem_hoarder',
  'candlewax_kid', 'emote_only_andy', 'stackofscrolls', 'celestial_clerk', 'vod_watcher', 'redeemer_rae',
  'chatterbox_9000', 'noodle_arm_nia', 'lurker_no7', 'mod_sleeps', 'kekw_enjoyer', 'papercut_paladin',
  'index_card', 'grindset_gary', 'onemorepull_', 'bits_please', 'ad_break_survivor', 'elf_tax',
  'subtember_sam', 'prime_time_pat', 'sock_puppet_sid', 'hat_trick_hal', 'omegaluluu', 'library_ghost_',
  'chibi_collector', 'pity_boy', 'rollformeplz', 'dust_jacket', 'margin_notes', 'paperback_writer',
  'sarxinas_braid', 'bookworm_brigade', 'chronic_rerroller', 'gacha_therapist', 'mom_card_holder', 'banner_skipper',
  'ten_pull_tony', 'soft_pity_sue', 'hard_pity_hank', 'luckless_lou', 'rng_hater', 'seed_scummer',
  'cursed_pull_carl', 'shiny_hunter_kai', 'duplicate_dan', 'card_shark_kyle', 'crit_fail_cass', 'nat20_nora',
  'eepy_reader', 'tea_and_tomes', 'quill_driver', 'binding_agent', 'hardcover_hugo', 'shelf_elf',
  'stamp_card', 'return_slot', 'reading_nook', 'ex_libris_', 'scroll_goblin', 'glasses_on_head',
  'ear_point_enjoyer', 'braid_tug', 'chat_is_this_real', 'w_streamer', 'ratio_robin', 'touch_grass_trevor',
  'mute_button_mia', 'clip_it_chad', 'hype_train_hal', 'emote_spammer', 'type1ifyouagree', 'monkaw_mike',
];

// Readable takes on Twitch's default name colours, for a dark page.
export const CHAT_COLORS = ['#ff6b6b', '#6fa8ff', '#5ed27d', '#ff8f6b', '#c3e35c', '#ff7a45', '#47c99a', '#f2c14e', '#e3925a', '#6fc3c9', '#4fb4ff', '#ff7ac3', '#b48cff', '#3fe0a0', '#ffb347'];

export function colorFor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CHAT_COLORS[h % CHAT_COLORS.length];
}
