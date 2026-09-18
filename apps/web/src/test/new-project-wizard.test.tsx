import { render, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewProjectWizard } from "@/features/projects/new-project-wizard";

// Stand-in for the backend rules engine: builds the approvals a real
// POST /api/v1/projects would return, from the mapped payload.
type MockPayload = { industry: string; boiler?: string; wetProcessing?: string; [k: string]: unknown };
const departmentsList = [
  { id: "d-mpcb", key: "mpcb", name: "Maharashtra Pollution Control Board (MPCB)" },
  { id: "d-dish", key: "dish", name: "Directorate of Industrial Safety and Health (DISH)" },
  { id: "d-fssai", key: "fssai", name: "Food Safety and Standards Authority of India (FSSAI)" },
  { id: "d-fire", key: "fire-emergency-services", name: "Maharashtra Fire and Emergency Services" },
];

const approval = (
  approvalKey: string,
  title: string,
  name: string,
  status: string,
  documents: string[],
  processingDays: number,
) => ({
  id: approvalKey,
  approvalKey,
  title,
  status,
  documents: documents.map((docName) => ({
    key: docName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: docName,
  })),
  processingDays,
  department: { id: `d-${approvalKey}`, key: approvalKey, name },
});

function mockApprovals(p: MockPayload) {
  const list = [];
  if (p.industry === "textile") list.push(approval("textile-registration", "Textile unit registration", "Directorate of Textiles", "required", ["Unit plan", "Machinery list", "Ownership proof"], 30));
  else if (p.industry === "steel") list.push(approval("factory-registration", "Factory registration", "DISH", "required", ["Floor plan", "Machinery list", "Worker details"], 45));
  else list.push(approval("food-licence", "Food-related licence", "FSSAI", "required", ["Factory plan", "Identity proof", "Water report"], 30));
  if (p.industry !== "steel") list.push(approval("factory-registration", "Factory registration", "DISH", "recommended", ["Floor plan", "Machinery list", "Worker details"], 45));
  list.push(approval("fire-noc", "Fire safety NOC", "Fire & Emergency Services", "recommended", ["Fire layout", "Evacuation plan", "Site photograph"], 21));
  list.push(approval("consent-to-operate", "Consent to operate", "MPCB", "recommended", ["Water balance", "Waste declaration", "Process note"], 60));
  if (p.boiler === "yes") list.push(approval("boiler-registration", "Boiler registration", "Directorate of Steam Boilers", "recommended", ["Boiler drawing", "Test certificate", "Feed-water report"], 30));
  if (p.wetProcessing === "yes") list.push(approval("effluent-consent", "Effluent treatment consent", "MPCB", "required", ["ETP design", "Water balance", "Discharge plan"], 45));
  return list;
}

const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (url === "/api/v1/departments") {
    return { ok: true, status: 200, json: async () => ({ data: { departments: departmentsList } }) } as Response;
  }
  if (init?.method === "PATCH") {
    const { departmentKey } = JSON.parse(init.body as string) as { departmentKey: string };
    const department = departmentsList.find((d) => d.key === departmentKey)!;
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: { approval: { id: "a", approvalKey: "consent-to-operate", title: "Consent to operate", status: "recommended", documents: [], processingDays: 60, department } } }),
    } as Response;
  }
  const p = JSON.parse(init!.body as string) as MockPayload;
  const project = {
    id: "p1",
    enterpriseName: p.enterpriseName,
    industry: p.industry,
    district: p.district,
    primaryActivity: p.primaryActivity,
    status: "submitted",
    approvals: mockApprovals(p),
  };
  return { ok: true, status: 201, json: async () => ({ status: "success", data: { project } }) } as Response;
});

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

const generate = async (u: UserEvent) => {
  await u.click(screen.getByRole("button", { name: /generate checklist/i }));
  await screen.findByRole("heading", { name: /approvals recommended/i });
};

const continueButton = () => screen.getByRole("button", { name: /save and continue/i });

async function fillBusiness(u: UserEvent, industry = "Food processing") {
  await u.type(screen.getByLabelText(/enterprise name/i), "Acme Foods Pvt. Ltd.");
  await u.selectOptions(screen.getByLabelText(/organisation type/i), "Private limited company");
  await u.selectOptions(screen.getByLabelText(/industry sector/i), industry);
  await u.type(screen.getByLabelText(/business PAN/i), "AABCS1234F");
  await u.click(continueButton());
}

