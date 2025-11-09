import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import App from "./App";
import "./index.css";
import i18n from "./i18n";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <App />
        </I18nextProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
