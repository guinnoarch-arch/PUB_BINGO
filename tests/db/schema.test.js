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
  await db.query(read("supabase/migrations/0005_bottles.sql"));
  await db.query(read("supabase/migrations/0006_suggestions.sql"));
  await db.query(read("supabase/migrations/0007_menu_submissions.sql"));
  await db.query(read("supabase/migrations/0008_features.sql"));
  await db.query(read("supabase/migrations/0009_food_menus.sql"));
  // Migrations must be safe to run twice.
  await db.query(read("supabase/migrations/0002_pub_admin.sql"));
  await db.query(read("supabase/migrations/0003_events.sql"));
  await db.query(read("supabase/migrations/0004_menu_uploads.sql"));
  await db.query(read("supabase/migrations/0005_bottles.sql"));
  await db.query(read("supabase/migrations/0006_suggestions.sql"));
  await db.query(read("supabase/migrations/0007_menu_submissions.sql"));
  await db.query(read("supabase/migrations/0008_features.sql"));
  await db.query(read("supabase/migrations/0009_food_menus.sql"));
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
  it("loads 16 pubs, their drinks, and one history entry per drink", async () => {
    const counts = await db.query(`select
      (select count(*) from public.pubs)::int as pubs,
      (select count(*) from public.drinks)::int as drinks,
      (select count(*) from public.price_reports)::int as reports`);
    expect(counts.rows[0]).toEqual({ pubs: 16, drinks: 112, reports: 112 });
  });

  it("is safe to run twice", async () => {
    await db.query(read("supabase/seed.sql"));
    const { rows } = await db.query("select count(*)::int as n from public.price_reports");
    expect(rows[0].n).toBe(112);
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
    expect(rows[0].n).toBe(112);
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
    expect(notes.rows[0].n).toBe(16);
  });

  it("keeps research notes admin-only", async () => {
    await expect(asAnon(() => db.query("select * from public.pub_admin"))).rejects.toThrow(/permission denied/);
    const alice = await as(users.alice, () => db.query("select * from public.pub_admin"));
    expect(alice.rows).toHaveLength(0);
    const admin = await as(users.admin, () => db.query("select * from public.pub_admin"));
    expect(admin.rows).toHaveLength(16);
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
    // Admin notes are kept; newer research is appended after them once (see RESEARCH_UPDATE_MARKER).
    await db.query(read("supabase/seed.sql"));
    const notes = await db.query("select notes from public.pub_admin where pub_id = 'the-toucan'");
    expect(notes.rows[0].notes).toMatch(/^Menu checked\n\n\[25 Sep 2026 research\] /);
    expect(notes.rows[0].notes.split("[25 Sep 2026 research]").length).toBe(2);
  });
});