async function fillLocation(u: UserEvent) {
  await u.type(screen.getByLabelText(/district/i), "Pune");
  await u.type(screen.getByLabelText(/PIN code/i), "410501");
  await u.selectOptions(screen.getByLabelText(/plot area/i), "500–2,000");
  await u.selectOptions(screen.getByLabelText(/land status/i), "Owned");
  await u.click(continueButton());
}

/** Advance from a fresh render to the Operations step for the given industry. */
async function gotoOperations(u: UserEvent, industry = "Food processing") {
  await fillBusiness(u, industry);
  await fillLocation(u);
  expect(screen.getByRole("heading", { name: /operations details/i })).toBeInTheDocument();
}

/** Complete a full Food-processing profile and land on the Checklist step. */
async function completeFoodToChecklist(
  u: UserEvent,
  { activity = "Food & beverage processing", permanent = "20–49" } = {},
) {
  await gotoOperations(u, "Food processing");
  await u.selectOptions(screen.getByLabelText(/primary activity/i), activity);
  await u.selectOptions(screen.getByLabelText(/project stage/i), "New unit");
  await u.selectOptions(screen.getByLabelText(/boiler \/ pressure vessel/i), "No");
  await u.selectOptions(screen.getByLabelText(/stores or handles hazardous chemicals/i), "No");
  await u.selectOptions(screen.getByLabelText(/FSSAI licence category/i), "State licence");
  await u.click(continueButton());

  await u.selectOptions(screen.getByLabelText(/electricity demand/i), "100–500");
  await u.selectOptions(screen.getByLabelText(/daily water use/i), "10–50");
  await u.selectOptions(screen.getByLabelText(/wastewater discharge/i), "On-site treatment plant");
  await u.selectOptions(screen.getByLabelText(/generates hazardous waste/i), "No");
  await u.click(continueButton());

  await u.selectOptions(screen.getByLabelText(/permanent employees/i), permanent);
  await u.click(continueButton());
}

/** Complete a Textiles profile with wet processing and land on the Checklist step. */
async function completeTextileToChecklist(u: UserEvent) {
  await gotoOperations(u, "Textiles");
  await u.selectOptions(screen.getByLabelText(/primary activity/i), "Weaving");
  await u.selectOptions(screen.getByLabelText(/project stage/i), "New unit");
  await u.selectOptions(screen.getByLabelText(/boiler \/ pressure vessel/i), "No");
  await u.selectOptions(screen.getByLabelText(/stores or handles hazardous chemicals/i), "No");
  await u.selectOptions(screen.getByLabelText(/involves dyeing \/ bleaching/i), "Yes");
  await u.click(continueButton());

  await u.selectOptions(screen.getByLabelText(/electricity demand/i), "100–500");
  await u.selectOptions(screen.getByLabelText(/daily water use/i), "10–50");
  await u.selectOptions(screen.getByLabelText(/wastewater discharge/i), "On-site treatment plant");
  await u.selectOptions(screen.getByLabelText(/generates hazardous waste/i), "No");
  await u.click(continueButton());

  await u.selectOptions(screen.getByLabelText(/permanent employees/i), "20–49");
  await u.click(continueButton());
}

describe("NewProjectWizard — initial state", () => {
  it("starts on the Business step with a 6-step progress indicator", () => {
    render(<NewProjectWizard />);
    expect(screen.getByText(/step 1 of 6/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /business details/i })).toBeInTheDocument();
  });

  it("reports progress and disables Back on the first step", () => {
    render(<NewProjectWizard />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "17");
    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
  });

  it("renders every step label in the stepper rail", () => {
    render(<NewProjectWizard />);
    for (const label of ["Business", "Location", "Operations", "Utilities", "Workforce", "Checklist"]) {
      expect(screen.getByRole("button", { name: new RegExp(label, "i") })).toBeInTheDocument();
    }
  });
});

