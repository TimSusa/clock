import { mount } from "svelte";
import App from "./App.svelte";
import "./app.css";

const target = document.getElementById("app");

if (!target) {
	throw new Error("Mount target #app is missing in index.html");
}

export default mount(App, { target });