describe("0003: events (What's on)", () => {
  const saveEvent = (userId, event) => as(userId, () => db.query("select * from public.admin_save_event($1)", [event]).then(r => r.rows[0]));

  it("seeds researched events unpublished, and adds feature tags", async () => {
    const { rows } = await db.query("select count(*)::int as n, bool_or(is_published) as any_published from public.events where source = 'research'");
    expect(rows[0]).toEqual({ n: 19, any_published: false });
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

describe("0005: bottles and cans", () => {
  it("seeds The Rocket's real bottle prices from its website, with history and no estimates", async () => {
    const { rows } = await db.query(
      "select count(*)::int as n, count(*) filter (where source = 'website')::int as website, count(*) filter (where measure = 'bottle')::int as bottles, count(*) filter (where source = 'seed')::int as estimates from public.drinks where pub_id = 'the-rocket'"
    );
    expect(rows[0]).toEqual({ n: 29, website: 29, bottles: 15, estimates: 0 });
    const peroni = await db.query("select volume_ml, current_price, source_url from public.drinks where pub_id = 'the-rocket' and name = 'Peroni'");
    expect(peroni.rows[0]).toEqual({ volume_ml: 330, current_price: "6.05", source_url: "https://www.therocketeustonroad.co.uk/drinks" });
    const history = await db.query("select count(*)::int as n from public.price_reports where pub_id = 'the-rocket' and source = 'website' and source_url is not null");
    expect(history.rows[0].n).toBe(29);
    const guinness = await db.query("select measure, current_price from public.drinks where pub_id = 'the-rocket' and name = 'Guinness'");
    expect(guinness.rows).toEqual([{ measure: "pint", current_price: "6.65" }]);
  });

  it("fills in missing bottle sizes when the seed is re-run, without overwriting", async () => {
    await db.query("update public.drinks set volume_ml = null where pub_id = 'the-rocket' and name = 'Magners Original'");
    await db.query("update public.drinks set volume_ml = 330 where pub_id = 'the-rocket' and name = 'Newcastle Brown Ale'");
    await db.query(read("supabase/seed.sql"));
    const { rows } = await db.query("select name, volume_ml from public.drinks where pub_id = 'the-rocket' and name in ('Magners Original', 'Newcastle Brown Ale') order by name");
    expect(rows).toEqual([{ name: "Magners Original", volume_ml: 568 }, { name: "Newcastle Brown Ale", volume_ml: 330 }]);
  });

  it("removes only The Rocket's estimates when re-run", async () => {
    await db.query("insert into public.drinks (pub_id, name, category, measure, current_price, source) values ('the-rocket', 'Old Estimate', 'Lager', 'pint', 7, 'seed')");
    await db.query(read("supabase/migrations/0005_bottles.sql"));
    const { rows } = await db.query("select count(*)::int as n, count(*) filter (where source = 'seed')::int as estimates from public.drinks where pub_id = 'the-rocket'");
    expect(rows[0]).toEqual({ n: 29, estimates: 0 });
    const others = await db.query("select count(*)::int as n from public.drinks where pub_id = 'the-harp' and source = 'seed'");
    expect(others.rows[0].n).toBeGreaterThan(0);
  });

  it("checks bottle sizes", async () => {
    await expect(db.query("insert into public.drinks (pub_id, name, category, measure, volume_ml, current_price) values ('the-rocket', 'Tiny', 'Lager', 'bottle', 20, 5)"))
      .rejects.toThrow(/drinks_volume_ml_check/);
    await expect(db.query("insert into public.drinks (pub_id, name, category, measure, current_price) values ('the-rocket', 'Yard', 'Lager', 'yard', 5)"))
      .rejects.toThrow(/drinks_measure_check/);
  });

  it("lets the community report a new bottled drink", async () => {
    const row = await report(users.bob, { pub: "the-rocket", name: "Brooklyn Lager", category: "Lager", measure: "can", price: 6.4 });
    expect(row).toMatchObject({ measure: "can", source: "community" });
  });

  it("lets admins set a bottle price and edit a drink's size", async () => {
    const saved = await as(users.admin, () => db.query(
      "select * from public.admin_set_drink_price('the-rocket', null, 'San Miguel', 'Lager', 'bottle', 5.95, 'website', 'https://www.therocketeustonroad.co.uk/drinks', null)"
    ).then(r => r.rows[0]));
    const edited = await as(users.admin, () => db.query("select * from public.admin_update_drink($1, 'San Miguel', 'Lager', 'bottle', 330)", [saved.drink_id]).then(r => r.rows[0]));
    expect(edited).toMatchObject({ measure: "bottle", volume_ml: 330 });
    const pint = await as(users.admin, () => db.query("select * from public.admin_update_drink($1, 'San Miguel', 'Lager', 'pint', 330)", [saved.drink_id]).then(r => r.rows[0]));
    expect(pint.volume_ml).toBeNull();
    await expect(as(users.admin, () => db.query("select public.admin_update_drink($1, 'San Miguel', 'Lager', 'bottle', 5000)", [saved.drink_id]))).rejects.toThrow(/100-2000 ml/);
    await expect(as(users.alice, () => db.query("select public.admin_update_drink($1, 'Mine', 'Lager', 'bottle', 330)", [saved.drink_id]))).rejects.toThrow(/Admins only/);
  });
});

describe("0006: suggestions", () => {
  const submit = (userId, category, message) => as(userId, () => db.query("select * from public.submit_suggestion($1, $2)", [category, message]).then(r => r.rows[0]));
  const list = userId => (userId
    ? as(userId, () => db.query("select * from public.list_suggestions()"))
    : asAnon(() => db.query("select * from public.list_suggestions()"))).then(r => r.rows);
  const vote = (userId, id, v) => as(userId, () => db.query("select public.vote_suggestion($1, $2)", [id, v]));
  let ideaId;

  it("lets signed-in users send suggestions, with validation", async () => {
    const row = await submit(users.alice, "idea", "  Add   a map filter for beer gardens ");
    expect(row).toMatchObject({ category: "idea", status: "new", message: "Add a map filter for beer gardens", submitted_by: users.alice });
    ideaId = row.id;
    await submit(users.bob, "pub", "Please add The Lyric on Great Windmill Street");
    await expect(submit(users.alice, "idea", "no")).rejects.toThrow(/bit more/);
    await expect(submit(users.alice, "rant", "Something here")).rejects.toThrow(/Pick a type/);
    await expect(submit(users.alice, "idea", "x".repeat(1001))).rejects.toThrow(/1000/);
    await expect(asAnon(() => db.query("select public.submit_suggestion('idea', 'Anonymous idea')"))).rejects.toThrow(/permission denied/);
  });

  it("rate-limits to 5 an hour", async () => {
    const chatty = await createUser("chatty");
    for (let i = 1; i <= 5; i += 1) await submit(chatty, "other", `Suggestion number ${i}`);
    await expect(submit(chatty, "other", "Suggestion number 6")).rejects.toThrow(/Try again later/);
  });

  it("shows the list to everyone with usernames but never emails, and blocks direct table access", async () => {
    const rows = await list(null);
    expect(rows.length).toBeGreaterThanOrEqual(7);
    const mine = rows.find(r => r.id === ideaId);
    expect(mine).toMatchObject({ username: "Alice_1", my_vote: 0, is_mine: false });
    expect(Object.keys(mine)).not.toContain("email");
    await expect(asAnon(() => db.query("select * from public.suggestions"))).rejects.toThrow(/permission denied/);
    await expect(as(users.alice, () => db.query("update public.suggestions set status = 'done'"))).rejects.toThrow(/permission denied/);
    expect((await list(users.alice)).find(r => r.id === ideaId).is_mine).toBe(true);
  });

  it("counts votes, allows changing and removing a vote, one per person", async () => {
    await vote(users.bob, ideaId, 1);
    await vote(users.admin, ideaId, 1);
    await vote(users.bob, ideaId, 1);
    let row = (await list(users.bob)).find(r => r.id === ideaId);
    expect(row).toMatchObject({ up_votes: 2, down_votes: 0, my_vote: 1 });
    await vote(users.bob, ideaId, -1);
    row = (await list(users.bob)).find(r => r.id === ideaId);
    expect(row).toMatchObject({ up_votes: 1, down_votes: 1, my_vote: -1 });
    await vote(users.bob, ideaId, 0);
    row = (await list(users.bob)).find(r => r.id === ideaId);
    expect(row).toMatchObject({ up_votes: 1, down_votes: 0, my_vote: 0 });
    await expect(vote(users.bob, ideaId, 5)).rejects.toThrow(/Invalid vote/);
    await expect(asAnon(() => db.query("select public.vote_suggestion($1, 1)", [ideaId]))).rejects.toThrow(/permission denied/);
  });

  it("puts the most-voted first", async () => {
    const rows = await list(null);
    expect(rows[0].id).toBe(ideaId);
  });

  it("only admins can set status, reply and delete", async () => {
    await expect(as(users.alice, () => db.query("select public.admin_update_suggestion($1, 'done', 'hi')", [ideaId]))).rejects.toThrow(/Admins only/);
    await as(users.admin, () => db.query("select public.admin_update_suggestion($1, 'planned', ' Good idea, coming soon ')", [ideaId]));
    const row = (await list(null)).find(r => r.id === ideaId);
    expect(row).toMatchObject({ status: "planned", admin_note: "Good idea, coming soon" });
    await expect(as(users.admin, () => db.query("select public.admin_update_suggestion($1, 'maybe', null)", [ideaId]))).rejects.toThrow(/valid status/);
    await expect(as(users.alice, () => db.query("select public.admin_delete_suggestion($1)", [ideaId]))).rejects.toThrow(/Admins only/);
    await as(users.admin, () => db.query("select public.admin_delete_suggestion($1)", [ideaId]));
    expect((await list(null)).some(r => r.id === ideaId)).toBe(false);
  });
});

describe("0007: menus sent in", () => {
  const today = () => db.query("select (now() at time zone 'Europe/London')::date::text as d").then(r => r.rows[0].d);
  const daysAgo = n => db.query(`select ((now() at time zone 'Europe/London')::date - ${Number(n)})::text as d`).then(r => r.rows[0].d);
  const upload = (userId, name) => as(userId, () => db.query("insert into storage.objects (bucket_id, name) values ('menu-submissions', $1)", [name]));
  const submit = (userId, { pub = "the-harp", pubName = null, path, file = "menu.pdf", seen, note = null }) => as(userId, () => db.query(
    "select * from public.submit_menu_submission($1, $2, $3, $4, $5::date, $6)", [pub, pubName, path, file, seen, note]
  ).then(r => r.rows[0]));
  let aliceMenu;

  it("only lets users upload into their own private folder", async () => {
    await upload(users.alice, `${users.alice}/1-a.pdf`);
    await expect(upload(users.alice, `${users.bob}/1-a.pdf`)).rejects.toThrow(/row-level security/);
    await expect(asAnon(() => db.query("insert into storage.objects (bucket_id, name) values ('menu-submissions', 'x/1.pdf')"))).rejects.toThrow(/permission denied|row-level security/);
    const bucket = await db.query("select public, allowed_mime_types from storage.buckets where id = 'menu-submissions'");
    expect(bucket.rows[0]).toEqual({ public: false, allowed_mime_types: ["application/pdf", "image/jpeg", "image/png", "image/webp"] });
  });

  it("records a menu for a listed pub, or a pub that isn't listed", async () => {
    aliceMenu = await submit(users.alice, { path: `${users.alice}/1-a.pdf`, seen: await daysAgo(3), note: " Guinness on the board " });
    expect(aliceMenu).toMatchObject({ pub_id: "the-harp", pub_name: null, file_kind: "pdf", status: "new", note: "Guinness on the board" });
    await upload(users.alice, `${users.alice}/2-b.jpg`);
    const other = await submit(users.alice, { pub: null, pubName: "  The   Lamb, Holborn ", path: `${users.alice}/2-b.jpg`, file: "IMG_1.jpg", seen: await today() });
    expect(other).toMatchObject({ pub_id: null, pub_name: "The Lamb, Holborn", file_kind: "photo" });
  });

  it("checks the pub, file and date", async () => {
    const path = `${users.alice}/3-c.png`;
    await expect(asAnon(() => db.query("select public.submit_menu_submission('the-harp', null, 'x/1.pdf', 'm', current_date, null)"))).rejects.toThrow(/permission denied/);
    await expect(submit(users.alice, { path: `${users.bob}/3-c.png`, seen: await today() })).rejects.toThrow(/Upload the file first/);
    await expect(submit(users.alice, { path: `${users.alice}/3-c.docx`, seen: await today() })).rejects.toThrow(/PDF or a photo/);
    await expect(submit(users.alice, { path, seen: await daysAgo(-1) })).rejects.toThrow(/future/);
    await expect(submit(users.alice, { path, seen: await daysAgo(366) })).rejects.toThrow(/over a year old/);
    await expect(submit(users.alice, { path, seen: null })).rejects.toThrow(/date/);
    await expect(submit(users.alice, { pub: "no-such-pub", path, seen: await today() })).rejects.toThrow(/Pick a pub/);
    await expect(submit(users.alice, { pub: null, pubName: " ", path, seen: await today() })).rejects.toThrow(/which pub/);
    await db.query("insert into public.pubs (id, name, area, is_published) values ('secret-pub', 'Secret Pub', 'Soho', false) on conflict (id) do nothing");
    await expect(submit(users.alice, { pub: "secret-pub", path, seen: await today() })).rejects.toThrow(/Pick a pub/);
  });

  it("is only visible to the sender and admins", async () => {
    const mine = await as(users.alice, () => db.query("select id from public.menu_submissions").then(r => r.rows));
    expect(mine.length).toBe(2);
    const bobs = await as(users.bob, () => db.query("select id from public.menu_submissions").then(r => r.rows));
    expect(bobs).toEqual([]);
    const all = await as(users.admin, () => db.query("select id from public.menu_submissions").then(r => r.rows));
    expect(all.length).toBe(2);
    await expect(asAnon(() => db.query("select id from public.menu_submissions"))).rejects.toThrow(/permission denied/);
    await expect(as(users.alice, () => db.query("update public.menu_submissions set status = 'used'"))).rejects.toThrow(/permission denied/);
    const files = who => as(who, () => db.query("select name from storage.objects where bucket_id = 'menu-submissions'").then(r => r.rows.length));
    expect(await files(users.bob)).toBe(0);
    expect(await files(users.alice)).toBe(2);
    expect(await files(users.admin)).toBe(2);
  });

  it("lets admins mark menus used, reply, and delete", async () => {
    await expect(as(users.alice, () => db.query("select public.admin_review_menu_submission($1, 'used', null, 3)", [aliceMenu.id]))).rejects.toThrow(/Admins only/);
    await as(users.admin, () => db.query("select public.admin_review_menu_submission($1, 'used', ' Thanks! ', 3)", [aliceMenu.id]));
    const row = await as(users.admin, () => db.query("select * from public.admin_review_menu_submission($1, 'used', 'Thanks!', 2)", [aliceMenu.id]).then(r => r.rows[0]));
    expect(row).toMatchObject({ status: "used", admin_note: "Thanks!", prices_imported: 5 });
    await expect(as(users.admin, () => db.query("select public.admin_review_menu_submission($1, 'maybe', null, null)", [aliceMenu.id]))).rejects.toThrow(/valid status/);
    const seen = await as(users.alice, () => db.query("select status, admin_note from public.menu_submissions where id = $1", [aliceMenu.id]).then(r => r.rows[0]));
    expect(seen).toEqual({ status: "used", admin_note: "Thanks!" });
    await expect(as(users.alice, () => db.query("select public.admin_delete_menu_submission($1)", [aliceMenu.id]))).rejects.toThrow(/Admins only/);
    const path = await as(users.admin, () => db.query("select public.admin_delete_menu_submission($1) as p", [aliceMenu.id]).then(r => r.rows[0].p));
    expect(path).toBe(`${users.alice}/1-a.pdf`);
  });

  it("limits each user to 10 menus a day", async () => {
    for (let i = 0; i < 9; i += 1) {
      await upload(users.bob, `${users.bob}/${i}-m.pdf`);
      await submit(users.bob, { path: `${users.bob}/${i}-m.pdf`, seen: await today() });
    }
    await upload(users.bob, `${users.bob}/9-m.pdf`);
    await submit(users.bob, { path: `${users.bob}/9-m.pdf`, seen: await today() });
    await expect(upload(users.bob, `${users.bob}/10-m.pdf`)).rejects.toThrow(/row-level security/);
    await expect(submit(users.bob, { path: `${users.bob}/10-m.pdf`, seen: await today() })).rejects.toThrow(/10 menus today/);
  });

  it("saves admin prices with the date they were seen, without replacing a newer price", async () => {
    const setPrice = (drink, price, seen) => as(users.admin, () => db.query(
      "select * from public.admin_set_drink_price('the-harp', $1, null, null, null, $2, 'admin', null, 'from a menu sent in', $3::date)", [drink, price, seen]
    ).then(r => r.rows[0]));
    const id = await drinkId("the-harp", "Guinness");
    const current = () => db.query("select current_price::float as price, source, last_updated_at from public.drinks where id = $1", [id]).then(r => r.rows[0]);

    // An estimate is replaced even by an older menu, and the price keeps the menu's date.
    await db.query("update public.drinks set source = 'seed' where id = $1", [id]);
    const old = await setPrice(id, 6.1, await daysAgo(10));
    let now = await current();
    expect(now).toMatchObject({ price: 6.1, source: "admin" });
    expect(now.last_updated_at.toISOString()).toBe(old.reported_at.toISOString());
    expect(Date.now() - now.last_updated_at.getTime()).toBeGreaterThan(9 * 86400000);

    // A newer price replaces it; an older one only goes into the history.
    await setPrice(id, 6.3, await daysAgo(2));
    await setPrice(id, 5.9, await daysAgo(5));
    now = await current();
    expect(now.price).toBe(6.3);
    const history = await db.query("select price::float from public.price_reports where drink_id = $1 and source = 'admin' order by reported_at desc", [id]);
    expect(history.rows.map(r => r.price)).toEqual([6.3, 5.9, 6.1]);

    // Today (or no date) means now.
    await setPrice(id, 6.4, await today());
    expect((await current()).price).toBe(6.4);
    await expect(setPrice(id, 6.4, await daysAgo(-1))).rejects.toThrow(/future/);
    await expect(setPrice(id, 6.4, await daysAgo(400))).rejects.toThrow(/over a year/);
    // The old 9-argument form still works (date defaults to now).
    await as(users.admin, () => db.query("select public.admin_set_drink_price('the-harp', $1, null, null, null, 6.5, 'admin', null, null)", [id]));
    expect((await current()).price).toBe(6.5);
  });

  it("stays a single set-price function if older migrations are re-run", async () => {
    await db.query(read("supabase/migrations/0002_pub_admin.sql"));
    await db.query(read("supabase/migrations/0005_bottles.sql"));
    const { rows } = await db.query("select count(*)::int as n from pg_proc where proname = 'admin_set_drink_price'");
    expect(rows[0].n).toBe(1);
    await db.query(read("supabase/migrations/0007_menu_submissions.sql"));
  await db.query(read("supabase/migrations/0008_features.sql"));
  await db.query(read("supabase/migrations/0009_food_menus.sql"));
  });
});

describe("0008: feature switches and new features", () => {
  const q = (who, sql, params = []) => as(who, () => db.query(sql, params).then(r => r.rows));
  const setFeature = (key, live) => q(users.admin, "select public.admin_set_feature($1, $2)", [key, live]);

  it("starts every feature switched off; only admins can switch them", async () => {
    const rows = await asAnon(() => db.query("select key, is_live from public.app_features").then(r => r.rows));
    expect(rows.length).toBe(18);
    expect(rows.every(r => r.is_live === false)).toBe(true);
    await expect(q(users.alice, "select public.admin_set_feature('still_right', true)")).rejects.toThrow(/Admins only/);
    await expect(setFeature("email_digest", true)).rejects.toThrow(/needs setting up/);
    await expect(setFeature("nope", true)).rejects.toThrow(/Unknown feature/);
    await expect(q(users.alice, "update public.app_features set is_live = true")).rejects.toThrow(/permission denied/);
  });

  it("lets admins try a feature before launch, and users once it's live", async () => {
    const id = await drinkId("the-harp", "Westons Old Rosie");
    await expect(q(users.alice, "select public.confirm_price($1)", [id])).rejects.toThrow(/isn't available yet/);
    const [adminTry] = await q(users.admin, "select * from public.confirm_price($1)", [id]);
    expect(adminTry).toMatchObject({ kind: "confirm", source: "community" });
    await setFeature("still_right", true);
    const before = (await db.query("select current_price::float as p from public.drinks where id = $1", [id])).rows[0].p;
    const [row] = await q(users.alice, "select * from public.confirm_price($1)", [id]);
    expect(row).toMatchObject({ kind: "confirm", note: "Still right" });
    expect(Number(row.price)).toBe(before);
    const drink = (await db.query("select source, last_updated_at from public.drinks where id = $1", [id])).rows[0];
    expect(drink.source).toBe("community");
    expect(Date.now() - drink.last_updated_at.getTime()).toBeLessThan(60000);
    await expect(q(users.alice, "select public.confirm_price($1)", [id])).rejects.toThrow(/already checked this price today/);
    await expect(asAnon(() => db.query("select public.confirm_price($1)", [id]))).rejects.toThrow(/permission denied/);
  });

  it("holds a big price jump from an untrusted reporter for review (only when switched on)", async () => {
    const id = await drinkId("the-harp", "Dark Star Hophead");
    await db.query("update public.drinks set source = 'community', current_price = 6 where id = $1", [id]);
    await db.query("delete from public.price_reports where reporter in ($1, $2) and drink_id = $3", [users.bob, users.alice, id]);
    const off = await report(users.bob, { pub: "the-harp", drinkId: id, price: 9.5 });
    expect(off.held).toBe(false);
    await db.query("update public.drinks set current_price = 6 where id = $1", [id]);
    await setFeature("trusted_reporters", true);
    await db.query("delete from public.price_reports where reporter = $1 and drink_id = $2", [users.bob, id]);
    const held = await report(users.bob, { pub: "the-harp", drinkId: id, price: 9.5 });
    expect(held).toMatchObject({ held: true, is_hidden: true });
    expect((await db.query("select current_price::float as p from public.drinks where id = $1", [id])).rows[0].p).toBe(6);
    // Bob can see his own held report; others can't.
    expect((await q(users.bob, "select id from public.price_reports where id = $1", [held.id])).length).toBe(1);
    expect((await q(users.alice, "select id from public.price_reports where id = $1", [held.id])).length).toBe(0);
    // A normal change goes straight through.
    await db.query("delete from public.price_reports where reporter = $1 and drink_id = $2", [users.alice, id]);
    const small = await report(users.alice, { pub: "the-harp", drinkId: id, price: 6.2 });
    expect(small.held).toBe(false);
    await expect(q(users.alice, "select public.admin_review_held_report($1, true)", [held.id])).rejects.toThrow(/Admins only/);
    await q(users.admin, "select public.admin_review_held_report($1, true)", [held.id]);
    const after = (await db.query("select current_price::float as p from public.drinks where id = $1", [id])).rows[0].p;
    expect(after).toBe(6.2); // Alice's report is newer, so it stays current
    const approved = (await db.query("select held, is_hidden from public.price_reports where id = $1", [held.id])).rows[0];
    expect(approved).toEqual({ held: false, is_hidden: false });
    await expect(q(users.admin, "select public.admin_review_held_report($1, true)", [held.id])).rejects.toThrow(/isn't waiting/);
  });

  it("makes reporters trusted once 5 of their prices are matched", async () => {
    const [before] = await q(null, "select public.is_trusted_reporter($1) as t", [users.alice]);
    expect(before.t).toBe(false);
    const drinks = (await db.query("select id, pub_id, current_price from public.drinks where pub_id = 'the-toucan' limit 5")).rows;
    for (const d of drinks) {
      await db.query("insert into public.price_reports (pub_id, drink_id, drink_name, category, price, reporter, source) values ($1, $2, 'x', 'Lager', 6, $3, 'community'), ($1, $2, 'x', 'Lager', 6.05, $4, 'community')", [d.pub_id, d.id, users.alice, users.admin]);
    }
    const [after] = await q(null, "select public.is_trusted_reporter($1) as t", [users.alice]);
    expect(after.t).toBe(true);
    const names = (await asAnon(() => db.query("select * from public.trusted_usernames() as u").then(r => r.rows.map(x => x.u))));
    expect(names).toContain("Alice_1");
    const stats = await asAnon(() => db.query("select * from public.community_stats(null)").then(r => r.rows));
    expect(stats.find(s => s.username === "Alice_1")).toMatchObject({ trusted: true });
    expect(stats.find(s => s.username === "Alice_1").confirms).toBeGreaterThanOrEqual(1);
  });

  it("attaches a private receipt to your own recent report", async () => {
    const id = await drinkId("the-harp", "Guinness");
    const own = await report(users.bob, { pub: "the-harp", drinkId: id, price: 6.3 });
    const path = `${users.bob}/1-r.jpg`;
    await expect(q(users.bob, "select public.attach_receipt($1, $2)", [own.id, path])).rejects.toThrow(/isn't available yet/);
    await setFeature("receipts", true);
    await expect(q(users.alice, "select public.attach_receipt($1, $2)", [own.id, `${users.alice}/1-r.jpg`])).rejects.toThrow(/own report/);
    await expect(q(users.bob, "select public.attach_receipt($1, $2)", [own.id, `${users.alice}/1-r.jpg`])).rejects.toThrow(/Upload the receipt first/);
    await q(users.bob, "select public.attach_receipt($1, $2)", [own.id, path]);
    expect((await db.query("select receipt_path from public.price_reports where id = $1", [own.id])).rows[0].receipt_path).toBe(path);
    await expect(as(users.alice, () => db.query("insert into storage.objects (bucket_id, name) values ('receipts', $1)", [`${users.bob}/2.jpg`]))).rejects.toThrow(/row-level security/);
  });

  it("saves, checks and hides deals until published", async () => {
    const deal = { pub_id: "the-harp", title: "£5 pints", days: [1, 2, 3, 4, 5], start_time: "16:00", end_time: "19:00", deal_price: "5.00" };
    await expect(q(users.alice, "select public.admin_save_deal($1)", [deal])).rejects.toThrow(/Admins only/);
    await expect(q(users.admin, "select public.admin_save_deal($1)", [{ ...deal, deal_price: "", discount_pct: "" }])).rejects.toThrow(/Check the deal/);
    await expect(q(users.admin, "select public.admin_save_deal($1)", [{ ...deal, days: [] }])).rejects.toThrow(/Check the deal/);
    await expect(q(users.admin, "select public.admin_save_deal($1)", [{ ...deal, start_time: "banana" }])).rejects.toThrow(/Check the times/);
    const [saved] = await q(users.admin, "select * from public.admin_save_deal($1)", [deal]);
    expect(saved).toMatchObject({ title: "£5 pints", is_published: false, days: [1, 2, 3, 4, 5] });
    expect((await asAnon(() => db.query("select id from public.deals").then(r => r.rows))).length).toBe(0);
    await q(users.admin, "select public.admin_save_deal($1)", [{ ...deal, id: saved.id, is_published: true }]);
    expect((await asAnon(() => db.query("select id from public.deals").then(r => r.rows))).length).toBe(1);
    await q(users.admin, "select public.admin_delete_deal($1)", [saved.id]);
    expect((await db.query("select count(*)::int as n from public.deals")).rows[0].n).toBe(0);
  });

  it("validates opening hours", async () => {
    await q(users.admin, "select public.admin_set_opening_hours('the-harp', $1)", [{ 1: [["11:00", "23:00"]], 5: [["11:00", "01:00"]], 0: [] }]);
    expect((await db.query("select opening_hours from public.pubs where id = 'the-harp'")).rows[0].opening_hours).toMatchObject({ 1: [["11:00", "23:00"]] });
    await expect(q(users.admin, "select public.admin_set_opening_hours('the-harp', $1)", [{ 9: [] }])).rejects.toThrow(/Invalid opening hours/);
    await expect(q(users.admin, "select public.admin_set_opening_hours('the-harp', $1)", [{ 1: [["25:00", "23:00"]] }])).rejects.toThrow(/Times must look like/);
    await expect(q(users.alice, "select public.admin_set_opening_hours('the-harp', null)")).rejects.toThrow(/Admins only/);
  });

  it("checks you in only when you're at the pub", async () => {
    const { lat, lng } = (await db.query("select lat, lng from public.pubs where id = 'the-harp'")).rows[0];
    await expect(q(users.bob, "select public.check_in('the-harp', $1, $2)", [lat, lng])).rejects.toThrow(/isn't available yet/);
    await setFeature("check_ins", true);
    await expect(q(users.bob, "select public.check_in('the-harp', $1, $2)", [lat + 0.01, lng])).rejects.toThrow(/need to be at the pub/);
    await q(users.bob, "select public.check_in('the-harp', $1, $2)", [lat + 0.0005, lng]);
    await expect(q(users.bob, "select public.check_in('the-harp', $1, $2)", [lat, lng])).rejects.toThrow(/already checked in/);
    const busy = await asAnon(() => db.query("select * from public.pub_busy()").then(r => r.rows));
    expect(busy).toEqual([{ pub_id: "the-harp", people: 1 }]);
    expect((await q(users.alice, "select * from public.checkins")).length).toBe(0);
    expect((await q(users.bob, "select * from public.checkins")).length).toBe(1);
  });

  it("rates the Guinness pour once a day per pub", async () => {
    await setFeature("guinness_score", true);
    await q(users.bob, "select public.rate_pour('the-harp', 4)");
    await q(users.bob, "select public.rate_pour('the-harp', 5)");
    await q(users.alice, "select public.rate_pour('the-harp', 3)");
    const scores = await asAnon(() => db.query("select pub_id, score::float, ratings from public.pour_scores()").then(r => r.rows));
    expect(scores).toEqual([{ pub_id: "the-harp", score: 4, ratings: 2 }]);
    await expect(q(users.bob, "select public.rate_pour('the-harp', 6)")).rejects.toThrow(/1 to 5/);
    const noGuinness = (await db.query("select id from public.pubs p where not exists (select 1 from public.drinks d where d.pub_id = p.id and d.name_normalized like '%guinness%') and is_published limit 1")).rows[0];
    if (noGuinness) await expect(q(users.bob, "select public.rate_pour($1, 4)", [noGuinness.id])).rejects.toThrow(/doesn't list Guinness/);
  });

  it("keeps price watches private and limited", async () => {
    await setFeature("price_watch", true);
    const [w] = await q(users.bob, "select * from public.add_price_watch('Guinness', 6, 'Soho')");
    expect(w).toMatchObject({ query: "Guinness", area: "Soho" });
    await expect(q(users.bob, "select public.add_price_watch('G', 6, null)")).rejects.toThrow(/Type a drink/);
    expect((await q(users.alice, "select * from public.price_watches")).length).toBe(0);
    await q(users.alice, "delete from public.price_watches where id = $1", [w.id]);
    expect((await q(users.bob, "select * from public.price_watches")).length).toBe(1);
    await q(users.bob, "delete from public.price_watches where id = $1", [w.id]);
    expect((await q(users.bob, "select * from public.price_watches")).length).toBe(0);
    for (let i = 0; i < 10; i += 1) await q(users.bob, "select public.add_price_watch($1, 6, null)", [`Beer ${i}`]);
    await expect(q(users.bob, "select public.add_price_watch('One more', 6, null)")).rejects.toThrow(/up to 10/);
  });
});

describe("0009: food menu links and the 25 Sep 2026 research", () => {
  const savePub = (userId, pub) => as(userId, () => db.query("select * from public.admin_save_pub($1)", [pub]).then(r => r.rows[0]));

  it("seeds food menu links and lets admins edit them", async () => {
    const { rows } = await db.query("select food_menu_url from public.pubs where id = 'the-ship-tavern'");
    expect(rows[0].food_menu_url).toBe("https://theshiptavern.co.uk/menus/");
    const saved = await savePub(users.admin, { id: "the-lyric-food", name: "The Lyric", area: "Soho", food_menu_url: "https://example.com/food" });
    expect(saved.food_menu_url).toBe("https://example.com/food");
    await expect(savePub(users.admin, { id: "the-lyric-food", name: "The Lyric", area: "Soho", food_menu_url: "example.com" })).rejects.toThrow(/Food menu link/);
  });

  it("appends the new research to notes once, and seeds one-off events unpublished", async () => {
    await db.query(read("supabase/seed.sql"));
    const { rows } = await db.query("select notes from public.pub_admin where pub_id = 'the-toucan'");
    expect(rows[0].notes.split("[25 Sep 2026 research]").length).toBe(2);
    const events = await db.query("select schedule, event_date::text, is_published from public.events where pub_id = 'lamb-and-flag' and schedule = 'one-off' order by event_date");
    expect(events.rows.map(e => e.event_date)).toEqual(["2026-09-27", "2026-10-25", "2026-11-29"]);
    expect(events.rows.every(e => !e.is_published)).toBe(true);
  });
});
