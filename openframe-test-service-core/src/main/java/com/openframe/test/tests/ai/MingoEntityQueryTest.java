package com.openframe.test.tests.ai;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.api.OrganizationApi;
import com.openframe.test.api.UserApi;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.organization.Organization;
import com.openframe.test.data.dto.user.AuthUser;
import com.openframe.test.data.generator.DeviceGenerator;
import com.openframe.test.helpers.ai.RunResult;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * AI assistant directory + web-research E2E (no machine required). These verify the assistant delegates to
 * the right read tool and surfaces real data: directory searches are checked against the product's own
 * org/user APIs (channel B), and the web case asserts the research tool was actually invoked (the one place
 * asserting <em>which</em> tool ran is legitimate — the point is that it did not answer from memory).
 *
 * <p>Immune to the searchMachines online-flap — no machine is involved.
 */
@Tag("ai")
@Tag("mingo")
@DisplayName("Mingo — directory & web")
public class MingoEntityQueryTest extends MingoBaseTest {


    @Tag("feature")
    @Test
    @Tag("directory")
    @DisplayName("Mingo finds an organization")
    public void testFindOrganization() {
        List<Organization> orgs = OrganizationApi.listOrganizations();
        assertThat(orgs).as("Tenant should have at least one organization").isNotEmpty();
        Organization target = orgs.getFirst();
        String name = target.getName();

        RunResult result = prompt("Search for organizations matching \"" + name + "\" and list what you find.");

        assertThat(toolInvoked(result, "searchOrganizations"))
                .as("Assistant should use the searchOrganizations tool, not answer from memory.\n%s", result)
                .isTrue();
        assertThat(result.finalText())
                .as("Reply should name the matching organization %s.\n%s", name, result)
                .containsIgnoringCase(name);
    }

    @Test
    @Tag("directory")
    @DisplayName("Mingo finds a user")
    public void testFindUser() {
        List<AuthUser> users = UserApi.getUsers();
        assertThat(users).as("Tenant should have at least one user").isNotEmpty();
        AuthUser target = users.getFirst();
        String email = target.getEmail();

        RunResult result = prompt("Search for platform users matching \"" + email + "\" and list what you find.");

        assertThat(toolInvoked(result, "searchUsers"))
                .as("Assistant should use the searchUsers tool, not answer from memory.\n%s", result)
                .isTrue();
        assertThat(result.finalText())
                .as("Reply should reference the matching user %s.\n%s", email, result)
                .containsIgnoringCase(email);
    }

    @Test
    @Tag("directory")
    @DisplayName("Mingo lists Windows machines")
    public void testListWindowsMachines() {
        // Ground truth from the device API: the currently-ONLINE Windows machines.
        List<Machine> onlineWindows = DeviceApi.getDevices(DeviceGenerator.onlineDevicesFilter()).stream()
                .filter(m -> m.getOsType() != null && m.getOsType().toLowerCase().contains("win"))
                .filter(m -> m.getHostname() != null && !m.getHostname().isBlank())
                .toList();
        assertThat(onlineWindows).as("Tenant should have at least one online Windows machine").isNotEmpty();

        RunResult result = prompt("List all Windows machines that are currently online.");

        assertThat(toolInvoked(result, "searchMachines"))
                .as("Assistant should use the searchMachines tool.\n%s", result)
                .isTrue();
        String reply = result.finalText() == null ? "" : result.finalText();
        for (Machine machine : onlineWindows) {
            assertThat(referencesMachine(reply, machine))
                    .as("Reply should reference online Windows machine %s (hostname, or an "
                                    + "@device: mention of id %s / machineId %s).\n%s",
                            machine.getHostname(), machine.getId(), machine.getMachineId(), result)
                    .isTrue();
        }
    }

    /**
     * Whether a reply identifies this machine — by hostname, or by one of its ids.
     *
     * <p>The assistant renders a device either as its hostname or as an {@code @device:<id>} mention
     * that the UI turns into a chip; both name the same machine, so either satisfies the case. Matching
     * on the bare id rather than the {@code @device:} prefix keeps this working if the mention syntax
     * changes again — what matters is that the right machine was named, not how it was decorated.
     */
    private static boolean referencesMachine(String reply, Machine machine) {
        return containsIgnoringCase(reply, machine.getHostname())
                || containsIgnoringCase(reply, machine.getId())
                || containsIgnoringCase(reply, machine.getMachineId());
    }

    private static boolean containsIgnoringCase(String haystack, String needle) {
        return needle != null && !needle.isBlank()
                && haystack.toLowerCase().contains(needle.toLowerCase());
    }

    @Test
    @Tag("web")
    @DisplayName("Mingo researches the web")
    @Disabled("TODO: review and fix later")
    public void testWebResearchInvoked() {
        RunResult result = prompt("Look up on the web the most recent CVE published this month for OpenSSH and"
                + " briefly say what it is. Use your web research tool to check current information.");

        assertThat(toolInvoked(result, "webSearch"))
                .as("Assistant should delegate to the webSearch tool rather than answer from training data.\n%s", result)
                .isTrue();
    }

    @Test
    @Tag("web")
    @DisplayName("Mingo looks up a current release")
    public void testWebResearchLatestRelease() {
        RunResult result = prompt("What is the latest stable release version of the Go programming language right"
                + " now? Use your web research tool to check the current version rather than answering from memory.");

        assertThat(toolInvoked(result, "webSearch"))
                .as("Assistant should delegate to the webSearch tool for a current-release lookup.\n%s", result)
                .isTrue();
    }

    // ---- helpers ----


    private boolean toolInvoked(RunResult result, String toolFunction) {
        return result.executedTools().stream()
                .anyMatch(d -> toolFunction.equals(d.getToolFunction()));
    }

    @AfterEach
    public void teardown() {
    }
}
