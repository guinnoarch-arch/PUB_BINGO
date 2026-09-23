// Runs the real migration + seed against Postgres and checks the security rules and price-report logic.
// Requires a Postgres server; set DATABASE_URL (a superuser connection) to point at it.
import { readFileSync } from "node:fs";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/postgres";
const TEST_DB = "pub_bingo_test";
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

let db;
const users = {};

async function createUser(username, email = `${username.toLowerCase()}@example.com`) {
  const { rows } = await db.query(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, { username }]
  );
  return rows[0].id;
}

// Runs fn inside a transaction as the given Supabase role/user, like a request through PostgREST.
async function as(userId, fn, { role = "authenticated", commit = true } = {}) {
  await db.query("begin");
  try {
    await db.query(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId || ""]);
    const result = await fn();
    await db.query(commit ? "commit" : "rollback");
    return result;
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}
const asAnon = fn => as(null, fn, { role: "anon" });

function report(userId, { pub, drinkId = null, name = null, category = null, measure = null, price, note = null }) {
  return as(userId, () => db.query(
    "select * from public.submit_price_report($1, $2, $3, $4, $5, $6, $7)",
    [pub, drinkId, name, category, measure, price, note]
  ).then(r => r.rows[0]));
}

async function drinkId(pub, name) {
  const { rows } = await db.query("select id from public.drinks where pub_id = $1 and name = $2", [pub, name]);
  return rows[0].id;
}

beforeAll(async () => {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${TEST_DB} with (force)`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${TEST_DB}`;
  db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  await db.query(read("tests/db/supabase-stub.sql"));
  await db.query(read("supabase/migrations/0001_init.sql"));
  await db.query(read("supabase/migrations/0002_pub_admin.sql"));
  await db.query(read("supabase/migrations/0003_events.sql"));
  await db.query(read("supabase/migrations/0004_menu_uploads.sql"));
  // Migrations must be safe to run twice.
  await db.query(read("supabase/migrations/0002_pub_admin.sql"));
  await db.query(read("supabase/migrations/0003_events.sql"));
  await db.query(read("supabase/migrations/0004_menu_uploads.sql"));
  await db.query(read("supabase/seed.sql"));

  users.alice = await createUser("Alice_1");
  users.bob = await createUser("bob");
  users.admin = await createUser("pubadmin");
  await db.query("update public.profiles set is_admin = true where id = $1", [users.admin]);
});

afterAll(async () => {
  await db?.end();
});

describe("seed data", () => {
  it("loads 14 pubs, their drinks, and one seed history entry per drink", async () => {
    const counts = await db.query(`select
      (select count(*) from public.pubs)::int as pubs,
      (select count(*) from public.drinks)::int as drinks,
      (select count(*) from public.price_reports where source = 'seed')::int as reports`);
    expect(counts.rows[0]).toEqual({ pubs: 14, drinks: 70, reports: 70 });
  });

  it("is safe to run twice", async () => {
    await db.query(read("supabase/seed.sql"));
    const { rows } = await db.query("select count(*)::int as n from public.price_reports");
    expect(rows[0].n).toBe(70);
  });
});

describe("accounts", () => {
  it("creates a profile from the sign-up username", async () => {
    const { rows } = await db.query("select username, username_normalized, is_admin from public.profiles where id = $1", [users.alice]);
    expect(rows[0]).toEqual({ username: "Alice_1", username_normalized: "alice_1", is_admin: false });
  });

  it("rejects duplicate usernames regardless of case", async () => {
    await expect(createUser("ALICE_1", "other@example.com")).rejects.toThrow(/already taken/);
  });

  it("rejects invalid usernames", async () => {
    await expect(createUser("a b", "space@example.com")).rejects.toThrow(/Usernames must be/);
  });

  it("resolves a username to its email for sign-in", async () => {
    const { rows } = await asAnon(() => db.query("select public.resolve_username_login('  alice_1 ') as email"));
    expect(rows[0].email).toBe("alice_1@example.com");
  });

  it("stops users making themselves admin", async () => {
    await expect(as(users.alice, () => db.query("update public.profiles set is_admin = true where id = $1", [users.alice])))
      .rejects.toThrow(/permission denied/);
  });
});

