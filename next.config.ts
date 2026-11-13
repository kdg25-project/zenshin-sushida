import type { NextConfig } from "next";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require=createRequire(import.meta.url);
const humanBrowserEsm=join(dirname(require.resolve("@vladmandic/human")),"human.esm.js");
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  webpack(config){
    config.resolve??={};
    config.resolve.alias={...(typeof config.resolve.alias==="object"&&!Array.isArray(config.resolve.alias)?config.resolve.alias:{}),"@vladmandic/human":humanBrowserEsm};
    return config;
  },
};
export default nextConfig;
