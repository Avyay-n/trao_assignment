import { describe, it, expect } from "vitest";
import { cleanHtml, scoreLink, validateUrl } from "../src/crawler/index.js";
import { RobotsParser } from "../src/crawler/robots.js";

describe("Web Crawler & Cleaning Engine", () => {
  it("should score hiring and careers links significantly higher than generic links", () => {
    const hiringScore = scoreLink("/careers/engineering", "View open jobs");
    const blogScore = scoreLink("/blog/company-update", "Read blog");
    const privacyScore = scoreLink("/legal/privacy-policy", "Privacy Policy");

    expect(hiringScore).toBeGreaterThan(blogScore);
    expect(hiringScore).toBeGreaterThan(privacyScore);
    expect(privacyScore).toBeLessThan(0); // Penalized
  });

  it("should clean HTML by stripping scripts, styles, and boilerplate", () => {
    const rawHtml = `
      <html>
        <head><title>Test Company Careers</title></head>
        <body>
          <script>console.log("secret tracker");</script>
          <style>.hero { color: red; }</style>
          <nav><a href="/">Home</a><a href="/login">Login</a></nav>
          <main>
            <h1>Engineering at TestCo</h1>
            <p>We build resilient distributed database engines in Rust and Go.</p>
          </main>
          <footer>Copyright 2026 TestCo</footer>
        </body>
      </html>
    `;

    const cleaned = cleanHtml(rawHtml);
    expect(cleaned.title).toContain("Test Company Careers");
    expect(cleaned.text).toContain("Engineering at TestCo");
    expect(cleaned.text).toContain("distributed database engines");
    expect(cleaned.text).not.toContain("secret tracker");
    expect(cleaned.text).not.toContain(".hero { color: red; }");
    expect(cleaned.text).not.toContain("Copyright 2026");
  });

  it("should honor robots.txt rules", () => {
    const robotsContent = `
      User-agent: *
      Disallow: /admin/
      Disallow: /internal/
      Allow: /careers/
    `;

    const parser = new RobotsParser(robotsContent);
    expect(parser.isAllowed("/careers/senior-eng")).toBe(true);
    expect(parser.isAllowed("/admin/dashboard")).toBe(false);
    expect(parser.isAllowed("/internal/notes")).toBe(false);
    expect(parser.isAllowed("/public/about")).toBe(true);
  });

  it("should permit local URLs when allowLocal is true", () => {
    const localRes = validateUrl("http://localhost:8099/acme/", true);
    expect(localRes.valid).toBe(true);

    const privateRes = validateUrl("http://127.0.0.1:3000/", true);
    expect(privateRes.valid).toBe(true);

    const restrictedRes = validateUrl("http://localhost:8099/acme/", false);
    expect(restrictedRes.valid).toBe(false);
  });
});
