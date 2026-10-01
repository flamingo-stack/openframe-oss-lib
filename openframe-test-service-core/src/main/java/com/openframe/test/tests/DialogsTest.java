package com.openframe.test.tests;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.api.DialogApi;
import com.openframe.test.api.MessageApi;
import com.openframe.test.api.TicketApi;
import com.openframe.test.config.MachineConfig;
import com.openframe.test.data.dto.ai.AgentType;
import com.openframe.test.data.dto.ai.ChatType;
import com.openframe.test.data.dto.ai.DialogConnection;
import com.openframe.test.data.dto.ai.DialogFilterInput;
import com.openframe.test.data.dto.ai.DialogMode;
import com.openframe.test.data.dto.ai.DialogResponse;
import com.openframe.test.data.dto.ai.DialogStatistics;
import com.openframe.test.data.dto.ai.SendMessageRequest;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.ticket.Ticket;
import com.openframe.test.helpers.ai.AgentSession;
import com.openframe.test.helpers.ai.DialogFixture;
import com.openframe.test.helpers.ai.RunId;
import com.openframe.test.helpers.ai.SshMachineVerifier;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.util.List;
import java.util.Set;

import static com.openframe.test.data.generator.DeviceGenerator.osDevicesFilter;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

// Dialog management (CP-16) on an ADMIN dialog, then the mode, unread counter and status (CP-35) on a Fae dialog of the target box; no AI provider is involved.
@Tag("saas")
@DisplayName("Dialogs")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class DialogsTest extends BaseTest {

    private static final RunId RUN_ID = RunId.next();
    private static final Set<String> STATUSES = Set.of("ACTIVE", "ACTION_REQUIRED", "ON_HOLD", "RESOLVED", "ARCHIVED");

    private static DialogFixture dialog;
    private static Machine box;
    private static AgentSession agent;
    private static DialogFixture clientDialog;
    private static String clientTicketId;
    private static boolean directMode;
    private static boolean unreadMinted;

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

    @Tag("feature")
    @Tag("needs-device")
    @Test
    @DisplayName("Hand a Fae dialog to the technician by switching it to DIRECT mode")
    @Order(4)
    public void testSwitchToDirectMode() {
        assumeTrue(MachineConfig.isConfigured(), "No TARGET_* machine is configured; the Fae dialog needs the enrolled box");
        Machine found = DeviceApi.searchDevice(osDevicesFilter(MachineConfig.getOs().name()), MachineConfig.getHostname());
        box = found != null && MachineConfig.getHostname().equalsIgnoreCase(found.getHostname()) ? found : null;
        assumeTrue(box != null, "The box " + MachineConfig.getHostname() + " is not listed");

        agent = AgentSession.open(new SshMachineVerifier());
        assertThat(agent.getMachineId()).as("The agent identity is the listed box's").isEqualTo(box.getMachineId());
        clientDialog = DialogFixture.openClient();
        releaseAgent();
        clientTicketId = DialogApi.getDialogTicketId(clientDialog.getDialogId());
        assertThat(clientTicketId).as("A Fae dialog gets a ticket").isNotNull();

        String id = clientDialog.getDialogId();
        DialogResponse direct = DialogApi.updateDialogMode(id, DialogMode.DIRECT);
        directMode = true;
        assertThat(direct.getId()).as("The mode change keeps the id").isEqualTo(id);
        assertThat(direct.getAgentType()).as("It is the client's dialog").isEqualTo(AgentType.CLIENT);
        assertThat(direct.getCurrentMode()).as("The dialog is now DIRECT").isEqualTo(DialogMode.DIRECT);
        assertThat(direct.getStatus()).as("Switching the mode leaves the status ACTIVE").isEqualTo("ACTIVE");

        DialogResponse again = DialogApi.updateDialogMode(id, DialogMode.DIRECT);
        assertThat(again.getCurrentMode()).as("Asking for the current mode again is a no-op").isEqualTo(DialogMode.DIRECT);
        DialogResponse read = DialogApi.getDialog(id);
        assertThat(read.getCurrentMode()).as("GraphQL reads the DIRECT mode back").isEqualTo(DialogMode.DIRECT);
        assertThat(read.getUnreadMessageCount()).as("Nothing is unread for technicians yet").isZero();
    }

    @Tag("feature")
    @Tag("needs-device")
    @Test
    @DisplayName("A client message in a technician-held dialog is unread for technicians only")
    @Order(5)
    public void testClientMessageIsUnreadForTechnicians() {
        requireDirectMode();
        String id = clientDialog.getDialogId();
        // While the ticket is in AI_ASSISTANCE a client message is Fae's to answer and is not counted for technicians.
        Ticket held = TicketApi.transitionTicket(clientTicketId, TicketApi.resolveSystemStatusId("TECH_REQUIRED"));
        assertThat(held.getStatusDefinition().getKind()).as("The ticket is with the technicians").isEqualTo("TECH_REQUIRED");

        agent = AgentSession.open(new SshMachineVerifier());
        MessageApi.sendMessage(SendMessageRequest.builder()
                .dialogId(id).chatType(ChatType.CLIENT_CHAT).content("E2E-" + RUN_ID + " unread probe").build());
        DialogResponse clientView = DialogApi.getDialog(id);
        releaseAgent();
        assertThat(clientView.getUnreadMessageCount()).as("The sender's own side stays read").isZero();

        DialogResponse adminView = DialogApi.getDialog(id);
        assertThat(adminView.getUnreadMessageCount()).as("The client message is unread on the technician side").isEqualTo(1);
        assertThat(adminView.getCurrentMode()).as("The dialog stays DIRECT").isEqualTo(DialogMode.DIRECT);
        unreadMinted = true;
    }

    @Tag("feature")
    @Tag("needs-device")
    @Test
    @DisplayName("Mark the dialog's messages read as a technician")
    @Order(6)
    public void testMarkMessagesRead() {
        assumeTrue(unreadMinted, "No unread client message was minted in \"A client message in a technician-held dialog is unread for technicians only\"; see that failure");
        String id = clientDialog.getDialogId();
        DialogResponse marked = DialogApi.markDialogMessagesRead(id);
        assertThat(marked.getId()).as("The payload carries the dialog").isEqualTo(id);
        assertThat(marked.getUnreadMessageCount()).as("The technician side is zeroed in the payload").isZero();
        assertThat(DialogApi.getDialog(id).getUnreadMessageCount()).as("The zeroed counter reads back").isZero();

        DialogResponse repeated = DialogApi.markDialogMessagesRead(id);
        assertThat(repeated.getUnreadMessageCount()).as("Marking an already read dialog read again is harmless").isZero();
    }

    @Tag("feature")
    @Tag("needs-device")
    @Test
    @DisplayName("Put the Fae dialog on hold and resolve it through the status endpoint")
    @Order(7)
    public void testUpdateStatus() {
        requireDirectMode();
        String id = clientDialog.getDialogId();
        DialogResponse onHold = DialogApi.updateDialogStatus(id, "ON_HOLD");
        assertThat(onHold.getId()).as("The status change keeps the id").isEqualTo(id);
        assertThat(onHold.getStatus()).as("The dialog is ON_HOLD").isEqualTo("ON_HOLD");
        assertThat(onHold.getCurrentMode()).as("A status change leaves the mode alone").isEqualTo(DialogMode.DIRECT);
        assertThat(onHold.getResolvedAt()).as("An open dialog has no resolvedAt").isNull();

        DialogResponse resolved = DialogApi.updateDialogStatus(id, "RESOLVED");
        assertThat(resolved.getStatus()).as("The dialog is RESOLVED").isEqualTo("RESOLVED");
        assertThat(resolved.getResolvedAt()).as("Resolving stamps resolvedAt").isNotNull();
        assertThat(DialogApi.getDialog(id).getStatus()).as("GraphQL reads the RESOLVED status back").isEqualTo("RESOLVED");
    }

    private static void requireDirectMode() {
        assumeTrue(directMode, "No Fae dialog was switched to DIRECT in \"Hand a Fae dialog to the technician by switching it to DIRECT mode\"; see that failure");
    }

    // Drops the AGENT bearer so the next call runs as the admin again.
    private static void releaseAgent() {
        if (agent != null) {
            agent.close();
            agent = null;
        }
    }

    // A case that failed while acting as the agent leaves the bearer set; the next case must start as the admin.
    @AfterEach
    public void restoreAdmin() {
        releaseAgent();
    }

    @AfterAll
    public static void cleanup() {
        if (dialog != null) {
            dialog.cleanup();
        }
        // Resolves and archives the Fae dialog's ticket, then archives the dialog.
        if (clientDialog != null) {
            clientDialog.cleanup();
        }
    }
}
