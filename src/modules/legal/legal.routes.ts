import { Router } from "express";
import { env } from "@/config/env";

/**
 * Public pages Google Play requires for an app with accounts and location:
 * a privacy policy URL and an account-deletion URL. Plain HTML, no auth.
 */
export const legalRouter = Router();

const UPDATED = "14 November 2026";

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

<p>Abo helps families and close friends keep each other safe: share location within a private Circle, check in, and raise an SOS. This policy explains what we collect, why, and the choices you have.</p>

<h2>What we collect</h2>
<ul>
  <li><strong>Account details:</strong> your phone number (your login), the email address your login codes are sent to, and optionally your name and profile photo.</li>
  <li><strong>Location:</strong> your device's precise location while the Abo app is open, shared only with the members of your Circle. Abo does not collect location in the background.</li>
  <li><strong>Safety information you choose to add:</strong> emergency contacts and medical information (medical information is encrypted at rest and visible only to you).</li>
  <li><strong>Things you create:</strong> check-ins, SOS events, community safety alerts, and any photos or videos you attach to them.</li>
  <li><strong>Technical data:</strong> device and app information and server logs (such as IP address) needed to run and secure the service.</li>
</ul>

<h2>How we use it</h2>
<ul>
  <li>To log you in and keep your account secure.</li>
  <li>To show your Circle where you are, alert them when you arrive at or leave a Safe Place, and deliver SOS and check-in notifications.</li>
  <li>To show community alerts near you.</li>
  <li>To operate, maintain and protect the service.</li>
</ul>
<p>We do not sell your personal data and do not use it for advertising.</p>

<h2>Who can see it</h2>
<ul>
  <li><strong>Your Circle:</strong> members see your name, photo, phone number, latest location and safety status. Admins approve who joins.</li>
  <li><strong>Community alerts</strong> you post are visible to Abo users nearby.</li>
  <li><strong>Service providers</strong> who process data on our behalf: our hosting provider, Supabase (database and media storage), Google (email delivery of login codes), Termii (SMS delivery of login codes) and MapTiler (map images; receives your IP address and the map area being viewed).</li>
  <li>Authorities, when required by law or to protect someone's life or safety.</li>
</ul>

<h2>How long we keep it</h2>
<p>Location history is kept for your Circle's retention setting (7 days by default, at most 30). Account data is kept until you delete your account.</p>

<h2>Your choices</h2>
<ul>
  <li>You can turn off location permission at any time in your phone's settings; Abo then cannot share your location.</li>
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
