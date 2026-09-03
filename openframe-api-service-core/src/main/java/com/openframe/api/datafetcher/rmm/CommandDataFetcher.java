package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.command.BatchRunCommandInput;
import com.openframe.api.dto.command.CancelExecutionInput;
import com.openframe.api.dto.command.CommandExecutionResponse;
import com.openframe.api.dto.command.RunCommandInput;
import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.service.rmm.command.CommandDispatchService;
import com.openframe.api.service.rmm.command.CommandExecutionService;
import com.openframe.security.authentication.AuthPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;

import java.util.List;

/**
 * GraphQL resolver for RMM ad-hoc command dispatch.
 */
@DgsComponent
@RequiredArgsConstructor
@Slf4j
@Validated
public class CommandDataFetcher {

    private final CommandDispatchService commandDispatchService;
    private final CommandExecutionService commandExecutionService;

    @DgsQuery
    public List<CommandExecutionResponse> commandExecutions(@InputArgument @NotBlank String executionId) {
        return commandExecutionService.getExecutionResults(executionId);
    }

    @DgsMutation
    public DispatchResponse runCommand(@InputArgument @Valid RunCommandInput input) {
        return commandDispatchService.runCommand(input);
    }

    @DgsMutation
    public DispatchResponse batchRunCommand(@InputArgument @Valid BatchRunCommandInput input) {
        return commandDispatchService.batchRunCommand(input, getCurrentUserId());
    }

    @DgsMutation
    public DispatchResponse cancelExecution(@InputArgument @Valid CancelExecutionInput input) {
        return commandDispatchService.cancelExecution(input);
    }

    private String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return AuthPrincipal.fromJwt((Jwt) auth.getPrincipal()).getId();
    }
}
