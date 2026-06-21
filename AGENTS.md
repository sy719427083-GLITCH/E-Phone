# Prototype Instructions

Run the local server yourself and open the preview in the in-app browser. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Current prototype direction:
- Use the pink visual direction: white, warm white, milk pink, blush, rose-gray, and tiny mist-blue shadows.
- Do not use green accents, green switches, mint, sage, grass, leaves, or teal-green.
- Desktop app icons should not have colored square backgrounds, tiles, badges, or button plates; they should look integrated into the cat wallpaper.
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
- The bottom navigation labels are "主页", "角色档案", "身份", and "设置"; the tab bar should use borderless glassmorphism with soft translucency instead of solid cards.
