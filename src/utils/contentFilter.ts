const BLOCKED_WORDS = [
  "fuck", "fucker", "fucking", "fucked",
  "shit", "shitty",
  "bitch", "bitches",
  "bastard",
  "cunt",
  "cock",
  "dick",
  "pussy",
  "whore",
  "slut",
  "nigger", "nigga",
  "faggot", "fag",
  "retard", "retarded",
  "asshole", "asses",
];

export function filterContent(text: string): string {
  let result = text;
  for (const word of BLOCKED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    result = result.replace(regex, "*".repeat(word.length));
  }
  return result;
}
