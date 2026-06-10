// AuraHire - PM2 process config for the NestJS API
//
// First start:  pm2 start deploy/ecosystem.config.cjs && pm2 save
// Reload:       pm2 reload aurahire-api --update-env
// Logs:         pm2 logs aurahire-api
// Status:       pm2 status
// Resurrect on reboot:  pm2 startup systemd  (run as deploy user, then run the printed command as root)

module.exports = {
  apps: [
    {
      name: "aurahire-api",
      cwd: "/home/deploy/aurahire/apps/api",
      script: "src/main.ts",
      interpreter: "node",
      interpreter_args: "--require @swc-node/register",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
        PORT: "3333",
      },
      error_file: "/home/deploy/.pm2/logs/aurahire-api-error.log",
      out_file: "/home/deploy/.pm2/logs/aurahire-api-out.log",
      time: true,
    },
  ],
};
