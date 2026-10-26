package com.openframe.test.tests;

import com.openframe.test.api.CommandApi;
import com.openframe.test.api.DeviceApi;
import com.openframe.test.api.ScriptApi;
import com.openframe.test.data.dto.device.DeviceStatus;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.execution.ScriptExecution;
import com.openframe.test.data.dto.script.BatchRunScriptInput;
import com.openframe.test.data.dto.script.CreateScriptInput;
import com.openframe.test.data.dto.script.RunScriptInput;
import com.openframe.test.data.dto.script.Script;
import com.openframe.test.data.dto.script.ScriptEnvVar;
import com.openframe.test.data.dto.script.UpdateScriptInput;
import com.openframe.test.data.dto.shared.GraphqlError;
import com.openframe.test.data.generator.CommandGenerator;
import com.openframe.test.data.generator.DeviceGenerator;
import com.openframe.test.data.generator.ScriptGenerator;
import com.openframe.test.helpers.FleetWait;
import com.openframe.test.helpers.RelayIds;
import com.openframe.test.helpers.ai.RunId;
import org.junit.jupiter.api.*;

import java.util.List;
import java.util.Set;

import static com.openframe.test.data.generator.ScriptGenerator.MARKER_VAR;
import static com.openframe.test.data.generator.ScriptGenerator.envVar;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

