import { execSync } from "node:child_process";

function readGitBuildVersion() {
  try {
    const count = execSync("git rev-list --count HEAD", { encoding: "utf8" }).trim();
    const sha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    return `web-${count}-${sha}`;
  } catch {
    return "web-dev";
  }
}

const clientVersion = process.env.NEXT_PUBLIC_CLIENT_VERSION ?? readGitBuildVersion();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_CLIENT_VERSION: clientVersion
  },
  async rewrites() {
    const target = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8080";
    return [
      {
        source: "/api/:path*",
        destination: `${target}/:path*`
      }
    ];
  }
};

export default nextConfig;
