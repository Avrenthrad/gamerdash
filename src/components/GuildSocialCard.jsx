// Gaming dashboard — Guild spotlight + recent activity in one panel,
// stacked under Current Rotation in the "Right now" lane.

import GuildSpotlightCard from "./GuildSpotlightCard";
import RecentActivityCard from "./RecentActivityCard";

export default function GuildSocialCard({ isLoggedIn, userId, onOpenGuilds }) {
  if (!isLoggedIn) {
    return (
      <div className="panel hero-card guild-social-card">
        <div className="guild-social-card__cols">
          <div className="guild-social-card__section">
            <div className="panel__head"><span className="panel__eyebrow">Guild Spotlight</span></div>
            <p className="panel__status">Sign in to see your Guilds here.</p>
          </div>
          <div className="guild-social-card__section">
            <div className="panel__head"><span className="panel__eyebrow">Recent Activity</span></div>
            <p className="panel__status">Sign in to see real activity here.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel hero-card guild-social-card">
      <div className="guild-social-card__cols">
        <GuildSpotlightCard embedded userId={userId} onOpenGuilds={onOpenGuilds} />
        <RecentActivityCard embedded userId={userId} onOpenGuilds={onOpenGuilds} />
      </div>
    </div>
  );
}
