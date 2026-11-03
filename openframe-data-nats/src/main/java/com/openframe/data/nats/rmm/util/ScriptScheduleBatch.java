package com.openframe.data.nats.rmm.util;

import com.openframe.data.document.rmm.schedule.ScheduledScriptCustomParams;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptEnvVar;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionItem;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

// the scripts of one schedule fire as the agent runs them: the schedule's custom args and env of a script win over
// the script's own defaults
public final class ScriptScheduleBatch {

    private ScriptScheduleBatch() {
    }

    public static List<ScriptScheduleExecutionItem> items(List<Script> scripts, List<ScheduledScriptCustomParams> customParams) {
        Map<String, ScheduledScriptCustomParams> customParamsByScriptId = byScriptId(customParams);
        return scripts.stream()
                .map(script -> item(script, customParamsByScriptId.get(script.getId())))
                .toList();
    }

    private static ScriptScheduleExecutionItem item(Script script, ScheduledScriptCustomParams customParams) {
        List<String> args = Optional.ofNullable(customParams).map(ScheduledScriptCustomParams::getArgs).orElseGet(script::getDefaultArgs);
        List<ScriptEnvVar> envVars = Optional.ofNullable(customParams).map(ScheduledScriptCustomParams::getEnvVars).orElseGet(script::getEnvVars);
        return ScriptScheduleExecutionItem.builder()
                .scriptId(script.getId())
                .code(script.getScriptBody())
                .shell(script.getShell())
                .privilegeLevel(script.getPrivilegeLevel())
                .args(ScriptArgsTokenizer.tokenize(args))
                .timeoutSeconds(script.getDefaultTimeoutSeconds())
                .envVars(envVars)
                .build();
    }

    private static Map<String, ScheduledScriptCustomParams> byScriptId(List<ScheduledScriptCustomParams> customParams) {
        if (customParams == null || customParams.isEmpty()) {
            return Map.of();
        }
        return customParams.stream()
                .filter(params -> params.getScriptId() != null)
                .collect(Collectors.toMap(ScheduledScriptCustomParams::getScriptId, Function.identity(), (first, second) -> second));
    }
}
