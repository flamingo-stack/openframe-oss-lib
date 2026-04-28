package com.openframe.sdk.fleetmdm;

import com.openframe.sdk.fleetmdm.model.LiveQueryCampaign;
import com.openframe.sdk.fleetmdm.model.RunLiveQueryRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

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
 * Covers the new live-query, host-assignment, and delete methods on {@link FleetMdmClient}.
 */
class FleetMdmClientAssignmentTest {

    private FleetMdmClient client;
    private HttpClient mockHttpClient;

    @BeforeEach
    void setUp() {
        mockHttpClient = mock(HttpClient.class);
        client = new FleetMdmClient("https://fleet.test.com", "test-token", mockHttpClient);
    }

    @Test
    void runLiveQueryAsync_targetsExpectedPathAndBody() throws Exception {
        String body = "{\"campaign\":{\"id\":42,\"query\":\"SELECT 1\",\"status\":\"running\"}}";
        mockAsyncResponse(200, body);

        RunLiveQueryRequest request = new RunLiveQueryRequest();
        request.setQuery("SELECT 1");
        request.setSelected(new RunLiveQueryRequest.Selected(List.of(7L), null, null));

        LiveQueryCampaign campaign = client.runLiveQueryAsync(request).get();

        assertNotNull(campaign);
        assertEquals(42L, campaign.getId());
        assertEquals("running", campaign.getStatus());
        ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(mockHttpClient).sendAsync(captor.capture(), any());
        assertTrue(captor.getValue().uri().toString().endsWith("/api/v1/fleet/queries/run"));
        assertEquals("POST", captor.getValue().method());
    }

    @Test
    void runLiveQueryAsync_rejectsRequestWithoutQueryOrId() {
        RunLiveQueryRequest empty = new RunLiveQueryRequest();
        empty.setSelected(new RunLiveQueryRequest.Selected(List.of(1L), null, null));

        CompletableFuture<LiveQueryCampaign> future = client.runLiveQueryAsync(empty);

        assertTrue(future.isCompletedExceptionally());
    }

    @Test
    void addQueryHostsAsync_returnsAddedCount() throws Exception {
        mockAsyncResponse(200, "{\"added\":3}");

        long added = client.addQueryHostsAsync(11L, List.of(1L, 2L, 3L)).get();

        assertEquals(3L, added);
        ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(mockHttpClient).sendAsync(captor.capture(), any());
        assertTrue(captor.getValue().uri().toString().endsWith("/api/v1/fleet/queries/11/hosts"));
        assertEquals("POST", captor.getValue().method());
    }

    @Test
    void removePolicyHostsAsync_usesDeleteWithBody() throws Exception {
        mockAsyncResponse(200, "{\"removed\":2}");

        long removed = client.removePolicyHostsAsync(8L, List.of(101L, 202L)).get();

        assertEquals(2L, removed);
        ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(mockHttpClient).sendAsync(captor.capture(), any());
        assertTrue(captor.getValue().uri().toString().endsWith("/api/v1/fleet/policies/8/hosts"));
        assertEquals("DELETE", captor.getValue().method());
    }

    @Test
    void deleteScheduledQueryAsync_usesDeleteOnIdPath() throws Exception {
        mockAsyncResponse(200, "");

        client.deleteScheduledQueryAsync(99L).get();

        ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(mockHttpClient).sendAsync(captor.capture(), any());
        assertTrue(captor.getValue().uri().toString().endsWith("/api/v1/fleet/queries/id/99"));
        assertEquals("DELETE", captor.getValue().method());
    }

    @Test
    void deletePolicyAsync_usesBatchDeletePost() throws Exception {
        mockAsyncResponse(200, "{\"deleted\":[55]}");

        client.deletePolicyAsync(55L).get();

        ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(mockHttpClient).sendAsync(captor.capture(), any());
        assertTrue(captor.getValue().uri().toString().endsWith("/api/v1/fleet/policies/delete"));
        assertEquals("POST", captor.getValue().method());
    }

    @Test
    void hostListMustNotBeEmpty() {
        CompletableFuture<Long> future = client.addPolicyHostsAsync(1L, List.of());
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
