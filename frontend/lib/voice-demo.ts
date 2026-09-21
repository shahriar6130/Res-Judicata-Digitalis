/* ------------------------------------------------------------------ *
 *  Mock voice data for the citizen complaint wizard.
 *  Realistic Bangla citizen names, mobile numbers, and complaint
 *  descriptions that the prototype injects when a microphone is clicked.
 *
 *  When real speech-to-text is plugged in later, delete this file and
 *  swap the hook in useMockVoice.ts for a real STT adapter. The hook
 *  surface (status, transcript, start) stays the same so no caller
 *  changes.
 * ------------------------------------------------------------------ */

export const NAMES = [
  "রিপন আহমেদ",
  "মোছাঃ রোকেয়া বেগম",
  "মোঃ কামাল হোসেন",
  "সালমা আক্তার",
  "মোছাঃ নাসরিন বেগম",
  "মোঃ শাহিনুর ইসলাম",
  "ফাতেমা বেগম",
];

export const PHONES = [
  "০১৭২২-৪৫৮৯৬৩",
  "০১৮১৫-৩৩২২৪৪",
  "০১৯৩৩-৭৭৭৬৬৬",
  "০১৫১৫-২২৩৩৪৪",
  "০১৭১১-৯৯৮৮৭৭",
  "০১৩১৩-৫৫৪৪৩৩",
  "০১৬১৬-১১২২৩৩",
  "০১৯১৯-৮৮৭৭৬৬",
];

export const DESCRIPTIONS = [
  "মিলের কাজ কমে যাওয়ায় স্বামী গত কয়েক মাস ধরে কোনো খরচ দিচ্ছেন না এবং খারাপ আচরণ করছেন।",
  "জমি রেজিস্ট্রি নিয়ে ভাইয়ের সাথে বিরোধ চলছে, মাসের পর মাস মামলা ঝুলে আছে।",
  "যৌতুকের জন্য শ্বশুরবাড়ির লোকজন নিয়মিত চাপ দিচ্ছে এবং মারধর করছে।",
  "সন্তানের দেখাশোনা ও ভরণপোষণের দায়িত্ব পূর্বপক্ষ নিতে চাইছে না।",
  "প্রতিবেশী জমির সীমানা দখল করে রেখেছে, সালিশেও কাজ হচ্ছে না।",
  "অন্য গ্রামের এক ব্যবসায়ী ধার নেওয়া টাকা ফেরত দিচ্ছেন না।",
];

export function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
