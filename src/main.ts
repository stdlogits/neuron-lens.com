import { mount } from "svelte";
import App from "./App.svelte";
import "@stdlogits/ledger/ledger.css";
import "./styles/site.css";
import { setTranslator } from "@stdlogits/ledger";
import { translator } from "./lib/translate.svelte";

// Ledger draws the English for foreign text; the site's translations supply it.
setTranslator(translator);
const target = document.getElementById("app")!;
// The summary for readers that run no script (scripts/site/meta.ts) gives way to the app.
target.replaceChildren();
mount(App, { target });
