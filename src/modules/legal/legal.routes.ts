import { Router } from "express";
import { env } from "@/config/env";

/**
 * Public pages Google Play requires for an app with accounts and location:
 * a privacy policy URL and an account-deletion URL. Plain HTML, no auth.
 */
export const legalRouter = Router();

const UPDATED = "17 November 2026";

function contactLine(): string {
  return env.SUPPORT_EMAIL
    ? `email <a href="mailto:${env.SUPPORT_EMAIL}">${env.SUPPORT_EMAIL}</a>`
    : "use the in-app Profile screen";
}

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Abo</title>
<style>
  body { font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1f2933; max-width: 720px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 28px; margin-bottom: 4px; }
  h2 { font-size: 19px; margin-top: 32px; }
  .muted { color: #616e7c; font-size: 14px; }
  li { margin: 6px 0; }
  a { color: #1a73e8; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

legalRouter.get("/privacy", (_req, res) => {
  res.type("html").send(
    page(
      "Privacy Policy",
      `<h1>Abo Privacy Policy</h1>
<p class="muted">Last updated ${UPDATED}</p>

<p>Abo helps families and close friends keep each other safe: share location within a private Circle, check in, and raise an SOS. Abo is operated by Letscync Ltd, Ibadan, Nigeria ("we"). This policy explains what we collect, why, and the choices you have.</p>

<h2>What we collect</h2>
<ul>
  <li><strong>Account details:</strong> your phone number (your login), the email address your login codes are sent to, and optionally your name and profile photo.</li>
  <li><strong>Location:</strong> your device's precise location while the Abo app is open, shared only with the members of your Circle. Abo does not collect location in the background.</li>
  <li><strong>Battery level:</strong> your phone's battery percentage, sent with your location so your Circle knows if your phone may switch off.</li>
  <li><strong>Safety information you choose to add:</strong> emergency contacts and medical information. Medical information is encrypted at rest. It is not shown to anyone in normal use; when you send an SOS, your medical information and emergency contacts are included in the alert to your Circle so they can help.</li>
  <li><strong>SOS recordings:</strong> when you send an SOS, Abo uses your camera and microphone to record a short video (up to 60 seconds), which is shared with your Circle. Recording only happens during an SOS you start.</li>
  <li><strong>Things you create:</strong> check-ins, SOS events, community safety alerts, and any photos or videos you attach to them.</li>
  <li><strong>Device and push data:</strong> a push-notification token for your phone, its platform (Android or iOS), and app information, so we can deliver alerts to you.</li>
  <li><strong>Technical data:</strong> server logs (such as IP address) needed to run and secure the service.</li>
</ul>

<h2>How we use it</h2>
<ul>
  <li>To log you in and keep your account secure.</li>
  <li>To show your Circle where you are, alert them when you arrive at or leave a Safe Place or when your battery is low, and deliver SOS, check-in and Circle notifications.</li>
  <li>To show community alerts near you.</li>
  <li>To operate, maintain and protect the service.</li>
</ul>
<p>We do not sell your personal data and do not use it for advertising.</p>

<h2>Who can see it</h2>
<ul>
  <li><strong>Your Circle:</strong> members see your name, photo, phone number, latest location, battery level and safety status, plus your check-ins and SOS alerts (including the SOS video, medical information and emergency contacts). Admins approve who joins.</li>
  <li><strong>People you choose to share with:</strong> from an SOS, any Circle member can share its details (location link, time, battery, phone number and a temporary video link) with people outside the Circle, for example by WhatsApp or SMS. This only happens when someone taps Share.</li>
  <li><strong>Community alerts</strong> you post (title, description, place, photo or video, and the area they're about) are visible to Abo users nearby. Your name and exact coordinates are not shown. Posts must follow our <a href="/community-guidelines">Community guidelines</a>.</li>
  <li><strong>Reports and blocks:</strong> if you report a post, we keep the report (reason and any note) and the post's details so our team can review it. If you block someone, we keep that so their posts stay hidden from you. The person you report or block is not told.</li>
  <li><strong>Service providers</strong> who process data on our behalf: our hosting provider, Supabase (database and media storage), Brevo (email delivery of login codes), Termii (SMS delivery of login codes), Google Firebase Cloud Messaging and Apple Push Notification service (delivery of notifications; they receive your push token and the notification content) and MapTiler (map images; receives your IP address and the map area being viewed). They may only use the data to provide these services to us.</li>
  <li>Authorities, when required by law or to protect someone's life or safety.</li>
</ul>

<h2>How long we keep it</h2>
<p>Location history is kept for your Circle's retention setting (7 days by default, at most 30). The Circle activity feed shows the last 7 days. Account data is kept until you delete your account.</p>

<h2>Your choices</h2>
<ul>
  <li>You can turn off location, camera, microphone or notification permission at any time in your phone's settings; Abo then cannot use that feature.</li>
  <li>You can edit your profile, and leave or be removed from a Circle.</li>
  <li>You can delete your account in the app (Profile &rarr; Delete account) or as described on our <a href="/delete-account">account deletion page</a>.</li>
</ul>

<h2>Children</h2>
<p>Abo accounts are for people aged 13 and over. Younger family members should only use Abo with a parent or guardian managing their Circle.</p>

<h2>Security</h2>
<p>Data is encrypted in transit (HTTPS), sensitive fields are encrypted at rest, and access is limited to what is needed to run the service.</p>

<h2>Changes and contact</h2>
<p>We will update this page if this policy changes. For questions or requests, ${contactLine()}.</p>`
    )
  );
});

legalRouter.get("/delete-account", (_req, res) => {
  res.type("html").send(
    page(
      "Delete your account",
      `<h1>Delete your Abo account</h1>
<p class="muted">Last updated ${UPDATED}</p>

<h2>In the app (fastest)</h2>
<ol>
  <li>Open Abo and go to the <strong>Profile</strong> tab.</li>
  <li>Tap <strong>Delete account</strong> and confirm.</li>
</ol>
<p>Deletion happens immediately.</p>

<h2>Without the app</h2>
<p>If you can no longer open the app, ${contactLine()} from the email address linked to your account, and include your phone number. We will delete the account within 30 days.</p>

<h2>What is deleted</h2>
<ul>
  <li>Your phone number, email address, name, profile photo, emergency contacts and medical information.</li>
  <li>Your location history, registered devices and login sessions.</li>
  <li>Your membership in every Circle. If you were a Circle's only Admin, its longest-standing member becomes Admin.</li>
</ul>

<h2>What may be kept</h2>
<p>Records of past SOS events, messages and community alerts you created are kept without your name or contact details, so other members' safety history stays intact. Server logs are kept for up to 30 days for security.</p>`
    )
  );
});

legalRouter.get("/community-guidelines", (_req, res) => {
  res.type("html").send(
    page(
      "Community guidelines",
      `<h1>Abo Community guidelines</h1>
<p class="muted">Last updated ${UPDATED}</p>

<p>Community alerts help neighbours look out for each other: a missing person, a lost item, or a hazard nearby. Everyone who posts agrees to these rules.</p>

<h2>Post only</h2>
<ul>
  <li>Real, current safety information: missing people, lost items, and hazards such as accidents, flooding or fires.</li>
  <li>Photos and videos that help others recognise the person, item or danger.</li>
</ul>

<h2>Never post</h2>
<ul>
  <li>False or misleading alerts, pranks, or spam and advertising.</li>
  <li>Harassment, hate, threats, or content that targets a person or group.</li>
  <li>Sexual content, graphic violence, or anything that exploits or endangers children.</li>
  <li>Private information about someone else (such as their address or phone number) unless it is needed to reunite a missing person with family and you have their family's consent.</li>
  <li>Anything illegal, or that encourages dangerous or illegal acts.</li>
</ul>

<h2>Reporting and blocking</h2>
<ul>
  <li>Tap <strong>&#8942;</strong> on any post to <strong>report</strong> it or <strong>block</strong> the person who posted it. You won't see posts you've reported or posts from people you've blocked.</li>
  <li>Our team reviews every report. Posts reported by several people are hidden automatically until reviewed.</li>
  <li>We remove posts that break these rules and may suspend or delete accounts that break them repeatedly or seriously.</li>
  <li>In an emergency, contact local emergency services first.</li>
</ul>

<h2>Contact</h2>
<p>To report a problem or appeal a decision, ${contactLine()}.</p>`
    )
  );
});
