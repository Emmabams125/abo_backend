# Phase 1 FRD Reference (Must-have modules)

Condensed from ABO-PRD-FRD-v1.0 §11–20, 23–24. Full source: the PDF supplied by the founder. Priority key: Must = MVP blocker · Should = can slip a sprint · Could = fast-follow.

## §11 Onboarding & Authentication
- **FR-ONB-01** (Must) Phone sign-up with OTP. OTP expires 5 min; max 5 attempts before 15-min lockout; resend after 30s.
- **FR-ONB-02** (Must) Create/join Family Circle via invite link/code. Invite links expire after 7 days; joining requires inviter approval if Circle has an Admin role set.
- **FR-ONB-03** (Must) Location permission rationale screen before OS prompt. *(Client-side; backend exposes no endpoint, noted for completeness.)*
- **FR-ONB-04** (Must) Assign Circle roles (Admin/Guardian, Adult Member, Managed Member). Only Admins can assign/change Managed Member roles; role changes logged + visible in Privacy Center.
- **FR-ONB-05** (Must) Managed Member transparency notice must be displayed & acknowledged on-device before setup completes. *(Backend: store acknowledgment timestamp.)*

## §12 Home Dashboard
- **FR-HOME-01** (Must) Circle safety summary; reflects status change within 10s via push-driven update, not manual refresh only.
- **FR-HOME-02** (Must) Member status list: avatar/status ring, place label, last-updated timestamp, battery %. Status ring: Safe / Driving / At a Safe Place / SOS.
- **FR-HOME-03** (Must) Quick actions: I'm Okay, Check-In, SOS. SOS still requires hold-confirmation per FR-SOS-01 even from Home.
- **FR-HOME-04** (Should) Missing Nearby summary — only if opted into Community Board location sharing. *(Community Board is Could-have; stub only.)*

## §13 Live — Location & Safe Places
- **FR-LOC-01** (Must) Adaptive live location updates. Stationary: every 5 min. Moving: every 15–30s. Battery <20%: 10-min interval regardless of movement.
- **FR-LOC-02** (Should) Safe Places (geofencing). Radius 50m–500m. Arrival/departure notification fires within 60s of boundary crossing.
- **FR-LOC-03** (Should) Location history timeline. Default retention 7 days, configurable per Circle, max 30 days.
- **FR-LOC-04** (Could) Directions handoff — deep link only, no backend involvement.

## §19 SOS / Emergency
- **FR-SOS-01** (Must) Hold-to-trigger, 3s. *(Client-enforced; backend must not require re-derivation but should debounce duplicate triggers.)*
- **FR-SOS-02** (Must) Emergency broadcast payload: live location, battery %, medical info snapshot → full Trusted Circle. Delivered within 5s; ≥99.5% success; retry logic for failed pushes.
- **FR-SOS-03** (Should) SOS event log: who was notified, delivery status, acknowledgment. Immutable, visible to Circle Admins.
- **FR-SOS-04** (Won't, Phase 2+) Direct emergency-service dispatch — explicitly out of scope.

## §20 Reassurance Mode
- **FR-RSR-01** (Must) One-tap "I'm Okay" broadcast — no location/call/message attached. Completes <1s, no confirmation dialog.
- **FR-RSR-02** (Should) Check-in history — at least last 10 check-ins per member, relative timestamps.
- **FR-RSR-03** (Could) Scheduled check-in reminder — local notification only, does not escalate to Circle if missed.

## §18 Messages
- **FR-MSG-01** (Must) 1:1 and group messaging. Delivery latency <2s on stable connection; offline messages queue and send on reconnect.
- **FR-MSG-02** (Should) Contextual conversation header — recipient's current status/location label, same data source/cadence as Home.
- **FR-MSG-03** (Should) Time-boxed location share in chat. Durations: 15 min / 1 hr / until turned off. Auto-expires, notifies both parties.
- **FR-MSG-04** (Could) External channel handoff — native deep links only (tel:, sms:, whatsapp://), no in-app relay.

## §23 Profile / You
- **FR-PRO-01** (Must) Personal profile: avatar, name, emergency contacts, medical info (used in SOS). Medical info optional, encrypted at rest, field-level.
- **FR-PRO-02** (Must) Circle & role management. Role changes require Admin re-auth (PIN/biometric → backend reauth token) before applying.
- **FR-PRO-03** (Should) Connected devices & tags. Unpairing immediately revokes access to Circle data.
- **FR-PRO-04** (Must) Privacy Center — per-feature "visible to whom", for every member including Managed Members viewing their own visibility. Every data-sharing feature must have a corresponding entry here.
- **FR-PRO-05** (Should) Notification & data settings — retention window setting directly controls FR-LOC-03 behavior.

## §24 Subscription & Billing
- **FR-SUB-01** (Must) Plan comparison view. Pricing from remote config, not hardcoded.
- **FR-SUB-02** (Must) Upgrade/downgrade via IAP or card (Paystack/Flutterwave). Downgrade takes effect at end of current billing period, not immediately.
- **FR-SUB-03** (Should) Billing management — invoice history for at least last 12 months.
- **FR-SUB-04** (Must) Feature gating — gated feature attempt on Free tier shows upgrade prompt, not broken/hidden UI.

## Non-Functional constraints touching Phase 1
- TLS 1.2+ in transit, encryption at rest; medical info/emergency contacts field-level encrypted (not just DB-level).
- Auth tokens short-lived with refresh rotation; biometric/PIN re-auth required for role changes and account deletion.
- Data minimization; NDPR-compliant handling; explicit Guardian consent before any Managed Member profile enables Screen Time/App Monitoring (Phase 2 modules, N/A yet).
- Right to deletion: full account/data deletion honored within 30 days.
