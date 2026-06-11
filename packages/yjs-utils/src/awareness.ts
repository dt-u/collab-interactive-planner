export const USER_CURSOR_COLORS = [
  "#FF5733", // Orange Red
  "#33FF57", // Emerald Green
  "#3357FF", // Royal Blue
  "#F3FF33", // Yellow
  "#FF33F3", // Pink
  "#33FFF0", // Cyan
  "#FFA833", // Amber
  "#A833FF", // Purple
] as const;

export function getRandomCursorColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % USER_CURSOR_COLORS.length;
  return USER_CURSOR_COLORS[index];
}
