package com.openframe.api.datafetcher;

import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.dto.script.RunScriptInput;
import com.openframe.api.mapper.GraphQLScriptMapper;
import com.openframe.api.service.rmm.ScriptDispatchService;
import com.openframe.api.service.rmm.ScriptService;
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
 * The {@code runScript} mutation is a thin pass-through: it must delegate to
 * {@link ScriptDispatchService} and return its result unchanged.
 */
@ExtendWith(MockitoExtension.class)
class ScriptDataFetcherTest {

    @Mock
    private ScriptService scriptService;
    @Mock
    private ScriptDispatchService scriptDispatchService;
    @Mock
    private GraphQLScriptMapper scriptMapper;

    @InjectMocks
    private ScriptDataFetcher dataFetcher;

    @Test
    @DisplayName("runScript delegates to the dispatch service and returns its response")
    void runScriptDelegates() {
        RunScriptInput input = new RunScriptInput();
        DispatchResponse response = DispatchResponse.builder().executionId("exec-1").build();
        when(scriptDispatchService.runScript(input)).thenReturn(response);

        assertThat(dataFetcher.runScript(input)).isSameAs(response);
        verify(scriptDispatchService).runScript(input);
    }
}
