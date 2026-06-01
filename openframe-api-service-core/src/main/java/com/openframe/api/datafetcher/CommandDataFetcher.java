package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.command.CancelDispatchResponse;
import com.openframe.api.dto.command.CancelExecutionInput;
import com.openframe.api.dto.command.CommandDispatchResponse;
import com.openframe.api.dto.command.RunCommandInput;
import com.openframe.api.service.rmm.CommandDispatchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;

/**
 * GraphQL resolver for RMM ad-hoc command dispatch.
 *
 * <p>Pure passthrough to {@link CommandDispatchService} — input validation
 * is handled by {@code @Valid} on the mutation argument, tenant scoping is
 * resolved inside the service / publisher, and the actual agent-targeted
 * publish happens over NATS. The mutation does NOT block on the agent's
 * response.
 */
@DgsComponent
@RequiredArgsConstructor
@Slf4j
@Validated
public class CommandDataFetcher {

    private final CommandDispatchService commandDispatchService;

    @DgsMutation
    public CommandDispatchResponse runCommand(@InputArgument @Valid RunCommandInput input) {
        return commandDispatchService.runCommand(input);
    }

    @DgsMutation
    public CancelDispatchResponse cancelExecution(@InputArgument @Valid CancelExecutionInput input) {
        return commandDispatchService.cancelExecution(input);
    }
}
