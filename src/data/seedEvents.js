// Regular events found by web search on 23-24 Sep 2026. Not checked against the pubs' own pages
// (the build environment blocks them), so they are seeded UNPUBLISHED: an admin checks each one,
// then publishes it. weekdays: 0 = Sunday ... 6 = Saturday. Times are London time; null = not known.
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
    description: "Stand-up comedy nights.",
    weekdays: [1, 3],
    start_time: "19:30",
    end_time: null,
    source_url: "https://www.theblueposts.net/"
  },
  {
    pub_id: "the-blue-posts-berwick-street",
    title: "Music night: open mic, blues and jazz",
    category: "live-music",
    description: "Open mic, blues and jazz nights.",
    weekdays: [2, 4],
    start_time: null,
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
  }
];
