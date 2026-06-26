package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.execution.ScriptExecutionFilterInput;
import com.openframe.api.dto.execution.ScriptExecutionResponse;
import com.openframe.api.dto.script.ScriptResponse;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.mapper.GraphQLScriptExecutionMapper;
import com.openframe.api.service.rmm.ScriptExecutionService;
import com.openframe.data.document.device.Machine;
import graphql.relay.Relay;
import org.dataloader.DataLoader;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * {@link ScriptExecutionDataFetcher} is a thin GraphQL resolver: the {@code scriptExecutions}
 * query forwards to {@link ScriptExecutionService}, while {@code initiator} and
 * {@code scriptName} are batch-resolved field resolvers (DataLoaders) so the row
 * stores only raw ids. These tests lock that wiring — in particular that the script's
 * display name is resolved at read time from {@code scriptId}, not snapshotted.
 */
@ExtendWith(MockitoExtension.class)
class ScriptExecutionDataFetcherTest {

    @Mock
    private ScriptExecutionService scriptExecutionService;
    @Mock
    private GraphQLScriptExecutionMapper executionMapper;

    @InjectMocks
    private ScriptExecutionDataFetcher dataFetcher;

    @Test
    @DisplayName("scriptExecutions: builds ConnectionArgs, forwards scriptId/filter/sort + mapped pagination to the service, returns the mapped connection")
    void scriptExecutions() {
        ScriptExecutionFilterInput filter = ScriptExecutionFilterInput.builder().build();
        SortInput sort = SortInput.builder().build();
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().build();
        CountedGenericQueryResult<ScriptExecutionResponse> result = CountedGenericQueryResult.<ScriptExecutionResponse>builder().build();
        CountedGenericConnection<GenericEdge<ScriptExecutionResponse>> connection =
                CountedGenericConnection.<GenericEdge<ScriptExecutionResponse>>builder().build();

        when(executionMapper.toCursorPaginationCriteria(any(ConnectionArgs.class))).thenReturn(pagination);
        when(scriptExecutionService.list("script-1", filter, sort, pagination)).thenReturn(result);
        when(executionMapper.toConnection(result)).thenReturn(connection);

        assertThat(dataFetcher.scriptExecutions("script-1", filter, sort, 10, "cursor", null, null))
                .isSameAs(connection);
        verify(scriptExecutionService).list("script-1", filter, sort, pagination);
    }

    @Test
    @DisplayName("ScriptExecution.id resolver returns the Relay global id (Base64 \"ScriptExecution:<rawId>\") — the opaque node handle, not the raw Mongo id")
    void scriptExecutionNodeId_returnsGlobalId() {
        DgsDataFetchingEnvironment dfe = mock(DgsDataFetchingEnvironment.class);
        doReturn(ScriptExecutionResponse.builder().id("doc-1").build()).when(dfe).getSource();

        assertThat(dataFetcher.scriptExecutionNodeId(dfe)).isEqualTo(new Relay().toGlobalId("ScriptExecution", "doc-1"));
    }

    @Test
    @DisplayName("scriptName: resolved at read time from the row's scriptId via the scriptDataLoader (NOT snapshotted on the row)")
    void scriptName_resolvedViaLoader() throws Exception {
        DgsDataFetchingEnvironment dfe = mock(DgsDataFetchingEnvironment.class);
        doReturn(ScriptExecutionResponse.builder().scriptId("script-1").build()).when(dfe).getSource();
        @SuppressWarnings("unchecked")
        DataLoader<String, ScriptResponse> loader = mock(DataLoader.class);
        doReturn(loader).when(dfe).getDataLoader("scriptDataLoader");
        when(loader.load("script-1"))
                .thenReturn(CompletableFuture.completedFuture(ScriptResponse.builder().id("script-1").name("disk usage").build()));

        assertThat(dataFetcher.scriptName(dfe).get()).isEqualTo("disk usage");
    }

    @Test
    @DisplayName("scriptName: a null scriptId short-circuits to null — no DataLoader interaction")
    void scriptName_nullScriptId_returnsNull() throws Exception {
        DgsDataFetchingEnvironment dfe = mock(DgsDataFetchingEnvironment.class);
        doReturn(ScriptExecutionResponse.builder().scriptId(null).build()).when(dfe).getSource();

        assertThat(dataFetcher.scriptName(dfe).get()).isNull();
        verify(dfe, org.mockito.Mockito.never()).getDataLoader(any(String.class));
    }

