# Prototype Instructions

Run the local server yourself and open the preview in the in-app browser. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Current prototype direction:
- Use the pink visual direction: white, warm white, milk pink, blush, rose-gray, and tiny mist-blue shadows.
- Do not use green accents, green switches, mint, sage, grass, leaves, or teal-green.
- Desktop app icons should not have colored square backgrounds, tiles, badges, or button plates; they should look integrated into the cat wallpaper.
- The Wallet app should be a real in-app page, not a placeholder, and show "我的余额" plus "我的账单" with soft pink Alipay-inspired wallet styling. Wallet state starts with a real ¥2000 balance and no fake bills; only in-app red packet events create bills. Role red packets require explicit receive/return actions, receiving increases balance, returning does not, and user-sent red packets deduct from wallet balance.
- The phone UI is the whole viewport: no external phone frame, no black border, no dynamic island, and no outside background.
- iPhone/Safari layouts should not feel pushed downward; prefer dynamic viewport units and light safe-area compensation so the UI sits higher and fills the visible screen.
- Do not render a custom top system time or battery indicator; let the phone/browser own that area while the app background fills behind it.
- On real phones, large iPhones, touch/narrow screens, mobile browsers, and home-screen PWAs, every screen, wallpaper, lock screen, and in-app page should fill the viewport without bottom blank space or vertical centering. On desktop browsers, keep a responsive phone-proportioned preview instead of stretching the UI across the full width.
- Mobile browser and home-screen PWA layouts should keep the same vertical placement; browser chrome and safe-area differences should not make the home/roles/me/settings tabs or page headers jump upward or downward.
- In-app page headers such as roles, me, settings, API settings, role create, and role detail must sit low enough to avoid the iPhone dynamic island/status area.
- The bottom tab bar for home, roles, me, and settings should float clearly above the bottom edge instead of sitting close to the home indicator area.
- Disable mobile tap gray highlights and avoid pressed-state dimming on app controls.
- New-role avatar upload should stay clean and circular without a hazy decorative block or frosted overlay behind it.
- Role overview avatars should not have hazy decorative blocks or frosted highlight overlays.
- Built-in wallpapers, icons, cats, and UI images should be precached by the PWA so the app remains visible on weak networks and does not reload images from the network every time it opens.
- The PWA manifest start URL and service-worker registration should both use the current app version query so iOS home-screen launches do not keep using an older app shell.
- The app should also fetch a small version manifest on foreground/visibility changes and periodically while open, then reload itself when the remote version changes. This preserves PWA data while avoiding stale desktop/home-screen app code.
- Form control text inside role and API input boxes should stay small and delicate; placeholder text should be smaller than entered text.
- API settings content should sit with extra top breathing room below the page header.
- The "me" tab should support identity profiles: new/edit identity uses the same form structure and interaction style as new/edit role, but identities have separate storage and a separately drawn low-saturation pink background.
- New/edit identity wallpaper should be very pale and low-saturation; use a separate PNG kitten overlay that clearly lies on the top edge of the name/gender form card.
- Do not show a separate role preview page; tapping a role card should open editing directly.
- Role overview layout, card structure, and density should stay stable; visual updates should be scoped to the role tab only and must not change the identity overview cards.
- Animated role overview effects should feel fresh and lightweight: floating fine lines, subtle spark points, mist-blue highlights, no heavy saturated pink, and no layout shift.
- Micro Chat should follow a real WeChat-inspired structure: conversation list, role-based chat entry, single chat thread, local message history, and API-powered role replies while staying in the app's soft pink visual language.
- Micro Chat should have an integrated inner four-tab structure: "微聊", "通讯录", "朋友圈", and "设置"; keep it WeChat-inspired without using green accents, and do not make the inner tab bar look like a separate floating module.
- Micro Chat contacts are not automatically populated from role files: the contact list starts empty, users add existing roles through an add button, and roles may randomly reject the request.
- Micro Chat inner tab labels should use light Apple-system typography, not bold text; chat rows should reveal delete only after a left swipe. Contacts should include "新的好友" and "群聊"; roles can proactively request to add the user, "新的好友" should show a +1-style badge, and accept/reject/request feedback should have a small delay.
- Micro Chat "新的好友" should open its own WeChat-like page showing current and historical add requests. Moments should follow the real WeChat structure: a top wallpaper area and a separate plain white feed section below, not a white overlay covering the wallpaper. The cover should be replaceable later, and the user's avatar/name should overlap the boundary without being hidden by the white section.
- Micro Chat contacts and settings tabs should not show the app-level back button. Moments should hide the inner four-tab bar, include its own top-left return button, and show a top-right action symbol that opens generation controls for random/specified mode and post count.
- Moments specified generation must choose only from already-added contacts, and generated moments should be real API-generated posts that are saved and shown in the feed.
- Moments generation should use compact prompts and a modest token budget so it behaves closer to chat requests and avoids triggering provider quota checks from an oversized max_tokens value.
- Moments generation controls should include "纯文字" and "图文"; image-text moments should use existing contact/avatar imagery first and must not trigger an extra image-generation API call unless explicitly requested later.
- Moments manual generation and role spontaneous posting are separate concepts: manual random/specified controls are for user-requested generation, while roles may independently and automatically post pure-text moments in the background.
- Moments spontaneous posting must not run concurrently with manual moments generation; background posting should skip when any moments request is already in flight.
- Moments pure-text copy should be 1-100 Chinese characters, never forced into ultra-short text. If a model returns longer text, trim before saving.
- Moments manual pure-text generation should use a horizontal count slider from 1 to 5. One user action may generate up to 5 posts, but the implementation should use lightweight one-post text requests rather than a large batch JSON request.
- Moments manual multi-post pure-text generation should pace repeated API requests so providers do not treat a quick burst as quota/rate-limit abuse. If a later request is quota-limited after earlier posts succeeded, keep and show the partial posts instead of failing the whole generation.
- Moments random generation means the user requests random role/contact-generated posts, excluding the user's own identity. Moment copy may reference that role's recent chat context, today's/current time, schedule, observations, or current mood.
- Moments posts should support lightweight WeChat-like likes and comments. User comments may receive probabilistic API-generated replies from the post author, and these interactions should persist with the post.
- Moments post actions should use icon-like controls: likes use a heart, comments use a drawn/SVG comment symbol, and the user's Moments profile block should keep the name on the left with the avatar on the right.
- Moments comment boxes should close immediately after the user sends a comment. Role replies to user comments should arrive after a short delay and display as "角色名回复了我内容"; the role name and "我" should use a distinct accent color while the rest remains normal text color.
- Role chats should bind the currently selected "me" identity into the conversation prompt so replies can respond to the user's saved identity/profile.
- Micro Chat back buttons should use the same round translucent style as the Moments back button.
- API quota/rate-limit errors should not retry the same API repeatedly; if a distinct secondary API exists, fail over once, otherwise show the provider error with model and HTTP status so the user can diagnose the selected model/channel.
- Micro Chat friend-request delays should feel quick: proactive incoming requests should appear shortly after opening contacts, and accept/reject/request confirmation waits should be brief rather than multi-second.
- Micro Chat friend-request waiting states must always resolve with a success, rejection, or visible failure message; never leave "waiting for confirmation" stuck indefinitely.
- The bottom navigation labels are "主页", "角色档案", "身份", and "设置"; the tab bar should use borderless glassmorphism with soft translucency instead of solid cards.

