/** @type {import('next').NextConfig} */
const nextConfig = {
  // These launch or ship a real browser binary — they must stay outside the
  // bundle, on the desktop and on Vercel alike.
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium", "exceljs"],
};
export default nextConfig;