describe("NewProjectWizard — validation", () => {
  it("blocks continue and shows inline errors for empty required fields", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await u.click(continueButton());

    expect(screen.getByText("Enterprise name is required.")).toBeInTheDocument();
    expect(screen.getByText("Industry sector is required.")).toBeInTheDocument();
    expect(screen.getByText("Business PAN is required.")).toBeInTheDocument();
    // Still on step 1.
    expect(screen.getByText(/step 1 of 6/i)).toBeInTheDocument();
  });

  it("marks the invalid control with aria-invalid", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await u.click(continueButton());
    expect(screen.getByLabelText(/enterprise name/i)).toHaveAttribute("aria-invalid", "true");
  });

  it("clears the error and advances once required fields are filled", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await u.click(continueButton());
    expect(screen.getByText("Enterprise name is required.")).toBeInTheDocument();

    await fillBusiness(u);
    expect(screen.getByRole("heading", { name: /location details/i })).toBeInTheDocument();
    expect(screen.queryByText("Enterprise name is required.")).not.toBeInTheDocument();
  });
});

describe("NewProjectWizard — navigation & persistence", () => {
  it("retains entered answers when navigating back to a previous step", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await fillBusiness(u);
    expect(screen.getByRole("heading", { name: /location details/i })).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByRole("heading", { name: /business details/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/enterprise name/i)).toHaveValue("Acme Foods Pvt. Ltd.");
  });

  it("lets the user jump back to a completed step via the stepper", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await fillBusiness(u);
    await u.click(screen.getByRole("button", { name: /business/i }));
    expect(screen.getByRole("heading", { name: /business details/i })).toBeInTheDocument();
  });

  it("keeps not-yet-reached steps disabled in the stepper", () => {
    render(<NewProjectWizard />);
    expect(screen.getByRole("button", { name: /workforce/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /checklist/i })).toBeDisabled();
  });
});

describe("NewProjectWizard — industry-specific fields", () => {
  it("shows food fields and food-only activity options for Food processing", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await gotoOperations(u, "Food processing");

    expect(screen.getByText(/specific to food processing/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/FSSAI licence category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cold storage capacity/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/furnace type/i)).not.toBeInTheDocument();

    const activity = screen.getByLabelText(/primary activity/i);
    expect(within(activity).getByRole("option", { name: "Food & beverage processing" })).toBeInTheDocument();
    expect(within(activity).queryByRole("option", { name: /rolling mill/i })).not.toBeInTheDocument();
  });

  it("shows textile fields and textile-only activity options for Textiles", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await gotoOperations(u, "Textiles");

    expect(screen.getByText(/specific to textiles/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/involves dyeing \/ bleaching/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/looms \/ spindles/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/FSSAI licence category/i)).not.toBeInTheDocument();

    const activity = screen.getByLabelText(/primary activity/i);
    expect(within(activity).getByRole("option", { name: "Dyeing & processing" })).toBeInTheDocument();
  });

  it("shows steel fields for Steel & metals", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await gotoOperations(u, "Steel & metals");

    expect(screen.getByText(/specific to steel & metals/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/furnace type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/furnace capacity/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/looms \/ spindles/i)).not.toBeInTheDocument();
  });

  it("uses an industry-aware unit hint for Installed capacity", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await gotoOperations(u, "Steel & metals");
    expect(screen.getByLabelText(/installed capacity/i)).toHaveAttribute("placeholder", "500 MT / month");
  });
});

describe("NewProjectWizard — conditional boiler fields", () => {
  it("reveals boiler detail fields only when a boiler is present", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await gotoOperations(u, "Food processing");

    expect(screen.queryByLabelText(/boiler capacity/i)).not.toBeInTheDocument();

    await u.selectOptions(screen.getByLabelText(/boiler \/ pressure vessel/i), "Yes");
    expect(screen.getByLabelText(/boiler capacity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/working pressure/i)).toBeInTheDocument();

    await u.selectOptions(screen.getByLabelText(/boiler \/ pressure vessel/i), "No");
    expect(screen.queryByLabelText(/boiler capacity/i)).not.toBeInTheDocument();
  });
});

