package com.openframe.api.datafetcher;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.dto.script.CreateScriptInput;
import com.openframe.api.dto.script.RunScriptInput;
import com.openframe.api.dto.script.ScriptFilterInput;
import com.openframe.api.dto.script.ScriptResponse;
import com.openframe.api.dto.script.UpdateScriptInput;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link ScriptDataFetcher} is a thin GraphQL resolver — every query/mutation
 * forwards to {@link ScriptService} (CRUD/list) or {@link ScriptDispatchService}
 * (runScript) and returns the result unchanged. These tests lock that wiring.
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
    @DisplayName("runScript forwards to the dispatch service and returns its response")
    void runScript() {
        RunScriptInput input = new RunScriptInput();
        DispatchResponse response = DispatchResponse.builder().executionId("exec-1").build();
        when(scriptDispatchService.runScript(input)).thenReturn(response);

        assertThat(dataFetcher.runScript(input)).isSameAs(response);
        verify(scriptDispatchService).runScript(input);
    }

    @Test
    @DisplayName("script forwards to the service and returns the response")
    void script() {
        ScriptResponse resp = ScriptResponse.builder().id("id-1").build();
        when(scriptService.get("id-1")).thenReturn(resp);

        assertThat(dataFetcher.script("id-1")).isSameAs(resp);
        verify(scriptService).get("id-1");
    }

    @Test
    @DisplayName("scripts: builds ConnectionArgs, forwards filter/search/sort + mapped pagination to the service, and returns the mapped connection")
    void scripts() {
        ScriptFilterInput filter = ScriptFilterInput.builder().build();
        SortInput sort = SortInput.builder().build();
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().build();
        CountedGenericQueryResult<ScriptResponse> result = CountedGenericQueryResult.<ScriptResponse>builder().build();
        CountedGenericConnection<GenericEdge<ScriptResponse>> connection =
                CountedGenericConnection.<GenericEdge<ScriptResponse>>builder().build();

        when(scriptMapper.toCursorPaginationCriteria(any(ConnectionArgs.class))).thenReturn(pagination);
        when(scriptService.list(filter, "q", sort, pagination)).thenReturn(result);
        when(scriptMapper.toConnection(result)).thenReturn(connection);

        assertThat(dataFetcher.scripts(filter, "q", sort, 10, "cursor", null, null)).isSameAs(connection);
        verify(scriptService).list(filter, "q", sort, pagination);
    }

    @Test
    @DisplayName("createScript forwards to the service and returns the created script")
    void createScript() {
        CreateScriptInput input = new CreateScriptInput();
        ScriptResponse resp = ScriptResponse.builder().id("id-1").build();
        when(scriptService.create(input)).thenReturn(resp);

        assertThat(dataFetcher.createScript(input)).isSameAs(resp);
        verify(scriptService).create(input);
    }

    @Test
    @DisplayName("updateScript forwards to the service and returns the updated script")
    void updateScript() {
        UpdateScriptInput input = new UpdateScriptInput();
        ScriptResponse resp = ScriptResponse.builder().id("id-1").build();
        when(scriptService.update(input)).thenReturn(resp);

        assertThat(dataFetcher.updateScript(input)).isSameAs(resp);
        verify(scriptService).update(input);
    }

    @Test
    @DisplayName("deleteScript forwards to the service and returns the deleted script id")
    void deleteScript() {
        when(scriptService.delete("id-1")).thenReturn("id-1");

        assertThat(dataFetcher.deleteScript("id-1")).isEqualTo("id-1");
        verify(scriptService).delete("id-1");
    }
}
