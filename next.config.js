/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable server actions for form handling
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb", // RFP files can be large
    },
  },
  // Increase API route body size limit for multi-file uploads
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

module.exports = nextConfig;
