package com.openframe.api.datafetcher;

import com.openframe.api.dto.command.CancelExecutionInput;
import com.openframe.api.dto.command.RunCommandInput;
import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.service.rmm.CommandDispatchService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The GraphQL resolver is a thin pass-through: each mutation must delegate to
 * {@link CommandDispatchService} and return its result unchanged.
 */
@ExtendWith(MockitoExtension.class)
class CommandDataFetcherTest {

    @Mock
    private CommandDispatchService commandDispatchService;

    @InjectMocks
    private CommandDataFetcher dataFetcher;

    @Test
    @DisplayName("runCommand delegates to the dispatch service and returns its response")
    void runCommandDelegates() {
        RunCommandInput input = new RunCommandInput();
        DispatchResponse response = DispatchResponse.builder().executionId("exec-1").build();
        when(commandDispatchService.runCommand(input)).thenReturn(response);

        assertThat(dataFetcher.runCommand(input)).isSameAs(response);
        verify(commandDispatchService).runCommand(input);
    }

    @Test
    @DisplayName("cancelExecution delegates to the dispatch service and returns its response")
    void cancelExecutionDelegates() {
        CancelExecutionInput input = new CancelExecutionInput();
        DispatchResponse response = DispatchResponse.builder().executionId("exec-1").build();
        when(commandDispatchService.cancelExecution(input)).thenReturn(response);

        assertThat(dataFetcher.cancelExecution(input)).isSameAs(response);
        verify(commandDispatchService).cancelExecution(input);
    }
}
