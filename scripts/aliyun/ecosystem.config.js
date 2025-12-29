/**
 * PM2 生态系统配置文件
 * Sysafari Logistics 双环境部署
 * 
 * 使用方法:
 *   pm2 start ecosystem.config.js
 *   pm2 start ecosystem.config.js --only sysafari-prod
 *   pm2 start ecosystem.config.js --only sysafari-demo
 * 
 * 管理命令:
 *   pm2 status           - 查看所有进程状态
 *   pm2 logs             - 查看所有日志
 *   pm2 logs sysafari-prod - 查看生产环境日志
 *   pm2 restart all      - 重启所有进程
 *   pm2 reload all       - 零停机重载
 *   pm2 save             - 保存当前进程列表
 *   pm2 startup          - 设置开机自启
 */

module.exports = {
  apps: [
    // ============================================
    // 生产环境 - erp.xianfeng-eu.com
    // ============================================
    {
      name: 'sysafari-prod',
      cwd: '/var/www/prod/server',
      script: 'app.js',
      instances: 1,                    // 单实例（可根据 CPU 核心数调整）
      exec_mode: 'fork',               // 执行模式
      autorestart: true,               // 自动重启
      watch: false,                    // 不监听文件变化（生产环境）
      max_memory_restart: '500M',      // 内存超过 500M 自动重启
      
      // 环境变量
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        // 数据库连接（部署时在 .env 文件中配置）
        // DATABASE_URL: 'postgresql://user:pass@rds-address:5432/sysafari_prod'
      },
      
      // 日志配置
      error_file: '/var/log/pm2/sysafari-prod-error.log',
      out_file: '/var/log/pm2/sysafari-prod-out.log',
      log_file: '/var/log/pm2/sysafari-prod-combined.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // 重启策略
      exp_backoff_restart_delay: 100,  // 指数退避重启延迟
      max_restarts: 10,                // 最大重启次数
      restart_delay: 1000,             // 重启间隔（毫秒）
      
      // 优雅关闭
      kill_timeout: 5000,              // 5 秒后强制杀死
      listen_timeout: 3000,            // 监听超时
      
      // 健康检查（需要 pm2-health-check 插件）
      // health: {
      //   url: 'http://localhost:3001/api/health',
      //   interval: 30000,
      //   timeout: 5000
      // }
    },
    
    // ============================================
    // 演示环境 - demo.xianfeng-eu.com
    // ============================================
    {
      name: 'sysafari-demo',
      cwd: '/var/www/demo/server',
      script: 'app.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',      // 演示环境内存限制稍低
      
      // 环境变量
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        // 数据库连接（部署时在 .env 文件中配置）
        // DATABASE_URL: 'postgresql://user:pass@rds-address:5432/sysafari_demo'
      },
      
      // 日志配置
      error_file: '/var/log/pm2/sysafari-demo-error.log',
      out_file: '/var/log/pm2/sysafari-demo-out.log',
      log_file: '/var/log/pm2/sysafari-demo-combined.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // 重启策略
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      restart_delay: 1000,
      
      // 优雅关闭
      kill_timeout: 5000,
      listen_timeout: 3000,
    }
  ],
  
  // ============================================
  // 部署配置（可选，用于远程部署）
  // ============================================
  deploy: {
    // 生产环境部署
    production: {
      user: 'root',
      host: ['your-ecs-ip'],           // ECS 服务器 IP
      ref: 'origin/main',
      repo: 'git@github.com:your-username/sysafari-logistics.git',
      path: '/var/www/prod',
      'pre-deploy-local': '',
      'post-deploy': 'cd server && npm install --production && pm2 reload ecosystem.config.js --only sysafari-prod',
      'pre-setup': ''
    },
    
    // 演示环境部署
    demo: {
      user: 'root',
      host: ['your-ecs-ip'],           // ECS 服务器 IP
      ref: 'origin/demo',              // 可以使用不同分支
      repo: 'git@github.com:your-username/sysafari-logistics.git',
      path: '/var/www/demo',
      'pre-deploy-local': '',
      'post-deploy': 'cd server && npm install --production && pm2 reload ecosystem.config.js --only sysafari-demo',
      'pre-setup': ''
    }
  }
};

