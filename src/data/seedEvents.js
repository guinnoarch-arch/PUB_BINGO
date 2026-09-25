// Regular events found by web search on 23-25 Sep 2026. Not checked against the pubs' own pages
// (the build environment blocks them), so they are seeded UNPUBLISHED: an admin checks each one,
// then publishes it. weekdays: 0 = Sunday ... 6 = Saturday. Times are London time; null = not known.
// Events with schedule "one-off" have an event_date instead of weekdays (titles must be unique per pub).
export const SEED_EVENTS = [
  {
    pub_id: "the-porterhouse",
    title: "Live music: house bands",
    category: "live-music",
    description: "Rock and pop covers from the 60s to today in the Basement Bar.",
    weekdays: [4, 5, 6],
    start_time: null,
    end_time: null,
    source_url: "https://porterhouse.london/events/"
  },
  {
    pub_id: "the-porterhouse",
    title: "Irish trad session",
    category: "live-music",
    description: "Traditional Irish music session on Sunday afternoons.",
    weekdays: [0],
    start_time: null,
    end_time: null,
    source_url: "https://porterhouse.london/events/"
  },
  {
    pub_id: "the-coach-and-horses",
    title: "Piano sing-along",
    category: "sing-along",
    description: "Soho's famous piano sing-along, running since 1988. All singing abilities welcome.",
    weekdays: [3, 6],
    start_time: null,
    end_time: null,
    source_url: "https://www.coachandhorsessoho.pub/"
  },
  {
    pub_id: "the-blue-posts-berwick-street",
    title: "Soho Comedy Factory",
    category: "comedy",
    description: "Stand-up comedy from Soho Comedy Factory. Doors 7pm, show 7:30pm; tickets on Fever.",
    weekdays: [1, 3],
    start_time: "19:30",
    end_time: null,
    source_url: "https://www.theblueposts.net/"
  },
  {
    pub_id: "the-blue-posts-berwick-street",
    title: "Music night: open mic, blues and jazz",
    category: "live-music",
    description: "Tuesday: open mic, blues and jazz. Thursday: The Black Diamonds (blues and jazz).",
    weekdays: [2, 4],
    start_time: "19:00",
    end_time: null,
    source_url: "https://www.theblueposts.net/"
  },
  {
    pub_id: "the-craft-beer-co-holborn",
    title: "Quiz night",
    category: "quiz",
    description: "Weekly pub quiz.",
    weekdays: [3],
    start_time: "20:00",
    end_time: null,
    source_url: "http://www.thecraftbeerco.com/events"
  },
  {
    pub_id: "the-craft-beer-co-holborn",
    title: "Open mic night",
    category: "open-mic",
    description: "Weekly open mic from 7:30pm.",
    weekdays: [5],
    start_time: "19:30",
    end_time: null,
    source_url: "http://www.thecraftbeerco.com/events"
  },
  {
    pub_id: "the-rocket",
    title: "Quiz night",
    category: "quiz",
    description: "Weekly Monday quiz.",
    weekdays: [1],
    start_time: null,
    end_time: null,
    source_url: "https://www.therocketeustonroad.co.uk/"
  },
  {
    pub_id: "the-toucan",
    title: "Irish trad session",
    category: "live-music",
    description: "Unplugged traditional Irish session (seisiún) in the basement bar: fiddles, flutes and bodhráns.",
    weekdays: [2],
    start_time: "19:30",
    end_time: "22:00",
    source_url: "https://www.thetoucansoho.co.uk/"
  },
  {
    pub_id: "the-ship-tavern",
    title: "Gin & Jazz",
    category: "live-music",
    description: "Live jazz in the Oak Room on Sunday afternoons, alongside the Sunday roast.",
    weekdays: [0],
    start_time: null,
    end_time: null,
    source_url: "https://theshiptavern.co.uk/"
  },
  {
    pub_id: "the-ship-tavern",
    title: "Sunday roast",
    category: "food",
    description: "Traditional Sunday roast. Popular: book 1-2 weeks ahead.",
    weekdays: [0],
    start_time: null,
    end_time: null,
    source_url: "https://theshiptavern.co.uk/menus/sunday-menu/"
  },
  ...[
    ["2026-09-27", "September"],
    ["2026-10-25", "October"],
    ["2026-11-29", "November"]
  ].map(([date, month]) => ({
    pub_id: "lamb-and-flag",
    title: `Last-Sunday live jazz: ${month}`,
    category: "live-music",
    description: "Live jazz on the last Sunday of the month. Sources disagree on the time (7-9pm or 7:30-10:30pm).",
    schedule: "one-off",
    event_date: date,
    weekdays: [],
    start_time: "19:00",
    end_time: null,
    source_url: "https://www.lambandflagcoventgarden.co.uk/whats-on"
  })),
  {
    pub_id: "lamb-and-flag",
    title: "Sunday roast",
    category: "food",
    description: "Sunday roast alongside the usual pub classics.",
    weekdays: [0],
    start_time: null,
    end_time: null,
    source_url: "https://www.lambandflagcoventgarden.co.uk/"
  },
  {
    pub_id: "the-porterhouse",
    title: "Sunday roast",
    category: "food",
    description: "Roasts added to the menu on Sundays, such as glazed leg of lamb and lemon and thyme chicken.",
    weekdays: [0],
    start_time: null,
    end_time: null,
    source_url: "https://porterhouse.london/"
  },
  {
    pub_id: "the-punch-and-judy",
    title: "Sunday roast",
    category: "food",
    description: "Sunday roasts with all the trimmings, including vegetarian options.",
    weekdays: [0],
    start_time: null,
    end_time: null,
    source_url: "https://www.greeneking.co.uk/pubs/greater-london/punch-and-judy/menu"
  },
  {
    pub_id: "the-salisbury",
    title: "Sunday roast",
    category: "food",
    description: "Sunday roast in the heart of Theatreland.",
    weekdays: [0],
    start_time: null,
    end_time: null,
    source_url: "https://www.greeneking.co.uk/pubs/greater-london/salisbury/menu"
  },
  {
    pub_id: "the-rosendale",
    title: "Pub quiz",
    category: "quiz",
    description: "Monday pub quiz for teams of up to 6 (£2.50 each in 2023). Check the start time.",
    weekdays: [1],
    start_time: null,
    end_time: null,
    source_url: "https://www.therosendale.co.uk/whats-on/"
  }
];
