const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cors = require("cors");

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const router = express.Router();

router.post("/auto", async (req, res) => {
  const { email, password, fieldName, coverLetter } = req.body;
  console.log({ email, password, fieldName, coverLetter });

  const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

  let browser;
  let page;
  let applicationsMade = 0;
  const MAX_APPLICATIONS = 5;

  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ["--start-maximized"],
    });

    page = await browser.newPage();
    const [width, height] = await page.evaluate(() => [
      window.screen.availWidth,
      window.screen.availHeight,
    ]);
    await page.setViewport({ width, height });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    await page.goto("https://internshala.com/", {
      waitUntil: "networkidle2",
    });

    await page.waitForSelector(".nav-cta-container .login-cta", {
      visible: true,
    });
    await page.click(".nav-cta-container .login-cta");

    await page.waitForSelector("#modal_email", { visible: true });
    await page.type("#modal_email", email, { delay: 100 });

    await page.waitForSelector("#modal_password", { visible: true });
    await page.type("#modal_password", password, { delay: 100 });
    await delay(4000);

    await page.waitForSelector("#modal_login_submit", { visible: true });
    await Promise.all([
      page.waitForNavigation(),
      page.click("#modal_login_submit"),
    ]);

    await page.waitForSelector(
      ".navbar-nav.nav_menu_container > li:first-child"
    );
    await page.hover(".navbar-nav.nav_menu_container > li:first-child");

    await page.waitForSelector(".internship_item_location");
    await page.click(".internship_item_location");

    await page.waitForSelector("#select_category_chosen");
    await page.click("#select_category_chosen");
    await page.waitForSelector("#select_category_chosen > ul > li > input");
    await delay(3000);
    await page.type(
      "#select_category_chosen > ul > li > input",
      ` ${fieldName} `,
      {
        delay: 50,
      }
    );

    await delay(3000);
    await page.keyboard.press("Enter");
    await delay(3000);

    while (applicationsMade < MAX_APPLICATIONS) {
      let internshipElements = await page.$$(
        ".container-fluid.individual_internship.easy_apply.button_easy_apply_t.visibilityTrackerItem"
      );

      if (internshipElements.length === 0) {
        console.log("No internships found.");
        break;
      }

      for (let i = 0; i < internshipElements.length; i++) {
        if (applicationsMade >= MAX_APPLICATIONS) {
          console.log("Max applications reached, exiting loop...");
          break;
        }

        try {
          internshipElements = await page.$$(
            ".container-fluid.individual_internship.easy_apply.button_easy_apply_t.visibilityTrackerItem"
          );
          const element = internshipElements[i];

          const nameElement = await element.$("h3.job-internship-name");
          const internshipName = await page.evaluate(
            (name) => name.textContent.trim(),
            nameElement
          );
          console.log(`Found internship: ${internshipName}`);

          if (!internshipName.toLowerCase().includes(fieldName.toLowerCase())) {
            console.log(
              `Skipping internship: ${internshipName} (does not match ${fieldName})`
            );
            continue;
          }

          await element.click();
          await delay(2000);

          const textareas = await page.$$('textarea[name^="text_"]');
          if (textareas.length > 0) {
            console.log(
              `Textarea found, skipping internship: ${internshipName}`
            );

            const closeIcon = await page.$("#easy_apply_modal_close");
            if (closeIcon) {
              await closeIcon.click();
              const confirmExitButton = await page.$(
                "#easy_apply_modal_close_confirm_exit"
              );
              if (confirmExitButton) {
                await confirmExitButton.click();
              } else {
                console.error("Confirm exit button not found.");
              }
              await delay(4000);
              continue;
            }
          }

          await page.waitForSelector("#continue_button");
          await page.click("#continue_button");

          await delay(4000);
          await page.waitForSelector(
            "#cover_letter_holder > div.ql-editor.ql-blank"
          );
          await page.type(
            "#cover_letter_holder > div.ql-editor.ql-blank",
            coverLetter
          );

          await delay(3000);

          await page.waitForSelector(
            ".submit_button_container.easy_apply_footer #submit"
          );
          await page.click(
            ".submit_button_container.easy_apply_footer #submit"
          );
          await delay(3000);

          const modalSelector = ".modal-dialog";
          const modalExists = await page.$(modalSelector);
          if (modalExists) {
            console.log("Modal appeared, closing it...");
            await page.click("#backToInternshipsCta");
            applicationsMade++;
            await page.waitForNavigation({ waitUntil: "networkidle2" });
          } else {
            console.log("Modal did not appear, clicking #not-interested...");
            await page.waitForSelector("#not-interested");
            await page.click("#not-interested");
            applicationsMade++;
          }

          console.log(`Applied to internship: ${internshipName}`);
          console.log(`Total applications made: ${applicationsMade}`);

          if (applicationsMade >= MAX_APPLICATIONS) {
            console.log("Reached maximum applications limit.");
            break;
          }
        } catch (err) {
          console.error(`Error applying for internship: ${err.message}`);
        }
      }

      if (applicationsMade >= MAX_APPLICATIONS) {
        break;
      }

      const nextPageButton = await page.$(".next_page");
      if (nextPageButton) {
        console.log("Moving to next page of internships...");
        await nextPageButton.click();
        await page.waitForNavigation({ waitUntil: "networkidle2" });
      } else {
        console.log("No more pages available or only one page exists.");
        break;
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    if (browser) {
      console.log("Closing browser after reaching the application limit...");
      await browser.close();
    }
  }
});

app.use("/", router);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
