import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  Filter,
  MapPin,
  Printer,
  Route,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const primaryAction =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary";
const secondaryAction =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-[#cfd4dc] bg-white px-4 text-sm font-semibold text-[#142b45] transition-colors hover:bg-[#f7f6f2] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary";

function PageIntro({
  section,
  title,
  description,
  action,
}: {
  section: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 border-b border-[#d8d3c8] pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold text-primary">{section}</p>
        <h1 className="mt-1 font-heading text-4xl font-bold tracking-tight text-[#142b45]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">{description}</p>
      </div>
      {action}
    </div>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "blue" | "amber" | "green" | "red" | "slate";
  children: ReactNode;
}) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    red: "border-red-200 bg-red-50 text-red-800",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function MetricStrip({
  items,
}: {
  items: { label: string; value: string; note: string; tone?: string }[];
}) {
  return (
    <section className="grid border border-[#d8d3c8] bg-white sm:grid-cols-2 xl:grid-cols-4" aria-label="Queue summary">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`p-5 ${index ? "border-t border-[#e4e0d6] sm:border-l sm:border-t-0" : ""} ${index === 2 ? "sm:border-l-0 xl:border-l" : ""}`}
        >
          <p className="text-sm font-medium text-slate-500">{item.label}</p>
          <p className={`mt-2 text-3xl font-bold tracking-tight ${item.tone ?? "text-[#142b45]"}`}>
            {item.value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{item.note}</p>
        </div>
      ))}
    </section>
  );
}