describe("public reads and blocked direct writes", () => {
  it("lets anonymous visitors read pubs, drinks and reports", async () => {
    const { rows } = await asAnon(() => db.query("select count(*)::int as n from public.drinks"));
    expect(rows[0].n).toBe(70);
  });

  it("does not let anyone write prices directly", async () => {
    await expect(asAnon(() => db.query("update public.drinks set current_price = 1"))).rejects.toThrow(/permission denied/);
    await expect(as(users.alice, () => db.query("update public.drinks set current_price = 1"))).rejects.toThrow(/permission denied/);
    await expect(as(users.alice, () => db.query(
      "insert into public.price_reports (pub_id, drink_id, drink_name, category, price) select pub_id, id, name, category, 1 from public.drinks limit 1"
    ))).rejects.toThrow(/permission denied/);
  });

  it("does not let anonymous visitors submit reports", async () => {
    await expect(asAnon(() => db.query(
      "select public.submit_price_report('the-harp', null, 'Test', 'Lager', 'pint', 5, null)"
    ))).rejects.toThrow(/permission denied/);
  });
});

describe("submit_price_report", () => {
  it("records a report with timestamp and reporter, updates the current price, and keeps history", async () => {
    const id = await drinkId("the-harp", "Guinness");
    const row = await report(users.alice, { pub: "the-harp", drinkId: id, price: 6.1, note: "  happy   hour  " });
    expect(row.reporter).toBe(users.alice);
    expect(row.reported_at).toBeInstanceOf(Date);
    expect(row.note).toBe("happy hour");
    expect(row.source).toBe("community");

    const drink = await db.query("select current_price, source from public.drinks where id = $1", [id]);
    expect(drink.rows[0]).toEqual({ current_price: "6.10", source: "community" });
    const history = await db.query("select price, source from public.price_reports where drink_id = $1 order by reported_at", [id]);
    expect(history.rows.map(r => [r.price, r.source])).toEqual([["6.40", "seed"], ["6.10", "community"]]);
  });

  it("rounds prices to pence", async () => {
    const row = await report(users.bob, { pub: "the-harp", drinkId: await drinkId("the-harp", "Dark Star Hophead"), price: 5.555 });
    expect(row.price).toBe("5.56");
  });

  it.each([[0.5], [25.01], [null], [-3]])("rejects price %s", async price => {
    await expect(report(users.bob, { pub: "the-toucan", drinkId: await drinkId("the-toucan", "Guinness"), price }))
      .rejects.toThrow(/between £1.00 and £25.00/);
  });

  it("rejects a drink id from a different pub", async () => {
    await expect(report(users.bob, { pub: "the-toucan", drinkId: await drinkId("the-harp", "Guinness"), price: 6 }))
      .rejects.toThrow(/not listed at this pub/);
  });

  it("validates new drinks", async () => {
    await expect(report(users.bob, { pub: "the-toucan", name: "X", category: "Lager", price: 6 })).rejects.toThrow(/2-60 characters/);
    await expect(report(users.bob, { pub: "the-toucan", name: "Mystery", category: "Wine", price: 6 })).rejects.toThrow(/valid category/);
    await expect(report(users.bob, { pub: "nowhere", name: "Mystery", category: "Lager", price: 6 })).rejects.toThrow(/Unknown pub/);
    await expect(report(users.bob, { pub: "the-toucan", name: "Mystery", category: "Lager", measure: "yard", price: 6 })).rejects.toThrow(/valid measure/);
  });

  it("creates a new community drink, then reuses it for the same name", async () => {
    const first = await report(users.alice, { pub: "the-toucan", name: "  Beamish   Stout ", category: "Stout", price: 6.2 });
    const second = await report(users.bob, { pub: "the-toucan", name: "beamish stout", category: "Stout", price: 6.3 });
    expect(second.drink_id).toBe(first.drink_id);
    const { rows } = await db.query("select name, source, current_price from public.drinks where id = $1", [first.drink_id]);
    expect(rows[0]).toEqual({ name: "Beamish Stout", source: "community", current_price: "6.30" });
  });

  it("blocks the same user re-reporting the same drink within 10 minutes", async () => {
    await expect(report(users.alice, { pub: "the-harp", drinkId: await drinkId("the-harp", "Guinness"), price: 6.2 }))
      .rejects.toThrow(/few minutes ago/);
  });

  it("rate-limits to 20 reports an hour per user", async () => {
    const spammer = await createUser("spammer");
    for (let i = 1; i <= 20; i += 1) {
      await report(spammer, { pub: "the-coal-hole", name: `Test Beer ${i}`, category: "Lager", price: 6 });
    }
    await expect(report(spammer, { pub: "the-coal-hole", name: "Test Beer 21", category: "Lager", price: 6 }))
      .rejects.toThrow(/Try again later/);
  });
});