- On iOS home-screen/standalone PWA, Moments must not run automatic spontaneous background posting; keep API calls tied to explicit user actions there so Safari and PWA behavior do not diverge.

- Moments manual generation should default to 1 post; the 1-5 slider is opt-in so users do not accidentally trigger multiple API calls from one tap, especially in home-screen PWAs.
- Moments generation must direct-connect to the selected user API just like chat; do not route Moments through a Vercel/server proxy.
- Manual Moments generation should use the same direct API request path in browser and home-screen/standalone PWA; do not add PWA-only retry prompts or fallback request branches.
- Roles may spontaneously post Moments using the same direct API path, but automatic posts must respect real-world time spacing and recent manual posts so they do not feel frequent or spammy.
- Moment copy should read like real social feed text and must avoid stage directions, gestures, poses, or parenthetical action descriptions such as "将三枚铜钱收入袖中"; clean generated content before saving if needed.
- Moment post timestamps should display from each post's real `createdAt` time instead of a fixed "刚刚" label.
- User comments on a role's Moment should queue a role reply every time, but replies must feel delayed rather than instant.
- Moment replies should display Chinese colons, for example "角色名回复了我：内容" and "我回复了角色名：内容"; tapping a role reply should let the user continue replying in the same comment thread.
- Moment role replies should sound like public social-feed comments rather than private chat messages.
- Moment generated post copy should read like a public social feed post, not private chat: avoid direct address such as "你", "客官", "宝", or "主人", and avoid question-style replies to the user.
- The Moments top-right action area can include a trash icon beside the plus icon for one-tap clearing of all Moment posts.
- Moments clearing must ask for confirmation before deleting generated posts.
- Moments top-right action buttons should keep the same compact round size; if the trash icon needs emphasis, widen only the drawn bin inside the SVG, not the button itself.
- Micro Chat role replies should behave like real phone chat bubbles: one user message may receive 1-3 short assistant bubbles, with no stage directions, gestures, poses, parenthetical action, or narration. Short complete sentences should not be visually squeezed into unnecessary line breaks.
- Micro Chat must never show model prompts, JSON wrappers, Markdown, rewrite notes, analysis, or formatting instructions as chat bubbles; parser and display should filter those leaks, including older stored messages.
- Micro Chat messages should show a time below each bubble. Roles may proactively send normal messages and WeChat-like special events: recalled message, red packet, pat, and shared location rendered with CSS/SVG instead of external images.
- In the new friends page, rejection should appear before acceptance when both actions are shown.
