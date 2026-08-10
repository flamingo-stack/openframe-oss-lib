package com.openframe.test.tests.ai;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.api.MonitoringApi;
import com.openframe.test.data.dto.device.DeviceStatus;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.policy.CreatePolicyRequest;
import com.openframe.test.data.dto.policy.Policy;
import com.openframe.test.data.dto.policy.ScheduledQuery;
import com.openframe.test.data.generator.MonitoringGenerator;
import com.openframe.test.helpers.ai.RunId;
import com.openframe.test.helpers.ai.RunResult;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static com.openframe.test.data.generator.DeviceGenerator.getFleetId;
import static com.openframe.test.data.generator.DeviceGenerator.osAndStatusDevicesFilter;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * AI assistant Fleet MDM E2E (no machine command required): the assistant creates/updates/assigns/deletes
 * Fleet policies via its bulk MDM tools (each a mutation requiring an ADMIN approval, auto-approved by the
 * runner), verified through the Fleet MDM server's own policy API ({@link MonitoringApi}). Assertions are on
 * the persisted policy, never on the assistant's prose.
 *
 * <p>Immune to the searchMachines online-flap — no machine command is involved (POL-03 references a device
 * only to resolve its Fleet host id).
 */
@Tag("ai")
@Tag("mingo")
@DisplayName("Mingo — Fleet MDM")
public class MingoMdmTest extends MingoBaseTest {

    private final List<Integer> policyIds = new ArrayList<>();
    private final List<Integer> queryIds = new ArrayList<>();

    @Tag("feature")
    @Test
    @Tag("mdm")
    @DisplayName("Mingo creates a policy")
    public void testPolicyCreate() {
        RunId runId = RunId.next();
        String name = "E2E-" + runId;

        RunResult result = prompt("Create a Fleet MDM policy named exactly \"" + name + "\" that checks whether"
                + " the operating system major version is at least 10, using an osquery SQL query.");

        Policy policy = MonitoringGenerator.findPolicyByName(MonitoringApi.getPolicies(), name).orElse(null);
        assertThat(policy).as("A Fleet policy named %s should exist.\n%s", name, result).isNotNull();
        policyIds.add(policy.getId());
        assertThat(policy.getQuery()).as("Policy should carry a non-empty query.\n%s", result).isNotBlank();
    }

    @Test
    @Tag("mdm")
    @DisplayName("Mingo updates a policy")
    public void testPolicyUpdate() {
        RunId runId = RunId.next();
        String name = "E2E-" + runId;
        Policy seed = seedPolicy(name);
        String desc = "UPDATED-" + runId;

        RunResult result = prompt("Update the Fleet MDM policy named \"" + name
                + "\" so that its description is exactly " + desc + ".");

        Policy after = MonitoringApi.getPolicy(seed.getId());
        assertThat(after).as("Original policy id should still exist.\n%s", result).isNotNull();
        assertThat(after.getDescription())
                .as("Policy %s description should be updated.\n%s", seed.getId(), result)
                .contains(desc);
    }

    @Test
    @Tag("mdm")
    @DisplayName("Mingo assigns exactly one host to a policy")
    public void testPolicyAssignHost() {
        RunId runId = RunId.next();
        Machine target = onlineWindowsDevice();
        Integer fleetId = Integer.valueOf(getFleetId(target));
        String name = "E2E-" + runId;
        Policy seed = seedPolicy(name);

        RunResult result = prompt("Assign the machine " + target.getHostname()
                + " to the Fleet MDM policy named \"" + name + "\".");

        Policy after = MonitoringApi.getPolicy(seed.getId());
        assertThat(after.getHostsIncludeAny())
                .as("Exactly the target host should be assigned to the policy.\n%s", result)
                .hasSize(1);
        assertThat(after.getHostsIncludeAny().getFirst().getId())
                .as("Assigned host should be the target's Fleet host id %s.\n%s", fleetId, result)
                .isEqualTo(fleetId);
    }

