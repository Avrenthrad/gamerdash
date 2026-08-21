// Guilds — real social groups of Lykodex users. Not the same as the 5
// top-level Colleges — a Guild is a small crew that cuts across all
// of them. Activity feed is built entirely from real, already-tracked
// data (see lib/guilds.js) — no invented per-game stats.
//
// Public guilds are browsable and joined by request (owner approves);
// private guilds are hidden from browsing and joinable only by a
// direct invite from a member, or by entering the guild's own unique
// code (same trust model as a Discord invite link).

import { useEffect, useState } from "react";
import {
  fetchGuilds, createGuild, joinGuildByCode, leaveGuild,
  fetchMyGuilds, fetchGuildMembersWithProfiles, fetchGuildActivity,
  describeActivity, updateGuildPrivacy, updateGuildProfile, requestToJoinGuild, withdrawJoinRequest,
  fetchMyJoinRequest, fetchJoinRequestsForGuild, respondToJoinRequest,
  inviteToGuild, fetchMyGuildInvites, acceptGuildInvite, declineGuildInvite,
  fetchGuildPosts, createGuildPost, deleteGuildPost, voteOnPost,
  fetchPostComments, addPostComment, deletePostComment, uploadPostImage,
} from "../lib/guilds";
import { findUserByFriendCode } from "../lib/friends";
import { supabase } from "../lib/supabaseClient";
import MiniAvatar from "./MiniAvatar";

function displayName(profile) {
  if (!profile) return "Someone";
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  return full || profile.username || "Someone";
}

