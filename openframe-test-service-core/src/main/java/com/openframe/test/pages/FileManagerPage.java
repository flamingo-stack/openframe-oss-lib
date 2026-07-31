package com.openframe.test.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Page Object for the File Manager page.
 * URL pattern: /devices/details/{id}/file-manager/
 * <p>
 * Opened from DeviceDetailsPage by clicking "Manage Files".
 * Provides a remote file browser with breadcrumb navigation, a file/folder
 * table (NAME / SIZE / EDITED columns), toolbar actions, and a per-row
 * context menu (Copy / Rename / Cut / Delete).
 */
public class FileManagerPage {

    private final Page page;

    // ── Selectors ─────────────────────────────────────────────────────────────

    /**
     * "Back to Device" navigation button.
     */
    private static final String BACK_BTN = "main button:has-text('Back to Device')";

    /**
     * Page heading ("File Manager").
     */
    private static final String PAGE_HEADING = "main h1";

    /**
     * Radix {@code DropdownMenuContent} — a DIV with {@code role="menu"}.
     * <p>
     * The DIV qualifier is load-bearing: the app shell also mounts a media-chrome
     * video player whose {@code <media-rendition-menu>},
     * {@code <media-playback-rate-menu>}, {@code <media-audio-track-menu>} and
     * {@code <media-captions-menu>} custom elements each carry {@code role="menu"}
     * permanently, so a bare {@code [role='menu']} resolves to 5 elements and
     * fails every strict locator call.
     */
    private static final String MENU = "div[role='menu']";

    /**
     * Device name subtitle below the heading.
     */
    private static final String DEVICE_NAME = "main h1 + div";

    /**
     * Breadcrumb {@code <nav>} element.
     * Contains one {@code <button>} per path segment separated by SVG chevrons.
     */
    private static final String BREADCRUMB_NAV = "main nav";

    // ── Toolbar buttons ───────────────────────────────────────────────────────

    private static final String NEW_FOLDER_BTN = "main button:has-text('New Folder')";
    private static final String COPY_BTN = "main button:has-text('Copy')";
    private static final String CUT_BTN = "main button:has-text('Cut')";
    private static final String PASTE_BTN = "main button:has-text('Paste')";
    private static final String UPLOAD_BTN = "main button:has-text('Upload')";
    private static final String SELECT_ALL_BTN = "main button:has-text('Select All')";

    /**
     * Hidden {@code <input type="file">} wired to the Upload button.
     */
    private static final String FILE_INPUT = "main input[type='file']";

    /**
     * Search input inside the file table area.
     */
    private static final String SEARCH_INPUT = "main input[placeholder='Search...']";

    /**
     * Header row checkbox (select-all toggle).
     * {@code aria-checked="true"} when all visible rows are selected.
     */
    private static final String HEADER_CHECKBOX =
            "main .bg-ods-bg-secondary [role='checkbox']";

    // ── Table rows ────────────────────────────────────────────────────────────

    /**
     * All file/folder row containers inside the table body.
     * The table is a custom-div grid with no {@code <table>} element;
     * rows sit inside the second child of the {@code .bg-ods-bg.rounded-lg} card.
     */
    private static final String ROW_CONTAINER = "main .bg-ods-bg.rounded-lg > div:nth-child(2) > div";

    // ── Constructor ───────────────────────────────────────────────────────────

    public FileManagerPage(Page page) {
        this.page = page;
    }

    // ── Header ────────────────────────────────────────────────────────────────

    /**
     * Returns the page heading text ("File Manager").
     */
    public String getPageHeading() {
        return page.locator(PAGE_HEADING).innerText().trim();
    }

    /**
     * Returns the device name shown below the heading (e.g. "vm114267").
     */
    public String getDeviceName() {
        return page.locator(DEVICE_NAME).innerText().trim();
    }

    /**
     * Clicks "Back to Device".
     */
    public void clickBackToDevice() {
        page.locator(BACK_BTN).click();
    }

    // ── Breadcrumb ────────────────────────────────────────────────────────────

    /**
     * Returns the ordered list of breadcrumb segment labels,
     * e.g. {@code ["Root", "C:", "$Recycle.Bin"]}.
     */
    public List<String> getBreadcrumbSegments() {
        return page.locator(BREADCRUMB_NAV + " button").all()
                .stream()
                .map(loc -> loc.textContent().trim())
                .collect(Collectors.toList());
    }