describe("NewProjectWizard — range dropdowns", () => {
  it("renders workforce headcount as a banded select, not a free number input", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await gotoOperations(u, "Food processing");
    // Operations -> Utilities -> Workforce
    await u.selectOptions(screen.getByLabelText(/primary activity/i), "Food & beverage processing");
    await u.selectOptions(screen.getByLabelText(/project stage/i), "New unit");
    await u.selectOptions(screen.getByLabelText(/boiler \/ pressure vessel/i), "No");
    await u.selectOptions(screen.getByLabelText(/stores or handles hazardous chemicals/i), "No");
    await u.selectOptions(screen.getByLabelText(/FSSAI licence category/i), "State licence");
    await u.click(continueButton());

    await u.selectOptions(screen.getByLabelText(/electricity demand/i), "100–500");
    await u.selectOptions(screen.getByLabelText(/daily water use/i), "10–50");
    await u.selectOptions(screen.getByLabelText(/wastewater discharge/i), "On-site treatment plant");
    await u.selectOptions(screen.getByLabelText(/generates hazardous waste/i), "No");
    await u.click(continueButton());

    const permanent = screen.getByLabelText(/permanent employees/i);
    expect(permanent.tagName).toBe("SELECT");
    expect(within(permanent).getByRole("option", { name: "20–49" })).toBeInTheDocument();
  });
});

describe("NewProjectWizard — checklist summary", () => {
  it("summarises the applicant's answers and offers Generate checklist", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await completeFoodToChecklist(u, { activity: "Bakery & confectionery", permanent: "50–99" });

    expect(screen.getByText(/step 6 of 6/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /ready to generate/i })).toBeInTheDocument();

    const summary = screen.getByText("Activity").closest("dl") as HTMLElement;
    expect(within(summary).getByText("Bakery & confectionery")).toBeInTheDocument();
    expect(within(summary).getByText("Pune")).toBeInTheDocument();
    expect(within(summary).getByText("50–99")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /generate checklist/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save and continue/i })).not.toBeInTheDocument();
  });

  it("shows a disabled Generating button and the card skeleton while the request is in flight", async () => {
    const u = userEvent.setup();
    let releasePost!: () => void;
    const pending = new Promise<void>((resolve) => {
      releasePost = resolve;
    });
    // Hold the POST open so we can observe the loading state.
    fetchMock.mockImplementationOnce(async (url: string, init?: RequestInit) => {
      const p = JSON.parse(init!.body as string) as MockPayload;
      await pending;
      return {
        ok: true,
        status: 201,
        json: async () => ({
          status: "success",
          data: {
            project: {
              id: "p1",
              enterpriseName: p.enterpriseName,
              industry: p.industry,
              district: p.district,
              primaryActivity: p.primaryActivity,
              status: "submitted",
              approvals: mockApprovals(p),
            },
          },
        }),
      } as Response;
    });

    render(<NewProjectWizard />);
    await completeFoodToChecklist(u);
    await u.click(screen.getByRole("button", { name: /generate checklist/i }));

    // Layer 1: button spinner state. Layer 2: the "ready" panel is replaced by the skeleton.
    const generating = screen.getByRole("button", { name: /generating/i });
    expect(generating).toBeDisabled();
    expect(screen.queryByRole("heading", { name: /ready to generate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /approvals recommended/i })).not.toBeInTheDocument();

    releasePost();
    expect(await screen.findByRole("heading", { name: /approvals recommended/i })).toBeInTheDocument();
  });
});