    @Test
    @Tag("mdm")
    @DisplayName("Mingo deletes only the target policy")
    public void testPolicyDeleteScoping() {
        RunId runId = RunId.next();
        Policy target = seedPolicy("E2E-" + runId + "-target");
        Policy control = seedPolicy("E2E-" + runId + "-control");

        RunResult result = prompt("Delete the Fleet MDM policy named \"E2E-" + runId
                + "-target\". Do not touch any other policy.");

        List<Policy> all = MonitoringApi.getPolicies();
        boolean targetPresent = all.stream().anyMatch(p -> target.getId().equals(p.getId()));
        boolean controlPresent = all.stream().anyMatch(p -> control.getId().equals(p.getId()));
        assertThat(targetPresent).as("Target policy should be deleted.\n%s", result).isFalse();
        assertThat(controlPresent).as("Control policy must survive.\n%s", result).isTrue();
    }

    @Test
    @Tag("mdm")
    @DisplayName("Mingo creates a scheduled query")
    public void testScheduledQueryCreate() {
        RunId runId = RunId.next();
        String name = "E2E-" + runId;

        RunResult result = prompt("Create a Fleet MDM scheduled query named exactly \"" + name
                + "\" that runs the osquery SQL 'SELECT hostname FROM system_info' every hour (3600 seconds).");

        ScheduledQuery query = MonitoringApi.getScheduledQueries().stream()
                .filter(q -> name.equals(q.getName()))
                .findFirst()
                .orElse(null);
        assertThat(query).as("A scheduled query named %s should exist.\n%s", name, result).isNotNull();
        queryIds.add(query.getId());
        assertThat(query.getQuery()).as("Scheduled query should carry SQL.\n%s", result).isNotBlank();
        assertThat(query.getInterval())
                .as("Scheduled query should have a positive interval (i.e. be scheduled).\n%s", result)
                .isNotNull().isGreaterThan(0);
    }

    @Test
    @Tag("mdm")
    @DisplayName("Mingo deletes only the target query")
    public void testScheduledQueryDeleteScoping() {
        RunId runId = RunId.next();
        ScheduledQuery target = seedQuery("E2E-" + runId + "-target");
        ScheduledQuery control = seedQuery("E2E-" + runId + "-control");

        RunResult result = prompt("Delete the Fleet MDM scheduled query named \"E2E-" + runId
                + "-target\". Do not touch any other scheduled query.");

        List<ScheduledQuery> all = MonitoringApi.getScheduledQueries();
        boolean targetPresent = all.stream().anyMatch(q -> target.getId().equals(q.getId()));
        boolean controlPresent = all.stream().anyMatch(q -> control.getId().equals(q.getId()));
        assertThat(targetPresent).as("Target scheduled query should be deleted.\n%s", result).isFalse();
        assertThat(controlPresent).as("Control scheduled query must survive.\n%s", result).isTrue();
    }

    // ---- helpers ----


    /** Seeds a Fleet policy directly (setup, not under test) and registers it for cleanup. */
    private Policy seedPolicy(String name) {
        Policy policy = MonitoringApi.createPolicy(CreatePolicyRequest.builder()
                .name(name)
                .description("e2e seed")
                .query("SELECT major FROM os_version WHERE major >= 10")
                .build());
        policyIds.add(policy.getId());
        return policy;
    }

    /** Seeds a Fleet scheduled query directly (setup, not under test) and registers it for cleanup. */
    private ScheduledQuery seedQuery(String name) {
        ScheduledQuery query = MonitoringApi.createScheduledQuery(name, "SELECT hostname FROM system_info", 3600);
        queryIds.add(query.getId());
        return query;
    }

    private Machine onlineWindowsDevice() {
        List<Machine> devices = DeviceApi.getDevices(osAndStatusDevicesFilter("WINDOWS", DeviceStatus.ONLINE));
        assertThat(devices).as("Expected at least one online Windows device with a Fleet connection").isNotEmpty();
        return DeviceApi.getDevice(devices.getFirst().getMachineId());
    }

    @AfterEach
    public void teardown() {
        // Delete each individually and swallow everything (incl. AssertionError from a 200-status check):
        // a policy the assistant already deleted returns 500, and cleanup must never fail the test.
        for (Integer id : policyIds) {
            try {
                MonitoringApi.deletePolicy(id);
            } catch (Throwable ignored) {
                // best-effort (target may already be deleted)
            }
        }
        policyIds.clear();
        for (Integer id : queryIds) {
            try {
                MonitoringApi.deleteScheduledQuery(id);
            } catch (Throwable ignored) {
                // best-effort (target may already be deleted)
            }
        }
        queryIds.clear();
    }
}
