/**
 * Community moderation from the server (run as the abo user, in the repo):
 *
 *   npx tsx scripts/moderate.ts list            reported posts, most reported first
 *   npx tsx scripts/moderate.ts show <postId>   the post and every report on it
 *   npx tsx scripts/moderate.ts hide <postId>   take it down for everyone
 *   npx tsx scripts/moderate.ts restore <postId> put it back (clears its reports)
 *
 * Each new report is also emailed to SUPPORT_EMAIL. Posts with 3 reports are
 * hidden automatically; review them and restore any that were fine.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [command, id] = process.argv.slice(2);

  if (command === "list") {
    const posts = await prisma.communityAlert.findMany({
      where: { reports: { some: {} } },
      include: { _count: { select: { reports: true } } },
    });
    posts.sort((a, b) => b._count.reports - a._count.reports);
    if (posts.length === 0) return console.log("No reported posts.");
    for (const p of posts) {
      console.log(`${p.id}  ${String(p._count.reports).padStart(2)} reports  ${p.status.padEnd(8)}  ${p.title}`);
    }
    return;
  }

  if (!id) return usage();
  const post = await prisma.communityAlert.findUnique({
    where: { id },
    include: { reports: { orderBy: { createdAt: "asc" } }, author: { select: { id: true, name: true, phone: true } } },
  });
  if (!post) return console.log("No post with that ID.");

  if (command === "show") {
    console.log(`${post.title}  [${post.kind}, ${post.status}]`);
    console.log(`Place: ${post.placeLabel}`);
    if (post.description) console.log(`Description: ${post.description}`);
    if (post.mediaUrl) console.log(`Media: ${post.mediaUrl}`);
    console.log(`Author: ${post.author.name ?? "(no name)"} ${post.author.phone} (${post.author.id})`);
    console.log(`Posted: ${post.createdAt.toISOString()}`);
    console.log(`\nReports (${post.reports.length}):`);
    for (const r of post.reports) {
      console.log(`- ${r.createdAt.toISOString()} ${r.reason}${r.details ? `: ${r.details}` : ""}`);
    }
    return;
  }
  if (command === "hide") {
    await prisma.communityAlert.update({ where: { id }, data: { status: "HIDDEN" } });
    return console.log(`Hidden: ${post.title}`);
  }
  if (command === "restore") {
    await prisma.$transaction([
      prisma.communityReport.deleteMany({ where: { alertId: id } }),
      prisma.communityAlert.update({ where: { id }, data: { status: "ACTIVE" } }),
    ]);
    return console.log(`Restored (reports cleared): ${post.title}`);
  }
  usage();
}

function usage() {
  console.log("Usage: npx tsx scripts/moderate.ts list | show <postId> | hide <postId> | restore <postId>");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