describe("favourites and bingo progress", () => {
  it("keeps each user's favourites private", async () => {
    await as(users.alice, () => db.query("insert into public.favourites (user_id, pub_id) values ($1, 'the-harp')", [users.alice]));
    await expect(as(users.alice, () => db.query("insert into public.favourites (user_id, pub_id) values ($1, 'the-harp')", [users.bob])))
      .rejects.toThrow(/row-level security/);
    const bobSees = await as(users.bob, () => db.query("select * from public.favourites"));
    expect(bobSees.rows).toHaveLength(0);
    await expect(asAnon(() => db.query("select * from public.favourites"))).rejects.toThrow(/permission denied/);
  });

  it("stores bingo ticks per user and rejects bad tile ids", async () => {
    await as(users.alice, () => db.query("insert into public.bingo_progress (user_id, tile_id) values ($1, 'try-stout')", [users.alice]));
    await expect(as(users.alice, () => db.query("insert into public.bingo_progress (user_id, tile_id) values ($1, 'DROP TABLE')", [users.alice])))
      .rejects.toThrow(/check constraint/);
    const { rows } = await as(users.bob, () => db.query("select * from public.bingo_progress"));
    expect(rows).toHaveLength(0);
  });
});

describe("photos and admin controls", () => {
  const photo = (userId, pub, path = `${pub}/${userId}/photo.jpg`) => as(userId, () => db.query(
    "insert into public.pub_photos (pub_id, storage_path, uploaded_by) values ($1, $2, $3)", [pub, path, userId]
  ));
  const storageUpload = (userId, name) => as(userId, () => db.query(
    "insert into storage.objects (bucket_id, name, owner_id) values ('pub-photos', $1, $2)", [name, userId]
  ));

  it("creates the public photo bucket with size and type limits", async () => {
    const { rows } = await db.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'pub-photos'");
    expect(rows[0]).toEqual({ public: true, file_size_limit: "5242880", allowed_mime_types: ["image/jpeg", "image/png", "image/webp"] });
  });

  it("lets signed-in users upload into their own folder only", async () => {
    await storageUpload(users.alice, `lamb-and-flag/${users.alice}/a.jpg`);
    await photo(users.alice, "lamb-and-flag");
    await expect(storageUpload(users.alice, `lamb-and-flag/${users.bob}/a.jpg`)).rejects.toThrow(/row-level security/);
    await expect(photo(users.alice, "lamb-and-flag", `lamb-and-flag/${users.bob}/x.jpg`)).rejects.toThrow(/row-level security/);
  });

  it("only lets admins pause uploads", async () => {
    await expect(as(users.alice, () => db.query("select public.admin_set_uploads_paused('the-salisbury', true)")))
      .rejects.toThrow(/Admins only/);
    await as(users.admin, () => db.query("select public.admin_set_uploads_paused('the-salisbury', true)"));
    const { rows } = await db.query("select uploads_paused from public.pubs where id = 'the-salisbury'");
    expect(rows[0].uploads_paused).toBe(true);
  });

  it("blocks uploads (file and record) for a paused pub", async () => {
    await expect(storageUpload(users.bob, `the-salisbury/${users.bob}/b.jpg`)).rejects.toThrow(/row-level security/);
    await expect(photo(users.bob, "the-salisbury")).rejects.toThrow(/row-level security/);
    await as(users.admin, () => db.query("select public.admin_set_uploads_paused('the-salisbury', false)"));
    await storageUpload(users.bob, `the-salisbury/${users.bob}/b.jpg`);
    await photo(users.bob, "the-salisbury");
  });

  it("lets admins hide a bad report and restores the previous price", async () => {
    const id = await drinkId("the-cross-keys", "Guinness");
    const bad = await report(users.bob, { pub: "the-cross-keys", drinkId: id, price: 1.2, note: "typo" });
    await expect(as(users.alice, () => db.query("select public.admin_set_report_hidden($1, true)", [bad.id])))
      .rejects.toThrow(/Admins only/);
    await as(users.admin, () => db.query("select public.admin_set_report_hidden($1, true)", [bad.id]));
    const drink = await db.query("select current_price, source from public.drinks where id = $1", [id]);
    expect(drink.rows[0]).toEqual({ current_price: "6.60", source: "seed" });
    const visible = await asAnon(() => db.query("select count(*)::int as n from public.price_reports where id = $1", [bad.id]));
    expect(visible.rows[0].n).toBe(0);
  });
});