function Toolbar({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border border-[#d8d3c8] bg-[#faf9f6] p-4 lg:flex-row lg:items-center">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Search records</span>
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          placeholder="Search by enterprise, applicant or reference number"
          className="h-11 w-full rounded-md border border-[#cfd4dc] bg-white pl-10 pr-3 text-sm text-[#142b45] placeholder:text-slate-400 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-primary"
        />
      </label>
      {children}
      <button type="button" className={secondaryAction}>
        <Filter className="size-4" aria-hidden="true" /> More filters
      </button>
    </div>
  );
}

const applications = [
  {
    reference: "MH-SWC-2026-04192",
    enterprise: "Sahyadri Foods Private Limited",
    approval: "Consent to operate",
    applicant: "Surya Patil",
    district: "Pune",
    submitted: "24 Sep 2026",
    due: "2 days",
    status: "Under review",
    tone: "blue" as const,
  },
  {
    reference: "MH-SWC-2026-04187",
    enterprise: "Pragati Precision Works",
    approval: "Factory registration",
    applicant: "Rohan Deshmukh",
    district: "Nashik",
    submitted: "23 Sep 2026",
    due: "Today",
    status: "SLA risk",
    tone: "amber" as const,
  },
  {
    reference: "MH-SWC-2026-04161",
    enterprise: "Konkan Marine Exports",
    approval: "Fire safety NOC",
    applicant: "Meera Sawant",
    district: "Ratnagiri",
    submitted: "21 Sep 2026",
    due: "4 days",
    status: "Clarification received",
    tone: "green" as const,
  },
  {
    reference: "MH-SWC-2026-04098",
    enterprise: "Vidarbha Agro Processing",
    approval: "Food-related licence",
    applicant: "Aarav Kulkarni",
    district: "Nagpur",
    submitted: "18 Sep 2026",
    due: "6 days overdue",
    status: "Overdue",
    tone: "red" as const,
  },
  {
    reference: "MH-SWC-2026-04085",
    enterprise: "Deccan Green Energy LLP",
    approval: "Consent to establish",
    applicant: "Nisha Bhosale",
    district: "Aurangabad",
    submitted: "17 Sep 2026",
    due: "Awaiting applicant",
    status: "Correction required",
    tone: "slate" as const,
  },
];

export function InspectorApplicationsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <PageIntro
        section="Department work registry"
        title="Applications"
        description="Find every approval assigned to your department, track statutory deadlines and open the complete review record."
        action={
          <button type="button" className={secondaryAction}>
            <Download className="size-4" aria-hidden="true" /> Export register
          </button>
        }
      />

      <div className="mt-7 space-y-5">
        <MetricStrip
          items={[
            { label: "Assigned to department", value: "68", note: "Across all active officers" },
            { label: "Due this week", value: "18", note: "5 require site inspection" },
            { label: "At SLA risk", value: "07", note: "Action needed within 24 hours", tone: "text-amber-700" },
            { label: "Closed this month", value: "124", note: "91% completed within SLA", tone: "text-emerald-700" },
          ]}
        />

        <Toolbar>
          <select className="h-11 rounded-md border border-[#cfd4dc] bg-white px-3 text-sm text-[#142b45]" defaultValue="active" aria-label="Application status">
            <option value="active">Active applications</option>
            <option>Pending review</option>
            <option>Correction required</option>
            <option>Approved</option>
            <option>Rejected</option>
          </select>
          <select className="h-11 rounded-md border border-[#cfd4dc] bg-white px-3 text-sm text-[#142b45]" defaultValue="deadline" aria-label="Sort applications">
            <option value="deadline">Nearest deadline</option>
            <option>Newest submission</option>
            <option>Oldest submission</option>
          </select>
        </Toolbar>

        <section className="overflow-hidden border border-[#d8d3c8] bg-white" aria-labelledby="applications-table-title">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e0d6] px-5 py-4">
            <div>
              <h2 id="applications-table-title" className="font-semibold text-[#142b45]">Active departmental applications</h2>
              <p className="mt-0.5 text-xs text-slate-500">Showing 5 of 68 records</p>
            </div>
            <span className="text-xs font-medium text-slate-500">Last synced 10:42 AM</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-left">
              <thead className="bg-[#f7f6f2] text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-5 py-3">Application</th>
                  <th className="px-4 py-3">Approval</th>
                  <th className="px-4 py-3">Applicant</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Deadline</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e4e0d6]">
                {applications.map((item) => (
                  <tr key={item.reference} className="align-top hover:bg-[#fcfbf8]">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#142b45]">{item.enterprise}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.reference} · {item.district}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">{item.approval}</td>
                    <td className="px-4 py-4 text-sm text-slate-700">{item.applicant}</td>
                    <td className="px-4 py-4 text-sm text-slate-600">{item.submitted}</td>
                    <td className={`px-4 py-4 text-sm font-semibold ${item.tone === "red" || item.tone === "amber" ? "text-amber-800" : "text-slate-700"}`}>{item.due}</td>
                    <td className="px-4 py-4"><StatusPill tone={item.tone}>{item.status}</StatusPill></td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/inspector/applications/${item.reference}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                        Open <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

const inspectionRows = [
  { time: "09:30", enterprise: "Pragati Precision Works", district: "Nashik", approval: "Factory registration", officer: "You + A. More", state: "Route confirmed", tone: "green" as const },
  { time: "12:15", enterprise: "Western Biofuels Limited", district: "Nashik", approval: "Consent to establish", officer: "You", state: "Applicant confirmed", tone: "blue" as const },
  { time: "15:30", enterprise: "Godavari Packaging", district: "Nashik", approval: "Fire safety NOC", officer: "You + Fire officer", state: "Documents pending", tone: "amber" as const },
];

export function InspectorInspectionsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <PageIntro
        section="Field operations"
        title="Site inspections"
        description="Plan visits, carry the prescribed checklist and record geo-tagged observations against the application."
        action={<button type="button" className={primaryAction}><CalendarDays className="size-4" aria-hidden="true" /> Schedule inspection</button>}
      />
      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <MetricStrip
            items={[
              { label: "Today", value: "03", note: "First visit at 09:30" },
              { label: "This week", value: "11", note: "Across 4 districts" },
              { label: "Reports due", value: "04", note: "2 due before 5 PM", tone: "text-amber-700" },
              { label: "Completed", value: "27", note: "During September", tone: "text-emerald-700" },
            ]}
          />
          <section className="border border-[#d8d3c8] bg-white">
            <div className="flex items-center justify-between gap-4 border-b border-[#e4e0d6] px-5 py-4">
              <div>
                <h2 className="font-semibold text-[#142b45]">Today’s field route</h2>
                <p className="mt-0.5 text-xs text-slate-500">Sunday, 27 September · Nashik district</p>
              </div>
              <button type="button" className={secondaryAction}><Route className="size-4" aria-hidden="true" /> View route</button>
            </div>
            <div className="divide-y divide-[#e4e0d6]">
              {inspectionRows.map((item, index) => (
                <article key={item.enterprise} className="grid gap-4 p-5 md:grid-cols-[76px_minmax(0,1fr)_auto] md:items-center">
                  <div>
                    <p className="text-xl font-bold text-[#142b45]">{item.time}</p>
                    <p className="text-xs text-slate-500">Visit {index + 1}</p>
                  </div>
                  <div className="border-l-2 border-primary/25 pl-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-[#142b45]">{item.enterprise}</h3>
                      <StatusPill tone={item.tone}>{item.state}</StatusPill>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{item.approval}</p>
                    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" /> {item.district}</span>
                      <span className="inline-flex items-center gap-1"><UsersRound className="size-3.5" aria-hidden="true" /> {item.officer}</span>
                    </p>
                  </div>
                  <button type="button" className={secondaryAction}>Open checklist</button>
                </article>
              ))}
            </div>
          </section>
          <section className="border border-[#d8d3c8] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-[#142b45]">Upcoming inspections</h2>
                <p className="mt-1 text-sm text-slate-500">8 visits awaiting final confirmation</p>
              </div>
              <button type="button" className={secondaryAction}><SlidersHorizontal className="size-4" aria-hidden="true" /> Manage schedule</button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {["28 Sep · Aurangabad · 4 visits", "29 Sep · Pune · 3 visits", "01 Oct · Satara · 2 visits", "03 Oct · Nagpur · 5 visits"].map((visit) => (
                <div key={visit} className="flex items-center justify-between gap-3 border border-[#e4e0d6] bg-[#faf9f6] px-4 py-3 text-sm font-medium text-[#142b45]">
                  <span>{visit}</span><ArrowRight className="size-4 text-slate-400" aria-hidden="true" />
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="space-y-5">
          <section className="border border-[#d8d3c8] bg-[#faf9f6] p-5">
            <p className="text-sm font-semibold text-primary">Before departure</p>
            <h2 className="mt-1 text-xl font-bold text-[#142b45]">Field readiness</h2>
            <ul className="mt-5 space-y-4 text-sm text-slate-700">
              {["Download offline checklists", "Verify appointment contacts", "Carry department identity card", "Enable device location services"].map((item, index) => (
                <li key={item} className="flex gap-3">
                  {index < 2 ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" /> : <span className="mt-0.5 size-5 shrink-0 rounded-full border-2 border-slate-300" />}
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <button type="button" className={`${primaryAction} mt-6 w-full`}><Download className="size-4" aria-hidden="true" /> Download day pack</button>
          </section>
          <section className="border-l-4 border-amber-400 bg-amber-50 p-5">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-800" aria-hidden="true" />
              <div><h2 className="font-semibold text-amber-950">2 reports need filing</h2><p className="mt-1 text-sm leading-6 text-amber-900">Submit yesterday’s signed observations before starting a new decision.</p></div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

const clarificationThreads = [
  { enterprise: "Konkan Marine Exports", subject: "Updated fire evacuation layout", age: "18 min", status: "Response received", tone: "green" as const, unread: true },
  { enterprise: "Sahyadri Foods Private Limited", subject: "Water analysis report legibility", age: "2 hr", status: "Awaiting applicant", tone: "amber" as const, unread: false },
  { enterprise: "Aster Medical Devices", subject: "Authorised signatory proof", age: "Yesterday", status: "Draft", tone: "slate" as const, unread: false },
  { enterprise: "Deccan Green Energy LLP", subject: "Process flow discrepancy", age: "23 Sep", status: "Response received", tone: "green" as const, unread: true },
];

export function InspectorClarificationsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <PageIntro
        section="Applicant correspondence"
        title="Clarifications"
        description="Keep document questions, applicant replies and review outcomes in one traceable thread."
        action={<button type="button" className={secondaryAction}><Download className="size-4" aria-hidden="true" /> Export correspondence</button>}
      />
      <div className="mt-7 grid min-h-[650px] overflow-hidden border border-[#d8d3c8] bg-white lg:grid-cols-[390px_minmax(0,1fr)]">
        <section className="border-b border-[#d8d3c8] lg:border-b-0 lg:border-r" aria-label="Clarification threads">
          <div className="border-b border-[#e4e0d6] bg-[#faf9f6] p-4">
            <label className="relative block">
              <span className="sr-only">Search clarifications</span>
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input type="search" placeholder="Search correspondence" className="h-11 w-full rounded-md border border-[#cfd4dc] bg-white pl-10 pr-3 text-sm" />
            </label>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>12 open threads</span><button type="button" className="font-semibold text-primary">Unread first</button></div>
          </div>
          <div className="divide-y divide-[#e4e0d6]">
            {clarificationThreads.map((thread, index) => (
              <button key={thread.enterprise} type="button" className={`w-full p-4 text-left ${index === 0 ? "border-l-4 border-primary bg-blue-50/60" : "border-l-4 border-transparent hover:bg-[#faf9f6]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-[#142b45]">{thread.enterprise}</p>
                  <span className="shrink-0 text-xs text-slate-500">{thread.age}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{thread.subject}</p>
                <div className="mt-3 flex items-center justify-between gap-2"><StatusPill tone={thread.tone}>{thread.status}</StatusPill>{thread.unread ? <span className="size-2 rounded-full bg-primary" aria-label="Unread" /> : null}</div>
              </button>
            ))}
          </div>
        </section>
        <section className="flex min-w-0 flex-col" aria-label="Selected clarification">
          <header className="border-b border-[#e4e0d6] px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs font-semibold text-primary">MH-SWC-2026-04161 · Fire safety NOC</p><h2 className="mt-1 text-xl font-bold text-[#142b45]">Updated fire evacuation layout</h2><p className="mt-1 text-sm text-slate-500">Konkan Marine Exports · Ratnagiri</p></div>
              <StatusPill tone="green">Response received</StatusPill>
            </div>
          </header>
          <div className="flex-1 space-y-5 bg-[#faf9f6] p-6">
            <article className="max-w-2xl border border-[#d8d3c8] bg-white p-5">
              <div className="flex items-center justify-between gap-3"><p className="font-semibold text-[#142b45]">You · Department inspector</p><time className="text-xs text-slate-500">25 Sep, 11:40 AM</time></div>
              <p className="mt-3 text-sm leading-6 text-slate-700">The assembly point shown in the evacuation layout does not match the site plan. Upload a revised, signed drawing and mark the unobstructed exit route.</p>
              <div className="mt-4 flex items-center gap-2 border border-[#e4e0d6] bg-[#faf9f6] px-3 py-2 text-sm text-slate-700"><FileText className="size-4 text-primary" aria-hidden="true" /> Evacuation-layout-v1.pdf <span className="ml-auto text-xs text-slate-500">2.8 MB</span></div>
            </article>
            <article className="ml-auto max-w-2xl border border-blue-200 bg-blue-50 p-5">
              <div className="flex items-center justify-between gap-3"><p className="font-semibold text-[#142b45]">Meera Sawant · Applicant</p><time className="text-xs text-slate-500">Today, 10:12 AM</time></div>
              <p className="mt-3 text-sm leading-6 text-slate-700">We have corrected the assembly point and added directional markings. The revised drawing is signed by the authorised architect.</p>
              <div className="mt-4 flex items-center gap-2 border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700"><FileCheck2 className="size-4 text-emerald-700" aria-hidden="true" /> Evacuation-layout-v2-signed.pdf <span className="ml-auto text-xs text-slate-500">3.1 MB</span></div>
            </article>
          </div>
          <div className="border-t border-[#e4e0d6] bg-white p-5">
            <label className="block text-sm font-semibold text-[#142b45]">Record your response<textarea className="mt-2 min-h-24 w-full rounded-md border border-[#cfd4dc] p-3 font-normal" placeholder="Write a clear instruction or confirm that the response is sufficient." /></label>
            <div className="mt-3 flex flex-wrap justify-between gap-3"><button type="button" className={secondaryAction}><FileText className="size-4" aria-hidden="true" /> Attach reference</button><div className="flex flex-wrap gap-3"><button type="button" className={secondaryAction}><CheckCircle2 className="size-4 text-emerald-700" aria-hidden="true" /> Resolve thread</button><button type="button" className={primaryAction}><Send className="size-4" aria-hidden="true" /> Send reply</button></div></div>
          </div>
        </section>
      </div>
    </div>
  );
}

const decisionRows = [
  { enterprise: "Sahyadri Foods Private Limited", approval: "Consent to operate", reference: "MH-SWC-2026-04192", reviewed: "All 7 documents accepted", age: "Ready for 3 hours" },
  { enterprise: "Mula Textile Processors", approval: "Factory registration", reference: "MH-SWC-2026-04139", reviewed: "Inspection report filed", age: "Ready since yesterday" },
  { enterprise: "Aster Medical Devices", approval: "Fire safety NOC", reference: "MH-SWC-2026-04071", reviewed: "All observations closed", age: "Ready for 2 days" },
];

export function InspectorDecisionsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <PageIntro
        section="Statutory action"
        title="Decisions"
        description="Issue reasoned approval orders, return incomplete cases and maintain the department’s signed decision register."
        action={<button type="button" className={secondaryAction}><Printer className="size-4" aria-hidden="true" /> Print register</button>}
      />
      <div className="mt-7 space-y-6">
        <MetricStrip items={[
          { label: "Ready for decision", value: "08", note: "3 awaiting your signature" },
          { label: "Approved this month", value: "79", note: "Median time 12.4 days", tone: "text-emerald-700" },
          { label: "Returned for correction", value: "14", note: "Clear reasons recorded" },
          { label: "Rejected this month", value: "03", note: "All include speaking orders" },
        ]} />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="border border-[#d8d3c8] bg-white">
            <div className="border-b border-[#e4e0d6] px-5 py-4"><h2 className="font-semibold text-[#142b45]">Ready for your decision</h2><p className="mt-1 text-xs text-slate-500">Review findings are complete; verify the record before signing.</p></div>
            <div className="divide-y divide-[#e4e0d6]">
              {decisionRows.map((item) => (
                <article key={item.reference} className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div><div className="flex flex-wrap items-center gap-2"><StatusPill tone="green">Review complete</StatusPill><span className="text-xs text-slate-500">{item.age}</span></div><h3 className="mt-3 text-lg font-semibold text-[#142b45]">{item.enterprise}</h3><p className="mt-1 text-sm text-slate-600">{item.approval}</p><p className="mt-2 text-xs text-slate-500">{item.reference} · {item.reviewed}</p></div>
                    <button type="button" className={primaryAction}>Prepare order <ArrowRight className="size-4" aria-hidden="true" /></button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <aside className="space-y-5">
            <section className="border border-[#d8d3c8] bg-[#faf9f6] p-5">
              <p className="text-sm font-semibold text-primary">Signing controls</p><h2 className="mt-1 text-xl font-bold text-[#142b45]">Decision checklist</h2>
              <ul className="mt-5 space-y-4">
                {["Document findings recorded", "Inspection observations closed", "Legal conditions selected", "Reasoned order previewed", "Digital signature available"].map((item) => <li key={item} className="flex items-center gap-3 text-sm text-slate-700"><CheckCircle2 className="size-5 shrink-0 text-emerald-700" aria-hidden="true" /> {item}</li>)}
              </ul>
              <div className="mt-6 border-t border-[#d8d3c8] pt-4 text-xs leading-5 text-slate-500">Every signed order receives a certificate number, QR verification link and immutable audit entry.</div>
            </section>
            <section className="border border-[#d8d3c8] bg-white p-5"><div className="flex items-center gap-3"><ShieldCheck className="size-8 text-primary" aria-hidden="true" /><div><h2 className="font-semibold text-[#142b45]">Digital signing service</h2><p className="text-sm text-emerald-700">Available and verified</p></div></div></section>
          </aside>
        </div>
        <section className="overflow-hidden border border-[#d8d3c8] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e0d6] px-5 py-4"><div><h2 className="font-semibold text-[#142b45]">Recent decision register</h2><p className="mt-1 text-xs text-slate-500">Digitally signed orders issued by your department</p></div><button type="button" className={secondaryAction}>View full register</button></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-[#f7f6f2] text-xs text-slate-500"><tr><th className="px-5 py-3">Certificate</th><th className="px-4 py-3">Enterprise</th><th className="px-4 py-3">Decision</th><th className="px-4 py-3">Signed</th><th className="px-5 py-3">Officer</th></tr></thead><tbody className="divide-y divide-[#e4e0d6]">{[
            ["CTO-2026-00918", "Riverbend Foods", "Approved", "26 Sep 2026", "S. Kulkarni"],
            ["FR-2026-00452", "Kaveri Engineering", "Correction required", "26 Sep 2026", "S. Kulkarni"],
            ["FNOC-2026-00631", "Northstar Warehousing", "Approved", "25 Sep 2026", "P. Jadhav"],
          ].map((row) => <tr key={row[0]}>{row.map((cell, i) => <td key={cell} className={`px-4 py-4 ${i === 0 ? "font-semibold text-primary" : "text-slate-700"}`}>{cell}</td>)}</tr>)}</tbody></table></div>
        </section>
      </div>
    </div>
  );
}

function ProgressRow({ label, value, note, tone = "bg-primary" }: { label: string; value: number; note: string; tone?: string }) {
  return <div><div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[#142b45]">{label}</p><p className="mt-0.5 text-xs text-slate-500">{note}</p></div><span className="text-sm font-bold text-[#142b45]">{value}%</span></div><div className="mt-2 h-2 overflow-hidden bg-slate-100"><div className={`h-full ${tone}`} style={{ width: `${value}%` }} /></div></div>;
}

export function InspectorReportsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <PageIntro
        section="Department performance"
        title="Reports"
        description="Monitor statutory timelines, team workload and recurring causes of delay without losing the case-level audit trail."
        action={<div className="flex flex-wrap gap-3"><select className="h-10 rounded-md border border-[#cfd4dc] bg-white px-3 text-sm font-semibold text-[#142b45]" defaultValue="sep"><option value="sep">September 2026</option><option>August 2026</option><option>July 2026</option></select><button type="button" className={primaryAction}><Download className="size-4" aria-hidden="true" /> Download report</button></div>}
      />
      <div className="mt-7 space-y-6">
        <MetricStrip items={[
          { label: "Applications received", value: "146", note: "+12% from August" },
          { label: "Decisions issued", value: "124", note: "85% of monthly intake" },
          { label: "Within statutory SLA", value: "91%", note: "Target is 95%", tone: "text-amber-700" },
          { label: "Median decision time", value: "12.4d", note: "1.8 days faster than August", tone: "text-emerald-700" },
        ]} />
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="border border-[#d8d3c8] bg-white p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-[#142b45]">SLA performance by approval</h2><p className="mt-1 text-sm text-slate-500">Share completed within the statutory period</p></div><Clock3 className="size-6 text-primary" aria-hidden="true" /></div><div className="mt-7 space-y-6"><ProgressRow label="Food-related licence" value={97} note="38 decisions" tone="bg-emerald-700" /><ProgressRow label="Factory registration" value={93} note="31 decisions" tone="bg-emerald-700" /><ProgressRow label="Fire safety NOC" value={88} note="29 decisions" tone="bg-amber-500" /><ProgressRow label="Consent to operate" value={84} note="26 decisions" tone="bg-amber-500" /></div></section>
          <section className="border border-[#d8d3c8] bg-white p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-[#142b45]">Where cases are waiting</h2><p className="mt-1 text-sm text-slate-500">Current active inventory by next required action</p></div><Building2 className="size-6 text-primary" aria-hidden="true" /></div><div className="mt-6 grid grid-cols-2 gap-px bg-[#d8d3c8] border border-[#d8d3c8]">{[
            ["24", "Inspector document review"], ["18", "Applicant clarification"], ["11", "Site inspection"], ["08", "Final decision"],
          ].map(([value, label]) => <div key={label} className="bg-[#faf9f6] p-5"><p className="text-3xl font-bold text-[#142b45]">{value}</p><p className="mt-2 text-sm text-slate-600">{label}</p></div>)}</div><div className="mt-5 border-l-4 border-amber-400 bg-amber-50 p-4"><p className="font-semibold text-amber-950">Primary delay: incomplete site layouts</p><p className="mt-1 text-sm leading-6 text-amber-900">Appears in 9 active clarification requests. Consider updating the applicant checklist guidance.</p></div></section>
        </div>
        <section className="border border-[#d8d3c8] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e0d6] px-5 py-4"><div><h2 className="font-semibold text-[#142b45]">Officer workload</h2><p className="mt-1 text-xs text-slate-500">Open assignments and monthly completion</p></div><button type="button" className={secondaryAction}><UsersRound className="size-4" aria-hidden="true" /> Manage allocation</button></div>
          <div className="grid divide-y divide-[#e4e0d6] md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">{[
            ["S. Kulkarni", "18 open", "34 closed", "92% SLA"], ["P. Jadhav", "14 open", "29 closed", "96% SLA"], ["R. Shinde", "21 open", "31 closed", "87% SLA"], ["M. Patwardhan", "15 open", "30 closed", "94% SLA"],
          ].map(([name, open, closed, sla]) => <article key={name} className="p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-primary text-sm font-bold text-white"><UserRound className="size-5" aria-hidden="true" /></span><div><h3 className="font-semibold text-[#142b45]">{name}</h3><p className="text-xs text-slate-500">Department inspector</p></div></div><dl className="mt-5 grid grid-cols-3 gap-2 text-center"><div><dt className="text-xs text-slate-500">Active</dt><dd className="mt-1 text-sm font-semibold text-[#142b45]">{open}</dd></div><div><dt className="text-xs text-slate-500">Closed</dt><dd className="mt-1 text-sm font-semibold text-[#142b45]">{closed}</dd></div><div><dt className="text-xs text-slate-500">SLA</dt><dd className="mt-1 text-sm font-semibold text-[#142b45]">{sla}</dd></div></dl></article>)}</div>
        </section>
      </div>
    </div>
  );
}
