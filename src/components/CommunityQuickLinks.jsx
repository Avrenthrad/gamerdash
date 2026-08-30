import { useMemo } from "react";
import { COMMUNITY_QUICK_LINKS } from "../data/communityLinks";
import { getProfileStreamQuickLinks } from "../lib/streamingProfiles";

export function QuickLinkRow({
  links,
  className = "dash-drawer__community-links",
  linkClassName = "dash-drawer__community-link",
  ariaLabel = "Community and apps",
}) {
  if (!links.length) return null;

  return (
    <div className={className} role="list" aria-label={ariaLabel}>
      {links.map((link) => {
        const classNames = `${linkClassName} ${link.placeholder ? `${linkClassName}--placeholder` : ""}`;

        if (link.placeholder) {
          return (
            <span
              key={link.id}
              className={classNames}
              role="listitem"
              title={`${link.label} (link coming soon)`}
              aria-label={link.label}
            >
              <img src={link.icon} alt="" width={28} height={28} decoding="async" />
            </span>
          );
        }

        return (
          <a
            key={link.id}
            href={link.href}
            className={classNames}
            role="listitem"
            target="_blank"
            rel="noopener noreferrer"
            title={link.label}
            aria-label={link.label}
          >
            <img src={link.icon} alt="" width={28} height={28} decoding="async" />
          </a>
        );
      })}
    </div>
  );
}

export default function CommunityQuickLinks({ profileDetails, includeCommunity = true }) {
  const links = useMemo(() => {
    const profileLinks = getProfileStreamQuickLinks(profileDetails);
    if (!includeCommunity) return profileLinks;
    return [...COMMUNITY_QUICK_LINKS, ...profileLinks];
  }, [profileDetails, includeCommunity]);

  return <QuickLinkRow links={links} />;
}
