package com.openframe.test.data.generator;

import com.openframe.test.data.dto.command.BatchRunCommandInput;
import com.openframe.test.data.dto.command.RunCommandInput;

import java.util.List;

// Harmless ad-hoc commands for the dispatch cases: a PowerShell echo of a marker, nothing else.
public class CommandGenerator {

    private static final String SHELL = "POWERSHELL";
    private static final String PRIVILEGE_LEVEL = "ADMIN";
    private static final int TIMEOUT_SECONDS = 60;

    public static RunCommandInput echoCommand(String machineId, String marker) {
        return RunCommandInput.builder()
                .machineId(machineId)
                .shell(SHELL)
                .command(echo(marker))
                .privilegeLevel(PRIVILEGE_LEVEL)
                .timeoutSeconds(TIMEOUT_SECONDS)
                .build();
    }

    // Sleeps before echoing, so a cancel sent right after dispatch finds it in flight.
    public static RunCommandInput sleepThenEchoCommand(String machineId, int sleepSeconds, String marker) {
        RunCommandInput input = echoCommand(machineId, marker);
        input.setCommand("Start-Sleep -Seconds " + sleepSeconds + "; " + input.getCommand());
        return input;
    }

    public static BatchRunCommandInput batchEchoCommand(List<String> machineIds, String marker) {
        return BatchRunCommandInput.builder()
                .machineIds(machineIds)
                .shell(SHELL)
                .command(echo(marker))
                .privilegeLevel(PRIVILEGE_LEVEL)
                .timeoutSeconds(TIMEOUT_SECONDS)
                .build();
    }

    private static String echo(String marker) {
        return "Write-Output 'marker=" + marker + "'";
    }
}
