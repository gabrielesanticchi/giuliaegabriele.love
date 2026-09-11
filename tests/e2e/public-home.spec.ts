import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("public home", () => {
  test("renders the editorial landing with one h1 and a skip link", async ({
    page
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Giulia e Gabriele" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Vai al contenuto principale" })
    ).toHaveAttribute("href", "#contenuto");
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test("keyboard focus reaches the skip link first", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Vai al contenuto principale" })
    ).toBeFocused();
  });

  test("keeps every story frame to the left of its chapter while scrolling", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    const storyMoments = page.locator(".story-list > li");
    await expect(storyMoments).toHaveCount(5);

    for (const moment of await storyMoments.all()) {
      const frame = await moment.locator(".story-art").boundingBox();
      const heading = await moment
        .getByRole("heading", { level: 3 })
        .boundingBox();

      expect(frame).not.toBeNull();
      expect(heading).not.toBeNull();
      expect(frame!.x + frame!.width).toBeLessThan(heading!.x);
    }
  });

  test("presents the desktop story as a continuous square film strip", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    const frames = page.locator(".story-list > li .story-art");
    await expect(frames).toHaveCount(5);
    const frameBoxes = await Promise.all(
      (await frames.all()).map((frame) => frame.boundingBox())
    );
    const firstFrame = frames.first();
    const filmStyles = await firstFrame.evaluate((element) => {
      const frame = getComputedStyle(element);
      const before = getComputedStyle(element, "::before");
      const after = getComputedStyle(element, "::after");

      return {
        backgroundColor: frame.backgroundColor,
        beforeBackground: before.backgroundImage,
        beforeContent: before.content,
        beforeWidth: Number.parseFloat(before.width),
        afterBackground: after.backgroundImage,
        afterContent: after.content,
        afterWidth: Number.parseFloat(after.width)
      };
    });

    expect(frameBoxes.every((frame) => frame !== null)).toBe(true);
    frameBoxes.forEach((frame) => {
      expect(frame!.height / frame!.width).toBeCloseTo(1, 1);
    });
    frameBoxes.slice(1).forEach((frame, index) => {
      const previous = frameBoxes[index]!;
      expect(
        Math.abs(frame!.y - (previous.y + previous.height))
      ).toBeLessThanOrEqual(1);
    });
    const proposalBounds = await frames.nth(2).evaluate((frame) => {
      const image = frame.querySelector("img");
      if (!image) {
        return null;
      }

      const frameBox = frame.getBoundingClientRect();
      const imageBox = image.getBoundingClientRect();
      return {
        leftInset: imageBox.left - frameBox.left,
        rightInset: frameBox.right - imageBox.right,
        topInset: imageBox.top - frameBox.top,
        bottomInset: frameBox.bottom - imageBox.bottom,
        objectFit: getComputedStyle(image).objectFit
      };
    });
    expect(proposalBounds).not.toBeNull();
    expect(proposalBounds!.leftInset).toBeGreaterThan(0);
    expect(proposalBounds!.rightInset).toBeGreaterThan(0);
    expect(proposalBounds!.topInset).toBeGreaterThan(0);
    expect(proposalBounds!.bottomInset).toBeGreaterThan(0);
    expect(proposalBounds!.objectFit).toBe("contain");
    expect(filmStyles.backgroundColor).toBe("rgb(41, 37, 31)");
    expect(filmStyles.beforeContent).toBe('\"\"');
    expect(filmStyles.afterContent).toBe('\"\"');
    expect(filmStyles.beforeWidth).toBeGreaterThan(0);
    expect(filmStyles.afterWidth).toBeGreaterThan(0);
    expect(filmStyles.beforeBackground).toContain("repeating-linear-gradient");
    expect(filmStyles.afterBackground).toContain("repeating-linear-gradient");
  });

  test("reveals each chapter as its frame enters the viewport", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    const chapterCopies = page.locator(".story-copy");
    await expect(chapterCopies).toHaveCount(5);
    const chapter = page.locator(".story-list > li").nth(2);
    const copy = chapter.locator(".story-copy");
    const frame = chapter.locator(".story-art");
    const before = await chapter.evaluate((element) => {
      const copyStyle = getComputedStyle(element.querySelector(".story-copy")!);
      const frameStyle = getComputedStyle(element.querySelector(".story-art")!);

      return {
        copyAnimation: copyStyle.animationName,
        copyClip: copyStyle.clipPath,
        copyTransform: copyStyle.transform,
        frameAnimation: frameStyle.animationName,
        frameOpacity: Number.parseFloat(frameStyle.opacity)
      };
    });

    await chapter.scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise(requestAnimationFrame));

    const after = {
      copyClip: await copy.evaluate(
        (element) => getComputedStyle(element).clipPath
      ),
      copyTransform: await copy.evaluate(
        (element) => getComputedStyle(element).transform
      ),
      frameOpacity: await frame.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).opacity)
      )
    };

    expect(before.copyAnimation).toContain("story-copy-reveal");
    expect(before.frameAnimation).toContain("story-frame-develop");
    expect(after.copyClip).not.toBe(before.copyClip);
    expect(after.copyTransform).not.toBe(before.copyTransform);
    expect(after.frameOpacity).toBeGreaterThan(before.frameOpacity);
  });

  test("shows a static complete story when reduced motion is requested", async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const styles = await page
      .locator(".story-list > li")
      .nth(2)
      .evaluate((element) => {
        const copy = getComputedStyle(element.querySelector(".story-copy")!);
        const frame = getComputedStyle(element.querySelector(".story-art")!);

        return {
          copyAnimation: copy.animationName,
          copyClip: copy.clipPath,
          copyTransform: copy.transform,
          frameAnimation: frame.animationName,
          frameOpacity: frame.opacity,
          frameTransform: frame.transform
        };
      });

    expect(styles).toEqual({
      copyAnimation: "none",
      copyClip: "none",
      copyTransform: "none",
      frameAnimation: "none",
      frameOpacity: "1",
      frameTransform: "none"
    });
  });

  test("stacks every film frame above its copy without mobile overflow", async ({
    page
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/");

    const storyMoments = page.locator(".story-list > li");
    for (const moment of await storyMoments.all()) {
      const frame = await moment.locator(".story-art").boundingBox();
      const copy = await moment.locator(".story-copy").boundingBox();

      expect(frame).not.toBeNull();
      expect(copy).not.toBeNull();
      expect(frame!.y + frame!.height).toBeLessThanOrEqual(copy!.y);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(320);
  });

  test("has no serious or critical accessibility violations", async ({
    page
  }) => {
    await page.goto("/");
    await page.addStyleTag({
      content:
        "*,*::before,*::after{transition-duration:0s!important;animation-duration:0s!important}"
    });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    );
    expect(
      blocking,
      blocking.map((v) => `${v.id}: ${v.help}`).join("\n")
    ).toEqual([]);
  });
});
