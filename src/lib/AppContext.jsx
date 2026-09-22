import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { friendlyError } from "./api/errors.js";

const AppContext = createContext(null);

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside <AppProvider>");
  return value;
}

export function AppProvider({ api, children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [pubs, setPubs] = useState([]);
  const [pubsStatus, setPubsStatus] = useState("loading");
  const [pubsError, setPubsError] = useState("");
  const [favourites, setFavourites] = useState(() => new Set());
  const [liveStatus, setLiveStatus] = useState("connecting");
  const [changeVersion, setChangeVersion] = useState(0);
  const [toasts, setToasts] = useState([]);
  const reloadTimer = useRef(null);
  const userId = session?.user?.id || null;

  const toast = useCallback((message, tone = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts(list => [...list.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), 4500);
  }, []);

  const reloadPubs = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setPubsStatus(status => (status === "ready" ? "ready" : "loading"));
    try {
      setPubs(await api.listPubs());
      setPubsStatus("ready");
      setPubsError("");
    } catch (error) {
      setPubsError(friendlyError(error, "Couldn't load pubs."));
      setPubsStatus(status => (status === "ready" ? "ready" : "error"));
      if (quiet) toast(friendlyError(error, "Couldn't refresh prices."), "error");
    }
  }, [api, toast]);

  // Auth session
  useEffect(() => {
    let active = true;
    api.auth.getSession()
      .then(current => { if (active) setSession(current); })
      .catch(() => {})
      .finally(() => { if (active) setAuthReady(true); });
    const unsubscribe = api.auth.onChange(next => setSession(next));
    return () => { active = false; unsubscribe(); };
  }, [api]);

  // Profile + favourites for the signed-in user
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setFavourites(new Set());
      return undefined;
    }
    let active = true;
    Promise.all([api.getProfile(userId), api.listFavourites(userId)])
      .then(([nextProfile, favouriteIds]) => {
        if (!active) return;
        setProfile(nextProfile);
        setFavourites(new Set(favouriteIds));
      })
      .catch(error => active && toast(friendlyError(error, "Couldn't load your account."), "error"));
    return () => { active = false; };
  }, [api, userId, toast]);

  // Pubs, plus live updates whenever anyone reports a price
  useEffect(() => {
    reloadPubs();
    const unsubscribe = api.subscribeToChanges(event => {
      if (event.status) {
        setLiveStatus(event.status === "SUBSCRIBED" ? "live" : event.status === "CLOSED" ? "offline" : "connecting");
        return;
      }
      setChangeVersion(v => v + 1);
      window.clearTimeout(reloadTimer.current);
      reloadTimer.current = window.setTimeout(() => reloadPubs({ quiet: true }), 400);
    });
    return () => {
      window.clearTimeout(reloadTimer.current);
      unsubscribe();
    };
  }, [api, reloadPubs]);

  const toggleFavourite = useCallback(async pubId => {
    if (!userId) {
      toast("Sign in to save favourites.");
      return;
    }
    const next = !favourites.has(pubId);
    setFavourites(prev => {
      const copy = new Set(prev);
      if (next) copy.add(pubId); else copy.delete(pubId);
      return copy;
    });
    try {
      await api.setFavourite(userId, pubId, next);
    } catch (error) {
      setFavourites(prev => {
        const copy = new Set(prev);
        if (next) copy.delete(pubId); else copy.add(pubId);
        return copy;
      });
      toast(friendlyError(error, "Couldn't update favourites."), "error");
    }
  }, [api, userId, favourites, toast]);

  const value = useMemo(() => ({
    api,
    session,
    userId,
    profile,
    isAdmin: Boolean(profile?.is_admin),
    authReady,
    pubs,
    pubsById: Object.fromEntries(pubs.map(pub => [pub.id, pub])),
    pubsStatus,
    pubsError,
    reloadPubs,
    favourites,
    toggleFavourite,
    liveStatus,
    changeVersion,
    notifyChange: () => { setChangeVersion(v => v + 1); reloadPubs({ quiet: true }); },
    toast,
    toasts
  }), [api, session, userId, profile, authReady, pubs, pubsStatus, pubsError, reloadPubs, favourites, toggleFavourite, liveStatus, changeVersion, toast, toasts]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