    @Test
    @DisplayName("scriptName: an unresolvable script (loader returns null) maps to a null name rather than failing the field")
    void scriptName_scriptMissing_returnsNull() throws Exception {
        DgsDataFetchingEnvironment dfe = mock(DgsDataFetchingEnvironment.class);
        doReturn(ScriptExecutionResponse.builder().scriptId("script-gone").build()).when(dfe).getSource();
        @SuppressWarnings("unchecked")
        DataLoader<String, ScriptResponse> loader = mock(DataLoader.class);
        doReturn(loader).when(dfe).getDataLoader("scriptDataLoader");
        when(loader.load("script-gone")).thenReturn(CompletableFuture.completedFuture(null));

        assertThat(dataFetcher.scriptName(dfe).get()).isNull();
    }

    @Test
    @DisplayName("initiator: resolved via the userDataLoader from the row's initiatedBy")
    void initiator_resolvedViaLoader() throws Exception {
        DgsDataFetchingEnvironment dfe = mock(DgsDataFetchingEnvironment.class);
        doReturn(ScriptExecutionResponse.builder().initiatedBy("user-1").build()).when(dfe).getSource();
        @SuppressWarnings("unchecked")
        DataLoader<String, UserResponse> loader = mock(DataLoader.class);
        doReturn(loader).when(dfe).getDataLoader("userDataLoader");
        UserResponse user = UserResponse.builder().id("user-1").build();
        when(loader.load("user-1")).thenReturn(CompletableFuture.completedFuture(user));

        assertThat(dataFetcher.initiator(dfe).get()).isSameAs(user);
    }

    @Test
    @DisplayName("initiator: a null initiatedBy short-circuits to null — no DataLoader interaction")
    void initiator_nullInitiatedBy_returnsNull() throws Exception {
        DgsDataFetchingEnvironment dfe = mock(DgsDataFetchingEnvironment.class);
        doReturn(ScriptExecutionResponse.builder().initiatedBy(null).build()).when(dfe).getSource();

        assertThat(dataFetcher.initiator(dfe).get()).isNull();
        verifyNoInteractions(scriptExecutionService);
    }

    @Test
    @DisplayName("machine: resolved via the machineDataLoader from the row's machineId (raw machineId is not exposed)")
    void machine_resolvedViaLoader() throws Exception {
        DgsDataFetchingEnvironment dfe = mock(DgsDataFetchingEnvironment.class);
        doReturn(ScriptExecutionResponse.builder().machineId("machine-1").build()).when(dfe).getSource();
        @SuppressWarnings("unchecked")
        DataLoader<String, Machine> loader = mock(DataLoader.class);
        doReturn(loader).when(dfe).getDataLoader("machineDataLoader");
        Machine machine = new Machine();
        when(loader.load("machine-1")).thenReturn(CompletableFuture.completedFuture(machine));

        assertThat(dataFetcher.machine(dfe).get()).isSameAs(machine);
    }

    @Test
    @DisplayName("machine: a null machineId short-circuits to null — no DataLoader interaction")
    void machine_nullMachineId_returnsNull() throws Exception {
        DgsDataFetchingEnvironment dfe = mock(DgsDataFetchingEnvironment.class);
        doReturn(ScriptExecutionResponse.builder().machineId(null).build()).when(dfe).getSource();

        assertThat(dataFetcher.machine(dfe).get()).isNull();
        verify(dfe, org.mockito.Mockito.never()).getDataLoader(any(String.class));
    }

    @Test
    @DisplayName("machine: an unresolvable machine (loader returns null — e.g. deleted device) maps to a null field rather than failing")
    void machine_machineMissing_returnsNull() throws Exception {
        DgsDataFetchingEnvironment dfe = mock(DgsDataFetchingEnvironment.class);
        doReturn(ScriptExecutionResponse.builder().machineId("machine-gone").build()).when(dfe).getSource();
        @SuppressWarnings("unchecked")
        DataLoader<String, Machine> loader = mock(DataLoader.class);
        doReturn(loader).when(dfe).getDataLoader("machineDataLoader");
        when(loader.load("machine-gone")).thenReturn(CompletableFuture.completedFuture(null));

        assertThat(dataFetcher.machine(dfe).get()).isNull();
    }
}
