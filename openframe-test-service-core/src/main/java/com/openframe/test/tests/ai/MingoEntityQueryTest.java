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
@DisplayName("Mingo — directory & web")
public class MingoEntityQueryTest extends MingoBaseTest {


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
        // Ground truth from the device API: hostnames of the currently-ONLINE Windows machines.
        List<String> onlineWindowsHosts = DeviceApi.getDevices(DeviceGenerator.onlineDevicesFilter()).stream()
                .filter(m -> m.getOsType() != null && m.getOsType().toLowerCase().contains("win"))
                .map(Machine::getHostname)
                .filter(h -> h != null && !h.isBlank())
                .toList();
        assertThat(onlineWindowsHosts).as("Tenant should have at least one online Windows machine").isNotEmpty();

        RunResult result = prompt("List all Windows machines that are currently online.");

        assertThat(toolInvoked(result, "searchMachines"))
                .as("Assistant should use the searchMachines tool.\n%s", result)
                .isTrue();
        String reply = result.finalText() == null ? "" : result.finalText();
        for (String hostname : onlineWindowsHosts) {
            assertThat(reply)
                    .as("Reply should include online Windows machine %s.\n%s", hostname, result)
                    .containsIgnoringCase(hostname);
        }
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
