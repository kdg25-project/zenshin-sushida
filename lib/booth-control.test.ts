import { describe, expect, it } from "vitest";
import { passwordError } from "./booth-control";

describe("staff password validation",()=>{
  it("requires a nonblank value without imposing a length limit",()=>{
    expect(passwordError("")).toBe("操作用パスワードを入力してください");
    expect(passwordError(" \t ")).toBe("操作用パスワードを入力してください");
    expect(passwordError("a")).toBeUndefined();
    expect(passwordError("x".repeat(256))).toBeUndefined();
  });
});
