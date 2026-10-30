// One list for the home page, its FAQ data for search engines, and llms-full.txt.
export const faq: [string, string][] = [
  ["How do I dictate on a Mac with Heyra?", "Hold fn in any app, talk, and let go. The words are typed where your cursor is. If there's nowhere to type, Heyra keeps the take on a card for you to copy."],
  ["Does Heyra need the internet?", "Once, to download a speech model (300 to 490 MB). After that it works with no network at all."],
  ["How fast is it?", "Heyra writes while you talk, so the wait after you let go stays around half a second, however long you spoke."],
  ["Which voice models can I use?", "Bark 3.0 Clean for English that leaves out the ums, Fluid Speech Mini for every word, and Parakeet v3 for 25 languages. You can also use your own model. The Bench page compares them."],
  ["Which Macs does it run on?", "Macs with Apple Silicon (M1 or later) on macOS 13 or later."],
  ["Which languages does it understand?", "English with any model. Pick Parakeet v3 for 24 other European languages, including French, German, Spanish and Italian; it works out which one you're speaking."],
  ["How is it different from the dictation built into macOS?", "Heyra works in any app by holding one key, uses the open speech model you pick, keeps a history you can copy from, and has a dictionary for the words it gets wrong. And it's open source."],
  ["Is it really free?", "Yes. It's MIT licensed, with no account and no paid tier."],
  ["Does it work on Windows or Linux?", "Not yet. A Windows version is planned."],
  ["What happens to my voice in the demo on this page?", "The demo sends your clip to this server, which writes it down in memory and doesn't keep the audio. The Mac app sends nothing."],
];
