package com.openframe.test.tests;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.api.ScriptApi;
import com.openframe.test.data.dto.device.DeviceStatus;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.script.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static com.openframe.test.data.generator.DeviceGenerator.getTacticalId;
import static com.openframe.test.data.generator.DeviceGenerator.osAndStatusDevicesFilter;
import static com.openframe.test.data.generator.ScriptGenerator.createOnlineCheckSchedule;
import static com.openframe.test.data.generator.ScriptGenerator.runSpeedTestScriptRequest;
import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Run Script")
public class RunScriptTest extends BaseTest {

    @Tag("device")
    @Test
    @DisplayName("Bulk run script")
    public void testBulkRun() {
        List<Machine> devices = DeviceApi.getDevices(osAndStatusDevicesFilter("WINDOWS", DeviceStatus.ONLINE));
        assertThat(devices).as("Expect Windows device online").isNotEmpty();
        Machine device = DeviceApi.getDevice(devices.getFirst().getMachineId());
        assertThat(device.getToolConnections()).as("Device should have agents").isNotEmpty();
        String tacticalId = getTacticalId(device);
        assertThat(tacticalId).as("Device should have Tactical").isNotEmpty();
        RunScriptRequest runScriptRequest = runSpeedTestScriptRequest(tacticalId);
        String runScriptResponse = ScriptApi.runScript(runScriptRequest);
        assertThat(runScriptResponse).as("Expect script execution started").contains("will now be run");
    }

    @Tag("device")
    @Test
    @DisplayName("Schedule script")
    public void testScheduleScript() {
        List<Machine> devices = DeviceApi.getDevices(osAndStatusDevicesFilter("WINDOWS", DeviceStatus.ONLINE));
        assertThat(devices).as("Expect Windows device online").isNotEmpty();
        Machine device = DeviceApi.getDevice(devices.getFirst().getMachineId());
        assertThat(device.getToolConnections()).as("Device should have agents").isNotEmpty();
        String tacticalId = getTacticalId(device);
        assertThat(tacticalId).as("Device should have Tactical").isNotEmpty();
        CreateScriptScheduleRequest scheduleRequest = createOnlineCheckSchedule();
        ScriptSchedule scriptSchedule = ScriptApi.createScriptSchedule(scheduleRequest);
        assertThat(scriptSchedule.getId()).as("Script scheduled").isNotNull();
        ScheduleAssignDeviceResponse assignDeviceResponse = ScriptApi.scheduleAssignDevice(scriptSchedule.getId(), tacticalId);
        assertThat(assignDeviceResponse.getAgentsCount()).as("Assigned agents not zero").isNotZero();
        assertThat(assignDeviceResponse.getTaskResultsCreated()).as("Assigned task not zero").isNotZero();
    }

    @Tag("scheduled")
    @Test
    @DisplayName("Schedule execution history")
    public void testScheduleExecution() {
        List<ScriptSchedule> schedules = ScriptApi.getScriptSchedules();
        assertThat(schedules).as("Expected script schedule").isNotEmpty();
        ScriptSchedule schedule = schedules.getLast();
        ScheduleExecutionHistory executionHistory = ScriptApi.getScheduleExecutionHistory(schedule.getId());
        assertThat(executionHistory).as("Expected schedule execution history").isNotNull();
        assertThat(executionHistory.getResults()).as("Expected history to contain results").isNotEmpty();
        ScheduleExecutionHistory.Result result = executionHistory.getResults().getLast();
        assertThat(result.getExecutionTime()).as("Execution time should not be empty").isNotEmpty();
        assertThat(result.getLastRun()).as("Last run should not be empty").isNotEmpty();
        assertThat(result.getLastRun()).as("Last run should be today")
                .startsWith(LocalDate.now().toString());
        assertThat(result.getAgentId()).as("Agent ID should not be empty").isNotEmpty();
        assertThat(result.getAgentHostname()).as("Agent hostname should not be empty").isNotEmpty();
        assertThat(result.getStatus()).as("Status should not be empty").isNotEmpty();
    }
}