describe("NewProjectWizard — edge cases and bug hunt", () => {
  it("rejects a required field that contains only whitespace", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await u.type(screen.getByLabelText(/enterprise name/i), "   ");
    await u.selectOptions(screen.getByLabelText(/organisation type/i), "Private limited company");
    await u.selectOptions(screen.getByLabelText(/industry sector/i), "Food processing");
    await u.type(screen.getByLabelText(/business PAN/i), "AABCS1234F");
    await u.click(continueButton());

    expect(screen.getByText("Enterprise name is required.")).toBeInTheDocument();
    expect(screen.getByText(/step 1 of 6/i)).toBeInTheDocument();
  });

  it("does not block navigation on a hidden conditional required field", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await gotoOperations(u, "Food processing");
    await u.selectOptions(screen.getByLabelText(/primary activity/i), "Food & beverage processing");
    await u.selectOptions(screen.getByLabelText(/project stage/i), "New unit");
    await u.selectOptions(screen.getByLabelText(/boiler \/ pressure vessel/i), "No");
    await u.selectOptions(screen.getByLabelText(/stores or handles hazardous chemicals/i), "No");
    await u.selectOptions(screen.getByLabelText(/FSSAI licence category/i), "State licence");
    await u.click(continueButton());

    // boilerCapacity is required but hidden (boiler = No), so it must not block.
    expect(screen.getByRole("heading", { name: /utilities details/i })).toBeInTheDocument();
  });

  it("blocks navigation when a revealed conditional field is required but empty", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await gotoOperations(u, "Food processing");
    await u.selectOptions(screen.getByLabelText(/primary activity/i), "Food & beverage processing");
    await u.selectOptions(screen.getByLabelText(/project stage/i), "New unit");
    await u.selectOptions(screen.getByLabelText(/boiler \/ pressure vessel/i), "Yes");
    await u.selectOptions(screen.getByLabelText(/stores or handles hazardous chemicals/i), "No");
    await u.selectOptions(screen.getByLabelText(/FSSAI licence category/i), "State licence");
    await u.click(continueButton());

    expect(screen.getByText("Boiler capacity (TPH) is required.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /operations details/i })).toBeInTheDocument();
  });

  it("persists a conditional field's value across navigation", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await gotoOperations(u, "Food processing");
    await u.selectOptions(screen.getByLabelText(/primary activity/i), "Food & beverage processing");
    await u.selectOptions(screen.getByLabelText(/project stage/i), "New unit");
    await u.selectOptions(screen.getByLabelText(/boiler \/ pressure vessel/i), "Yes");
    await u.selectOptions(screen.getByLabelText(/boiler capacity/i), "1–5");
    await u.selectOptions(screen.getByLabelText(/stores or handles hazardous chemicals/i), "No");
    await u.selectOptions(screen.getByLabelText(/FSSAI licence category/i), "State licence");
    await u.click(continueButton());
    expect(screen.getByRole("heading", { name: /utilities details/i })).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByLabelText(/boiler capacity/i)).toHaveValue("1–5");
  });

  it("remembers an unchecked default checkbox after navigating away and back", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await gotoOperations(u, "Food processing");

    const packaging = screen.getByRole("checkbox", { name: /packaging and storage/i });
    expect(packaging).toBeChecked();
    await u.click(packaging);

    await u.selectOptions(screen.getByLabelText(/primary activity/i), "Food & beverage processing");
    await u.selectOptions(screen.getByLabelText(/project stage/i), "New unit");
    await u.selectOptions(screen.getByLabelText(/boiler \/ pressure vessel/i), "No");
    await u.selectOptions(screen.getByLabelText(/stores or handles hazardous chemicals/i), "No");
    await u.selectOptions(screen.getByLabelText(/FSSAI licence category/i), "State licence");
    await u.click(continueButton());
    await u.click(screen.getByRole("button", { name: /back/i }));

    expect(screen.getByRole("checkbox", { name: /packaging and storage/i })).not.toBeChecked();
  });

  it("advances the progress indicator to 33% on the second step", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await fillBusiness(u);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
  });

  it("swaps the primary-activity options when the industry changes", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await gotoOperations(u, "Steel & metals");

    const activity = screen.getByLabelText(/primary activity/i);
    expect(within(activity).getByRole("option", { name: "Foundry / casting" })).toBeInTheDocument();
    expect(within(activity).queryByRole("option", { name: "Bakery & confectionery" })).not.toBeInTheDocument();
  });

  it("adds the effluent-treatment approval for textile wet processing", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await completeTextileToChecklist(u);
    await generate(u);

    expect(screen.getByRole("heading", { name: /5 approvals recommended/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /effluent treatment consent/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /textile unit registration/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /food-related licence/i })).not.toBeInTheDocument();
  });
});

