import { z } from "zod";

export const TranscriptQuestions = z.object({
    title: z.string().describe("The title of the YouTube video"),
    language: z.string().describe("Language code of the output, e.g. 'en'"),
    questions: z.object({
        general: z
            .array(
                z.object({
                    question: z.string().describe("A clear question about the video content"),
                    timestampSeconds: z
                        .number()
                        .describe("Second in the video where the answer is discussed; use the transcript's [Ns] markers"),
                })
            )
            .describe("Conceptual questions based on the transcript"),
        coding: z
            .array(
                z.object({
                    task: z.string().describe("A short practice task the learner should complete"),
                    code: z.string().describe("Starter or example code for the task"),
                    lang: z.string().describe("Syntax highlighter language id, e.g. 'typescript'"),
                    filename: z.string().describe("Label for the code block, e.g. 'app.ts'"),
                })
            )
            .describe("Coding practice exercises related to the video"),
    }),
    educational: z.boolean().describe("Tells if the video is realted to coding and educational or not"),
});

export type TranscriptQuestionsOutput = z.infer<typeof TranscriptQuestions>;

export const typescriptTranscriptQuestions: TranscriptQuestionsOutput = {
    title: "Complete TypeScript Masterclass",
    language: "en",
    questions: {
        general: [
            {
                question: "Why should you enable the strict flag immediately, and which individual checks does it switch on?",
                timestampSeconds: 103,
            },
            {
                question: "What does type erasure mean, and why does it prevent TypeScript from validating JSON returned by a network call?",
                timestampSeconds: 152,
            },
            {
                question: "Why does a robust pipeline run tsc --noEmit separately even when esbuild or SWC handles the bundling?",
                timestampSeconds: 272,
            },
            {
                question: "Why does a const initializer infer the literal type 42 while a let initializer widens to number?",
                timestampSeconds: 347,
            },
            {
                question: "Why is unknown preferred over any, and what must you do before using an unknown value?",
                timestampSeconds: 407,
            },
            {
                question: "How does structural typing decide whether two types are compatible?",
                timestampSeconds: 613,
            },
            {
                question: "How do interfaces and type aliases differ with respect to declaration merging?",
                timestampSeconds: 662,
            },
            {
                question: "What does enabling noUncheckedIndexedAccess change about index lookups?",
                timestampSeconds: 751,
            },
            {
                question: "What is a user-defined type guard, and what does its type predicate tell the compiler?",
                timestampSeconds: 1005,
            },
            {
                question: "How do discriminated unions combined with a never-typed default branch enforce exhaustive handling?",
                timestampSeconds: 1035,
            },
            {
                question: "What does strictFunctionTypes change about parameter bivariance, and why do method declarations remain bivariant?",
                timestampSeconds: 1289,
            },
            {
                question: "When is a union parameter or generic a better choice than function overloads?",
                timestampSeconds: 1365,
            },
            {
                question: "How does getProp<T, K extends keyof T> guarantee that the return type matches the selected property?",
                timestampSeconds: 1589,
            },
            {
                question: "Why is a type parameter that appears only once in a signature a warning sign?",
                timestampSeconds: 1652,
            },
            {
                question: "How does a homomorphic mapped type preserve optionality and readonly modifiers from its source type?",
                timestampSeconds: 1936,
            },
            {
                question: "Why is Omit not distributive over unions, and when does that matter?",
                timestampSeconds: 2023,
            },
            {
                question: "What does it mean for a conditional type to distribute over a union, and how can you disable that behavior?",
                timestampSeconds: 2130,
            },
            {
                question: "How does the infer keyword let ReturnType<T> capture the return position of a function type?",
                timestampSeconds: 2176,
            },
            {
                question: "How does the satisfies operator differ from a plain type annotation on a configuration object?",
                timestampSeconds: 2549,
            },
            {
                question: "How does branding a primitive emulate nominal typing in a structurally typed language?",
                timestampSeconds: 2597,
            },
            {
                question: "How do TypeScript's private modifier and ECMAScript hash-prefixed fields differ at runtime?",
                timestampSeconds: 2792,
            },
            {
                question: "What problem does the override keyword with noImplicitOverride prevent?",
                timestampSeconds: 2852,
            },
            {
                question: "What does verbatimModuleSyntax change about import and export elision?",
                timestampSeconds: 3028,
            },
            {
                question: "Why does NodeNext module resolution require explicit .js extensions in relative imports?",
                timestampSeconds: 3058,
            },
            {
                question: "Why should external data be parsed into trusted types at every system boundary?",
                timestampSeconds: 3362,
            },
            {
                question: "Why should the non-null assertion operator be avoided in application code?",
                timestampSeconds: 3434,
            },
        ],
        coding: [
            {
                task: "Fix getInitial so it compiles under strictNullChecks by handling the null case without using the non-null assertion operator.",
                code: `// tsconfig.json has "strict": true
function getInitial(name: string | null): string {
  // TODO: handle the null case explicitly
  return name[0].toUpperCase();
}

console.log(getInitial("ada"));
console.log(getInitial(null));`,
                lang: "typescript",
                filename: "strictNull.ts",
            },
            {
                task: "Implement parseAge so it accepts unknown input, narrows it with typeof and Number.isFinite, and throws a descriptive Error for invalid values.",
                code: `function parseAge(input: unknown): number {
  // TODO: narrow \`input\` before returning it
  return input;
}

console.log(parseAge(42));
console.log(parseAge("not a number"));`,
                lang: "typescript",
                filename: "parseAge.ts",
            },
            {
                task: "Freeze the roles array with as const and derive a Role union type from it using an indexed access type.",
                code: `const roles = ["admin", "editor", "viewer"];

// TODO: freeze \`roles\`, then derive:
// type Role = "admin" | "editor" | "viewer"
type Role = string;

function canWrite(role: Role): boolean {
  return role === "admin" || role === "editor";
}`,
                lang: "typescript",
                filename: "roles.ts",
            },
            {
                task: "Type the patch parameter so callers may update only name and email, every field is optional, and id can never be changed.",
                code: `interface User {
  readonly id: number;
  name: string;
  email?: string;
}

// TODO: replace \`unknown\` with a precise type built from utility types
function updateUser(user: User, patch: unknown): User {
  return { ...user, ...(patch as object) };
}`,
                lang: "typescript",
                filename: "updateUser.ts",
            },
            {
                task: "Add a triangle variant to Shape and make the compiler fail whenever a variant is not handled by using assertNever in a default branch.",
                code: `type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rect"; width: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "rect":
      return shape.width * shape.height;
    // TODO: add the triangle case and an exhaustive default branch
  }
}

function assertNever(value: never): never {
  throw new Error(\`Unexpected variant: \${JSON.stringify(value)}\`);
}`,
                lang: "typescript",
                filename: "shapes.ts",
            },
            {
                task: "Change isUser to return a type predicate so that narrowing works at the call site.",
                code: `interface User {
  id: number;
  name: string;
}

// TODO: update the return type to a type predicate (value is User)
function isUser(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value
  );
}

declare const input: unknown;
if (isUser(input)) {
  console.log(input.name); // should compile after your fix
}`,
                lang: "typescript",
                filename: "isUser.ts",
            },
            {
                task: "Make getProp fully type-safe using the type parameters T and K extends keyof T so that the return type is T[K].",
                code: `// TODO: replace \`any\` with generics
function getProp(obj: any, key: string): any {
  return obj[key];
}

const id: number = getProp({ id: 1, name: "ada" }, "id");
// getProp({ id: 1, name: "ada" }, "missing"); // should fail to compile`,
                lang: "typescript",
                filename: "getProp.ts",
            },
            {
                task: "Build a Getters<T> mapped type using key remapping so Settings produces getTheme and getFontSize methods with matching return types.",
                code: `interface Settings {
  theme: string;
  fontSize: number;
}

// TODO: expected shape:
// { getTheme: () => string; getFontSize: () => number }
type Getters<T> = unknown;

type SettingsGetters = Getters<Settings>;`,
                lang: "typescript",
                filename: "getters.ts",
            },
            {
                task: "Implement UnwrapPromise<T> as a recursive conditional type using infer so nested promises are fully unwrapped.",
                code: `// TODO: implement recursively with \`infer\`
type UnwrapPromise<T> = T;

type A = UnwrapPromise<Promise<Promise<string>>>; // expected: string
type B = UnwrapPromise<number>;                   // expected: number`,
                lang: "typescript",
                filename: "unwrapPromise.ts",
            },
            {
                task: "Use template literal types to derive EventName and HandlerName unions from the Entity and Action unions.",
                code: `type Entity = "user" | "order";
type Action = "created" | "deleted";

// TODO: "user:created" | "user:deleted" | "order:created" | "order:deleted"
type EventName = string;

// TODO: "onUserCreated" | "onUserDeleted" | "onOrderCreated" | "onOrderDeleted"
type HandlerName = string;`,
                lang: "typescript",
                filename: "events.ts",
            },
            {
                task: "Create a Brand helper with a phantom property so that a UserId can no longer be passed where an OrderId is expected.",
                code: `// TODO: define Brand<T, B> using an intersection with a phantom property
type UserId = string;
type OrderId = string;

function getUser(id: UserId): void {
  console.log(id);
}

const orderId = "o-1" as OrderId;
getUser(orderId); // should fail to compile after your fix`,
                lang: "typescript",
                filename: "brand.ts",
            },
            {
                task: "Make Repository abstract with an abstract validate method, use a parameter property for name, and implement a UserRepository that overrides validate.",
                code: `// TODO: make this class abstract and add \`abstract validate(item: T): boolean\`
class Repository<T extends { id: string }> {
  private items = new Map<string, T>();

  // TODO: turn \`name\` into a private readonly parameter property
  constructor(name: string) {}

  save(item: T): void {
    this.items.set(item.id, item);
  }
}

// TODO: class UserRepository extends Repository<{ id: string; email: string }>
// and implement validate using the \`override\` keyword`,
                lang: "typescript",
                filename: "repository.ts",
            },
            {
                task: "Use the satisfies operator so routes is checked against Record<string, Route> while routes.home.path keeps the literal type \"/\".",
                code: `type Route = { path: string; auth: boolean };

const routes = {
  home: { path: "/", auth: false },
  admin: { path: "/admin", auth: true },
};

// TODO: add \`satisfies Record<string, Route>\` and verify that a typo such as
// \`atuh: true\` is rejected`,
                lang: "typescript",
                filename: "routes.ts",
            },
            {
                task: "Complete the tsconfig for a modern Node.js ESM project with strict checking, indexed-access safety, explicit overrides, and separate source and output directories.",
                code: `{
  "compilerOptions": {
    "target": "ES2022"
    // TODO: add module and moduleResolution for Node ESM
    // TODO: add strict, noUncheckedIndexedAccess, noImplicitOverride
    // TODO: add verbatimModuleSyntax, rootDir (src) and outDir (dist)
  }
}`,
                lang: "jsonc",
                filename: "tsconfig.json",
            },
            {
                task: "Model Result<T, E> as a discriminated union and write parseJson so it returns a Result instead of throwing.",
                code: `// TODO: type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

function parseJson(text: string) {
  // TODO: wrap JSON.parse in try/catch and return a Result<unknown, SyntaxError>
}

const result = parseJson('{"a": 1}');
// TODO: narrow on result.ok before accessing result.value or result.error`,
                lang: "typescript",
                filename: "result.ts",
            },
        ],
    },
    educational: true,
};