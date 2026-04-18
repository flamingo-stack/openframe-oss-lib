package com.openframe.test.data.generator;

import com.openframe.test.data.dto.script.CreateScriptScheduleRequest;
import com.openframe.test.data.dto.script.RunScriptRequest;
import com.openframe.test.data.dto.script.Script;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

public class ScriptGenerator {

    public static Script addScriptRequest() {
        return Script.builder()
                .name("Dir")
                .description("List files in folder")
                .scriptType("userdefined")
                .shell("powershell")
                .args(List.of("dirName"))
                .category("Custom")
                .favorite(false)
                .scriptBody("dir")
                .defaultTimeout(90)
                .hidden(false)
                .supportedPlatforms(List.of("windows"))
                .runAsUser(false)
                .envVars(List.of("ENVVAR=varValue"))
                .build();
    }

    public static String addScriptResponse(Script script) {
        return "\"%s was added!\"".formatted(script.getName());
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

    public static String editScriptResponse(Script script) {
        return "\"%s was edited!\"".formatted(script.getName());
    }
}
