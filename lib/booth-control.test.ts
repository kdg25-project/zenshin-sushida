import { describe, expect, it } from "vitest";
import { BOOTH_DIAGNOSTIC_MAX_LINE_LENGTH, BOOTH_DIAGNOSTIC_MAX_LINES, createBoothDiagnostics, isBoothDiagnostics, passwordError } from "./booth-control";

describe("staff password validation",()=>{
  it("requires a nonblank value without imposing a length limit",()=>{
    expect(passwordError("")).toBe("操作用パスワードを入力してください");
    expect(passwordError(" \t ")).toBe("操作用パスワードを入力してください");
    expect(passwordError("a")).toBeUndefined();
    expect(passwordError("x".repeat(256))).toBeUndefined();
  });
});

describe("booth diagnostics",()=>{
  it("bounds lines while retaining the final error row",()=>{
    const diagnostics=createBoothDiagnostics([...Array.from({length:BOOTH_DIAGNOSTIC_MAX_LINES+2},(_,index)=>`line ${index}`),`worker error: ${"x".repeat(BOOTH_DIAGNOSTIC_MAX_LINE_LENGTH+20)}`],123);
    expect(diagnostics.lines).toHaveLength(BOOTH_DIAGNOSTIC_MAX_LINES);
    expect(diagnostics.lines.at(-1)).toMatch(/^worker error:/);
    expect(diagnostics.lines.at(-1)?.endsWith("…")).toBe(true);
    expect(isBoothDiagnostics(diagnostics)).toBe(true);
  });
  it("rejects malformed or oversized diagnostics",()=>{
    expect(isBoothDiagnostics({updatedAt:1,lines:[]})).toBe(false);
    expect(isBoothDiagnostics({updatedAt:1,lines:["x".repeat(BOOTH_DIAGNOSTIC_MAX_LINE_LENGTH+1)]})).toBe(false);
    expect(isBoothDiagnostics({updatedAt:1.5,lines:["ok"]})).toBe(false);
  });
});
