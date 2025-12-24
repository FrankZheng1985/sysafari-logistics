/**
 * Puppeteer 配置文件
 * 用于配置 Render 等云服务器上的 Chrome 安装
 */

const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // 缓存目录 - 对于 Render，使用 /opt/render/.cache
  cacheDirectory: process.env.RENDER ? '/opt/render/.cache/puppeteer' : join(__dirname, '.cache', 'puppeteer'),
  
  // 使用新版本的 Chrome
  chrome: {
    skipDownload: false,
  },
  
  // 在安装时自动下载 Chrome
  skipDownload: false,
};