describe("NewProjectWizard — generated checklist result", () => {
  it("replaces the wizard with recommended approvals derived from the answers", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await completeFoodToChecklist(u);
    await generate(u);

    expect(screen.getByRole("heading", { name: /4 approvals recommended/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /food-related licence/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /factory registration/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /fire safety NOC/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /consent to operate/i })).toBeInTheDocument();
    expect(screen.getByText(/why these approvals/i)).toBeInTheDocument();

    // The wizard (stepper/progress) is gone once the result is shown.
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("adds a boiler registration approval when a boiler is declared", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await gotoOperations(u, "Food processing");

    await u.selectOptions(screen.getByLabelText(/primary activity/i), "Food & beverage processing");
    await u.selectOptions(screen.getByLabelText(/project stage/i), "New unit");
    await u.selectOptions(screen.getByLabelText(/boiler \/ pressure vessel/i), "Yes");
    await u.selectOptions(screen.getByLabelText(/boiler capacity/i), "1–5");
    await u.selectOptions(screen.getByLabelText(/stores or handles hazardous chemicals/i), "No");
    await u.selectOptions(screen.getByLabelText(/FSSAI licence category/i), "State licence");
    await u.click(continueButton());

    await u.selectOptions(screen.getByLabelText(/electricity demand/i), "100–500");
    await u.selectOptions(screen.getByLabelText(/daily water use/i), "10–50");
    await u.selectOptions(screen.getByLabelText(/wastewater discharge/i), "On-site treatment plant");
    await u.selectOptions(screen.getByLabelText(/generates hazardous waste/i), "No");
    await u.click(continueButton());

    await u.selectOptions(screen.getByLabelText(/permanent employees/i), "20–49");
    await u.click(continueButton());
    await generate(u);

    expect(screen.getByRole("heading", { name: /5 approvals recommended/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /boiler registration/i })).toBeInTheDocument();
  });
});

describe("NewProjectWizard — document requirements", () => {
  async function openFirstApproval(u: UserEvent) {
    await completeFoodToChecklist(u);
    await generate(u);
    const foodCard = screen.getByRole("heading", { name: /food-related licence/i }).closest("article") as HTMLElement;
    await u.click(within(foodCard).getByRole("button", { name: /view 3 document requirements/i }));
  }

  it("opens the document collection with the required documents for an approval", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await openFirstApproval(u);

    expect(screen.getByRole("heading", { name: /^required documents$/i })).toBeInTheDocument();
    expect(screen.getByText(/0 of 3 files selected/i)).toBeInTheDocument();
    expect(screen.getByText(/document 1 of 3/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^factory plan$/i })).toBeInTheDocument();
    expect(screen.getByText(/3 documents remaining/i)).toBeInTheDocument();
  });

  it("navigates between documents and back to the approvals list", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await openFirstApproval(u);

    await u.click(screen.getByRole("button", { name: /next document/i }));
    expect(screen.getByText(/document 2 of 3/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /identity proof/i })).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: /back to approvals/i }));
    expect(screen.getByRole("heading", { name: /approvals recommended/i })).toBeInTheDocument();
  });

  it("rejects an oversized file and accepts a valid PDF", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await openFirstApproval(u);

    const input = document.querySelector("input[type='file']") as HTMLInputElement;

    const tooBig = new File([new ArrayBuffer(6 * 1024 * 1024)], "big-plan.pdf", { type: "application/pdf" });
    await u.upload(input, tooBig);
    expect(screen.getByText(/file must be 5 MB or smaller/i)).toBeInTheDocument();
    expect(screen.getByText(/0 of 3 files selected/i)).toBeInTheDocument();

    const goodFile = new File(["%PDF-1.4"], "factory-plan.pdf", { type: "application/pdf" });
    await u.upload(input, goodFile);
    expect(screen.getByText("factory-plan.pdf")).toBeInTheDocument();
    expect(screen.getByText(/1 of 3 files selected/i)).toBeInTheDocument();
  });

  it("tracks progress across documents and pluralises the remaining count", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await openFirstApproval(u);

    await u.upload(document.querySelector("input[type='file']") as HTMLInputElement, new File(["%PDF-1.4"], "plan.pdf", { type: "application/pdf" }));
    await u.click(screen.getByRole("button", { name: /next document/i }));
    await u.upload(document.querySelector("input[type='file']") as HTMLInputElement, new File(["%PDF-1.4"], "id.pdf", { type: "application/pdf" }));

    expect(screen.getByText(/2 of 3 files selected/i)).toBeInTheDocument();
    expect(screen.getByText(/^1 document remaining$/i)).toBeInTheDocument();
  });

  it("restores the dropzone when a selected file is removed", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await openFirstApproval(u);

    await u.upload(document.querySelector("input[type='file']") as HTMLInputElement, new File(["%PDF-1.4"], "plan.pdf", { type: "application/pdf" }));
    expect(screen.getByText("plan.pdf")).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: /remove/i }));
    expect(screen.getByText(/drag and drop your file here/i)).toBeInTheDocument();
    expect(screen.getByText(/0 of 3 files selected/i)).toBeInTheDocument();
  });

  it("shows document specs specific to the opened approval", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await completeFoodToChecklist(u);
    await generate(u);

    const consentCard = screen.getByRole("heading", { name: /consent to operate/i }).closest("article") as HTMLElement;
    await u.click(within(consentCard).getByRole("button", { name: /view 3 document requirements/i }));

    expect(screen.getByRole("heading", { name: /^water balance$/i })).toBeInTheDocument();
    expect(screen.getByText(/a water balance statement for the unit/i)).toBeInTheDocument();
  });
});

