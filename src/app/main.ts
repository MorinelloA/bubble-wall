import "./styles/base.css";
import "./styles/drawer.css";
import "./styles/remote.css";
import { boot } from "./boot";

// Wiring only: everything else lives in modules that tests can drive.
boot(window, Date.now());
