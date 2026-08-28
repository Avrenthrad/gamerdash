// Friends — real, mutual connections between Lykodex users. Add
// someone by their real per-account friend code (see
// profiles.friend_code in schema.sql — this used to be a hardcoded
// placeholder shown in Account Settings; it's a genuine, unique,
// looked-up code now).

import { useEffect, useState } from "react";
import {
  fetchMyFriendCode, fetchFriends, removeFriend,
  findUserByFriendCode, searchUsersByUsername, sendFriendRequest,
  fetchFriendRequests, acceptFriendRequest, declineFriendRequest, withdrawFriendRequest,
  blockUser, unblockUser, fetchBlockedUsers,
} from "../lib/friends";
import { displayName } from "../lib/guilds";
import MiniAvatar from "./MiniAvatar";
import ConfirmDialog from "./ConfirmDialog";
import FriendMasteryChart from "./FriendMasteryChart";

export default function FriendsPage({ onBack, userId, isLoggedIn, onSignIn, onCreateAccount, onGoToInbox }) {
  const [myCode, setMyCode] = useState("");
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [status, setStatus] = useState("loading");

  const [addCode, setAddCode] = useState("");
  const [addStatus, setAddStatus] = useState("idle");
  const [addMessage, setAddMessage] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState("idle"); // idle | loading | done | error
  const [searchResults, setSearchResults] = useState([]);
  const [searchMessage, setSearchMessage] = useState("");
  const [sentTo, setSentTo] = useState(new Set()); // ids just requested this session, so the row can flip to "Sent" without a full reload
  // Holds the friend pending removal while the "are you sure?" dialog
  // is open — null means no dialog. Unfriending is a real, meaningful
  // relationship change (not just a UI toggle), so it shouldn't fire
  // from a single accidental tap the way a plain "X" icon invites.
  const [pendingRemove, setPendingRemove] = useState(null);
  // Holds { id, profile } for whoever is pending a block confirmation
  // — kept separate from pendingRemove since blocking is a distinct,
  // more permanent action (it also silently unfriends + wipes any
  // pending request, and stops them from re-adding you).
  const [pendingBlock, setPendingBlock] = useState(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setStatus("ready");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, userId]);

  async function load() {
    setStatus("loading");
    try {
      const [code, friendRows, requestRows, blockedRows] = await Promise.all([
        fetchMyFriendCode(userId),
        fetchFriends(userId),
        fetchFriendRequests(userId),
        fetchBlockedUsers(userId),
      ]);
      setMyCode(code);
      setFriends(friendRows);
      setRequests(requestRows);
      setBlocked(blockedRows);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to load friends:", err);
      setStatus("error");
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!addCode.trim()) return;
    setAddStatus("loading");
    setAddMessage("");
    try {
      const found = await findUserByFriendCode(addCode.trim());
      if (!found) {
        setAddStatus("error");
        setAddMessage("No Lykodex account found with that friend code.");
        return;
      }
      if (found.id === userId) {
        setAddStatus("error");
        setAddMessage("That's your own friend code.");
        return;
      }
      await sendFriendRequest(userId, found.id);
      setAddStatus("done");
      setAddMessage(`Friend request sent to ${displayName(found)}.`);
      setAddCode("");
      load();
    } catch (err) {
      console.error("Failed to send friend request:", err);
      setAddStatus("error");
      setAddMessage(
        err.message?.includes("duplicate") ? "You've already sent a request to this person." : (err.message || "Couldn't send that request.")
      );
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchStatus("loading");
    setSearchMessage("");
    try {
      const results = await searchUsersByUsername(searchQuery.trim());
      setSearchResults(results.filter((r) => r.id !== userId));
      setSearchStatus("done");
      if (results.length === 0) setSearchMessage("No usernames matched that.");
    } catch (err) {
      console.error("Failed to search usernames:", err);
      setSearchStatus("error");
      setSearchMessage(err.message || "Couldn't search right now.");
    }
  }

  async function handleSendFromSearch(found) {
    try {
      await sendFriendRequest(userId, found.id);
      setSentTo((prev) => new Set(prev).add(found.id));
      load();
    } catch (err) {
      console.error("Failed to send friend request:", err);
      setSearchMessage(
        err.message?.includes("duplicate") ? "You've already sent a request to this person." : (err.message || "Couldn't send that request.")
      );
    }
  }

  async function handleAccept(requestId) {
    try {
      await acceptFriendRequest(requestId);
      load();
    } catch (err) {
      console.error("Failed to accept friend request:", err);
    }
  }

  async function handleDecline(requestId) {
    try {
      await declineFriendRequest(requestId);
      load();
    } catch (err) {
      console.error("Failed to decline friend request:", err);
    }
  }

  async function handleWithdraw(requestId) {
    try {
      await withdrawFriendRequest(requestId);
      load();
    } catch (err) {
      console.error("Failed to withdraw friend request:", err);
    }
  }

  async function handleRemove(friendId) {
    try {
      await removeFriend(userId, friendId);
      setFriends((prev) => prev.filter((f) => f.friend_id !== friendId));
    } catch (err) {
      console.error("Failed to remove friend:", err);
    } finally {
      setPendingRemove(null);
    }
  }

  async function handleBlock(targetId) {
    try {
      await blockUser(targetId);
      // block_user also deletes any friendship/pending request server
      // side — reload rather than hand-patch every list that could've
      // changed (friends, incoming/outgoing requests, search results).
      load();
    } catch (err) {
      console.error("Failed to block user:", err);
    } finally {
      setPendingBlock(null);
    }
  }

  async function handleUnblock(blockedId) {
    try {
      await unblockUser(userId, blockedId);
      setBlocked((prev) => prev.filter((b) => b.blocked_id !== blockedId));
    } catch (err) {
      console.error("Failed to unblock user:", err);
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="price-page">
        <div className="price-page__head">
          <button type="button" className="back-link" onClick={onBack}>← Back</button>
          <h1 className="price-page__title">Friends</h1>
          <p className="price-page__subtitle">Sign in to add and manage friends.</p>
        </div>
        <div className="account-gate-panel__actions">
          <button type="button" className="auth-form__submit" onClick={onCreateAccount}>Create account</button>
          <button type="button" className="auth-form__secondary" onClick={onSignIn}>Sign in</button>
        </div>
      </div>
    );
  }

  const incoming = requests.filter((r) => r.receiver_id === userId);
  const outgoing = requests.filter((r) => r.sender_id === userId);
  const existingFriendIds = new Set(friends.map((f) => f.friend_id));
  const pendingIds = new Set(outgoing.map((r) => r.receiver_id));

  function searchRowStatus(found) {
    if (existingFriendIds.has(found.id)) return "friends";
    if (pendingIds.has(found.id) || sentTo.has(found.id)) return "sent";
    return "none";
  }

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back</button>
        <h1 className="price-page__title">Friends</h1>
        <p className="price-page__subtitle">Real, mutual connections — add someone by their friend code or Lykodex username.</p>
      </div>

      <FriendMasteryChart userId={userId} />

      <div className="friend-code-row">
        <span className="friend-code-row__code">{myCode || "…"}</span>
        <span className="panel__status" style={{ margin: 0 }}>This is your code — share it so others can add you.</span>
      </div>

      <form className="price-search" onSubmit={handleSearch}>
        <input
          className="price-search__input"
          type="text"
          placeholder="Search by Lykodex username…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button type="submit" className="price-search__button" disabled={searchStatus === "loading"}>
          {searchStatus === "loading" ? "Searching…" : "Search"}
        </button>
      </form>
      {searchMessage && (
        <p className={`panel__status ${searchStatus === "error" ? "panel__status--error" : ""}`}>{searchMessage}</p>
      )}
      {searchStatus === "done" && searchResults.length > 0 && (
        <ul className="backlog-list">
          {searchResults.map((found) => {
            const rowStatus = searchRowStatus(found);
            return (
              <li key={found.id} className="backlog-card">
                <MiniAvatar profile={found} />
                <div className="backlog-card__info">
                  <span className="backlog-card__title">{displayName(found)}</span>
                  {found.username && <span className="backlog-card__meta">@{found.username}</span>}
                </div>
                {rowStatus === "friends" && <span className="score-badge">Already friends</span>}
                {rowStatus === "sent" && <span className="score-badge">Request sent</span>}
                {rowStatus === "none" && (
                  <button type="button" className="linking-row__connect" onClick={() => handleSendFromSearch(found)}>
                    Add
                  </button>
                )}
                <button
                  type="button"
                  className="quickdash-reset-btn"
                  onClick={() => setPendingBlock({ id: found.id, profile: found })}
                >
                  Block
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form className="price-search" onSubmit={handleAdd}>
        <input
          className="price-search__input"
          type="text"
          placeholder="Add a friend by their code (LYK-XXXX-XXXX)…"
          value={addCode}
          onChange={(e) => setAddCode(e.target.value)}
        />
        <button type="submit" className="price-search__button" disabled={addStatus === "loading"}>
          {addStatus === "loading" ? "Sending…" : "Add"}
        </button>
      </form>
      {addMessage && (
        <p className={`panel__status ${addStatus === "error" ? "panel__status--error" : ""}`}>{addMessage}</p>
      )}

      {status === "loading" && <p className="panel__status">Loading…</p>}
      {status === "error" && <p className="panel__status panel__status--error">Couldn't load your friends right now.</p>}

      {incoming.length > 0 && (
        <>
          <div className="backlog-summary"><span className="feed-col__label">Friend requests</span></div>
          <ul className="backlog-list">
            {incoming.map((r) => (
              <li key={r.id} className="backlog-card">
                <MiniAvatar profile={r.senderProfile} />
                <div className="backlog-card__info">
                  <span className="backlog-card__title">{displayName(r.senderProfile)}</span>
                </div>
                <button type="button" className="linking-row__connect" onClick={() => handleAccept(r.id)}>Accept</button>
                <button type="button" className="game-popup__close" onClick={() => handleDecline(r.id)} aria-label="Decline">✕</button>
              </li>
            ))}
          </ul>
        </>
      )}

      {outgoing.length > 0 && (
        <>
          <div className="backlog-summary"><span className="feed-col__label">Sent requests</span></div>
          <ul className="backlog-list">
            {outgoing.map((r) => (
              <li key={r.id} className="backlog-card">
                <MiniAvatar profile={r.receiverProfile} />
                <div className="backlog-card__info">
                  <span className="backlog-card__title">{displayName(r.receiverProfile)}</span>
                  <span className="backlog-card__meta">Pending</span>
                </div>
                <button type="button" className="game-popup__close" onClick={() => handleWithdraw(r.id)} aria-label="Withdraw">✕</button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="backlog-summary"><span className="feed-col__label">Your friends</span></div>
      {status === "ready" && friends.length === 0 && (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">🧑‍🤝‍🧑</span>
          <p className="empty-state__body">No friends yet — add one above using their friend code.</p>
        </div>
      )}
      {friends.length > 0 && (
        <ul className="backlog-list">
          {friends.map((f) => (
            <li key={f.id} className="backlog-card">
              <MiniAvatar profile={f.profile} />
              <div className="backlog-card__info">
                <span className="backlog-card__title">{displayName(f.profile)}</span>
                {f.profile?.username && <span className="backlog-card__meta">@{f.profile.username}</span>}
              </div>
              {onGoToInbox && (
                <button type="button" className="linking-row__connect" onClick={onGoToInbox}>Message</button>
              )}
              <button type="button" className="quickdash-reset-btn" onClick={() => setPendingRemove(f)}>Remove</button>
              <button
                type="button"
                className="quickdash-reset-btn"
                onClick={() => setPendingBlock({ id: f.friend_id, profile: f.profile })}
              >
                Block
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="backlog-summary"><span className="feed-col__label">Blocked</span></div>
      {blocked.length === 0 ? (
        <p className="panel__status">Nobody's blocked.</p>
      ) : (
        <ul className="backlog-list">
          {blocked.map((b) => (
            <li key={b.id} className="backlog-card">
              <MiniAvatar profile={b.profile} />
              <div className="backlog-card__info">
                <span className="backlog-card__title">{displayName(b.profile)}</span>
                {b.profile?.username && <span className="backlog-card__meta">@{b.profile.username}</span>}
              </div>
              <button type="button" className="quickdash-reset-btn" onClick={() => handleUnblock(b.blocked_id)}>
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(pendingRemove)}
        title="Remove this friend?"
        message={
          pendingRemove
            ? `${displayName(pendingRemove.profile)} will be removed from your friends list. You can send a new request later, but they'll need to accept it again.`
            : ""
        }
        confirmLabel="Remove"
        onCancel={() => setPendingRemove(null)}
        onConfirm={() => handleRemove(pendingRemove.friend_id)}
      />

      <ConfirmDialog
        open={Boolean(pendingBlock)}
        title="Block this person?"
        message={
          pendingBlock
            ? `${displayName(pendingBlock.profile)} will be unfriended (if you're currently friends) and won't be able to send you a new friend request. You can unblock them later from this page.`
            : ""
        }
        confirmLabel="Block"
        onCancel={() => setPendingBlock(null)}
        onConfirm={() => handleBlock(pendingBlock.id)}
      />
    </div>
  );
}
