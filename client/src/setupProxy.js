const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api',  // Redirects any request starting with /api
    createProxyMiddleware({
      target: 'http://127.0.0.1:5004',  // Your local IPFS API
      changeOrigin: true,
      pathRewrite: { '^/api': '' },  // Remove '/api' before sending to IPFS
    })
  );
};
