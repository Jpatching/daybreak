export default function middleware(request) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/scan\/([A-Za-z0-9]{32,44})$/);
  if (!match) return;

  const ua = request.headers.get('user-agent') || '';
  const isBot = /twitterbot|discordbot|facebookexternalhit|linkedinbot|slackbot/i.test(ua);
  if (!isBot) return;

  const token = match[1];
  const truncated = token.slice(0, 8) + '...';

  return new Response(
    `<!DOCTYPE html><html>
    <head>
      <meta property="og:title" content="Deployer Scan: ${truncated}" />
      <meta property="og:description" content="Check this deployer's reputation on Daybreak" />
      <meta property="og:image" content="https://api.daybreakscan.com/api/v1/report/${token}/twitter.png" />
      <meta property="og:url" content="https://www.daybreakscan.com/scan/${token}" />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Deployer Scan: ${truncated}" />
      <meta name="twitter:description" content="Check this deployer's reputation on Daybreak" />
      <meta name="twitter:image" content="https://api.daybreakscan.com/api/v1/report/${token}/twitter.png" />
    </head><body></body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}

export const config = { matcher: '/scan/:path*' };
