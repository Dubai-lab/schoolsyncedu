// Vercel serverless function — returns a school-specific PWA manifest.
// Called by SchoolSite.tsx via a <link rel="manifest"> tag so that
// when a student installs the PWA from their school's page, the app
// shows the school's name, color, and logo instead of "SchoolSync".

export default function handler(req, res) {
  const {
    name = 'SchoolSync',
    short_name,
    color = '#1e3a5f',
    logo,
    slug = '/',
  } = req.query;

  // Truncate short name to 12 chars so it fits on home screen icons
  const shortName = short_name || name.slice(0, 12);

  const manifest = {
    name,
    short_name: shortName,
    description: `${name} — Student Portal`,
    theme_color: color,
    background_color: '#ffffff',
    display: 'standalone',
    orientation: 'portrait',
    start_url: `/school/${slug}`,
    scope: '/',
    icons: [
      {
        src: logo || '/SchoolSync_logo.png',
        sizes: '192x192',
        type: logo ? 'image/png' : 'image/png',
        purpose: 'any',
      },
      {
        src: logo || '/SchoolSync_logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  };

  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.status(200).json(manifest);
}
