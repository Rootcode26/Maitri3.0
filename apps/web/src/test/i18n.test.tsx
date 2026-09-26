import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import {
  LanguageProvider,
  useLanguage,
} from "@/components/providers/language-provider";

function LanguageHarness() {
  const { language, setLanguage, t, text } = useLanguage();
  return (
    <div>
      <p data-testid="language">{language}</p>
      <p>{t("documents.title")}</p>
      <p>{text("Checklist generated")}</p>
      <p>{text("{{count}} approvals recommended", { count: 4 })}</p>
      <p>{text("Unregistered API value")}</p>
      <button type="button" onClick={() => setLanguage("hi")}>Hindi</button>
      <button type="button" onClick={() => setLanguage("mr")}>Marathi</button>
    </div>
  );
}

describe("multilingual UI", () => {
  beforeEach(() => window.localStorage.clear());

  it("switches key-based and data-driven text together", async () => {
    const user = userEvent.setup();
    render(<LanguageProvider><LanguageHarness /></LanguageProvider>);

    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("Checklist generated")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hindi" }));
    expect(screen.getByText("दस्तावेज़")).toBeInTheDocument();
    expect(screen.getByText("चेकलिस्ट तैयार हो गई")).toBeInTheDocument();
    expect(screen.getByText("4 अनुमोदन सुझाए गए")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Marathi" }));
    expect(screen.getByText("कागदपत्रे")).toBeInTheDocument();
    expect(screen.getByText("तपासणी यादी तयार झाली")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("mr");
    expect(window.localStorage.getItem("language")).toBe("mr");
    expect(document.cookie).toContain("udyogsetu_language=mr");
  });

  it("restores a saved language and safely falls back for API text", async () => {
    window.localStorage.setItem("language", "hi");
    render(<LanguageProvider><LanguageHarness /></LanguageProvider>);

    await waitFor(() => expect(screen.getByTestId("language")).toHaveTextContent("hi"));
    expect(screen.getByText("Unregistered API value")).toBeInTheDocument();
  });
});