    /**
     * Returns the last breadcrumb segment label — the currently displayed folder
     * (e.g. "Root", "C:", "$Recycle.Bin").
     */
    public String getCurrentFolder() {
        Locator segments = page.locator(BREADCRUMB_NAV + " button");
        int count = segments.count();
        return count > 0 ? segments.nth(count - 1).textContent().trim() : "";
    }

    /**
     * Clicks the breadcrumb segment with the given label to navigate to that
     * level (e.g. "Root" or "C:").
     *
     * @param segmentLabel exact text of the breadcrumb button
     */
    public void clickBreadcrumb(String segmentLabel) {
        page.locator(BREADCRUMB_NAV + " button")
                .filter(new Locator.FilterOptions().setHasText(segmentLabel))
                .click();
    }

    // ── Search ────────────────────────────────────────────────────────────────

    /**
     * Types into the search input to filter the file list.
     */
    public void search(String query) {
        page.locator(SEARCH_INPUT).fill(query);
    }

    /**
     * Clears the search input.
     */
    public void clearSearch() {
        page.locator(SEARCH_INPUT).clear();
    }

    // ── Toolbar actions ───────────────────────────────────────────────────────

    /**
     * Clicks "New Folder".
     */
    public void clickNewFolder() {
        page.locator(NEW_FOLDER_BTN).click();
    }

    /**
     * Returns {@code true} when the "Copy" button is enabled
     * (i.e. at least one item is selected).
     */
    public boolean isCopyEnabled() {
        return page.locator(COPY_BTN).isEnabled();
    }

    /**
     * Clicks the toolbar "Copy" button (requires ≥1 selection).
     */
    public void clickCopy() {
        page.locator(COPY_BTN).click();
    }

    /**
     * Returns {@code true} when the "Cut" button is enabled
     * (i.e. at least one item is selected).
     */
    public boolean isCutEnabled() {
        return page.locator(CUT_BTN).isEnabled();
    }

    /**
     * Clicks the toolbar "Cut" button (requires ≥1 selection).
     */
    public void clickCut() {
        page.locator(CUT_BTN).click();
    }

    /**
     * Clicks the toolbar "Paste" button.
     */
    public void clickPaste() {
        page.locator(PASTE_BTN).click();
    }

    /**
     * Triggers file upload by setting the given local file path on the hidden
     * file input element. This avoids opening the native file picker.
     *
     * @param absoluteFilePath absolute path to the file to upload
     */
    public void uploadFile(String absoluteFilePath) {
        page.locator(FILE_INPUT).setInputFiles(java.nio.file.Paths.get(absoluteFilePath));
    }

    /**
     * Clicks "Select All" to check every visible row's checkbox.
     */
    public void clickSelectAll() {
        page.locator(SELECT_ALL_BTN).click();
    }

    // ── Select-all header checkbox ────────────────────────────────────────────

    /**
     * Returns {@code true} if the header checkbox (select-all) is checked,
     * meaning all visible items are selected.
     */
    public boolean isHeaderCheckboxChecked() {
        return "true".equals(
                page.locator(HEADER_CHECKBOX).getAttribute("aria-checked"));
    }

    /**
     * Clicks the header checkbox to toggle selection of all visible rows.
     */
    public void clickHeaderCheckbox() {
        page.locator(HEADER_CHECKBOX).click();
    }

    // ── File / folder rows ────────────────────────────────────────────────────

    /**
     * Returns the number of file/folder rows currently visible in the table.
     */
    public int getRowCount() {
        return page.locator(ROW_CONTAINER).count();
    }

    /**
     * Returns the name of the entry at the given 0-based row index.
     * Names are in column 1 (index 1) of the 5-column row layout.
     *
     * @param rowIndex 0-based index
     */
    public String getRowName(int rowIndex) {
        return rowName(rowIndex).innerText().trim();
    }

    /**
     * Name-cell locator for a row. {@code .first()} because the cell also holds
     * the file-type icon's own {@code <span>} on some entry types — without it
     * the locator is a strict-mode violation rather than a name lookup.
     */
    private Locator rowName(int rowIndex) {
        return page.locator(ROW_CONTAINER).nth(rowIndex)
                .locator("div:nth-child(2) span")
                .first();
    }

    /**
     * Returns the EDITED date string of the row at the given 0-based index,
     * e.g. "03/18/2026 17:57". Returns an empty string for folders with no date.
     *
     * @param rowIndex 0-based index
     */
    public String getRowEditedDate(int rowIndex) {
        return page.locator(ROW_CONTAINER).nth(rowIndex)
                .locator("div:nth-child(4)")
                .innerText()
                .trim();
    }

