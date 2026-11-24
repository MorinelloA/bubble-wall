import "./styles/base.css";
import "./styles/drawer.css";
import "./styles/remote.css";
import "./styles/more.css";
import { boot } from "./boot";

// Wiring only: everything else lives in modules that tests can drive.
boot(window, { seed: Date.now(), offline: import.meta.env.PROD });
