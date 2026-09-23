import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={(props.alt as string) ?? ""} />
  ),
}));

describe("DashboardSidebar", () => {
  it("renders the brand, workspace nav and account footer", () => {
    render(<DashboardSidebar activeHref="/applicant/dashboard" />);

    expect(screen.getByText("UdyogSetu")).toBeInTheDocument();
    expect(screen.getByText("Applicant portal")).toBeInTheDocument();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("Your account")).toBeInTheDocument();
    expect(screen.getByText("Applicant account")).toBeInTheDocument();

    for (const label of [
      "Dashboard",
      "New project",
      "Applications",
      "Documents",
    ]) {
      expect(
        screen.getByRole("link", { name: new RegExp(label, "i") }),
      ).toBeInTheDocument();
    }
    for (const label of ["Notifications", "Verify certificate"]) {
      expect(screen.getByText(new RegExp(label, "i"))).toBeInTheDocument();
    }
  });

  it("shows unbuilt sections as disabled and not as links", () => {
    render(<DashboardSidebar activeHref="/applicant/dashboard" />);
    for (const label of ["Notifications", "Verify certificate"]) {
      expect(
        screen.queryByRole("link", { name: new RegExp(label, "i") }),
      ).toBeNull();
    }
    expect(screen.getAllByText("Soon")).toHaveLength(2);
  });

  it("marks only the active route with aria-current=page", () => {
    render(<DashboardSidebar activeHref="/applicant/projects/new" />);
    expect(screen.getByRole("link", { name: /new project/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /^dashboard/i }),
    ).not.toHaveAttribute("aria-current");
  });
});

describe("DashboardShell", () => {
  function renderShell() {
    return render(
      <DashboardShell
        activeHref="/applicant/dashboard"
        breadcrumb={["Home", "Applicant", "Dashboard"]}
      >
        <p>Body content</p>
      </DashboardShell>,
    );
  }

  it("renders children inside the main region", () => {
    renderShell();
    expect(screen.getByText("Body content")).toBeInTheDocument();
    expect(screen.getByRole("main")).toContainElement(
      screen.getByText("Body content"),
    );
  });

  it("renders the breadcrumb trail with the last crumb as the current page", () => {
    renderShell();
    const breadcrumb = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(within(breadcrumb).getByText("Home")).toBeInTheDocument();
    expect(within(breadcrumb).getByText("Applicant")).toBeInTheDocument();
    const current = within(breadcrumb).getByText("Dashboard");
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("renders the prototype tag, notification bell and avatar", () => {
    renderShell();
    expect(screen.getByText("SIH")).toBeInTheDocument();
    expect(
      screen.getByText(/digital public-service prototype/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /notifications/i }),
    ).toBeInTheDocument();
  });

  it("opens and closes the mobile workspace navigation", async () => {
    renderShell();
    const toggle = screen.getByRole("button", { name: /toggle navigation/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: /close navigation/i }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /close navigation/i }),
    );
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
