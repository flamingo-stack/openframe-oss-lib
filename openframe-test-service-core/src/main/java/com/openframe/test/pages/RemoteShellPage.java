package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Page Object for the Remote Shell page.
 * URL pattern: /devices/details/{id}/remote-shell/?shellType=cmd|powershell
 * <p>
 * Opened from DeviceDetailsPage by clicking Remote Shell → CMD or PowerShell.
 * The terminal is rendered by xterm.js using a pure DOM renderer (no canvas).
 * User input is proxied through a hidden textarea[aria-label="Terminal input"].
 * Terminal output is readable from .xterm-rows DOM elements.
 */
public class RemoteShellPage {

    private final Page page;

    // ── Selectors ─────────────────────────────────────────────────────────────

    /**
     * Page heading ("Remote Shell").
     */
    private static final String PAGE_HEADING = "main h1.text-h2";

    /**
     * Device name shown in the connection status card.
     */
    private static final String DEVICE_NAME = "main h1.text-lg";

    /**
     * "Terminal • Default" subtitle inside the connection status card.
     * Carries the shell type label and organisation name.
     */
    private static final String SHELL_SUBTITLE = "main p.text-ods-text-secondary.text-sm";

    /**
     * Connection status span.
     * "Connected" → carries {@code text-ods-attention-green-success}.
     * Disconnected states carry a different colour class.
     */
    private static final String CONNECTION_STATUS = "main span.text-sm";

    /**
     * Disconnect button in the status card.
     */
    private static final String DISCONNECT_BTN = "main button:has-text('Disconnect')";

    /**
     * xterm.js input proxy textarea.
     * Typing into this element sends keystrokes to the live shell session.
     */
    private static final String TERMINAL_INPUT = "textarea[aria-label='Terminal input']";

    /**
     * xterm.js rows container.
     * Each child {@code <div>} is one rendered terminal line.
     * Used to read the current terminal output.
     */
    private static final String TERMINAL_ROWS = ".xterm-rows";

    // ── Constructor ───────────────────────────────────────────────────────────

    public RemoteShellPage(Page page) {
        this.page = page;
    }

    // ── Header ────────────────────────────────────────────────────────────────

    /**
     * Returns the page heading text ("Remote Shell").
     */
    public String getPageHeading() {
        return page.locator(PAGE_HEADING).innerText().trim();
    }

    /**
     * Returns the device name shown in the connection status card.
     */
    public String getDeviceName() {
        return page.locator(DEVICE_NAME).innerText().trim();
    }

    /**
     * Returns the shell subtitle text shown under the device name,
     * e.g. "Terminal • Default".
     */
    public String getShellSubtitle() {
        return page.locator(SHELL_SUBTITLE).innerText().trim();
    }

    /**
     * Returns the connection status text, e.g. "Connected".
     */
    public String getConnectionStatus() {
        return page.locator(CONNECTION_STATUS).innerText().trim();
    }

    /**
     * Returns {@code true} when the status span carries the green success
     * class, meaning the shell session is actively connected.
     */
    public boolean isConnected() {
        String cls = page.locator(CONNECTION_STATUS).getAttribute("class");
        return cls != null && cls.contains("text-ods-attention-green-success") && !getTerminalOutput().isEmpty();
    }

    /**
     * Returns the shell type from the URL query parameter
     * ({@code "cmd"} or {@code "powershell"}).
     */
    public String getShellType() {
        String url = page.url();
        if (url.contains("shellType=")) {
            return url.replaceAll(".*shellType=([^&]+).*", "$1");
        }
        return "";
    }

    // ── Navigation ────────────────────────────────────────────────────────────

    /**
     * Clicks "Back to Device" and returns to the Device Details page.
     */
    public void clickBackToDevice() {
        page.getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName("Back to Device")).click();
    }

    // ── Connection control ────────────────────────────────────────────────────

    /**
     * Clicks the "Disconnect" button to terminate the shell session.
     */
    public void clickDisconnect() {
        page.locator(DISCONNECT_BTN).click();
    }

    // ── Terminal interaction ──────────────────────────────────────────────────

    /**
     * Types a command into the terminal and presses Enter to execute it.
     * Focuses the xterm input proxy textarea before typing.
     *
     * @param command the shell command to execute (e.g. "dir", "echo hello")
     */
    public void executeCommand(String command) {
        List<String> terminalLines = this.getTerminalLines();
        page.locator(TERMINAL_INPUT).click();
        page.locator(TERMINAL_INPUT).pressSequentially(command);
        page.keyboard().press("Enter");
        page.waitForCondition(() -> this.getTerminalLines().size() > terminalLines.size());
    }

    /**
     * Types text into the terminal without pressing Enter.
     * Useful for filling a password prompt or constructing multi-part input.
     *
     * @param text text to type
     */
    public void typeText(String text) {
        page.locator(TERMINAL_INPUT).click();
        page.locator(TERMINAL_INPUT).pressSequentially(text);
    }

    /**
     * Presses a single key or key combination in the terminal context.
     * Examples: {@code "Enter"}, {@code "Control+C"}, {@code "Tab"}.
     *
     * @param key Playwright key name or shortcut
     */
    public void pressKey(String key) {
        page.locator(TERMINAL_INPUT).click();
        page.keyboard().press(key);
    }

    // ── Terminal output ───────────────────────────────────────────────────────

    /**
     * Returns all non-empty lines currently visible in the terminal output.
     * Lines are read from the xterm.js DOM rows container.
     */
    public List<String> getTerminalLines() {
        return page.locator(TERMINAL_ROWS + " > div").all()
                .stream()
                .map(loc -> loc.textContent().trim())
                .filter(t -> !t.isEmpty())
                .collect(Collectors.toList());
    }

    /**
     * Returns the full terminal output as a single string with newlines
     * between each non-empty row.
     */
    public String getTerminalOutput() {
        return String.join("\n", getTerminalLines());
    }

    /**
     * Returns {@code true} if the terminal output currently contains
     * the given text (case-sensitive substring match).
     *
     * @param text text to search for in the terminal output
     */
    public boolean terminalOutputContains(String text) {
        return getTerminalOutput().contains(text);
    }

    /**
     * Waits until the terminal output contains the given text, up to
     * the specified timeout in milliseconds. Polls every 500 ms.
     *
     * @param text          expected text to appear in terminal output
     * @param timeoutMillis maximum wait time in milliseconds
     * @throws AssertionError if the text does not appear within the timeout
     */
    public void waitForOutputContaining(String text, long timeoutMillis) {
        page.waitForFunction(
                "([selector, expected]) => {"
                        + "  const rows = document.querySelector(selector);"
                        + "  if (!rows) return false;"
                        + "  return Array.from(rows.children)"
                        + "    .map(r => r.textContent || '')"
                        + "    .join('\\n')"
                        + "    .includes(expected);"
                        + "}",
                new Object[]{TERMINAL_ROWS, text},
                new Page.WaitForFunctionOptions().setTimeout(timeoutMillis)
        );
    }

    /**
     * Returns the terminal container {@link Locator} for assertions that need
     * to check visibility or bounding box of the xterm viewport.
     */
    public Locator terminalContainer() {
        return page.locator(".terminal.xterm");
    }
}