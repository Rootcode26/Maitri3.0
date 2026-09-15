import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

if (!document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

afterEach(() => cleanup());
