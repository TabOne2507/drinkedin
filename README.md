# 🍺 DrinkedIn

**"The Unprofessional Network for Professional People"**

Tired of seeing your college roommate boast about their "synergistic paradigm shifts" on your professional feed? Welcome to **DrinkedIn** — the only social network where being an absolute mess is a sign of leadership. Save your "thrilled to announce" posts for the corporate overminds. Here, we embrace the Morning After Confessions and unhinged Office Rage.

## ✨ Features
- **Corporate Firewall™ Checklist:** Built-in safeguards prevent corporate buzzwords ("now hiring," "circle back," "synergy"). You can't be a professional here.
- **Anonymous Venting:** Post safely into the void. Hide your real name and identify yourself by your industry ("Anonymous Drinker at Finance Firm").
- **Bespoke Chaos Categories:**
  - 🌅 Morning After Confession
  - 😤 Office Rage Vent
  - 🫣 Personal Overshare
  - 🍵 Industry Gossip
  - 💧 Water Cooler Random
- **Unprofessional Reactions:** React with emotional accuracy: 🍻 Cheers, 😬 Oof, 🍵 Tea, 🤝 Same, 🛋️ Therapy, or 🚨 HR Risk.
- **Live Bar Stats:** The public sidebar shows real aggregate counts — no seeded or placeholder data.

## 🛠 Admin Dashboard

The dashboard lives at `/admin`. It shows real Firestore data only:

- **Overview:** users, posts, reactions, daily activity, category breakdown, top ranters.
- **Users:** per-drinker posts, reactions, sessions, first/last seen, last IP and user agent.
- **Activity:** session starts, posts, reactions, deletes, and admin logins/logouts.
- **Posts:** recent posts with moderation delete.

### Credentials

Admin credentials are **never** stored in the code or frontend. The server reads:

```bash
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
```

If either variable is missing, the login endpoint refuses to authenticate.

#### Local development

Copy `.env.example` to `.env` and fill in the values. `.env` is gitignored.

#### Render

Add both variables in **Render Dashboard → your service → Environment**:

| Key | Value |
| --- | --- |
| `ADMIN_USERNAME` | your admin username |
| `ADMIN_PASSWORD` | your admin password |

`render.yaml` declares both keys with `sync: false`, so Render prompts for them instead of expecting them in the repo.

Admin sessions last 8 hours and are stored in memory, so a server restart signs you out.

## 📊 Tracked data

DrinkedIn has no account system; the identity is the drinker name/ID created in the browser. For the admin dashboard the server records:

- post content, category, reactions, and timestamps;
- drinker ID/name, session activity, first/last seen;
- IP address and user agent for the latest activity;
- admin login/logout events.

Anonymous posts hide the author from other drinkers, but the admin dashboard still records the author's drinker ID and name. Because there are no accounts, the browser-supplied drinker ID can be spoofed by a determined user.

No passwords or admin credentials are ever written to Firestore or sent to the browser.
