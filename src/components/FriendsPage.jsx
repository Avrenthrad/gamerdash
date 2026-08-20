// Friends — real, mutual connections between Lykodex users. Add
// someone by their real per-account friend code (see
// profiles.friend_code in schema.sql — this used to be a hardcoded
// placeholder shown in Account Settings; it's a genuine, unique,
// looked-up code now).

import { useEffect, useState } from "react";
import {
  fetchMyFriendCode, fetchFriends, removeFriend,
  findUserByFriendCode, sendFriendRequest,
  fetchFriendRequests, acceptFriendRequest, declineFriendRequest, withdrawFriendRequest,
} from "../lib/friends";
import MiniAvatar from "./MiniAvatar";

function displayName(profile) {
  if (!profile) return "Someone";
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  return full || profile.username || "Someone";
}

export default function FriendsPage({ onBack, userId, isLoggedIn, onSignIn, onCreateAccount, onGoToInbox }) {
  const [myCode, setMyCode] = useState("");
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState("loading");

  const [addCode, setAddCode] = useState("");
  const [addStatus, setAddStatus] = useState("idle");
  const [addMessage, setAddMessage] = useState("");

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
      const [code, friendRows, requestRows] = await Promise.all([
        fetchMyFriendCode(userId),
        fetchFriends(userId),
        fetchFriendRequests(userId),
      ]);
      setMyCode(code);
      setFriends(friendRows);
      setRequests(requestRows);
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
        <div className="backlog-add">
          <button type="button" className="linking-row__connect" onClick={onSignIn}>Sign in</button>
          <button type="button" className="linking-row__connect" onClick={onCreateAccount}>Create account</button>
        </div>
      </div>
    );
  }

  const incoming = requests.filter((r) => r.receiver_id === userId);
  const outgoing = requests.filter((r) => r.sender_id === userId);

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back</button>
        <h1 className="price-page__title">Friends</h1>
        <p className="price-page__subtitle">Real, mutual connections — add someone by their friend code.</p>
      </div>

      <div className="friend-code-row">
        <span className="friend-code-row__code">{myCode || "…"}</span>
        <span className="panel__status" style={{ margin: 0 }}>This is your code — share it so others can add you.</span>
      </div>

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
              <button type="button" className="game-popup__close" onClick={() => handleRemove(f.friend_id)} aria-label="Remove friend">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