describe("0002: hidden pubs, websites and admin tools", () => {
  const savePub = (userId, pub) => as(userId, () => db.query("select * from public.admin_save_pub($1)", [pub]).then(r => r.rows[0]));
  const visibleTo = (userId, sql, params = []) => (userId ? as(userId, () => db.query(sql, params)) : asAnon(() => db.query(sql, params)));

  it("seeds websites, operators and private research notes", async () => {
    const { rows } = await db.query("select website, drinks_menu_url, operator from public.pubs where id = 'the-harp'");
    expect(rows[0]).toEqual({ website: "https://www.harpcoventgarden.com/", drinks_menu_url: "https://www.harpcoventgarden.com/drink", operator: "Fuller's" });
    const notes = await db.query("select count(*)::int as n from public.pub_admin");
    expect(notes.rows[0].n).toBe(14);
  });

  it("keeps research notes admin-only", async () => {
    await expect(asAnon(() => db.query("select * from public.pub_admin"))).rejects.toThrow(/permission denied/);
    const alice = await as(users.alice, () => db.query("select * from public.pub_admin"));
    expect(alice.rows).toHaveLength(0);
    const admin = await as(users.admin, () => db.query("select * from public.pub_admin"));
    expect(admin.rows).toHaveLength(14);
  });

  it("lets admins save a hidden pub with limited info", async () => {
    const pub = await savePub(users.admin, { id: "the-lyric", name: "The Lyric", area: "Soho", is_published: false, tags: ["historic", " "] });
    expect(pub).toMatchObject({ id: "the-lyric", is_published: false, address: null, lat: null, tags: ["historic"] });
  });

  it("refuses to publish a pub without an address and map position", async () => {
    await expect(savePub(users.admin, { id: "the-lyric", name: "The Lyric", area: "Soho", is_published: true }))
      .rejects.toThrow(/needs an address and a map position/);
  });

  it("gives friendly errors for bad pub details", async () => {
    await expect(savePub(users.admin, { id: "Bad Id", name: "X", area: "Soho" })).rejects.toThrow(/lowercase/);
    await expect(savePub(users.admin, { id: "the-lyric", name: "The Lyric", area: "Soho", website: "lyric.com" })).rejects.toThrow(/http/);
    await expect(savePub(users.admin, { id: "the-lyric", name: "The Lyric", area: "Soho", lat: "north" })).rejects.toThrow(/must be numbers/);
  });

  it("only lets admins save pubs", async () => {
    await expect(savePub(users.alice, { id: "sneaky", name: "Sneaky", area: "Soho", is_published: false })).rejects.toThrow(/Admins only/);
  });

  it("hides unpublished pubs and their drinks from everyone but admins", async () => {
    await as(users.admin, () => db.query(
      "select public.admin_set_drink_price('the-lyric', null, 'Guinness', 'Stout', 'pint', 6.2, 'admin', null, 'checked at the bar')"
    ));
    for (const who of [null, users.alice]) {
      const pubs = await visibleTo(who, "select id from public.pubs where id = 'the-lyric'");
      const drinks = await visibleTo(who, "select id from public.drinks where pub_id = 'the-lyric'");
      const reports = await visibleTo(who, "select id from public.price_reports where pub_id = 'the-lyric'");
      expect([pubs.rows.length, drinks.rows.length, reports.rows.length]).toEqual([0, 0, 0]);
    }
    const adminDrinks = await visibleTo(users.admin, "select source from public.drinks where pub_id = 'the-lyric'");
    expect(adminDrinks.rows).toEqual([{ source: "admin" }]);
  });

  it("stops the community reporting prices at hidden pubs", async () => {
    await expect(report(users.alice, { pub: "the-lyric", name: "Guinness", category: "Stout", price: 6 })).rejects.toThrow(/Unknown pub/);
  });

  it("shows a pub once it's published with full details", async () => {
    await savePub(users.admin, {
      id: "the-lyric", name: "The Lyric", area: "Soho", address: "37 Great Windmill Street, London W1D 7LU",
      lat: 51.5112, lng: -0.1338, is_published: true
    });
    const pubs = await asAnon(() => db.query("select id from public.pubs where id = 'the-lyric'"));
    expect(pubs.rows).toHaveLength(1);
  });

  it("records website prices with their source link, in the same history", async () => {
    const id = await drinkId("the-salisbury", "Guinness");
    await expect(as(users.admin, () => db.query(
      "select public.admin_set_drink_price('the-salisbury', $1, null, null, null, 6.9, 'website', null, null)", [id]
    ))).rejects.toThrow(/Add the link/);
    await as(users.admin, () => db.query(
      "select public.admin_set_drink_price('the-salisbury', $1, null, null, null, 6.9, 'website', 'https://www.greeneking.co.uk/pubs/greater-london/salisbury/menu', null)", [id]
    ));
    const drink = await db.query("select current_price, source, source_url from public.drinks where id = $1", [id]);
    expect(drink.rows[0]).toEqual({ current_price: "6.90", source: "website", source_url: "https://www.greeneking.co.uk/pubs/greater-london/salisbury/menu" });
    const history = await db.query("select source from public.price_reports where drink_id = $1 order by reported_at", [id]);
    expect(history.rows.map(r => r.source)).toEqual(["seed", "website"]);
  });

  it("clears the website link when the community reports a newer price", async () => {
    const id = await drinkId("the-salisbury", "Guinness");
    await report(users.bob, { pub: "the-salisbury", drinkId: id, price: 7.0 });
    const drink = await db.query("select source, source_url from public.drinks where id = $1", [id]);
    expect(drink.rows[0]).toEqual({ source: "community", source_url: null });
  });

  it("only lets admins set, edit or delete drinks and notes", async () => {
    const id = await drinkId("the-toucan", "Harp Lager");
    await expect(as(users.alice, () => db.query("select public.admin_set_drink_price('the-toucan', $1, null, null, null, 5, 'admin', null, null)", [id]))).rejects.toThrow(/Admins only/);
    await expect(as(users.alice, () => db.query("select public.admin_update_drink($1, 'Renamed', 'Lager', 'pint')", [id]))).rejects.toThrow(/Admins only/);
    await expect(as(users.alice, () => db.query("select public.admin_delete_drink($1)", [id]))).rejects.toThrow(/Admins only/);
    await expect(as(users.alice, () => db.query("select public.admin_save_pub_admin('the-toucan', 'yes', 'x', true)"))).rejects.toThrow(/Admins only/);
  });

  it("lets admins edit and delete drinks, and update notes", async () => {
    const id = await drinkId("the-toucan", "Harp Lager");
    await as(users.admin, () => db.query("select public.admin_update_drink($1, '  Harp   Lager ', 'Lager', 'pint')", [id]));
    await expect(as(users.admin, () => db.query("select public.admin_update_drink($1, 'Guinness', 'Stout', 'pint')", [id]))).rejects.toThrow(/already lists/);
    await as(users.admin, () => db.query("select public.admin_delete_drink($1)", [id]));
    expect((await db.query("select count(*)::int as n from public.drinks where id = $1", [id])).rows[0].n).toBe(0);

    const { rows } = await as(users.admin, () => db.query("select * from public.admin_save_pub_admin('the-toucan', 'yes', 'Menu checked', true)"));
    expect(rows[0]).toMatchObject({ prices_online: "yes", notes: "Menu checked" });
    expect(rows[0].prices_checked_at).toBeInstanceOf(Date);
    await expect(as(users.admin, () => db.query("select public.admin_save_pub_admin('the-toucan', 'maybe', '', false)"))).rejects.toThrow(/yes, partial, no or unknown/);
  });

  it("re-running the seed doesn't overwrite admin edits", async () => {
    await as(users.admin, () => db.query("select public.admin_save_pub($1)", [{
      id: "the-harp", name: "The Harp", area: "Covent Garden", address: "47 Chandos Place, London WC2N 4HS",
      lat: 51.50965, lng: -0.12594, is_published: true, website: "https://example.com/harp"
    }]));
    await db.query(read("supabase/seed.sql"));
    const { rows } = await db.query("select website from public.pubs where id = 'the-harp'");
    expect(rows[0].website).toBe("https://example.com/harp");
    const notes = await db.query("select notes from public.pub_admin where pub_id = 'the-toucan'");
    expect(notes.rows[0].notes).toBe("Menu checked");
  });
});

