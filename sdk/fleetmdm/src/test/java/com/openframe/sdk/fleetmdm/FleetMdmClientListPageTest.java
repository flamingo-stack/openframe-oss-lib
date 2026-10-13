package com.openframe.sdk.fleetmdm;

import com.openframe.sdk.fleetmdm.model.Policy;
import com.openframe.sdk.fleetmdm.model.ScheduledQueriesResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetMdmClientListPageTest {

    @Mock HttpClient httpClient;

    FleetMdmClient client;

    @BeforeEach
    void setUp() {
        client = new FleetMdmClient("https://fleet.example.com", "token", httpClient);
    }

    @Test
    void listPoliciesAsync_firstPage_asksForTheFirstPoliciesById() throws Exception {
        respondWith("{\"policies\": [{\"id\": 7, \"name\": \"Disk encryption\"}]}");

        List<Policy> policies = client.listPoliciesAsync(null, 51).get();

        assertEquals(7L, policies.get(0).getId());
        assertEquals("/api/v1/fleet/global/policies?order_key=id&order_direction=asc&per_page=51", requestedPath());
    }

    @Test
    void listPoliciesAsync_afterAnId_asksForThePoliciesAfterIt() throws Exception {
        respondWith("{\"policies\": []}");

        client.listPoliciesAsync(7L, 51).get();

        assertEquals("/api/v1/fleet/global/policies?order_key=id&order_direction=asc&per_page=51&after=7",
                requestedPath());
    }

    @Test
    void listScheduledQueriesPageAsync_firstPage_asksForPageZeroById() throws Exception {
        respondWith("{\"queries\": [{\"id\": 3, \"name\": \"os-version\"}], \"meta\": {\"has_next_results\": true}}");

        ScheduledQueriesResponse page = client.listScheduledQueriesPageAsync(0, 50).get();

        assertEquals(3L, page.getQueries().get(0).getId());
        assertEquals(Boolean.TRUE, page.getMeta().getHasNextResults());
        assertEquals("/api/v1/fleet/queries?order_key=id&order_direction=asc&page=0&per_page=50", requestedPath());
    }

    // Fleet answers HTTP 500 for the query list with "after", so a later page is asked for by number.
    @Test
    void listScheduledQueriesPageAsync_laterPage_asksByPageNumberAndNeverSendsAfter() throws Exception {
        respondWith("{\"queries\": [], \"meta\": {\"has_next_results\": false}}");

        ScheduledQueriesResponse page = client.listScheduledQueriesPageAsync(2, 50).get();

        assertEquals(Boolean.FALSE, page.getMeta().getHasNextResults());
        assertEquals("/api/v1/fleet/queries?order_key=id&order_direction=asc&page=2&per_page=50", requestedPath());
    }

    private void respondWith(String body) {
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.body()).thenReturn(body);
        when(httpClient.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(CompletableFuture.completedFuture(response));
    }

    private String requestedPath() {
        ArgumentCaptor<HttpRequest> request = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient).sendAsync(request.capture(), any(HttpResponse.BodyHandler.class));
        return request.getValue().uri().getPath() + "?" + request.getValue().uri().getQuery();
    }
}
