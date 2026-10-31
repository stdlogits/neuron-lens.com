import { mount } from "svelte";
import App from "./App.svelte";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";

const target = document.getElementById("app")!;
// The summary for readers that run no script (scripts/site/meta.ts) gives way to the app.
target.replaceChildren();
mount(App, { target });
