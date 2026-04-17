package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Page Object for the New Device page.
 * URL: /devices/new/
 * <p>
 * Opened by clicking "Add Device" on the Devices list page.
 * Displays a generated install command scoped to a chosen organization
 * and platform, with options to copy it or run it on the current machine.
 */
public class NewDevicePage {

    private final Page page;

    // ── Navigation ───────────────────────────────────────────────────────────

    /**
     * "Back to Devices" button (top-left)
     */
    private final Locator backToDevicesButton;

    // ── Organization selector ────────────────────────────────────────────────

    /**
     * The Organization selector trigger button.
     * Displays the currently selected organization name (e.g. "Default").
     * Clicking it opens a searchable dropdown.
     */
    private final Locator organizationSelectorButton;

    /**
     * Search input inside the Organization dropdown (placeholder "Search...")
     */
    private final Locator organizationSearchInput;

    // ── Platform selector ────────────────────────────────────────────────────

    /**
     * Platform option divs (Windows / macOS / Linux).
     * Each has an onclick handler. The active platform's inner div carries
     * {@code bg-ods-accent}; inactive ones carry {@code bg-transparent};
     * Linux carries {@code opacity-50 cursor-not-allowed} (coming soon).
     *
     * Use {@link #selectPlatform(String)} and {@link #getSelectedPlatform()}
     * rather than accessing these directly.
     */

    // ── Device Add Command section ────────────────────────────────────────────

    /**
     * The generated install command text (monospace div inside the command card).
     * Scoped via the "Device Add Command" section label.
     */
    private final Locator commandText;

    /**
     * "Run on Current Machine" button
     */
    private final Locator runOnCurrentMachineButton;

    /**
     * "Copy Command" button
     */
    private final Locator copyCommandButton;

    // ── Additional Arguments ─────────────────────────────────────────────────

    /**
     * The "Additional Arguments" tag-style input.
     * Type a value and press Enter to add it as a command-line argument token.
     */
    private final Locator additionalArgumentsInput;

    // ── Antivirus exclusion paths ─────────────────────────────────────────────

    /**
     * The antivirus exclusion section container.
     * Scoped so that path text and copy buttons can be queried within it.
     */
    private final Locator avExclusionSection;

    // ─────────────────────────────────────────────────────────────────────────

    public NewDevicePage(Page page) {
        this.page = page;

        backToDevicesButton = page.getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName("Back to Devices"));

        organizationSelectorButton = page.locator("main button").filter(
                new Locator.FilterOptions().setHasText("Default"));

        // Rendered inside the dropdown popover only when the org selector is open
        organizationSearchInput = page.locator("input[placeholder='Search...']");

        // "Device Add Command" label → sibling card → font-mono div inside it
        commandText = page.locator("text=Device Add Command")
                .locator("xpath=..")
                .locator(".font-mono");

