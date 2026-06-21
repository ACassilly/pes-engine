import { json } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import { useState, useEffect } from "react";
import { AppProvider as BridgeAppProvider } from "@shopify/app-bridge-react";
import translations from "@shopify/polaris/locales/en.json";

export const links = () => [
  { rel: "stylesheet", href: polarisStyles },
];

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  
  return json({
    apiKey: process.env.SHOPIFY_API_KEY,
    shopDomain: session.shop,
    shopOrigin: session.shop,
    airgapMode: process.env.AIRGAP_MODE === "true",
    appVersion: process.env.APP_VERSION || "1.0.0",
  });
}

export default function App() {
  const { apiKey, shopOrigin, airgapMode, appVersion } = useLoaderData();
  const [host, setHost] = useState("");
  
  useEffect(() => {
    if (document.location) {
      const encodedHost = btoa(document.location.host);
      setHost(encodedHost);
    }
  }, []);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <BridgeAppProvider
          config={{
            apiKey,
            host,
            forceRedirect: true,
          }}
        >
          <PolarisAppProvider
            i18n={translations}
            features={{
              newDesignLanguage: true,
            }}
          >
            <Outlet />
            <ScrollRestoration />
            <Scripts />
          </PolarisAppProvider>
        </BridgeAppProvider>
      </body>
    </html>
  );
}

export function ErrorBoundary({ error }) {
  return (
    <html lang="en">
      <head>
        <title>Error — PES Engine</title>
        <Meta />
        <Links />
      </head>
      <body>
        <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
          <h1>PES Engine Error</h1>
          <p>Something went wrong. Please try refreshing the page.</p>
          <pre style={{ background: "#f5f5f5", padding: "1rem", borderRadius: "4px", overflow: "auto" }}>
            {error.message}
          </pre>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
