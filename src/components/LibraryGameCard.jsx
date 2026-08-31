const PLATFORM_LABELS = { steam: "Steam", xbox: "Xbox", playstation: "PlayStation" };

export function PlatformTag({ platform }) {
  const label = PLATFORM_LABELS[platform] || platform;
  return <span className={`tag tag--platform tag--platform-${platform}`}>{label}</span>;
}

function LibraryDlcDropdown({ dlc }) {
  if (!dlc?.length) return null;

  return (
    <details className="library-dlc-dropdown">
      <summary className="library-dlc-dropdown__summary">
        {dlc.length} DLC owned
      </summary>
      <ul className="library-dlc-dropdown__list">
        {dlc.map((item) => (
          <li key={`${item.platform}-${item.title}`} className="library-dlc-dropdown__item">
            <PlatformTag platform={item.platform} />
            <span>{item.title}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function LibraryGameCard({ game, formatPlaytime, steamHeaderArt }) {
  return (
    <li className="backlog-card library-game-card">
      {game.steamAppid ? (
        <img
          src={steamHeaderArt(game.steamAppid)}
          alt=""
          className="backlog-card__thumb"
          decoding="async"
          onError={(e) => {
            e.target.onerror = null;
            if (game.imgIconUrl) {
              e.target.src = `https://media.steampowered.com/steamcommunity/public/images/apps/${game.steamAppid}/${game.imgIconUrl}.jpg`;
            } else {
              e.target.style.display = "none";
            }
          }}
        />
      ) : (
        <div className="backlog-card__thumb backlog-card__thumb--placeholder" />
      )}
      <div className="backlog-card__info">
        <span className="backlog-card__title">{game.title}</span>
        <span className="backlog-card__meta">
          {game.platforms.map((platform) => (
            <PlatformTag key={platform} platform={platform} />
          ))}
          {game.totalPlaytimeMinutes > 0 && (
            <span>{formatPlaytime(game.totalPlaytimeMinutes)} played</span>
          )}
        </span>
        <LibraryDlcDropdown dlc={game.dlc} />
      </div>
    </li>
  );
}

export function LibraryGameRow({ game, formatPlaytime }) {
  return (
    <tr>
      <td>
        <div className="library-table__game">
          {game.steamAppid && game.imgIconUrl && (
            <img
              src={`https://media.steampowered.com/steamcommunity/public/images/apps/${game.steamAppid}/${game.imgIconUrl}.jpg`}
              alt=""
              className="library-table__icon"
              loading="lazy"
              decoding="async"
            />
          )}
          <div className="library-table__game-copy">
            <span>{game.title}</span>
            <LibraryDlcDropdown dlc={game.dlc} />
          </div>
        </div>
      </td>
      <td>
        <div className="library-table__platforms">
          {game.platforms.map((platform) => (
            <PlatformTag key={platform} platform={platform} />
          ))}
        </div>
      </td>
      <td>
        {game.platforms.map((platform) => {
          const playtime = formatPlaytime(game.playtimeMinutes[platform]);
          if (!playtime) return null;
          return (
            <span key={platform} className="library-table__playtime-line">
              {PLATFORM_LABELS[platform]} {playtime}
            </span>
          );
        }).filter(Boolean)}
        {game.totalPlaytimeMinutes === 0 && "—"}
      </td>
    </tr>
  );
}
