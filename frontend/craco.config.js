const path = require("path");

module.exports = {
  webpack: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // react-scripts 5 trae la configuración del servidor de desarrollo para webpack-dev-server 4,
  // pero este proyecto usa la versión 5. Acá se traduce.
  devServer: (devServerConfig) => {
    const { onBeforeSetupMiddleware, onAfterSetupMiddleware, https, ...rest } = devServerConfig;
    if (https) {
      rest.server = typeof https === "object" ? { type: "https", options: https } : "https";
    }
    rest.setupMiddlewares = (middlewares, devServer) => {
      if (typeof onBeforeSetupMiddleware === "function") onBeforeSetupMiddleware(devServer);
      if (typeof onAfterSetupMiddleware === "function") onAfterSetupMiddleware(devServer);
      return middlewares;
    };
    return rest;
  },
};
