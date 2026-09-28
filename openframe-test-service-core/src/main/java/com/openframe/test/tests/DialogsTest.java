package com.openframe.test.tests;

import com.openframe.test.api.DialogApi;
import com.openframe.test.data.dto.ai.DialogConnection;
import com.openframe.test.data.dto.ai.DialogFilterInput;
import com.openframe.test.data.dto.ai.DialogResponse;
import com.openframe.test.data.dto.ai.DialogStatistics;
import com.openframe.test.helpers.ai.DialogFixture;
import com.openframe.test.helpers.ai.RunId;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Dialog management over {@code chat/graphql} (coverage plan item CP-16): an ADMIN/AI dialog of this
 * run's own is renamed, listed, archived, unarchived, and the tenant's dialog statistics are read.
 * No message is sent, so no AI provider is involved.
 */
@Tag("saas")
@DisplayName("Dialogs")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class DialogsTest extends BaseTest {

    private static final RunId RUN_ID = RunId.next();
    private static final Set<String> STATUSES = Set.of("ACTIVE", "ACTION_REQUIRED", "ON_HOLD", "RESOLVED", "ARCHIVED");

    private static DialogFixture dialog;

    @Tag("feature")
    @Test
    @DisplayName("Rename a dialog and find it in the list")
    @Order(1)
    public void testRenameAndList() {
        dialog = DialogFixture.open();
        String title = "E2E-" + RUN_ID + " dialog";

        DialogResponse renamed = DialogApi.renameDialog(dialog.getDialogId(), title);
        assertThat(renamed.getId()).as("Renaming keeps the id").isEqualTo(dialog.getDialogId());
        assertThat(renamed.getTitle()).as("The title is stored").isEqualTo(title);
        assertThat(renamed.getStatus()).as("A fresh dialog is ACTIVE").isEqualTo("ACTIVE");

        DialogConnection mine = DialogApi.listDialogs(
                DialogFilterInput.builder().statuses(List.of("ACTIVE")).scope("MY").build(), 50, null);
        assertThat(mine.getPageInfo()).as("A connection carries pageInfo").isNotNull();
        assertThat(mine.ids()).as("The renamed dialog is among my active dialogs").contains(dialog.getDialogId());
        assertThat(mine.nodes()).allSatisfy(d -> assertThat(d.getStatus()).as("statuses filter is honoured").isEqualTo("ACTIVE"));

        DialogConnection searched = DialogApi.listDialogs(null, 50, RUN_ID.value());
        assertThat(searched.ids()).as("Search by the run id finds the dialog by its title").contains(dialog.getDialogId());
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Read the dialog statistics")
    @Order(2)
    public void testStatistics() {
        DialogStatistics stats = DialogApi.dialogStatistics();
        assertThat(stats.getTotalCount()).as("The tenant has dialogs (this class created one)").isGreaterThanOrEqualTo(1);
        assertThat(stats.getStatusCounts()).as("Counts per status are present").isNotEmpty();
        assertThat(stats.getStatusCounts()).allSatisfy(c -> {
            assertThat(c.getStatus()).as("Each count names a schema status").isIn(STATUSES);
            assertThat(c.getCount()).as("Counts are never negative").isGreaterThanOrEqualTo(0);
        });
        int sum = stats.getStatusCounts().stream().mapToInt(DialogStatistics.StatusCount::getCount).sum();
        assertThat(sum).as("Per-status counts never exceed the total").isLessThanOrEqualTo(stats.getTotalCount());
        assertThat(stats.getAverageResolutionTimeFormatted()).as("The average resolution time is formatted").isNotNull();
    }

    @Tag("feature")
    @Test
    @DisplayName("Archive and unarchive a dialog")
    @Order(3)
    public void testArchiveAndUnarchive() {
        assertThat(dialog).as("The dialog from the first case").isNotNull();
        String id = dialog.getDialogId();
        DialogApi.archiveDialog(id);
        assertThat(DialogApi.listDialogs(DialogFilterInput.builder().statuses(List.of("ARCHIVED")).scope("MY").build(), 50, RUN_ID.value()).ids())
                .as("An archived dialog is listed under ARCHIVED").contains(id);
        assertThat(DialogApi.listDialogs(DialogFilterInput.builder().statuses(List.of("ACTIVE")).scope("MY").build(), 50, RUN_ID.value()).ids())
                .as("An archived dialog is not listed under ACTIVE").doesNotContain(id);

        DialogResponse restored = DialogApi.unarchiveDialog(id);
        assertThat(restored.getId()).as("Unarchiving keeps the id").isEqualTo(id);
        assertThat(restored.getStatus()).as("An unarchived dialog is ACTIVE again").isEqualTo("ACTIVE");
        assertThat(DialogApi.listDialogs(DialogFilterInput.builder().statuses(List.of("ACTIVE")).scope("MY").build(), 50, RUN_ID.value()).ids())
                .as("The restored dialog is back under ACTIVE").contains(id);
    }

    @AfterAll
    public static void cleanup() {
        if (dialog != null) {
            dialog.cleanup();
        }
    }
}
