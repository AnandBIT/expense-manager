import { describe, expect, it } from "vitest";
import { safeNextPath } from "../../src/lib/redirect";

const origin = "https://app.example";

describe("safeNextPath", () => {
  it("goes to the dashboard when there's nowhere to return to", () => {
    expect(safeNextPath(null, origin)).toBe("/dashboard");
    expect(safeNextPath("", origin)).toBe("/dashboard");
  });

  it("returns to a page on this site, keeping its query", () => {
    expect(safeNextPath("/join/0123abcd", origin)).toBe("/join/0123abcd");
    expect(safeNextPath("/groups/g1?sort=amount", origin)).toBe("/groups/g1?sort=amount");
  });

  it("never leads to another site", () => {
    const tricks = [
      "//evil.example",
      "/\\evil.example",
      "/\t/evil.example", // what "?next=/%09/evil.example" decodes to
      "https://evil.example/",
      "javascript:alert(1)",
      "http://[",
    ];
    for (const next of tricks) expect(safeNextPath(next, origin)).toBe("/dashboard");
  });
});
