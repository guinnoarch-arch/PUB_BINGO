import { useEffect } from "react";

const APP_NAME = "Pub Bingo";
const HOME_TITLE = "Pub Bingo · Cheapest pints in London";

// Sets the browser tab title for a page: "Leaderboard · Pub Bingo". Pass nothing for the home title.
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : HOME_TITLE;
  }, [title]);
}
