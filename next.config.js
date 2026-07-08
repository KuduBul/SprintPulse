/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  // Keep @react-pdf/* out of the webpack server bundle. When webpack bundles it
  // into the RSC/route chunk, React.createElement calls resolve to Next's React
  // while @react-pdf/reconciler uses its own copy, producing "Minified React
  // error #31" at render time. Marking these packages external makes them load
  // via native Node require with a single, consistent React instance.
  serverExternalPackages: [
    '@react-pdf/renderer',
    '@react-pdf/reconciler',
  ],
};

module.exports = nextConfig;