        runOnCurrentMachineButton = page.getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName("Run on Current Machine"));

        copyCommandButton = page.getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName("Copy Command"));

        additionalArgumentsInput = page.locator(
                "input[placeholder='Press enter after each argument']");

        // The antivirus section: the card that contains the warning message
        avExclusionSection = page.locator("main").locator(
                "text=Your antivirus may block OpenFrame installation").locator("xpath=../../..");
    }

    // ── Navigation ───────────────────────────────────────────────────────────

    /**
     * Clicks "Back to Devices" and returns to the Devices list.
     */
    public void clickBackToDevices() {
        backToDevicesButton.click();
    }

    // ── Organization ─────────────────────────────────────────────────────────

    /**
     * Returns the name of the currently selected organization
     * (e.g. "Default").
     */
    public String getSelectedOrganization() {
        // Button inner text is "De" (badge) + "Default" (name) — extract only the name span
        return organizationSelectorButton
                .locator("span span span").last()
                .textContent()
                .trim();
    }

    /**
     * Opens the Organization dropdown, optionally searches for the given name,
     * and clicks the matching option.
     *
     * @param orgName the exact organization name to select (e.g. "Default")
     */
    public void selectOrganization(String orgName) {
        organizationSelectorButton.click();
        organizationSearchInput.waitFor();
        organizationSearchInput.fill(orgName);
        // Options are rendered as buttons inside the dropdown; match by contained text
        page.locator("input[placeholder='Search...']")
                .locator("xpath=../../..")  // up to the dropdown inner container
                .locator("button")
                .filter(new Locator.FilterOptions().setHasText(orgName))
                .first()
                .click();
    }

    /**
     * Opens the Organization dropdown, searches by the given query, and returns
     * all matching organization names.
     */
    public List<String> searchOrganizations(String query) {
        organizationSelectorButton.click();
        organizationSearchInput.waitFor();
        organizationSearchInput.fill(query);
        Locator results = page.locator("input[placeholder='Search...']")
                .locator("xpath=../../..")
                .locator("button");
        return results.all().stream()
                .map(btn -> btn.locator("div > span").last().textContent().trim())
                .collect(Collectors.toList());
    }

    /**
     * Closes the organization dropdown by pressing Escape.
     */
    public void closeOrganizationDropdown() {
        page.keyboard().press("Escape");
    }

    // ── Platform ─────────────────────────────────────────────────────────────

    /**
     * Returns the name of the currently selected platform by looking for the
     * platform option whose inner div carries {@code bg-ods-accent}.
     * Possible values: "Windows", "macOS".
     */
    public String getSelectedPlatform() {
        return page.evaluate("""
                (() => {
                  const main = document.querySelector('main');
                  const all = main.querySelectorAll('*');
                  for (const el of all) {
                    if (el.onclick && (el.textContent?.trim() === 'Windows' || el.textContent?.trim() === 'macOS' || el.textContent?.trim().startsWith('Linux'))) {
                      const inner = el.children[0];
                      if (inner && typeof inner.className === 'string' && inner.className.includes('bg-ods-accent')) {
                        return el.textContent.trim();
                      }
                    }
                  }
                  return null;
                })()
                """).toString();
    }

    /**
     * Clicks the platform option with the given name.
     * Valid names: "Windows", "macOS". "Linux" is not yet available.
     *
     * @param platformName "Windows" or "macOS"
     */
    public void selectPlatform(String platformName) {
        // Platform options are plain divs with onclick handlers.
        // The inner styled div is the one that handles pointer events;
        // target it directly via :text-is() for an exact text match.
        page.locator("main div:text-is('" + platformName + "')").first().click();
    }

    /**
     * Returns true if the given platform option is available for selection
     * (i.e. not in "coming soon" / disabled state).
     *
     * @param platformName "Windows", "macOS", or "Linux"
     */
    public boolean isPlatformAvailable(String platformName) {
        return (boolean) page.evaluate("""
                (platformName) => {
                  const main = document.querySelector('main');
                  const all = main.querySelectorAll('*');
                  for (const el of all) {
                    if (el.onclick) {
                      const txt = el.textContent?.trim();
                      if (txt === platformName || txt.startsWith(platformName)) {
                        const inner = el.children[0];
                        if (inner && typeof inner.className === 'string') {
                          return !inner.className.includes('opacity-50') && !inner.className.includes('cursor-not-allowed');
                        }
                      }
                    }
                  }
                  return false;
                }
                """, platformName);
    }

    // ── Device Add Command ────────────────────────────────────────────────────

    /**
     * Returns the full generated install command text shown in the command card.
     */
    public String getDeviceAddCommand() {
        return commandText.textContent().trim();
    }

    /**
     * Clicks "Copy Command" to copy the install command to the clipboard.
     */
    public void clickCopyCommand() {
        copyCommandButton.click();
    }

    /**
     * Clicks "Run on Current Machine" to execute the install command locally.
     */
    public void clickRunOnCurrentMachine() {
        runOnCurrentMachineButton.click();
    }

    // ── Additional Arguments ─────────────────────────────────────────────────

    /**
     * Types an additional command-line argument and presses Enter to add it
     * as a token. Can be called multiple times for multiple arguments.
     *
     * @param argument the argument string to add (e.g. "--silent")
     */
    public void addArgument(String argument) {
        additionalArgumentsInput.fill(argument);
        page.keyboard().press("Enter");
    }

    // ── Antivirus exclusion paths ─────────────────────────────────────────────

    /**
     * Returns all antivirus exclusion paths listed on the page
     * (e.g. "C:\Program Files\OpenFrame").
     */
    public List<String> getExclusionPaths() {
        return avExclusionSection.locator(".font-mono").all().stream()
                .map(loc -> loc.textContent().trim())
                .collect(Collectors.toList());
    }

    /**
     * Clicks the copy button next to the exclusion path at the given 0-based index.
     *
     * @param index 0-based index of the path row
     */
    public void copyExclusionPath(int index) {
        // Each row is a div containing a font-mono span and a button; scope to the section
        avExclusionSection.locator("button").nth(index).click();
    }

    /**
     * Returns the antivirus exclusion path at the given 0-based index.
     *
     * @param index 0-based index of the path row
     */
    public String getExclusionPath(int index) {
        return avExclusionSection.locator(".font-mono").nth(index).textContent().trim();
    }

    /**
     * Returns the number of antivirus exclusion paths shown on the page.
     */
    public int getExclusionPathCount() {
        return avExclusionSection.locator(".font-mono").count();
    }
}