describe("0003: events (What's on)", () => {
  const saveEvent = (userId, event) => as(userId, () => db.query("select * from public.admin_save_event($1)", [event]).then(r => r.rows[0]));

  it("seeds researched events unpublished, and adds feature tags", async () => {
    const { rows } = await db.query("select count(*)::int as n, bool_or(is_published) as any_published from public.events where source = 'research'");
    expect(rows[0]).toEqual({ n: 7, any_published: false });
    const tags = await db.query("select tags from public.pubs where id = 'the-porterhouse'");
    expect(tags.rows[0].tags).toContain("sports-tv");
  });

  it("hides unpublished events from the public but not admins", async () => {
    expect((await asAnon(() => db.query("select * from public.events"))).rows).toHaveLength(0);
    expect((await as(users.alice, () => db.query("select * from public.events"))).rows).toHaveLength(0);
    expect((await as(users.admin, () => db.query("select * from public.events"))).rows.length).toBeGreaterThanOrEqual(7);
  });

  it("publishing an event makes it public and records when it was checked", async () => {
    const { rows } = await db.query("select * from public.events where pub_id = 'the-coach-and-horses'");
    const saved = await saveEvent(users.admin, { ...rows[0], weekdays: rows[0].weekdays, start_time: "19:00", is_published: true });
    expect(saved.is_published).toBe(true);
    expect(saved.checked_at).toBeInstanceOf(Date);
    expect(saved.start_time).toBe("19:00:00");
    const pub = await asAnon(() => db.query("select title from public.events"));
    expect(pub.rows.map(r => r.title)).toEqual(["Piano sing-along"]);
  });

  it("creates one-off events like a match screening", async () => {
    const saved = await saveEvent(users.admin, {
      pub_id: "the-porterhouse", title: "England v France (Six Nations)", category: "sports", schedule: "one-off",
      event_date: "2027-03-13", start_time: "20:00", is_published: true, source_url: "https://www.fanzo.com/en/bar/248658/the-porterhouse"
    });
    expect(saved).toMatchObject({ schedule: "one-off", category: "sports", source: "admin" });
    expect(saved.created_by).toBe(users.admin);
  });

  it("validates events with friendly messages", async () => {
    const base = { pub_id: "the-harp", title: "Quiz", category: "quiz", schedule: "weekly", weekdays: [2] };
    await expect(saveEvent(users.admin, { ...base, weekdays: [] })).rejects.toThrow(/at least one day/);
    await expect(saveEvent(users.admin, { ...base, weekdays: [9] })).rejects.toThrow(/at least one day/);
    await expect(saveEvent(users.admin, { ...base, schedule: "one-off", event_date: "" })).rejects.toThrow(/Pick a date/);
    await expect(saveEvent(users.admin, { ...base, category: "rave" })).rejects.toThrow(/event type/);
    await expect(saveEvent(users.admin, { ...base, title: "Q" })).rejects.toThrow(/2-100/);
    await expect(saveEvent(users.admin, { ...base, start_time: "25:99" })).rejects.toThrow(/date and times/);
    await expect(saveEvent(users.admin, { ...base, source_url: "fanzo.com" })).rejects.toThrow(/http/);
    await expect(saveEvent(users.admin, { ...base, pub_id: "nowhere" })).rejects.toThrow(/Unknown pub/);
    await saveEvent(users.admin, base);
    await expect(saveEvent(users.admin, base)).rejects.toThrow(/already has an event/);
  });

  it("only lets admins save or delete events", async () => {
    await expect(saveEvent(users.alice, { pub_id: "the-harp", title: "Mine", category: "quiz", schedule: "weekly", weekdays: [1] })).rejects.toThrow(/Admins only/);
    const { rows } = await db.query("select id from public.events limit 1");
    await expect(as(users.alice, () => db.query("select public.admin_delete_event($1)", [rows[0].id]))).rejects.toThrow(/Admins only/);
    await expect(as(users.alice, () => db.query("insert into public.events (pub_id, title, category, schedule, weekdays) values ('the-harp', 'x y', 'quiz', 'weekly', '{1}')"))).rejects.toThrow(/permission denied/);
    await as(users.admin, () => db.query("select public.admin_delete_event($1)", [rows[0].id]));
  });

  it("hides events of hidden pubs even if published", async () => {
    await as(users.admin, () => db.query("select public.admin_save_pub($1)", [{ id: "secret-bar", name: "Secret Bar", area: "Soho", is_published: false }]));
    await saveEvent(users.admin, { pub_id: "secret-bar", title: "Secret gig", category: "live-music", schedule: "weekly", weekdays: [5], is_published: true });
    const visible = await asAnon(() => db.query("select title from public.events where pub_id = 'secret-bar'"));
    expect(visible.rows).toHaveLength(0);
  });

  it("migration notes updates don't duplicate on re-run", async () => {
    await db.query(read("supabase/migrations/0003_events.sql"));
    const { rows } = await db.query("select notes from public.pub_admin where pub_id = 'the-porterhouse'");
    expect(rows[0].notes.split("[Sep 2026 research]").length - 1).toBe(1);
  });
});