@Tag("saas")
@DisplayName("Scripts")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class ScriptsTest extends BaseTest {

    // Ad-hoc dispatch (CP-40) targets the enrolled qa Windows box with a script and commands that only echo a marker.
    private static final String HOSTNAME = "vm115982";
    private static final RunId RUN_ID = RunId.next();
    private static final String STORED_MARKER = RUN_ID + "-stored";
    private static final String ADMIN = "ADMIN";
    private static final String UUID_REGEX = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
    private static final Set<String> FINISHED = Set.of("SUCCESS", "FAILED");
    // Generous: other agents dispatch to the same box at the same time.
    private static final int RESULT_TIMEOUT_SECONDS = 300;
    private static final int CANCEL_SLEEP_SECONDS = 30;

    private static Machine device;
    private static Script echoScript;
    private static String runExecutionId;
    private static String batchExecutionId;
    private static String commandExecutionId;

    @BeforeAll
    public static void pickDevice() {
        device = DeviceApi.getDevices(DeviceGenerator.osAndStatusDevicesFilter("WINDOWS", DeviceStatus.ONLINE)).stream()
                .filter(d -> HOSTNAME.equals(d.getHostname()))
                .findFirst()
                .orElse(null);
    }

    @Tag("feature")
    @Test
    @DisplayName("Add script")
    @Order(1)
    public void testAddScript() {
        CreateScriptInput input = ScriptGenerator.createScriptRequest();
        Script created = ScriptApi.createScript(input);
        assertThat(created.getId()).as("Created script should have an id").isNotNull();
        assertThat(created.getName()).as("Name should match").isEqualTo(input.getName());
        assertThat(created.getShell()).as("Shell should match").isEqualTo(input.getShell());
        assertThat(created.getScriptBody()).as("Script body should match").isEqualTo(input.getScriptBody());
        assertThat(created.getSupportedPlatforms()).as("Supported platforms should match").isEqualTo(input.getSupportedPlatforms());
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("List scripts")
    @Order(2)
    public void testListScripts() {
        List<Script> scripts = ScriptApi.listScripts();
        assertThat(scripts).as("Expected at least one script").isNotEmpty();
        // No withFailMessage() here on purpose: it replaces the failure message for the whole block,
        // including the per-field .as() descriptions below, so a failure would report only "Expected to
        // have mandatory fields" -- naming neither the field nor the script. That is not diagnosable
        // from a nightly log, because RequestSpecHelper logs requests but not response bodies.
        // These three fields are non-null in the schema (id: ID!, name: String!, shell: ScriptShell!),
        // so a failure here is a contract violation worth reporting precisely, and it has to say which
        // of possibly many scripts in the list broke it.
        assertThat(scripts).allSatisfy(script -> {
            assertThat(script.getId()).as("No Id").isNotNull();
            assertThat(script.getName()).as("No Name for " + script.getId()).isNotEmpty();
            assertThat(script.getShell()).as("No Shell for " + script.getName()).isNotEmpty();
        });
    }

    @Tag("feature")
    @Tag("read")
    @Test
    @DisplayName("Get script")
    @Order(3)
    public void testGetScript() {
        List<Script> scripts = ScriptApi.listScripts();
        assertThat(scripts).as("Expected at least one script to exist").isNotEmpty();
        Script listed = scripts.getFirst();
        Script script = ScriptApi.getScript(listed.getId());
        assertThat(script).as("Retrieved script should not be null").isNotNull();
        assertThat(script.getId()).as("Retrieved script id should match the listed script").isEqualTo(listed.getId());
        assertThat(script.getName()).as("Retrieved script name should match the listed script").isEqualTo(listed.getName());
        assertThat(script.getShell()).as("Retrieved script shell should match the listed script").isEqualTo(listed.getShell());
        assertThat(script.getScriptBody()).as("Script body should not be empty").isNotEmpty();
    }

    @Tag("feature")
    @Test
    @DisplayName("Edit script")
    @Order(4)
    public void testEditScript() {
        List<Script> scripts = ScriptApi.listScripts();
        assertThat(scripts).as("Expected at least one script to exist").isNotEmpty();
        Script script = ScriptApi.getScript(scripts.getFirst().getId());

        UpdateScriptInput input = ScriptGenerator.updateScriptRequest(script, "Updated description");
        Script updated = ScriptApi.updateScript(input);
        assertThat(updated).as("Updated script should not be null").isNotNull();
        assertThat(updated.getId()).as("Updated script id should match").isEqualTo(script.getId());
        assertThat(updated.getDescription()).as("Description should be updated").isEqualTo("Updated description");

        Script refetched = ScriptApi.getScript(script.getId());
        assertThat(refetched.getDescription()).as("Persisted description should match the update").isEqualTo("Updated description");
    }

    @Tag("feature")
    @Test
    @DisplayName("Archive script")
    @Order(5)
    public void testArchiveScript() {
        List<Script> scripts = ScriptApi.listScripts();
        assertThat(scripts).as("Expected at least one script to exist").isNotEmpty();
        Script script = ScriptApi.getScript(scripts.getFirst().getId());

        Script archived = ScriptApi.archiveScript(script.getId());
        assertThat(archived).as("Archived script should not be null").isNotNull();
        assertThat(archived.getId()).as("Archived script id should match").isEqualTo(script.getId());
        assertThat(archived.getStatus()).as("Archived script status should be ARCHIVED").isEqualTo("ARCHIVED");
    }

    @Tag("feature")
    @Test
    @DisplayName("Unarchive an archived script")
    @Order(6)
    public void testUnarchiveScript() {
        Script script = ScriptApi.createScript(ScriptGenerator.createScriptRequest());
        try {
            assertThat(ScriptApi.archiveScript(script.getId()).getStatus()).as("The script is archived first").isEqualTo("ARCHIVED");
            assertThat(ScriptApi.listScripts()).extracting(Script::getId).as("An archived script is not listed as ACTIVE").doesNotContain(script.getId());

            Script restored = ScriptApi.unarchiveScript(script.getId());
            assertThat(restored.getId()).as("Unarchived script id should match").isEqualTo(script.getId());
            assertThat(restored.getStatus()).as("Unarchived script status should be ACTIVE").isEqualTo("ACTIVE");
            assertThat(ScriptApi.getScript(script.getId()).getStatus()).as("The ACTIVE status is persisted").isEqualTo("ACTIVE");
            assertThat(ScriptApi.listScripts()).extracting(Script::getId).as("The script is back among the ACTIVE ones").contains(script.getId());
            assertThat(ScriptApi.unarchiveScript(script.getId()).getStatus()).as("Unarchiving an active script is idempotent").isEqualTo("ACTIVE");
        } finally {
            ScriptApi.deleteScript(script.getId());
        }
    }

    @Tag("feature")
    @Test
    @DisplayName("Create a script that echoes a marker from its env vars")
    @Order(7)
    public void testCreateEchoScript() {
        CreateScriptInput input = ScriptGenerator.echoScriptRequest("E2E-" + RUN_ID + " echo", STORED_MARKER);
        echoScript = ScriptApi.createScript(input);
        assertThat(echoScript.getId()).as("Created script should have an id").isNotNull();
        assertThat(echoScript.getScriptBody()).as("Script body should match").isEqualTo(input.getScriptBody());
        assertThat(echoScript.getEnvVars()).extracting(ScriptEnvVar::getName).as("The marker env var is stored").containsExactly(MARKER_VAR);
        assertThat(ScriptApi.getExecutions(echoScript.getId(), 20).getFilteredCount()).as("A new script has no execution history").isZero();
    }

    @Tag("feature")
    @Tag("needs-device")
    @Test
    @DisplayName("Run a saved script on a device with an env var override")
    @Order(8)
    public void testRunScript() {
        requireScriptAndDevice();
        String override = RUN_ID + "-override";
        runExecutionId = ScriptApi.runScript(RunScriptInput.builder()
                .machineId(device.getMachineId())
                .scriptId(echoScript.getId())
                .privilegeLevel(ADMIN)
                .envVars(List.of(envVar(MARKER_VAR, override)))
                .build());
        assertThat(runExecutionId).as("runScript answers with a UUID executionId").matches(UUID_REGEX);

        ScriptExecution row = finishedExecution(runExecutionId);
        assertThat(row.getScriptId()).as("The row belongs to the dispatched script").isEqualTo(RelayIds.rawId(echoScript.getId()));
        assertThat(row.getSource()).as("A dashboard dispatch is recorded as MANUAL").isEqualTo("MANUAL");
        assertThat(row.getScheduleId()).as("An ad-hoc run has no schedule").isNull();
        assertThat(row.getPrivilegeLevel()).as("The requested privilege level is recorded").isEqualTo(ADMIN);
        assertThat(row.getMachine().getMachineId()).as("The row names the target machine").isEqualTo(device.getMachineId());
        assertThat(row.getStatus()).as("The echo succeeds (stderr: " + row.getStderr() + ", error: " + row.getError() + ")").isEqualTo("SUCCESS");
        assertThat(row.getExitCode()).as("The echo exits 0").isZero();
        assertThat(row.getStdout()).as("The run-time env var overrides the stored one").contains("marker=" + override).doesNotContain(STORED_MARKER);
        assertThat(row.getFinishedAt()).as("A finished run records when it finished").isNotBlank();
    }

    @Tag("feature")
    @Tag("needs-device")
    @Test
    @DisplayName("Run a saved script on several devices at once")
    @Order(9)
    public void testBatchRunScript() {
        requireScriptAndDevice();
        batchExecutionId = ScriptApi.batchRunScript(BatchRunScriptInput.builder()
                .machineIds(List.of(device.getMachineId(), device.getMachineId()))
                .scriptId(echoScript.getId())
                .privilegeLevel(ADMIN)
                .build());
        assertThat(batchExecutionId).as("batchRunScript answers with a UUID executionId").matches(UUID_REGEX);
        assertThat(batchExecutionId).as("Every dispatch mints its own executionId").isNotEqualTo(runExecutionId);

        ScriptExecution row = finishedExecution(batchExecutionId);
        assertThat(rowsOf(batchExecutionId)).as("A machine listed twice is dispatched once").hasSize(1);
        assertThat(row.getSource()).as("A dashboard batch dispatch is recorded as MANUAL").isEqualTo("MANUAL");
        assertThat(row.getMachine().getMachineId()).as("The row names the target machine").isEqualTo(device.getMachineId());
        assertThat(row.getStatus()).as("The echo succeeds (stderr: " + row.getStderr() + ", error: " + row.getError() + ")").isEqualTo("SUCCESS");
        assertThat(row.getStdout()).as("Without an override the stored env var is used").contains("marker=" + STORED_MARKER);
    }

    @Tag("feature")
    @Tag("negative")
    @Tag("needs-device")
    @Test
    @DisplayName("A dispatch naming an unknown device is refused as a whole")
    @Order(10)
    public void testDispatchToUnknownDeviceRefused() {
        requireScriptAndDevice();
        String unknown = "e2e-no-such-machine-" + RUN_ID;
        List<String> mixed = List.of(device.getMachineId(), unknown);
        int before = ScriptApi.getExecutions(echoScript.getId(), 20).getFilteredCount();

        List<GraphqlError> scriptErrors = ScriptApi.attemptBatchRunScriptErrors(BatchRunScriptInput.builder()
                .machineIds(mixed).scriptId(echoScript.getId()).privilegeLevel(ADMIN).build());
        assertThat(codes(scriptErrors)).as("batchRunScript refuses a batch with an unknown machine").contains("DEVICE_NOT_FOUND");
        assertThat(ScriptApi.getExecutions(echoScript.getId(), 20).getFilteredCount())
                .as("Nothing is dispatched to the known machine of a refused batch").isEqualTo(before);

        assertThat(codes(CommandApi.attemptRunCommandErrors(CommandGenerator.echoCommand(unknown, RUN_ID.value()))))
                .as("runCommand refuses an unknown machine").contains("DEVICE_NOT_FOUND");
        assertThat(codes(CommandApi.attemptBatchRunCommandErrors(CommandGenerator.batchEchoCommand(mixed, RUN_ID.value()))))
                .as("batchRunCommand refuses a batch with an unknown machine").contains("DEVICE_NOT_FOUND");
    }

    @Tag("feature")
    @Tag("needs-device")
    @Test
    @DisplayName("Run an ad-hoc command on a device")
    @Order(11)
    public void testRunCommand() {
        requireDevice();
        commandExecutionId = CommandApi.runCommand(CommandGenerator.echoCommand(device.getMachineId(), RUN_ID + "-command"));
        assertThat(commandExecutionId).as("runCommand answers with a UUID executionId").matches(UUID_REGEX);
        assertThat(commandExecutionId).as("Every dispatch mints its own executionId").isNotIn(runExecutionId, batchExecutionId);
    }

    @Tag("feature")
    @Tag("needs-device")
    @Test
    @DisplayName("Run an ad-hoc command on several devices at once")
    @Order(12)
    public void testBatchRunCommand() {
        requireDevice();
        String executionId = CommandApi.batchRunCommand(CommandGenerator.batchEchoCommand(
                List.of(device.getMachineId(), device.getMachineId()), RUN_ID + "-batch-command"));
        assertThat(executionId).as("batchRunCommand answers with a UUID executionId").matches(UUID_REGEX);
        assertThat(executionId).as("Every dispatch mints its own executionId").isNotIn(runExecutionId, batchExecutionId, commandExecutionId);
    }

    // Only the dispatch is asserted: the agent did not honour a cancel of a sleeping script on qa, and command results are not readable over the API.
    @Tag("feature")
    @Tag("needs-device")
    @Test
    @DisplayName("Cancel an in-flight ad-hoc command")
    @Order(13)
    public void testCancelExecution() {
        requireDevice();
        String executionId = CommandApi.runCommand(CommandGenerator.sleepThenEchoCommand(
                device.getMachineId(), CANCEL_SLEEP_SECONDS, RUN_ID + "-cancelled"));
        assertThat(executionId).as("runCommand answers with a UUID executionId").matches(UUID_REGEX);

        assertThat(CommandApi.cancelExecution(device.getMachineId(), executionId))
                .as("cancelExecution answers with the executionId it was asked to cancel").isEqualTo(executionId);
    }

    // Deletes the echo script; its execution rows stay as history of a deleted script.
    @AfterAll
    public static void cleanup() {
        if (echoScript != null) {
            ScriptApi.attemptDeleteScript(echoScript.getId());
        }
    }

    private static ScriptExecution finishedExecution(String executionId) {
        FleetWait.until("execution " + executionId + " on " + HOSTNAME + " to finish",
                () -> rowsOf(executionId),
                rows -> rows.stream().anyMatch(r -> FINISHED.contains(r.getStatus())),
                RESULT_TIMEOUT_SECONDS);
        List<ScriptExecution> rows = rowsOf(executionId);
        assertThat(rows).extracting(ScriptExecution::getStatus)
                .as("Execution %s reached SUCCESS or FAILED within %ds", executionId, RESULT_TIMEOUT_SECONDS)
                .isNotEmpty().allMatch(FINISHED::contains);
        return rows.getFirst();
    }

    private static List<ScriptExecution> rowsOf(String executionId) {
        return ScriptApi.getExecutions(echoScript.getId(), 20).nodes().stream()
                .filter(r -> executionId.equals(r.getExecutionId()))
                .toList();
    }

    private static List<Object> codes(List<GraphqlError> errors) {
        return errors.stream().map(e -> e.getExtensions() == null ? null : e.getExtensions().get("code")).toList();
    }

    private static void requireDevice() {
        assumeTrue(device != null, HOSTNAME + " is not listed among the ONLINE WINDOWS devices; the dispatch cases need it");
    }

    private static void requireScriptAndDevice() {
        assumeTrue(echoScript != null && echoScript.getId() != null,
                "No script was created in \"Create a script that echoes a marker from its env vars\"; see that failure");
        requireDevice();
    }
}
