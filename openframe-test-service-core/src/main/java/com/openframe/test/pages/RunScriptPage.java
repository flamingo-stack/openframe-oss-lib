package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Page Object for the Run Script page.
 * URL pattern: /scripts/details/{id}/run/
 * <p>
 * Opened by clicking the ▷ Run button on any script row in the Scripts List.
 * Allows configuring timeout, script arguments, environment vars, and
 * selecting target devices before running the script.
 */
public class RunScriptPage {

    private final Page page;

    // ── Top-level actions ────────────────────────────────────────────────────

    /**
     * "Back to Script Details" button (top-left, type=submit)
     */
    private final Locator backToScriptDetailsButton;

    /**
     * "Run Script" submit button (top, enabled only when ≥1 device is selected)
     */
    private final Locator runScriptButton;

    // ── Script info card ─────────────────────────────────────────────────────

    /**
     * Script name heading inside the info card
     */
    private final Locator scriptName;

    /**
     * Script description paragraph inside the info card
     */
    private final Locator scriptDescription;

    // ── Timeout ──────────────────────────────────────────────────────────────

    /**
     * Numeric timeout input (seconds, default 90)
     */
    private final Locator timeoutInput;

    // ── Script Arguments ─────────────────────────────────────────────────────

    /**
     * "Add Script Argument" button
     */
    private final Locator addScriptArgumentButton;

    // ── Environment Vars ─────────────────────────────────────────────────────

    /**
     * "Add Environment Var" button
     */
    private final Locator addEnvironmentVarButton;

    // ── Device selection ─────────────────────────────────────────────────────

    /**
     * "Search for Devices" text input
     */
    private final Locator deviceSearchInput;

    /**
     * "Select Organization" combobox trigger input
     */
    private final Locator organizationFilterInput;

    /**
     * "Select All Displayed Devices" button
     */
    private final Locator selectAllDevicesButton;

    /**
     * "Clear Selection (N)" button – only present when ≥1 device is selected
     */
    private final Locator clearSelectionButton;

    /**
     * All device cards in the picker grid ([role="option"] buttons)
     */
    private final Locator deviceOptions;

    // ─────────────────────────────────────────────────────────────────────────

    public RunScriptPage(Page page) {
        this.page = page;

        backToScriptDetailsButton = page.getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName("Back to Script Details"));