describe("0004: menu uploads", () => {
  const upload = (userId, name) => as(userId, () => db.query(
    "insert into storage.objects (bucket_id, name, owner_id) values ('menus', $1, $2)", [name, userId]
  ));
  const record = (userId, pub, path) => as(userId, () => db.query(
    "insert into public.menu_uploads (pub_id, storage_path, file_name, uploaded_by) values ($1, $2, 'menu.pdf', $3) returning *", [pub, path, userId]
  ).then(r => r.rows[0]));

  it("creates a public, PDF-only menus bucket", async () => {
    const { rows } = await db.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'menus'");
    expect(rows[0]).toEqual({ public: true, file_size_limit: "10485760", allowed_mime_types: ["application/pdf"] });
  });

  it("only admins can upload menu files and records", async () => {
    await expect(upload(users.alice, "the-porterhouse/x.pdf")).rejects.toThrow(/row-level security/);
    await expect(record(users.alice, "the-porterhouse", "the-porterhouse/x.pdf")).rejects.toThrow(/row-level security/);
    await upload(users.admin, "the-porterhouse/spring.pdf");
    const row = await record(users.admin, "the-porterhouse", "the-porterhouse/spring.pdf");
    expect(row).toMatchObject({ pub_id: "the-porterhouse", prices_imported: 0, uploaded_by: users.admin });
  });

  it("keeps the upload list admin-only", async () => {
    await expect(asAnon(() => db.query("select * from public.menu_uploads"))).rejects.toThrow(/permission denied/);
    expect((await as(users.alice, () => db.query("select * from public.menu_uploads"))).rows).toHaveLength(0);
    expect((await as(users.admin, () => db.query("select * from public.menu_uploads"))).rows).toHaveLength(1);
  });

  it("files must live in the pub's own folder", async () => {
    await expect(record(users.admin, "the-harp", "the-porterhouse/other.pdf")).rejects.toThrow(/check constraint/);
  });

  it("admins can record how many prices were imported", async () => {
    await as(users.admin, () => db.query("update public.menu_uploads set prices_imported = 4 where storage_path = 'the-porterhouse/spring.pdf'"));
    const { rows } = await db.query("select prices_imported from public.menu_uploads where storage_path = 'the-porterhouse/spring.pdf'");
    expect(rows[0].prices_imported).toBe(4);
  });
});
