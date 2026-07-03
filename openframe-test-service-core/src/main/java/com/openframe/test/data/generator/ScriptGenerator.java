package com.openframe.test.data.generator;

import com.openframe.test.data.dto.script.*;
import net.datafaker.Faker;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

public class ScriptGenerator {

    private static Faker faker = new Faker();

    public static CreateScriptInput createScriptRequest() {
        return CreateScriptInput.builder()
                .name("Dir".concat(faker.lorem().characters(3)))
                .description("List files in folder")
                .shell("POWERSHELL")
                .privilegeLevel("USER")
                .scriptBody("dir")
                .supportedPlatforms(List.of("WINDOWS"))
                .defaultTimeoutSeconds(90)
                .defaultArgs(List.of("dirName"))
                .envVars(List.of(ScriptEnvVar.builder().name("ENVVAR").value("varValue").secret(false).build()))
                .build();
    }

    /**
     * Full-replacement update payload derived from an existing script, changing only
     * the description. Mirrors the PUT semantics of {@code updateScript}: every writable
     * field is echoed back so nothing is inadvertently cleared.
     */
    public static UpdateScriptInput updateScriptRequest(Script script, String description) {
        return UpdateScriptInput.builder()
                .id(script.getId())
                .name(script.getName())
                .description(description)
                .shell(script.getShell())
                .privilegeLevel(script.getPrivilegeLevel())
                .scriptBody(script.getScriptBody())
                .supportedPlatforms(script.getSupportedPlatforms())
                .defaultTimeoutSeconds(script.getDefaultTimeoutSeconds())
                .defaultArgs(script.getDefaultArgs())
                .envVars(script.getEnvVars())
                .build();
    }

    public static RunScriptRequest runSpeedTestScriptRequest(String... agents) {
        return RunScriptRequest.builder()
                .mode("script")
                .target("agents")
                .monType("all")
                .osType("windows")
                .cmd("")
                .shell("cmd")
                .customShell(null)
                .customField(null)
                .collectorAllOutput(false)
                .saveToAgentNote(false)
                .patchMode("scan")
                .offlineAgents(false)
                .client(null)
                .site(null)
                .agents(List.of(agents))
                .script(14)
                .timeout(10)
                .args(List.of())
                .envVars(List.of())
                .runAsUser(false)
                .build();
    }

    public static CreateScriptScheduleRequest createOnlineCheckSchedule() {
        return CreateScriptScheduleRequest.builder()
                .name("Check device is online")
                .taskType("runonce")
                .runTimeDate(Instant.now().plus(5, ChronoUnit.MINUTES).truncatedTo(ChronoUnit.SECONDS).toString())
                .taskSupportedPlatforms(List.of("windows"))
                .enabled(true)
                .actions(List.of(
                        CreateScriptScheduleRequest.Action.builder()
                                .type("script")
                                .script(129)
                                .name("Network - Online check")
                                .timeout(10)
                                .scriptArgs(List.of())
                                .envVars(List.of("PING_HOSTNAME=8.8.8.8", "PING_TIMEOUT=5"))
                                .build()
                ))
                .build();
    }

}