describe("NewProjectWizard — API submission", () => {
  it("POSTs the mapped payload to the projects API", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await completeFoodToChecklist(u);
    await generate(u);

    const postCall = fetchMock.mock.calls.find(
      (call) => call[0] === "/api/v1/projects" && call[1]?.method === "POST",
    );
    expect(postCall).toBeTruthy();
    const [, init] = postCall as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      industry: "food",
      organisationType: "private-limited",
      landStatus: "owned",
      projectStage: "new",
      boiler: "no",
      pan: "AABCS1234F",
    });
    expect(Array.isArray(body.processes)).toBe(true);
  });

  it("shows an error and stays on the wizard when saving fails", async () => {
    fetchMock.mockImplementationOnce(
      async () => ({ ok: false, status: 401, json: async () => ({ code: "AUTHENTICATION_REQUIRED" }) }) as Response,
    );
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await completeFoodToChecklist(u);
    await u.click(screen.getByRole("button", { name: /generate checklist/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/sign in to save/i);
    expect(screen.queryByRole("heading", { name: /approvals recommended/i })).not.toBeInTheDocument();
  });

  it("surfaces the backend's specific field messages on a 400", async () => {
    fetchMock.mockImplementationOnce(
      async () =>
        ({
          ok: false,
          status: 400,
          json: async () => ({
            code: "VALIDATION_ERROR",
            details: {
              formErrors: [],
              fieldErrors: { pincode: ["Enter a valid 6-digit PIN code."] },
            },
          }),
        }) as Response,
    );
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await completeFoodToChecklist(u);
    await u.click(screen.getByRole("button", { name: /generate checklist/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/enter a valid 6-digit pin code/i);
    expect(screen.queryByRole("heading", { name: /approvals recommended/i })).not.toBeInTheDocument();
  });

  it("blocks generation and jumps to the step with a missing required answer", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await completeFoodToChecklist(u);

    // Go back to Location via the stepper (no validation), clear a required field,
    // then re-enter the checklist through Workforce → Save and continue.
    await u.click(screen.getByRole("button", { name: /location/i }));
    await u.clear(screen.getByLabelText(/district/i));
    await u.click(screen.getByRole("button", { name: /workforce/i }));
    await u.click(screen.getByRole("button", { name: /save and continue/i }));

    await u.click(screen.getByRole("button", { name: /generate checklist/i }));

    // No request is sent; the user is returned to Location with an inline error.
    expect(fetchMock.mock.calls.some((call) => call[1]?.method === "POST")).toBe(false);
    expect(screen.getByRole("alert")).toHaveTextContent(/please complete: district/i);
    expect(screen.getByText("District is required.")).toBeInTheDocument();
    expect(screen.getByText(/step 2 of 6/i)).toBeInTheDocument();
  });

  it("lets the applicant re-target an approval to a chosen department", async () => {
    const u = userEvent.setup();
    render(<NewProjectWizard />);
    await completeFoodToChecklist(u);
    await generate(u);

    // Departments load into a per-approval selector.
    const consentSelect = await screen.findByRole("combobox", { name: /department for consent to operate/i });
    await u.selectOptions(consentSelect, "Directorate of Industrial Safety and Health (DISH)");

    const patchCall = fetchMock.mock.calls.find((call) => call[1]?.method === "PATCH");
    expect(patchCall).toBeTruthy();
    const [patchUrl, patchInit] = patchCall as [string, RequestInit];
    expect(patchUrl).toContain("/api/v1/projects/p1/approvals/");
    expect(JSON.parse(patchInit.body as string)).toMatchObject({ departmentKey: "dish" });
  });
});
