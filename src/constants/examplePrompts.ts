/** 
 * Self-contained prompts for single persona conversations.
 * No external context required - all inputs provided inline.
 */
export const EXAMPLE_PROMPTS: string[] = [
  "Calculate fibonacci(20) and explain the time complexity",
  "Write a function that reverses a string without using .reverse()",
  "Explain the difference between const, let, and var in JavaScript",
  "Sort these numbers ascending: 42, 7, 93, 15, 8, 61, 3",
  "Find all prime numbers between 1 and 100",
  "Convert 'hello world' to title case, camelCase, and snake_case",
  "Explain how HTTP cookies work in 3 paragraphs",
  "Calculate the area and perimeter of a rectangle: width=12, height=7",
  "List 5 ways to optimize a slow SQL query",
  "Convert 1024 bytes to KB, MB, and GB",
  "Explain what happens when you type 'google.com' in a browser",
  "Write a regex that matches valid email addresses",
  "Compare merge sort vs quick sort: time complexity, space, stability",
  "Generate a random UUID v4 and explain its format",
  "Explain the CAP theorem with database examples",
  "Calculate compound interest: $10,000 at 5% annual for 10 years",
  "List the 7 layers of the OSI model with examples",
  "Convert RGB(255, 87, 51) to hexadecimal color code",
  "Explain how JWT authentication works with diagrams",
  "Parse this JSON and extract all email values: {\"users\":[{\"email\":\"a@b.c\"},{\"email\":\"x@y.z\"}]}",
  "Calculate how many seconds in 30 days",
  "Explain the difference between TCP and UDP",
  "Generate 5 strong password examples (12+ chars, mixed case, numbers, symbols)",
  "Compare REST vs GraphQL vs gRPC in a table",
  "Calculate the factorial of 12",
  "Explain how DNS resolution works step-by-step",
  "Convert timestamp 1699392000 (unix seconds) to human-readable date",
  "List all HTTP status codes in the 4xx range with meanings",
  "Explain how git merge differs from git rebase",
  "Calculate average of [15, 23, 8, 42, 31, 19]",
];

/** 
 * Self-contained agency prompts showing multi-GMI coordination.
 * Each role gets specific, grounded tasks with NO external context needed.
 * Currently only first seat responds (workflow start endpoint not wired).
 */
export const AGENCY_EXAMPLE_PROMPTS: string[] = [
  "[Intel Lead] Scan GitHub changelog for Prisma 6 breaking changes, [Migration Engineer] draft upgrade checklist, [Writer] format customer-ready advisory, [QA] create regression test list",
  "[Research Coordinator] Summarize three latest AI safety papers, [Data Modeler] extract comparable metrics into table, [Debate Lead] highlight disagreements, [Comms] craft executive briefing",
  "[Market Analyst] Gather ARR + headcount for top 5 SaaS observability vendors, [Finance] model 12-month runway scenarios, [Strategist] outline 3 positioning bets, [Writer] deliver board memo",
  "[SRE Captain] Parse attached incident log JSON for repeating signatures, [Debugger] map chain of failure, [Playbook Author] propose mitigation tasks per team, [Communicator] draft status email",
  "[Growth Researcher] Audit landing page copy for accessibility, [Experiment Lead] propose 3 multivariate tests, [Localization] adapt hero copy for ES/FR/JP, [Designer] supply updated style tokens",
  "[Threat Hunter] Review MITRE ATT&CK techniques relevant to new CVE, [Detection Engineer] draft Sigma rule, [Blue Team Lead] prepare response checklist, [Advocate] craft customer advisory",
  "[Product Trio] [PM] outline jobs-to-be-done for shared workspace, [Designer] produce layout wireframe in ASCII grid, [Engineer] note integration points, [Doc Lead] compose changelog entry",
  "[Compliance Analyst] Match SOC2 control IDs to evidence list, [Auditor] flag gaps + owners, [Automation Lead] suggest scripts/webhooks to auto-collect evidence, [Writer] output meeting agenda",
  "[Data Squad] [Collector] ingest provided CSV + clean missing data, [Statistician] compute variance + outliers, [Forecaster] fit ARIMA baseline, [Storyteller] narrate insight summary paragraph",
  "[AI Lab] [Prompt Engineer] craft rubric for evaluating travel itineraries, [Researcher] pull comparison data for Rome/Berlin/Tokyo, [Itinerary Planner] assemble 3-day plans, [Critic] rate each vs rubric"
];