    /**
     * Returns the SIZE value of the row at the given 0-based index.
     * Empty for directories.
     *
     * @param rowIndex 0-based index
     */
    public String getRowSize(int rowIndex) {
        return page.locator(ROW_CONTAINER).nth(rowIndex)
                .locator("div:nth-child(3)")
                .innerText()
                .trim();
    }

    /**
     * Returns the names of all entries currently visible in the table.
     */
    public List<String> getAllRowNames() {
        int count = getRowCount();
        List<String> names = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            names.add(getRowName(i));
        }
        return names;
    }

    // ── Row checkbox ──────────────────────────────────────────────────────────

    /**
     * Returns {@code true} if the row at the given 0-based index is checked.
     */
    public boolean isRowChecked(int rowIndex) {
        return "true".equals(
                page.locator(ROW_CONTAINER).nth(rowIndex)
                        .locator("[role='checkbox']")
                        .getAttribute("aria-checked"));
    }

    /**
     * Clicks the checkbox of the row at the given 0-based index to
     * toggle its selection.
     */
    public void clickRowCheckbox(int rowIndex) {
        page.locator(ROW_CONTAINER).nth(rowIndex)
                .locator("[role='checkbox']")
                .click();
    }

    // ── Row navigation ────────────────────────────────────────────────────────

    /**
     * Clicks the chevron (navigate-into) button of the row at the given
     * 0-based index to open that folder.
     */
    public void enterFolder(int rowIndex) {
        page.locator(ROW_CONTAINER).nth(rowIndex)
                .locator("button[type='submit']")
                .click();
    }

    /**
     * Enters the folder whose name matches the given text.
     *
     * @param folderName exact display name (e.g. "Program Files")
     */
    public void enterFolderByName(String folderName) {
        page.locator(ROW_CONTAINER)
                .filter(new Locator.FilterOptions().setHasText(folderName))
                .locator("button[type='submit']")
                .click();
    }

    // ── Row context menu ──────────────────────────────────────────────────────

    /**
     * Opens the ⋯ context menu for the row at the given 0-based index.
     * The menu contains: Copy, Rename, Cut, Delete.
     */
    public void openRowContextMenu(int rowIndex) {
        page.locator(ROW_CONTAINER).nth(rowIndex)
                .locator("button[type='button']")
                .click();
        page.locator(MENU).waitFor();
    }

    /**
     * Opens the ⋯ context menu for the row whose name matches the given text.
     */
    public void openRowContextMenuByName(String name) {
        page.locator(ROW_CONTAINER)
                .filter(new Locator.FilterOptions().setHasText(name))
                .locator("button[type='button']")
                .click();
        page.locator(MENU).waitFor();
    }

    /**
     * Clicks a context menu item by label.
     * Call {@link #openRowContextMenu(int)} first.
     * Valid labels: "Copy", "Rename", "Cut", "Delete".
     *
     * @param label exact menu item text
     */
    public void clickContextMenuItem(String label) {
        page.locator(MENU + " [role='menuitem']")
                .filter(new Locator.FilterOptions().setHasText(label))
                .click();
    }

    /**
     * Convenience: opens the context menu for the named row and clicks the
     * given item in one call.
     *
     * @param rowName  exact display name of the entry
     * @param menuItem "Copy", "Rename", "Cut", or "Delete"
     */
    public void performContextAction(String rowName, String menuItem) {
        openRowContextMenuByName(rowName);
        clickContextMenuItem(menuItem);
    }

    /**
     * Same condition as before — at least one row, and its name is non-empty —
     * but evaluated without ever blocking.
     * <p>
     * This is polled by {@link Page#waitForCondition} (see
     * {@code DeviceDetailsPage.openFileManager}), so it must not call an
     * auto-waiting accessor: while the remote listing is still in flight the
     * name cell does not exist, and {@code getRowName(0)} would turn one poll
     * into a 30s timeout thrown out of the wait instead of the wait simply not
     * being satisfied yet. {@code count()} does not wait, and once it is
     * non-zero the element exists, so {@code innerText()} returns immediately.
     */
    public boolean isLoaded() {
        if (getRowCount() == 0) {
            return false;
        }
        Locator name = rowName(0);
        return name.count() > 0 && !name.innerText().trim().isEmpty();
    }
}