        // There are two "Run Script" buttons (top + sticky bottom); .first() targets the top one.
        runScriptButton = page.getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName("Run Script")).first();

        scriptName = page.locator("main h3").first();
        scriptDescription = page.locator("main h3 + p").first();

        timeoutInput = page.locator("input[type='number']");

        addScriptArgumentButton = page.getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName("Add Script Argument"));

        addEnvironmentVarButton = page.getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName("Add Environment Var"));

        deviceSearchInput = page.locator("input[placeholder='Search for Devices']");
        organizationFilterInput = page.locator("input[placeholder='Select Organization']");

        selectAllDevicesButton = page.getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName("Select All Displayed Devices"));

        clearSelectionButton = page.locator("button").filter(
                new Locator.FilterOptions().setHasText("Clear Selection"));

        deviceOptions = page.locator("[role='option'][type='button']");
    }

    // ── Navigation ───────────────────────────────────────────────────────────

    /**
     * Clicks "Back to Script Details" and returns to the previous page.
     */
    public void clickBackToScriptDetails() {
        backToScriptDetailsButton.click();
    }

    // ── Script info card readers ─────────────────────────────────────────────

    /**
     * Returns the script name shown in the info card.
     */
    public String getScriptName() {
        return scriptName.textContent().trim();
    }

    /**
     * Returns the script description shown in the info card.
     */
    public String getScriptDescription() {
        return scriptDescription.textContent().trim();
    }

    /**
     * Returns the value of a metadata field (Shell Type / Supported Platforms / Category)
     * by its label text.
     * Example: {@code getScriptMetadataField("Shell Type")} → "PowerShell"
     */
    public String getScriptMetadataField(String labelText) {
        // Each metadata cell is a <span>value</span><span>label</span> pair inside a div
        Locator labelSpan = page.locator("main span")
                .filter(new Locator.FilterOptions().setHasText(labelText))
                .first();
        // The value span is the preceding sibling – navigate via the parent div
        return labelSpan.locator("xpath=preceding-sibling::span").first().textContent().trim();
    }

    // ── Timeout ──────────────────────────────────────────────────────────────

    /**
     * Returns the current value of the Timeout field.
     */
    public int getTimeout() {
        return Integer.parseInt(timeoutInput.inputValue().trim());
    }

    /**
     * Clears the Timeout field and types the given value.
     */
    public void setTimeout(int seconds) {
        timeoutInput.clear();
        timeoutInput.fill(String.valueOf(seconds));
    }

    // ── Script Arguments ─────────────────────────────────────────────────────

    /**
     * Sets the key and value for the script argument at the given 0-based index.
     * The first existing argument (index 0) is pre-populated from the script definition.
     */
    public void setScriptArgument(int index, String key, String value) {
        Locator keyInputs = page.locator("input[placeholder='Key']");
        Locator valueInputs = page.locator("input[placeholder='Enter Value (empty=flag)']");
        keyInputs.nth(index).clear();
        keyInputs.nth(index).fill(key);
        valueInputs.nth(index).clear();
        valueInputs.nth(index).fill(value);
    }

    /**
     * Returns the key of the script argument at the given 0-based index.
     * Pre-populated arguments (read-only from the script) are also accessible here.
     */
    public String getScriptArgumentKey(int index) {
        return page.locator("input[placeholder='Key']").nth(index).inputValue();
    }

    /**
     * Returns the value of the script argument at the given 0-based index.
     */
    public String getScriptArgumentValue(int index) {
        return page.locator("input[placeholder='Enter Value (empty=flag)']").nth(index).inputValue();
    }

    /**
     * Returns the number of script argument rows currently displayed.
     */
    public int getScriptArgumentCount() {
        return page.locator("input[placeholder='Key']").count();
    }

    /**
     * Clicks "Add Script Argument" to append a new empty argument row.
     */
    public void addScriptArgument() {
        addScriptArgumentButton.click();
    }

    /**
     * Deletes the script argument at the given 0-based index by clicking its
     * "Delete argument" (trash) button.
     */
    public void deleteScriptArgument(int index) {
        page.locator("button[aria-label='Delete argument']").nth(index).click();
    }

    // ── Environment Vars ─────────────────────────────────────────────────────

    /**
     * Sets the key and value for the environment variable at the given 0-based index.
     * The first existing env var (index 0) is pre-populated from the script definition.
     */
    public void setEnvironmentVar(int index, String key, String value) {
        Locator keyInputs = page.locator("input[placeholder='Key']");
        Locator valueInputs = page.locator("input[placeholder='Enter Value']");
        // Env var key inputs are the SECOND group of "Key" placeholders.
        // Script arg keys come first (count them to offset correctly).
        int argCount = getScriptArgumentCount();
        keyInputs.nth(argCount + index).clear();
        keyInputs.nth(argCount + index).fill(key);
        valueInputs.nth(index).clear();
        valueInputs.nth(index).fill(value);
    }

    /**
     * Returns the key of the environment variable at the given 0-based index.
     */
    public String getEnvironmentVarKey(int index) {
        int argCount = getScriptArgumentCount();
        return page.locator("input[placeholder='Key']").nth(argCount + index).inputValue();
    }

    /**
     * Returns the value of the environment variable at the given 0-based index.
     */
    public String getEnvironmentVarValue(int index) {
        return page.locator("input[placeholder='Enter Value']").nth(index).inputValue();
    }

    /**
     * Returns the number of environment variable rows currently displayed.
     */
    public int getEnvironmentVarCount() {
        return page.locator("input[placeholder='Enter Value']").count();
    }

    /**
     * Clicks "Add Environment Var" to append a new empty env var row.
     */
    public void addEnvironmentVar() {
        addEnvironmentVarButton.click();
    }

    /**
     * Deletes the environment variable at the given 0-based index.
     * "Delete argument" buttons are shared between script args and env vars;
     * env var delete buttons start after the script arg delete buttons.
     */
    public void deleteEnvironmentVar(int index) {
        int argCount = getScriptArgumentCount();
        page.locator("button[aria-label='Delete argument']").nth(argCount + index).click();
    }

    // ── Device search & filter ────────────────────────────────────────────────

    /**
     * Types into the "Search for Devices" input to filter the device grid.
     */
    public void searchForDevice(String query) {
        deviceSearchInput.clear();
        deviceSearchInput.fill(query);
    }

    /**
     * Opens the "Filter by Organization" dropdown and selects the option matching
     * the given text (e.g. "Default").
     */
    public void selectOrganization(String orgName) {
        organizationFilterInput.click();
        page.locator("[role='listbox'] [role='option']")
                .filter(new Locator.FilterOptions().setHasText(orgName))
                .click();
    }

    // ── Device selection ─────────────────────────────────────────────────────

    /**
     * Selects the device card whose name matches the given text.
     * Clicking an already-selected device deselects it.
     */
    public void toggleDeviceByName(String deviceName) {
        deviceOptions
                .filter(new Locator.FilterOptions().setHasText(deviceName))
                .first()
                .click();
    }

    /**
     * Returns true if the device card with the given name is currently selected
     * ({@code aria-selected="true"}).
     */
    public boolean isDeviceSelected(String deviceName) {
        return Boolean.parseBoolean(
                deviceOptions
                        .filter(new Locator.FilterOptions().setHasText(deviceName))
                        .first()
                        .getAttribute("aria-selected")
        );
    }

    /**
     * Returns the names of all currently selected devices.
     */
    public List<String> getSelectedDeviceNames() {
        return deviceOptions.all().stream()
                .filter(opt -> "true".equals(opt.getAttribute("aria-selected")))
                .map(opt -> opt.locator("span > span").first().textContent().trim())
                .collect(Collectors.toList());
    }

    /**
     * Returns the names of all devices visible in the device picker grid.
     */
    public List<String> getAllDeviceNames() {
        return deviceOptions.all().stream()
                .map(opt -> opt.locator("span > span").first().textContent().trim())
                .collect(Collectors.toList());
    }

    /**
     * Returns the number of device cards currently visible in the picker grid.
     */
    public int getVisibleDeviceCount() {
        return deviceOptions.count();
    }

    /**
     * Clicks "Select All Displayed Devices" to select every visible device card.
     */
    public void selectAllDisplayedDevices() {
        selectAllDevicesButton.click();
    }

    /**
     * Clicks the "Clear Selection (N)" button to deselect all devices.
     * The button is only rendered when at least one device is selected.
     */
    public void clearDeviceSelection() {
        clearSelectionButton.click();
    }

    /**
     * Returns true if the "Clear Selection" button is visible, which indicates
     * that at least one device is currently selected.
     */
    public boolean isClearSelectionVisible() {
        return clearSelectionButton.isVisible();
    }

    /**
     * Returns the selection count shown in the "Clear Selection (N)" button,
     * e.g. returns 2 for "Clear Selection (2)".
     */
    public int getSelectionCount() {
        String text = clearSelectionButton.textContent().trim(); // "Clear Selection (2)"
        return Integer.parseInt(text.replaceAll(".*\\((\\d+)\\).*", "$1"));
    }

    // ── Run ──────────────────────────────────────────────────────────────────

    /**
     * Returns true if the "Run Script" button is enabled (i.e. at least one
     * device has been selected).
     */
    public boolean isRunScriptButtonEnabled() {
        return runScriptButton.isEnabled();
    }

    /**
     * Clicks the "Run Script" button.
     * The button must be enabled (≥1 device selected) before calling this method.
     */
    public void clickRunScript() {
        runScriptButton.click();
    }
}
