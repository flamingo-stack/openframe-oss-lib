package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.command.BatchRunCommandInput;
import com.openframe.api.dto.command.CancelExecutionInput;
import com.openframe.api.dto.command.RunCommandInput;
import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.service.rmm.CommandDispatchService;
import com.openframe.security.authentication.AuthPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;

/**
 * GraphQL resolver for RMM ad-hoc command dispatch.
 */
@DgsComponent
@RequiredArgsConstructor
@Slf4j
@Validated
public class CommandDataFetcher {

    private final CommandDispatchService commandDispatchService;

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
