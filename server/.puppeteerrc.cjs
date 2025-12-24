/**
 * Puppeteer 配置文件
 * 用于配置 Render 等云服务器上的 Chrome 安装
 * 
 * 注意：在 Render 上必须将 Chrome 安装到项目目录内（而非缓存目录）
 * 因为 /opt/render/.cache 在运行时会被清除
 */

const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // 缓存目录 - 使用项目目录内的位置，确保 Chrome 包含在部署包中
  cacheDirectory: join(__dirname, '.puppeteer'),
  
  // 使用新版本的 Chrome
  chrome: {
    skipDownload: false,
  },
  
  // 在安装时自动下载 Chrome
  skipDownload: false,
};

