package com.openframe.test.tests;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.api.ScriptApi;
import com.openframe.test.api.ScriptScheduleApi;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.schedule.ScheduleDeviceCriteriaInput;
import com.openframe.test.data.dto.schedule.ScheduleDeviceEdge;
import com.openframe.test.data.dto.schedule.ScheduleDevices;
import com.openframe.test.data.dto.schedule.ScriptSchedule;
import com.openframe.test.data.dto.script.Script;
import com.openframe.test.data.dto.shared.GraphqlError;
import com.openframe.test.data.generator.DeviceGenerator;
import com.openframe.test.data.generator.ScriptGenerator;
import com.openframe.test.data.generator.ScriptScheduleGenerator;
import com.openframe.test.helpers.ai.RunId;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.time.Duration;
import java.util.List;

import static com.openframe.test.data.generator.ScriptScheduleGenerator.nextSlot;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Device targeting on a script schedule (coverage plan item CP-2): the pickers, incremental and
 * bulk assign/unassign, full replacement, criteria-based selection, and the platform-mismatch
 * rejection. The schedule's slot is a day away and it is deleted afterwards, so assigning a real
 * device to it never dispatches anything.
 */
@Slf4j
@Tag("saas")
@DisplayName("Script schedule devices")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class ScriptScheduleDevicesTest extends BaseTest {

    private static final RunId RUN_ID = RunId.next();
    private static final String NAME = "E2E-" + RUN_ID + " targeting";
    private static final int PAGE = 50;

    private static Machine device;
    private static Script script;
    private static Script otherScript;
    private static ScriptSchedule schedule;
    private static ScriptSchedule mismatched;

    /** Prefer the enrolled Windows box; fall back to any listed device (a shared tenant may lead with a Mac). */
    @BeforeAll
    public static void pickDevice() {
        device = DeviceApi.getAnyDevice(
                pipelineScoped(DeviceGenerator.osDevicesFilter("WINDOWS")),
                pipelineScoped(DeviceGenerator.listedStatusesDevicesFilter()));
    }

    @Tag("feature")
    @Test
    @DisplayName("Assign a device to a script schedule")
    @Order(1)
    public void testAssignDevice() {
        requireDevice();
        // A schedule's platforms must be supported by every script it runs, so the script is built
        // for the device's OS (the server rejects the schedule otherwise, not the assignment).
        script = ScriptApi.createScript(ScriptGenerator.createScriptRequest(device.getOsType()));
        schedule = ScriptScheduleApi.createSchedule(ScriptScheduleGenerator.dateTimeSchedule(
                NAME, script.getId(), nextSlot(Duration.ofDays(1)), null, List.of(device.getOsType())));
        assertThat(schedule.getDeviceCount()).as("A new schedule has no devices").isZero();

        ScheduleDevices before = ScriptScheduleApi.getScheduleDevices(schedule.getId(), device.getHostname(), PAGE);
        assertThat(before.getAssignedDevices().ids()).as("Nothing is assigned yet").doesNotContain(device.getId());
        ScheduleDeviceEdge offered = before.getAvailableDevices().edgeFor(device.getId())
                .orElseThrow(() -> new AssertionError("The picker should offer " + device.getHostname() + " (" + device.getOsType() + ")"));
        assertThat(offered.getAssigned()).as("An unassigned device is offered with assigned=false").isFalse();

        ScriptSchedule assigned = ScriptScheduleApi.addDevices(schedule.getId(), List.of(device.getId()));
        assertThat(assigned.getDeviceCount()).as("deviceCount after assigning one device").isEqualTo(1);

        ScheduleDevices after = ScriptScheduleApi.getScheduleDevices(schedule.getId(), device.getHostname(), PAGE);
        assertThat(after.getDeviceCount()).as("deviceCount is persisted").isEqualTo(1);
        assertThat(after.getAssignedDevices().ids()).as("The device is in assignedDevices").contains(device.getId());
        assertThat(after.getAvailableDevices().edgeFor(device.getId()).map(ScheduleDeviceEdge::getAssigned))
                .as("The picker edge flips to assigned=true").contains(true);

        assertThat(ScriptScheduleApi.addDevices(schedule.getId(), List.of(device.getId())).getDeviceCount())
                .as("Assigning the same device again is idempotent").isEqualTo(1);
    }

    @Tag("feature")
    @Test
    @DisplayName("Unassign a device from a script schedule")
    @Order(2)
    public void testUnassignDevice() {
        requireSchedule();
        ScriptSchedule removed = ScriptScheduleApi.removeDevices(schedule.getId(), List.of(device.getId()));
        assertThat(removed.getDeviceCount()).as("deviceCount after unassigning").isZero();
        assertThat(ScriptScheduleApi.getScheduleDevices(schedule.getId(), device.getHostname(), PAGE).getAssignedDevices().ids())
                .as("The device left assignedDevices").doesNotContain(device.getId());
        assertThat(ScriptScheduleApi.removeDevices(schedule.getId(), List.of(device.getId())).getDeviceCount())
                .as("Unassigning a device that is not assigned is a no-op").isZero();
    }

    @Tag("feature")
    @Test
    @DisplayName("Assign and unassign every device matching a search")
    @Order(3)
    public void testAssignAllBySearch() {
        requireSchedule();
        ScriptSchedule added = ScriptScheduleApi.addAllDevices(schedule.getId(), null, device.getHostname());
        assertThat(added.getDeviceCount()).as("Add-all by hostname search assigns at least our device").isGreaterThanOrEqualTo(1);
        assertThat(ScriptScheduleApi.getScheduleDevices(schedule.getId(), device.getHostname(), PAGE).getAssignedDevices().ids())
                .as("Our device is among the assigned").contains(device.getId());

        ScriptSchedule cleared = ScriptScheduleApi.removeAllDevices(schedule.getId(), null, null);
        assertThat(cleared.getDeviceCount()).as("Remove-all with no filter clears the whole assignment").isZero();
    }

    @Tag("feature")
    @Test
    @DisplayName("Replace the device set of a script schedule")
    @Order(4)
    public void testReplaceDeviceSet() {
        requireSchedule();
        assertThat(ScriptScheduleApi.setDevices(schedule.getId(), List.of(device.getId())).getDeviceCount())
                .as("Setting one device yields exactly one").isEqualTo(1);
        assertThat(ScriptScheduleApi.setDevices(schedule.getId(), List.of()).getDeviceCount())
                .as("Setting an empty set clears the assignment (PUT semantics)").isZero();
    }

    @Tag("feature")
    @Test
    @DisplayName("Select devices by criteria")
    @Order(5)
    public void testSelectByCriteria() {
        requireSchedule();
        ScheduleDeviceCriteriaInput.ScheduleDeviceCriteriaInputBuilder rule = ScheduleDeviceCriteriaInput.builder()
                .osTypes(List.of(device.getOsType()));
        if (device.getOrganizationId() != null) {
            rule.organizationIds(List.of(device.getOrganizationId()));
        }
        ScriptSchedule byCriteria = ScriptScheduleApi.setDeviceCriteria(schedule.getId(), rule.build());

        assertThat(byCriteria.getSelectionMode()).as("The schedule switches to CRITERIA selection").isEqualTo("CRITERIA");
        assertThat(byCriteria.getDeviceCriteria()).as("The rule is echoed back").isNotNull();
        assertThat(byCriteria.getDeviceCriteria().getOsTypes()).as("The OS rule is stored").containsExactly(device.getOsType());
        assertThat(byCriteria.getDeviceCount()).as("A live rule matching our device resolves to at least one device")
                .isGreaterThanOrEqualTo(1);

        ScheduleDevices resolved = ScriptScheduleApi.getScheduleDevices(schedule.getId(), device.getHostname(), PAGE);
        assertThat(resolved.getSelectionMode()).as("CRITERIA is persisted").isEqualTo("CRITERIA");
        assertThat(resolved.getAssignedDevices().ids()).as("The rule resolves to our device").contains(device.getId());
    }

    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("Rejects a device outside the schedule's platforms")
    @Order(6)
    public void testRejectsPlatformMismatch() {
        requireSchedule();
        String otherOs = ScriptScheduleGenerator.otherPlatform(device.getOsType());
        otherScript = ScriptApi.createScript(ScriptGenerator.createScriptRequest(otherOs));
        mismatched = ScriptScheduleApi.createSchedule(ScriptScheduleGenerator.dateTimeSchedule(
                NAME + " " + otherOs, otherScript.getId(), nextSlot(Duration.ofDays(1)), null, List.of(otherOs)));

        List<GraphqlError> errors = ScriptScheduleApi.attemptAddDevicesErrors(mismatched.getId(), List.of(device.getId()));
        assertThat(errors).as("Assigning a " + device.getOsType() + " device to a " + otherOs + " schedule is rejected").isNotEmpty();
        assertThat(errors.getFirst().getMessage()).as("The rejection carries a message").isNotBlank();
        assertThat(ScriptScheduleApi.getSchedule(mismatched.getId()).getDeviceCount())
                .as("The rejected device was not assigned").isZero();
        assertThat(ScriptScheduleApi.getScheduleDevices(mismatched.getId(), device.getHostname(), PAGE).getAvailableDevices().ids())
                .as("The picker never offers a device of the wrong platform").doesNotContain(device.getId());
    }

    @AfterAll
    public static void cleanup() {
        for (ScriptSchedule s : new ScriptSchedule[]{schedule, mismatched}) {
            if (s == null) {
                continue;
            }
            try {
                ScriptScheduleApi.removeAllDevices(s.getId(), null, null);
            } catch (RuntimeException | AssertionError e) {
                log.warn("Failed to clear the devices of schedule {}: {}", s.getId(), e.getMessage());
            }
            try {
                ScriptScheduleApi.deleteSchedule(s.getId());
            } catch (RuntimeException | AssertionError e) {
                log.warn("Failed to delete schedule {} — it is left in the tenant: {}", s.getId(), e.getMessage());
            }
        }
        for (Script s : new Script[]{script, otherScript}) {
            if (s == null) {
                continue;
            }
            try {
                ScriptApi.deleteScript(s.getId());
            } catch (RuntimeException | AssertionError e) {
                log.warn("Failed to delete script {} — it is left in the tenant: {}", s.getId(), e.getMessage());
            }
        }
    }

    private static void requireDevice() {
        assumeTrue(device != null && device.getId() != null,
                "No device to target" + orgSuffix() + "; device targeting needs an enrolled machine");
    }

    private static void requireSchedule() {
        requireDevice();
        assumeTrue(schedule != null && schedule.getId() != null,
                "No schedule was created in \"Assign a device to a script schedule\"; see that failure");
    }
}
