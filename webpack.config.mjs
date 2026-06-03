import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import webpack from "webpack";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import { ModuleFederationPlugin } from "@module-federation/enhanced/webpack";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const deps = require("./package.json").dependencies;

// Load .env files into process.env (Node 20.12+ native, zero-dependency).
// File selection: APP_ENV picks the target explicitly and independently of the
// webpack --mode (e.g. APP_ENV=prod -> .env.prod, still a minified build);
// without APP_ENV it falls back to the build mode (development | production).
// Precedence (first match wins; a real shell env var always beats the files):
//   .env.<sel>.local > .env.<sel> > .env.local > .env
// Missing files are ignored. Documented variables live in .env.example;
// the actual files are gitignored.
function loadEnv(mode) {
  const sel = process.env.APP_ENV ?? mode;
  for (const file of [`.env.${sel}.local`, `.env.${sel}`, ".env.local", ".env"]) {
    try {
      process.loadEnvFile(path.join(__dirname, file));
    } catch {
      /* file absent — ignore */
    }
  }
}

export default (_env, argv) => {
  const mode = argv.mode ?? "production";
  loadEnv(mode);

  // publicPath must end with "/", else webpack concatenates chunk names straight
  // onto it (e.g. "http://example.com" + "main.js" -> "http://example.commain.js").
  const publicPath = (process.env.PUBLIC_PATH ?? "http://localhost:3003/").replace(/\/*$/, "/");

  return {
    entry: "./src/index.ts",
    // Minified prod bundle (no maps); readable dev bundle with real source maps.
    devtool: mode === "development" ? "source-map" : false,
    output: {
      path: path.join(__dirname, "dist"),
      filename: "[name].js",
      clean: true,
      publicPath,
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: {
            loader: "ts-loader",
            // Bundle build doesn't need .d.ts/.d.ts.map (host exposes nothing,
            // remotes use hand-written types.d.ts). tsconfig keeps declarations
            // on for the editor; this only suppresses them during the build.
            options: { compilerOptions: { declaration: false, declarationMap: false } },
          },
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, "css-loader", "postcss-loader"],
        },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
      alias: {
        "@": path.join(__dirname, "src"),
      },
    },
    plugins: [
      // Backend base URL baked into the bundle at build time (see src/lib/api.ts).
      new webpack.DefinePlugin({
        "process.env.API_BASE": JSON.stringify(process.env.API_BASE ?? "http://localhost:8000"),
      }),
      new HtmlWebpackPlugin({
        template: "./public/index.html",
      }),
      new MiniCssExtractPlugin({
        filename: "[name].css",
      }),
      new ModuleFederationPlugin({
        name: "categoryPicker",
        filename: "remoteEntry.js",
        exposes: {
          "./CategoryPicker": "./src/CategoryPicker",
        },
        shared: {
          react: { singleton: true, requiredVersion: deps.react },
          "react-dom": { singleton: true, requiredVersion: deps["react-dom"] },
        },
        dts: false,
      }),
    ],
    devServer: {
      port: Number(process.env.DEV_PORT ?? 3003),
      hot: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      historyApiFallback: false,
    },
  };
};
