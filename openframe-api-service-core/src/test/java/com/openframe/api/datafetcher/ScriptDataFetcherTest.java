package com.openframe.api.datafetcher;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.dto.script.BatchRunScriptInput;
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
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import graphql.relay.Relay;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
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

    private static final Relay RELAY = new Relay();

    @Test
    @DisplayName("Script.id resolver returns the Relay global id (Base64 \"Script:<rawId>\")")
    void scriptNodeId_returnsGlobalId() {
        DgsDataFetchingEnvironment dfe = mock(DgsDataFetchingEnvironment.class);
        doReturn(ScriptResponse.builder().id("id-1").build()).when(dfe).getSource();

        assertThat(dataFetcher.scriptNodeId(dfe)).isEqualTo(RELAY.toGlobalId("Script", "id-1"));
    }

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
    @DisplayName("batchRunScript forwards to the dispatch service and returns its response")
    void batchRunScript() {
        BatchRunScriptInput input = new BatchRunScriptInput();
        DispatchResponse response = DispatchResponse.builder().executionId("exec-batch-1").build();
        when(scriptDispatchService.batchRunScript(input)).thenReturn(response);

        assertThat(dataFetcher.batchRunScript(input)).isSameAs(response);
        verify(scriptDispatchService).batchRunScript(input);
    }

    @Test
    @DisplayName("script: decodes the incoming Relay global id to the raw id before the service call")
    void script() {
        ScriptResponse resp = ScriptResponse.builder().id("id-1").build();
        when(scriptService.get("id-1")).thenReturn(resp);

        assertThat(dataFetcher.script(RELAY.toGlobalId("Script", "id-1"))).isSameAs(resp);
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
    @DisplayName("createScript stamps the authenticated user's id (sub claim) and forwards to the service")
    void createScript() {
        Jwt jwt = Jwt.withTokenValue("t").header("alg", "none").subject("user-1").build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(jwt, null));
        try {
            CreateScriptInput input = new CreateScriptInput();
            ScriptResponse resp = ScriptResponse.builder().id("id-1").build();
            when(scriptService.create(input, "user-1")).thenReturn(resp);

            assertThat(dataFetcher.createScript(input)).isSameAs(resp);
            verify(scriptService).create(input, "user-1");
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    @DisplayName("updateScript: decodes the input's global id to raw in place, then forwards to the service")
    void updateScript() {
        UpdateScriptInput input = new UpdateScriptInput();
        input.setId(RELAY.toGlobalId("Script", "id-1"));
        ScriptResponse resp = ScriptResponse.builder().id("id-1").build();
        when(scriptService.update(input)).thenReturn(resp);

        assertThat(dataFetcher.updateScript(input)).isSameAs(resp);
        assertThat(input.getId()).isEqualTo("id-1"); // decoded in place
        verify(scriptService).update(input);
    }

    @Test
    @DisplayName("deleteScript: decodes the incoming global id to raw before the service call")
    void deleteScript() {
        when(scriptService.delete("id-1")).thenReturn("id-1");

        assertThat(dataFetcher.deleteScript(RELAY.toGlobalId("Script", "id-1"))).isEqualTo("id-1");
        verify(scriptService).delete("id-1");
    }
}
