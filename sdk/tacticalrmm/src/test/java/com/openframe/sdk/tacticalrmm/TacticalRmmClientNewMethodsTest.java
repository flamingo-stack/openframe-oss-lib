package com.openframe.sdk.tacticalrmm;

import com.openframe.sdk.tacticalrmm.model.RunScriptRequest;
import com.openframe.sdk.tacticalrmm.model.RunScriptResult;
import com.openframe.sdk.tacticalrmm.model.ScriptScheduleAgentsResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.lang.reflect.Field;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Covers the runScript / script-schedule agent assignment / delete methods on {@link TacticalRmmClient}.
 */
class TacticalRmmClientNewMethodsTest {

    private static final String SERVER = "https://tactical.test.com";
    private static final String API_KEY = "test-key";

    private TacticalRmmClient client;
    private HttpClient mockHttpClient;

    @BeforeEach
    void setUp() throws Exception {
        client = new TacticalRmmClient();
        mockHttpClient = mock(HttpClient.class);
        // Replace the package-private httpClient field with the mock so we can verify outbound requests.
        Field field = TacticalRmmClient.class.getDeclaredField("httpClient");
        field.setAccessible(true);
        field.set(client, mockHttpClient);
    }

    @Test
    void runScriptAsync_postsToRunscriptEndpoint() throws Exception {
        mockAsyncResponse(200, "{\"stdout\":\"hi\",\"stderr\":\"\",\"execution_time\":\"0.05\",\"retcode\":0}");
        RunScriptRequest req = new RunScriptRequest();
        req.setScript(7);
        req.setOutput("wait");
        req.setTimeout(60);

        RunScriptResult result = client.runScriptAsync(SERVER, API_KEY, "agent-abc", req).get();

        assertNotNull(result);
        assertEquals(0, result.getRetcode());
        assertEquals("hi", result.getStdout());
        assertEquals("agent-abc", result.getAgentId());
        assertEquals(7, result.getScriptId());
        ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(mockHttpClient).sendAsync(captor.capture(), any());
        assertTrue(captor.getValue().uri().toString().endsWith("/agents/agent-abc/runscript/"));
        assertEquals("POST", captor.getValue().method());
    }

    @Test
    void runScriptAsync_rejectsMissingScriptId() {
        CompletableFuture<RunScriptResult> future = client.runScriptAsync(SERVER, API_KEY, "agent-abc", new RunScriptRequest());
        assertTrue(future.isCompletedExceptionally());
    }

    @Test
    void assignAgentsToScriptScheduleAsync_postsAgentsList() throws Exception {
        mockAsyncResponse(200, "{\"agents_count\":3,\"task_results_created\":2,\"task_results_deleted\":0}");

        ScriptScheduleAgentsResult result = client.assignAgentsToScriptScheduleAsync(
                SERVER, API_KEY, 11, List.of("a1", "a2")).get();

        assertEquals(3, result.getAgentsCount());
        assertEquals(2, result.getTaskResultsCreated());
        ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(mockHttpClient).sendAsync(captor.capture(), any());
        assertTrue(captor.getValue().uri().toString().endsWith("/script-schedules/11/agents/"));
        assertEquals("POST", captor.getValue().method());
    }

    @Test
    void unassignAgentsFromScriptScheduleAsync_usesDeleteVerbWithBody() throws Exception {
        mockAsyncResponse(200, "{\"agents_count\":1,\"task_results_created\":0,\"task_results_deleted\":1}");

        ScriptScheduleAgentsResult result = client.unassignAgentsFromScriptScheduleAsync(
                SERVER, API_KEY, 11, List.of("a1")).get();

        assertEquals(1, result.getAgentsCount());
        ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(mockHttpClient).sendAsync(captor.capture(), any());
        assertTrue(captor.getValue().uri().toString().endsWith("/script-schedules/11/agents/"));
        assertEquals("DELETE", captor.getValue().method());
    }

    @Test
    void deleteScriptAsync_callsDeleteOnScriptsPath() throws Exception {
        mockAsyncResponse(200, "");

        client.deleteScriptAsync(SERVER, API_KEY, "5").get();

        ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(mockHttpClient).sendAsync(captor.capture(), any());
        assertTrue(captor.getValue().uri().toString().endsWith("/scripts/5/"));
        assertEquals("DELETE", captor.getValue().method());
    }

    @Test
    void deleteScriptScheduleAsync_callsDeleteOnSchedulePath() throws Exception {
        mockAsyncResponse(204, "");

        client.deleteScriptScheduleAsync(SERVER, API_KEY, 12).get();

        ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(mockHttpClient).sendAsync(captor.capture(), any());
        assertTrue(captor.getValue().uri().toString().endsWith("/script-schedules/12/"));
        assertEquals("DELETE", captor.getValue().method());
    }

    @Test
    void scheduleAgentsRequiresNonEmptyList() {
        CompletableFuture<ScriptScheduleAgentsResult> future =
                client.assignAgentsToScriptScheduleAsync(SERVER, API_KEY, 1, List.of());
        assertTrue(future.isCompletedExceptionally());
    }

    @SuppressWarnings("unchecked")
    private void mockAsyncResponse(int statusCode, String body) {
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(statusCode);
        when(response.body()).thenReturn(body);
        when(mockHttpClient.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(CompletableFuture.completedFuture(response));
    }
}
