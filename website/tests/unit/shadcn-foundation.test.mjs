import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const source = (path) => readFile(resolve(root, path), "utf8");

test("P20 uses one real Radix React foundation", async () => {
  const config = JSON.parse(await source("components.json"));
  const pkg = JSON.parse(await source("package.json"));
  const files = await readdir(resolve(root, "src/components/ui"));
  assert.equal(config.tsx, true);
  assert.equal(config.rsc, false);
  assert.ok(pkg.dependencies["@astrojs/react"]);
  assert.ok(pkg.dependencies["@radix-ui/react-accordion"]);
  assert.ok(pkg.dependencies["@radix-ui/react-dialog"]);
  assert.ok(files.every((file) => file.endsWith(".tsx")), `non-React primitive: ${files.join(", ")}`);
  const combined = await Promise.all(files.map((file) => source(`src/components/ui/${file}`))).then((parts) => parts.join("\n"));
  assert.match(combined, /@radix-ui\/react-accordion/);
  assert.match(combined, /@radix-ui\/react-dialog/);
  assert.doesNotMatch(combined, /@base-ui|react-aria/);
});

test("P20 exports all approved primitives", async () => {
  const expectations = {
    "button.tsx": ["Button", "buttonVariants"],
    "card.tsx": ["Card", "CardHeader", "CardContent", "CardFooter"],
    "badge.tsx": ["Badge", "badgeVariants"],
    "aspect-ratio.tsx": ["AspectRatio"],
    "accordion.tsx": ["Accordion", "AccordionItem", "AccordionTrigger", "AccordionContent"],
    "dialog.tsx": ["Dialog", "DialogTrigger", "DialogContent", "DialogClose"],
    "drawer.tsx": ["Drawer", "DrawerTrigger", "DrawerContent", "DrawerClose"],
  };
  for (const [file, names] of Object.entries(expectations)) {
    const text = await source(`src/components/ui/${file}`);
    for (const name of names) assert.match(text, new RegExp(`export (?:const|function|interface) ${name}\\b`), `${file} missing ${name}`);
  }
});

test("Questionnaire is controlled, conditional and semantic", async () => {
  const text = await source("src/components/questionnaire/questionnaire.tsx");
  assert.match(text, /activeStep: number/);
  assert.match(text, /answers: QuestionnaireAnswers/);
  assert.match(text, /onActiveStepChange/);
  assert.match(text, /onAnswersChange/);
  assert.match(text, /enabledWhen/);
  assert.match(text, /<fieldset>/);
  assert.match(text, /<legend>/);
  assert.match(text, /type="radio"/);
  assert.match(text, /<progress aria-label=/);
});

test("Brand styling keeps focus, touch and reduced-motion protections", async () => {
  const css = await source("src/styles/global.css");
  assert.match(css, /\.ui-button \{[^}]*min-height:44px/s);
  assert.match(css, /questionnaire-choice:has\(input:focus-visible\)/);
  assert.match(css, /questionnaire-choice:has\(input:checked\)[\s\S]*questionnaire-choice__check/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.ui-dialog__overlay/);
  assert.match(css, /\.ui-drawer__content/);
});
