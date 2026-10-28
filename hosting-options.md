# Hosting options — provisional

Reviewed 2026-10-25 using Context7 and current official documentation. This is a planning comparison, not a deployment or a guarantee of zero cost.

## Constraints

- One room at a time for friends in Malaysia and Singapore.
- Browser access, nicknames and private room codes; no player accounts.
- Hidden hands/identities and server-enforced original rules.
- Reconnect to the same seat; pause required decisions on disconnection.
- Prefer free deployment. No paid service selected or authorized.
- 3D rendering happens on each player's device. Hosting distributes assets and game state, not a rendered video stream.

## Candidate arrangements

| Arrangement | User experience | Main implication |
| --- | --- | --- |
| Hosted authoritative room | Everyone opens a URL; room creator manages the lobby | Durable room state and reconnect handling; no friend's PC needs to act as the game server |
| Local server over WLAN/LAN | Owner runs the game server; others on the reachable local network open its local address | Appropriate for in-person sessions; remote friends are not on that WLAN |
| Browser peer hosting over internet | Owner's browser runs the authoritative simulation | Signaling required; some networks need a TURN relay; host must remain connected or explicit state migration is needed |
| Owner runs a server reachable over internet | Owner launches a local game server and an approved remote access/tunnel arrangement | More host setup and availability requirements; remote connectivity and access control must be tested |

## Vercel

Current dedicated documentation says native WebSockets are in public beta on all plans with Fluid Compute. Connections end at the function duration limit; reconnects may reach another instance. Shared room state therefore needs durable external storage/coordination. Older search results saying WebSocket servers are unsupported conflict with current dedicated documentation and should not drive the plan.

Source: https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections

Vercel remains a candidate. A deployment test and full free-tier storage/coordination selection would be needed before confirming a completely free Vercel solution. Do not apply AI Gateway-specific WebSocket limits to game Functions.

## Cloudflare

SQLite-backed Durable Objects are available on Workers Free. The documented daily allowances include 100,000 requests and 13,000 GB-seconds; storage has separate limits. Exceeding a free limit makes the corresponding operation fail. WebSocket hibernation avoids duration usage while eligible and idle. Room coordination and persisted state fit the product's server model; actual usage and asset delivery still need testing.

Sources:

- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/

Proposed preference: evaluate a hosted Cloudflare room first; keep local hosting as an optional later mode unless the user requires it in the first release. Provider and frontend stack are not selected yet.

## Internet peer-hosting details

WebRTC peers exchange connection offers/answers through signaling. STUN helps discover routes; TURN relays traffic when a direct route is unavailable. A browser-hosted match therefore does not imply zero supporting infrastructure or guaranteed connectivity. The authoritative host also holds hidden game state; protecting it from the host operator would require a different trust model.

Sources:

- https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity
- https://webrtc.org/getting-started/peer-connections

## User decision

Hosted internet play is the intended friend-facing release, with Vercel or another suitable free provider; packaged local/WLAN hosting remains later. Provider selection is still provisional. On 2026-10-26, the user authorized a placeholder-based implementation foundation. A local Node development server is being built for integration and browser testing; this is not the later friend-facing hosting solution. No cloud deployment, subscription or network configuration has been made. Reverify provider documentation before choosing a production adapter; local filesystem persistence must not be assumed durable on a serverless host.
