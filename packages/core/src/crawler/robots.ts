/**
 * Simple robots.txt parser and checker
 */
export class RobotsParser {
  private disallowedPaths: string[] = [];
  private allowedPaths: string[] = [];

  constructor(robotsTxtContent?: string) {
    if (robotsTxtContent) {
      this.parse(robotsTxtContent);
    }
  }

  private parse(content: string) {
    const lines = content.split(/\r?\n/);
    let appliesToAll = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const [directive, ...rest] = line.split(":");
      const key = directive.trim().toLowerCase();
      const value = rest.join(":").trim();

      if (key === "user-agent") {
        appliesToAll = value === "*" || value.toLowerCase().includes("bot");
      } else if (appliesToAll) {
        if (key === "disallow" && value) {
          this.disallowedPaths.push(value);
        } else if (key === "allow" && value) {
          this.allowedPaths.push(value);
        }
      }
    }
  }

  isAllowed(urlPath: string): boolean {
    // Explicit allow overrides disallow
    for (const allow of this.allowedPaths) {
      if (urlPath.startsWith(allow)) return true;
    }
    for (const disallow of this.disallowedPaths) {
      if (urlPath.startsWith(disallow)) return false;
    }
    return true;
  }
}
