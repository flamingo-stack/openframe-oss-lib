package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.data.document.rmm.command.CommandExecution;
import com.openframe.data.model.enums.MessageType;
import com.openframe.data.repository.rmm.CommandExecutionRepository;
import com.openframe.stream.mapping.SourceEventTypes;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Binds the shared {@link RmmResultDeserializer} logic to
 * {@link MessageType#COMMAND_EXECUTED} — results of native OpenFrame commands.
 *
 * <p>Routing is static (see {@code MessageType.COMMAND_EXECUTED}): every command
 * result feeds ALL of its destinations — the generic event-log + Pinot (so it shows
 * up in the Logs UI exactly like a script) AND the command-specific sinks
 * (Cassandra {@code command_results} + the Mongo {@code CommandExecution} write-back).
 * The command-specific handlers correlate on {@code (machineId, executionId)}
 * themselves, so no per-message routing decision is made here.
 */
@Component
@Slf4j
public final class CommandResultDeserializer extends RmmResultDeserializer {

    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_EXECUTION_ID = "executionId";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_EXIT_CODE = "exitCode";
    private static final String FIELD_TIMED_OUT = "timedOut";

    private static final String DETAILS_INPUT = "input";
    private static final String INPUT_COMMAND = "command";
    private static final String INPUT_SHELL = "shell";
    private static final String INPUT_PRIVILEGE_LEVEL = "privilegeLevel";
    private static final String INPUT_TIMEOUT_SECONDS = "timeoutSeconds";

    private final CommandExecutionRepository commandExecutionRepository;

    public CommandResultDeserializer(ObjectMapper mapper, CommandExecutionRepository commandExecutionRepository) {
        super(mapper);
        this.commandExecutionRepository = commandExecutionRepository;
    }

    @Override
    public MessageType getType() {
        return MessageType.COMMAND_EXECUTED;
    }

    @Override
    protected Optional<String> getSourceEventType(JsonNode after) {
        return Optional.of(SourceEventTypes.Rmm.CMD_RUN_FINISHED);
    }

    @Override
    protected Optional<String> getMessage(JsonNode after) {
        boolean timedOut = parseStringField(after, FIELD_TIMED_OUT).map(Boolean::parseBoolean).orElse(false);
        if (timedOut) {
            return Optional.of("Command timed out");
        }
        return parseStringField(after, FIELD_EXIT_CODE)
                .map(code -> "Command finished (exit code %s)".formatted(code))
                .or(() -> Optional.of("Command finished"));
    }

    // The result block carries what was dispatched next to the output: the command, its shell, privilege
    // level and timeout, as recorded on the execution row. A command has no saved script behind it.
    @Override
    protected String getResult(JsonNode after) {
        String baseResult = super.getResult(after);
        try {
            ObjectNode result = toObjectNode(baseResult);
            findExecution(after).ifPresent(execution -> result.set(DETAILS_INPUT, inputOf(execution)));
            return result.isEmpty() ? null : mapper.writeValueAsString(result);
        } catch (Exception e) {
            log.warn("Failed to attach the command input to the command-result block", e);
            return baseResult;
        }
    }

    private Optional<CommandExecution> findExecution(JsonNode after) {
        String tenantId = parseStringField(after, FIELD_TENANT_ID).orElse(null);
        String executionId = parseStringField(after, FIELD_EXECUTION_ID).orElse(null);
        String machineId = parseStringField(after, FIELD_MACHINE_ID).orElse(null);
        if (tenantId == null || executionId == null || machineId == null) {
            return Optional.empty();
        }
        return commandExecutionRepository.findByTenantIdAndExecutionIdAndMachineId(tenantId, executionId, machineId);
    }

    private ObjectNode inputOf(CommandExecution execution) {
        ObjectNode input = mapper.createObjectNode();
        putIfPresent(input, INPUT_COMMAND, execution.getCommand());
        putIfPresent(input, INPUT_SHELL, execution.getShell() == null ? null : execution.getShell().name());
        putIfPresent(input, INPUT_PRIVILEGE_LEVEL,
                execution.getPrivilegeLevel() == null ? null : execution.getPrivilegeLevel().name());
        putIfPresent(input, INPUT_TIMEOUT_SECONDS, execution.getTimeoutSeconds());
        return input;
    }
}