export default function GuildsPage({ onBack, userId, isLoggedIn, onSignIn, onCreateAccount }) {
  const [allGuilds, setAllGuilds] = useState([]);
  const [myGuilds, setMyGuilds] = useState([]);
  const [myInvites, setMyInvites] = useState([]);
  const [status, setStatus] = useState("loading");

  const [newGuildName, setNewGuildName] = useState("");
  const [newGuildPrivate, setNewGuildPrivate] = useState(false);
  const [creatingGuild, setCreatingGuild] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeStatus, setCodeStatus] = useState("idle");
  const [codeMessage, setCodeMessage] = useState("");

  const [activeGuild, setActiveGuild] = useState(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setStatus("ready");
      return;
    }
    loadGuilds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, userId]);

  async function loadGuilds() {
    setStatus("loading");
    try {
      const [all, mine, invites] = await Promise.all([
        fetchGuilds(),
        fetchMyGuilds(userId),
        fetchMyGuildInvites(userId),
      ]);
      setAllGuilds(all);
      setMyGuilds(mine);
      setMyInvites(invites);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to load guilds:", err);
      setStatus("error");
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newGuildName.trim() || creatingGuild) return;
    setCreatingGuild(true);
    try {
      await createGuild(userId, newGuildName.trim(), newGuildPrivate);
      setNewGuildName("");
      setNewGuildPrivate(false);
      await loadGuilds();
    } catch (err) {
      console.error("Failed to create guild:", err);
    } finally {
      setCreatingGuild(false);
    }
  }

  async function handleRequestJoin(guildId) {
    try {
      await requestToJoinGuild(guildId, userId);
      loadGuilds();
    } catch (err) {
      console.error("Failed to request to join guild:", err);
    }
  }

  async function handleJoinByCode(e) {
    e.preventDefault();
    if (!codeInput.trim()) return;
    setCodeStatus("loading");
    setCodeMessage("");
    try {
      const guild = await joinGuildByCode(codeInput.trim());
      setCodeStatus("done");
      setCodeMessage(`Joined ${guild.name}.`);
      setCodeInput("");
      loadGuilds();
    } catch (err) {
      console.error("Failed to join by code:", err);
      setCodeStatus("error");
      setCodeMessage(err.message || "That code didn't match a real guild.");
    }
  }

  async function handleLeave(guildId) {
    try {
      await leaveGuild(guildId, userId);
      if (activeGuild?.id === guildId) setActiveGuild(null);
      loadGuilds();
    } catch (err) {
      console.error("Failed to leave guild:", err);
    }
  }

  async function handleAcceptInvite(invite) {
    try {
      await acceptGuildInvite(invite);
      loadGuilds();
    } catch (err) {
      console.error("Failed to accept guild invite:", err);
    }
  }

  async function handleDeclineInvite(inviteId) {
    try {
      await declineGuildInvite(inviteId);
      loadGuilds();
    } catch (err) {
      console.error("Failed to decline guild invite:", err);
    }
  }

  const myGuildIds = new Set(myGuilds.map((g) => g.id));

  if (!isLoggedIn) {
    return (
      <div className="price-page">
        <div className="price-page__head">
          <button type="button" className="back-link" onClick={onBack}>← Back</button>
          <h1 className="price-page__title">Guilds</h1>
          <p className="price-page__subtitle">Sign in to create or join a guild.</p>
        </div>
        <div className="backlog-add">
          <button type="button" className="linking-row__connect" onClick={onSignIn}>Sign in</button>
          <button type="button" className="linking-row__connect" onClick={onCreateAccount}>Create account</button>
        </div>
      </div>
    );
  }

  if (activeGuild) {
    return (
      <GuildDetail
        guild={activeGuild}
        userId={userId}
        isMember={myGuildIds.has(activeGuild.id)}
        isOwner={activeGuild.created_by === userId}
        onBack={() => setActiveGuild(null)}
        onLeave={() => handleLeave(activeGuild.id)}
        onPrivacyChanged={(isPrivate) => {
          setActiveGuild((g) => ({ ...g, is_private: isPrivate }));
          setAllGuilds((prev) => prev.map((g) => (g.id === activeGuild.id ? { ...g, is_private: isPrivate } : g)));
        }}
      />
    );
  }

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back</button>
        <h1 className="price-page__title">Guilds</h1>
        <p className="price-page__subtitle">
          Real crews of Lykodex users — a shared feed of real achievements, backlog progress, and collection adds.
        </p>
      </div>

      {myInvites.length > 0 && (
        <div className="backlog-add" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <span className="feed-col__label">Guild invites</span>
          {myInvites.map((invite) => (
            <div key={invite.id} className="backlog-card">
              <div className="backlog-card__info">
                <span className="backlog-card__title">{invite.guilds?.name}</span>
                <span className="backlog-card__meta">{invite.guilds?.is_private ? "Private guild" : "Public guild"}</span>
              </div>
              <button type="button" className="linking-row__connect" onClick={() => handleAcceptInvite(invite)}>Accept</button>
              <button type="button" className="game-popup__close" onClick={() => handleDeclineInvite(invite.id)} aria-label="Decline">✕</button>
            </div>
          ))}
        </div>
      )}

      <form className="price-search" onSubmit={handleJoinByCode}>
        <input
          className="price-search__input"
          type="text"
          placeholder="Have a guild code? Enter it to join instantly…"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
        />
        <button type="submit" className="price-search__button" disabled={codeStatus === "loading"}>
          {codeStatus === "loading" ? "Joining…" : "Join"}
        </button>
      </form>
      {codeMessage && (
        <p className={`panel__status ${codeStatus === "error" ? "panel__status--error" : ""}`}>{codeMessage}</p>
      )}

      <form className="price-search" onSubmit={handleCreate}>
        <input
          className="price-search__input"
          type="text"
          placeholder="New guild name…"
          value={newGuildName}
          onChange={(e) => setNewGuildName(e.target.value)}
        />
        <label className="pref-choice" style={{ flexShrink: 0 }}>
          <input type="checkbox" checked={newGuildPrivate} onChange={(e) => setNewGuildPrivate(e.target.checked)} />
          <span>Private</span>
        </label>
        <button type="submit" className="price-search__button" disabled={creatingGuild}>
          {creatingGuild ? "Creating…" : "Create guild"}
        </button>
      </form>

      {status === "loading" && <p className="panel__status">Loading guilds…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load guilds right now.</p>}
      {status === "ready" && allGuilds.length === 0 && <p className="panel__status">No guilds yet — create the first one.</p>}

      {status === "ready" && allGuilds.length > 0 && (
        <ul className="backlog-list">
          {allGuilds.map((guild) => (
            <GuildRow
              key={guild.id}
              guild={guild}
              userId={userId}
              isMember={myGuildIds.has(guild.id)}
              onView={() => setActiveGuild(guild)}
              onRequestJoin={() => handleRequestJoin(guild.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function GuildRow({ guild, userId, isMember, onView, onRequestJoin }) {
  const [myRequest, setMyRequest] = useState(undefined); // undefined = not checked yet

  useEffect(() => {
    if (isMember) return;
    fetchMyJoinRequest(guild.id, userId)
      .then(setMyRequest)
      .catch((err) => console.error("Failed to check join request status:", err));
  }, [guild.id, userId, isMember]);

  async function handleWithdraw() {
    try {
      await withdrawJoinRequest(myRequest.id);
      setMyRequest(null);
    } catch (err) {
      console.error("Failed to withdraw join request:", err);
    }
  }

  return (
    <li className="backlog-card">
      {guild.logo_url ? (
        <img src={guild.logo_url} alt="" className="guild-row__logo" />
      ) : (
        <div className="guild-row__logo guild-row__logo--placeholder" aria-hidden="true">
          {guild.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="backlog-card__info">
        <span className="backlog-card__title">
          {guild.name}
          {guild.is_official && <span className="tag tag--rose-outline" style={{ marginLeft: "8px" }}>Official</span>}
        </span>
        <span className="backlog-card__meta">{guild.is_private ? "Private" : "Public"}</span>
      </div>
      <button type="button" className="linking-row__connect" onClick={onView}>View</button>
      {!isMember && myRequest === null && (
        <button type="button" className="linking-row__connect" onClick={onRequestJoin}>Request to join</button>
      )}
      {!isMember && myRequest && (
        <>
          <span className="score-badge">Request pending</span>
          <button type="button" className="game-popup__close" onClick={handleWithdraw} aria-label="Withdraw join request">✕</button>
        </>
      )}
    </li>
  );
}

function GuildDetail({ guild: initialGuild, userId, isMember, isOwner, onBack, onLeave, onPrivacyChanged }) {
  const [guild, setGuild] = useState(initialGuild);
  const [tab, setTab] = useState("posts");
  const [members, setMembers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [status, setStatus] = useState("loading");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteStatus, setInviteStatus] = useState("idle");
  const [inviteMessage, setInviteMessage] = useState("");
  const [descriptionInput, setDescriptionInput] = useState(initialGuild.description || "");
  const [descriptionStatus, setDescriptionStatus] = useState("idle");
  const [logoStatus, setLogoStatus] = useState("idle"); // idle | uploading | error
  const [bannerStatus, setBannerStatus] = useState("idle");

  function extFor(file, fallback) {
    const nameExt = file.name.includes(".") ? file.name.split(".").pop() : "";
    const mimeExt = file.type?.split("/")?.[1];
    return (nameExt || mimeExt || fallback).toLowerCase().replace(/[^a-z0-9]/g, "") || fallback;
  }

  async function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoStatus("uploading");
    try {
      const path = `${guild.id}/logo.${extFor(file, "png")}`;
      const { error: uploadError } = await supabase.storage
        .from("guild-media")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("guild-media").getPublicUrl(path);
      const logoUrl = `${data.publicUrl}?t=${Date.now()}`;
      await updateGuildProfile(guild.id, { logoUrl });
      setGuild((g) => ({ ...g, logo_url: logoUrl }));
      setLogoStatus("idle");
    } catch (err) {
      console.error("Failed to upload guild logo:", err);
      setLogoStatus("error");
    }
  }

  async function handleBannerChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerStatus("uploading");
    try {
      const path = `${guild.id}/banner.${extFor(file, "jpg")}`;
      const { error: uploadError } = await supabase.storage
        .from("guild-media")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("guild-media").getPublicUrl(path);
      const bannerUrl = `${data.publicUrl}?t=${Date.now()}`;
      await updateGuildProfile(guild.id, { bannerUrl });
      setGuild((g) => ({ ...g, banner_url: bannerUrl }));
      setBannerStatus("idle");
    } catch (err) {
      console.error("Failed to upload guild banner:", err);
      setBannerStatus("error");
    }
  }

  async function handleSaveDescription(e) {
    e.preventDefault();
    setDescriptionStatus("saving");
    try {
      await updateGuildProfile(guild.id, { description: descriptionInput.trim() || null });
      setGuild((g) => ({ ...g, description: descriptionInput.trim() || null }));
      setDescriptionStatus("saved");
    } catch (err) {
      console.error("Failed to save guild description:", err);
      setDescriptionStatus("error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guild.id]);

  async function load() {
    setStatus("loading");
    try {
      const [membersData, activityData, requestsData] = await Promise.all([
        fetchGuildMembersWithProfiles(guild.id),
        fetchGuildActivity(guild.id),
        isOwner ? fetchJoinRequestsForGuild(guild.id) : Promise.resolve([]),
      ]);
      setMembers(membersData);
      setActivity(activityData);
      setJoinRequests(requestsData);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to load guild details:", err);
      setStatus("error");
    }
  }

  async function handleTogglePrivacy() {
    try {
      const nextPrivate = !guild.is_private;
      await updateGuildPrivacy(guild.id, nextPrivate);
      setGuild((g) => ({ ...g, is_private: nextPrivate }));
      onPrivacyChanged(nextPrivate);
    } catch (err) {
      console.error("Failed to update guild privacy:", err);
    }
  }

  async function handleRespond(requestId, approve) {
    try {
      await respondToJoinRequest(requestId, approve);
      load();
    } catch (err) {
      console.error("Failed to respond to join request:", err);
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setInviteStatus("loading");
    setInviteMessage("");
    try {
      const found = await findUserByFriendCode(inviteCode.trim());
      if (!found) {
        setInviteStatus("error");
        setInviteMessage("No Lykodex account found with that friend code.");
        return;
      }
      await inviteToGuild(guild.id, found.id, userId);
      setInviteStatus("done");
      setInviteMessage(`Invited ${displayName(found)}.`);
      setInviteCode("");
    } catch (err) {
      console.error("Failed to invite to guild:", err);
      setInviteStatus("error");
      setInviteMessage(err.message || "Couldn't send that invite.");
    }
  }

  return (
    <div className="price-page">
      {guild.banner_url && <img src={guild.banner_url} alt="" className="guild-detail__banner" />}

      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back to Guilds</button>
        <div className="guild-detail__identity">
          {guild.logo_url ? (
            <img src={guild.logo_url} alt="" className="guild-detail__logo" />
          ) : (
            <div className="guild-detail__logo guild-detail__logo--placeholder" aria-hidden="true">
              {guild.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="price-page__title">
              {guild.name}
              {guild.is_official && <span className="tag tag--rose-outline" style={{ marginLeft: "10px" }}>Official Lykodex Guild</span>}
            </h1>
            <p className="price-page__subtitle">
              {members.length} member{members.length === 1 ? "" : "s"} · {guild.is_private ? "Private" : "Public"}
            </p>
          </div>
        </div>
        {guild.description && <p className="settings-card__note">{guild.description}</p>}
      </div>

      {isMember && (
        <div className="friend-code-row">
          <span className="friend-code-row__code">{guild.code}</span>
          <span className="panel__status" style={{ margin: 0 }}>Share this code so someone can join instantly.</span>
        </div>
      )}

      {isMember && (
        <button type="button" className="quickdash-reset-btn" onClick={onLeave}>
          Leave guild
        </button>
      )}

      <div className="backlog-status-tabs">
        <button type="button" className={`quickdash-reset-btn ${tab === "posts" ? "quickdash-reset-btn--active" : ""}`} onClick={() => setTab("posts")}>Posts</button>
        <button type="button" className={`quickdash-reset-btn ${tab === "members" ? "quickdash-reset-btn--active" : ""}`} onClick={() => setTab("members")}>Members</button>
        <button type="button" className={`quickdash-reset-btn ${tab === "activity" ? "quickdash-reset-btn--active" : ""}`} onClick={() => setTab("activity")}>Activity</button>
        {isOwner && (
          <button type="button" className={`quickdash-reset-btn ${tab === "settings" ? "quickdash-reset-btn--active" : ""}`} onClick={() => setTab("settings")}>Settings</button>
        )}
      </div>

      {tab === "posts" && <PostsTab guildId={guild.id} userId={userId} isMember={isMember} />}

      {tab === "settings" && isOwner && (
        <section className="settings-card">
          <h2 className="settings-card__title">Guild settings</h2>
          <label className="pref-choice">
            <input type="checkbox" checked={guild.is_private} onChange={handleTogglePrivacy} />
            <span>Private (hidden from browsing — joinable by invite or code only)</span>
          </label>

          <div className="settings-avatar-row" style={{ marginTop: "14px" }}>
            {guild.logo_url ? (
              <img src={guild.logo_url} alt="" className="settings-avatar" style={{ objectFit: "cover" }} />
            ) : (
              <div className="settings-avatar">
                <span className="settings-avatar__placeholder">{guild.name.slice(0, 1).toUpperCase()}</span>
              </div>
            )}
            <div className="settings-avatar__controls">
              <label className="settings-avatar__upload">
                {guild.logo_url ? "Change logo" : "Upload logo"}
                <input type="file" accept="image/*" onChange={handleLogoChange} hidden />
              </label>
              <span className="settings-avatar__hint">
                {logoStatus === "uploading" ? "Uploading…" : logoStatus === "error" ? "Upload failed — try again" : "Square image recommended."}
              </span>
            </div>
          </div>

          <div className="settings-wallpaper" style={{ marginTop: "14px" }}>
            <span className="settings-card__note" style={{ marginTop: 0 }}>Banner (optional)</span>
            <div className="settings-wallpaper__row">
              {guild.banner_url ? (
                <img src={guild.banner_url} alt="" className="settings-wallpaper__preview" />
              ) : (
                <span className="settings-wallpaper__placeholder">No banner set</span>
              )}
              <div className="settings-avatar__controls">
                <label className="settings-avatar__upload">
                  {guild.banner_url ? "Change banner" : "Upload banner"}
                  <input type="file" accept="image/*" onChange={handleBannerChange} hidden />
                </label>
                <span className="settings-avatar__hint">
                  {bannerStatus === "uploading" ? "Uploading…" : bannerStatus === "error" ? "Upload failed — try again" : "Shown across the top of this page."}
                </span>
              </div>
            </div>
          </div>

          <p className="settings-card__note">Description:</p>
          <form className="price-search" onSubmit={handleSaveDescription}>
            <input
              className="price-search__input"
              type="text"
              placeholder="What's this guild about?"
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
            />
            <button type="submit" className="price-search__button" disabled={descriptionStatus === "saving"}>
              {descriptionStatus === "saving" ? "Saving…" : "Save"}
            </button>
          </form>
          {descriptionStatus === "error" && <p className="panel__status panel__status--error">Couldn't save — try again.</p>}

          <p className="settings-card__note">Invite someone by their friend code:</p>
          <form className="price-search" onSubmit={handleInvite}>
            <input
              className="price-search__input"
              type="text"
              placeholder="LYK-XXXX-XXXX"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
            <button type="submit" className="price-search__button" disabled={inviteStatus === "loading"}>
              {inviteStatus === "loading" ? "Inviting…" : "Invite"}
            </button>
          </form>
          {inviteMessage && (
            <p className={`panel__status ${inviteStatus === "error" ? "panel__status--error" : ""}`}>{inviteMessage}</p>
          )}

          {joinRequests.length > 0 && (
            <>
              <p className="settings-card__note">Pending join requests:</p>
              <ul className="backlog-list">
                {joinRequests.map((req) => (
                  <li key={req.id} className="backlog-card">
                    <MiniAvatar profile={req.profile} />
                    <div className="backlog-card__info">
                      <span className="backlog-card__title">{displayName(req.profile)}</span>
                    </div>
                    <button type="button" className="linking-row__connect" onClick={() => handleRespond(req.id, true)}>Approve</button>
                    <button type="button" className="game-popup__close" onClick={() => handleRespond(req.id, false)} aria-label="Decline">✕</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {tab === "members" && (
        <>
          <div className="backlog-summary">
            <span className="feed-col__label">Members</span>
          </div>
          {status === "loading" && <p className="panel__status">Loading…</p>}
          {status === "ready" && (
            <ul className="backlog-list">
              {members.map((m) => (
                <li key={m.id} className="backlog-card">
                  <MiniAvatar profile={m.profile} />
                  <div className="backlog-card__info">
                    <span className="backlog-card__title">{displayName(m.profile)}</span>
                    {m.user_id === guild.created_by && <span className="backlog-card__meta">Owner</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "activity" && (
        <>
          <div className="backlog-summary">
            <span className="feed-col__label">Activity feed</span>
          </div>
          {activity.length === 0 ? (
            <p className="panel__status">No activity yet — real activity from members will show up here.</p>
          ) : (
            <ul className="calendar-list">
              {activity.map((entry) => (
                <li key={entry.id} className="calendar-row">
                  <span className="calendar-row__date">{new Date(entry.created_at).toLocaleDateString()}</span>
                  <div className="calendar-row__body">
                    <span className="calendar-row__event" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <MiniAvatar profile={entry.profile} />
                      {describeActivity(entry)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function PostsTab({ guildId, userId, isMember }) {
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [postStatus, setPostStatus] = useState("idle");
  const [expandedPostId, setExpandedPostId] = useState(null);

  function load() {
    setStatus("loading");
    fetchGuildPosts(guildId, userId)
      .then((rows) => {
        setPosts(rows);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Failed to load guild posts:", err);
        setStatus("error");
      });
  }

  useEffect(load, [guildId, userId]);

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handlePost(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setPostStatus("saving");
    try {
      let imageUrl = null;
      if (imageFile) imageUrl = await uploadPostImage(userId, imageFile);
      await createGuildPost(userId, guildId, { title: title.trim(), body: body.trim(), imageUrl });
      setTitle("");
      setBody("");
      setImageFile(null);
      setImagePreview(null);
      setPostStatus("idle");
      load();
    } catch (err) {
      console.error("Failed to post:", err);
      setPostStatus("error");
    }
  }

  async function handleVote(post, value) {
    const prevVote = post.myVote;
    const prevScore = post.score;
    // Optimistic update — same pattern used elsewhere in this app for
    // toggles (e.g. achievement checkboxes) so voting feels instant.
    const delta = value === prevVote ? -prevVote : value - prevVote;
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, myVote: value === prevVote ? 0 : value, score: p.score + delta } : p)));
    try {
      await voteOnPost(userId, post.id, value, prevVote);
    } catch (err) {
      console.error("Failed to vote:", err);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, myVote: prevVote, score: prevScore } : p)));
    }
  }

  async function handleDelete(postId) {
    try {
      await deleteGuildPost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      console.error("Failed to delete post:", err);
    }
  }

  return (
    <div>
      {isMember ? (
        <form className="backlog-add" onSubmit={handlePost} style={{ flexDirection: "column", alignItems: "stretch", gap: "10px" }}>
          <input
            className="price-search__input"
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <textarea
            className="price-search__input"
            placeholder="What's on your mind? (optional)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
          />
          <label className="settings-avatar__upload" style={{ alignSelf: "flex-start" }}>
            {imageFile ? "Change image" : "Add an image"}
            <input type="file" accept="image/*" onChange={handleImageChange} hidden />
          </label>
          {imagePreview && <img src={imagePreview} alt="" className="search-result-card__thumb" style={{ width: "160px", height: "90px" }} />}
          <button type="submit" className="price-search__button" disabled={postStatus === "saving"} style={{ alignSelf: "flex-start" }}>
            {postStatus === "saving" ? "Posting…" : "Post"}
          </button>
          {postStatus === "error" && <p className="panel__status panel__status--error">Couldn't post — try again.</p>}
        </form>
      ) : (
        <p className="panel__status">Join this guild to post.</p>
      )}

      {status === "loading" && <p className="panel__status">Loading posts…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load posts right now.</p>}
      {status === "ready" && posts.length === 0 && <p className="panel__status">No posts yet — be the first.</p>}

      {status === "ready" && posts.length > 0 && (
        <ul className="backlog-list" style={{ marginTop: "16px" }}>
          {posts.map((post) => (
            <li key={post.id} className="backlog-card" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div style={{ display: "flex", gap: "12px" }}>
                <div className="vote-column">
                  <button
                    type="button"
                    className={`vote-column__btn ${post.myVote === 1 ? "vote-column__btn--active-up" : ""}`}
                    onClick={() => handleVote(post, 1)}
                    aria-label="Upvote"
                  >▲</button>
                  <span className="vote-column__score">{post.score}</span>
                  <button
                    type="button"
                    className={`vote-column__btn ${post.myVote === -1 ? "vote-column__btn--active-down" : ""}`}
                    onClick={() => handleVote(post, -1)}
                    aria-label="Downvote"
                  >▼</button>
                </div>
                <div className="backlog-card__info">
                  <span className="backlog-card__title">{post.title}</span>
                  <span className="backlog-card__meta" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <MiniAvatar profile={post.author} />
                    {displayName(post.author)} · {new Date(post.created_at).toLocaleDateString()}
                  </span>
                  {post.body && <p className="settings-card__note" style={{ margin: "6px 0" }}>{post.body}</p>}
                  {post.image_url && <img src={post.image_url} alt="" style={{ maxWidth: "320px", borderRadius: "8px", marginTop: "6px" }} />}
                  <button
                    type="button"
                    className="store-row-toggle"
                    onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)}
                  >
                    {expandedPostId === post.id ? "Hide comments ▲" : `${post.commentCount} comment${post.commentCount === 1 ? "" : "s"} ▾`}
                  </button>
                </div>
                {post.user_id === userId && (
                  <button type="button" className="game-popup__close" onClick={() => handleDelete(post.id)} aria-label="Delete post">✕</button>
                )}
              </div>
              {expandedPostId === post.id && (
                <CommentsPanel postId={post.id} guildId={guildId} userId={userId} isMember={isMember} onCommentAdded={() => setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, commentCount: p.commentCount + 1 } : p)))} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentsPanel({ postId, guildId, userId, isMember, onCommentAdded }) {
  const [comments, setComments] = useState([]);
  const [status, setStatus] = useState("loading");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  // Which top-level comment's inline reply form is open — a reply
  // itself never gets its own reply form (one level of threading only).
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replySaving, setReplySaving] = useState(false);

  useEffect(() => {
    fetchPostComments(postId)
      .then((rows) => {
        setComments(rows);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("Failed to load comments:", err);
        setStatus("error");
      });
  }, [postId]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      await addPostComment(userId, postId, guildId, text.trim());
      setText("");
      const rows = await fetchPostComments(postId);
      setComments(rows);
      onCommentAdded();
    } catch (err) {
      console.error("Failed to add comment:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleReply(e, parentId) {
    e.preventDefault();
    if (!replyText.trim()) return;
    setReplySaving(true);
    try {
      await addPostComment(userId, postId, guildId, replyText.trim(), parentId);
      setReplyText("");
      setReplyingToId(null);
      const rows = await fetchPostComments(postId);
      setComments(rows);
      onCommentAdded();
    } catch (err) {
      console.error("Failed to add reply:", err);
    } finally {
      setReplySaving(false);
    }
  }

  async function handleDelete(commentId) {
    try {
      await deletePostComment(commentId);
      // Deleting a top-level comment cascades its replies at the DB
      // level (on delete cascade) — reflect that in local state too,
      // not just the one row, so the UI doesn't show orphaned replies.
      setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_comment_id !== commentId));
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  }

  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const repliesByParent = comments.reduce((acc, c) => {
    if (c.parent_comment_id) (acc[c.parent_comment_id] ||= []).push(c);
    return acc;
  }, {});

  function renderComment(c, isReply) {
    return (
      <div key={c.id} className="comments-panel__row" style={isReply ? { marginLeft: "28px" } : undefined}>
        <span className="comments-panel__author" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <MiniAvatar profile={c.author} />
          {displayName(c.author)}
        </span>
        <span className="comments-panel__body">{c.body}</span>
        <div className="settings-form-row" style={{ marginTop: "2px" }}>
          {!isReply && isMember && (
            <button type="button" className="store-row-toggle" onClick={() => setReplyingToId(replyingToId === c.id ? null : c.id)}>
              Reply
            </button>
          )}
          {c.user_id === userId && (
            <button type="button" className="game-popup__close" onClick={() => handleDelete(c.id)} aria-label="Delete comment">✕</button>
          )}
        </div>
        {!isReply && replyingToId === c.id && (
          <form className="price-search" onSubmit={(e) => handleReply(e, c.id)} style={{ marginTop: "6px", marginLeft: "28px" }}>
            <input
              className="price-search__input"
              type="text"
              placeholder={`Reply to ${displayName(c.author)}…`}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
            <button type="submit" className="price-search__button" disabled={replySaving}>
              {replySaving ? "Posting…" : "Reply"}
            </button>
          </form>
        )}
        {!isReply && (repliesByParent[c.id] || []).map((reply) => renderComment(reply, true))}
      </div>
    );
  }

  return (
    <div className="comments-panel">
      {status === "loading" && <p className="panel__status">Loading comments…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load comments.</p>}
      {status === "ready" && comments.length === 0 && <p className="panel__status">No comments yet.</p>}
      {topLevel.map((c) => renderComment(c, false))}
      {isMember && (
        <form className="price-search" onSubmit={handleAdd} style={{ marginTop: "8px" }}>
          <input
            className="price-search__input"
            type="text"
            placeholder="Add a comment…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" className="price-search__button" disabled={saving}>
            {saving ? "Posting…" : "Comment"}
          </button>
        </form>
      )}
    </div>
  );
}
