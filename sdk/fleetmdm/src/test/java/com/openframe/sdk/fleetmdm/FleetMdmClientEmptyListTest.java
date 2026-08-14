package com.openframe.sdk.fleetmdm;

import com.openframe.sdk.fleetmdm.model.Policy;
import com.openframe.sdk.fleetmdm.model.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetMdmClientEmptyListTest {

    @Mock HttpClient httpClient;
    @Mock HttpResponse<String> httpResponse;

    FleetMdmClient client;

    @BeforeEach
    void setUp() {
        client = new FleetMdmClient("https://fleet.example.com", "token", httpClient);
    }

    private void respondWith(String body) throws IOException, InterruptedException {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(body);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(httpResponse);
    }

    @Test
    void listPolicies_nullList() throws IOException, InterruptedException {
        respondWith("{\"policies\": null}");
        List<Policy> policies = client.listPolicies();
        assertTrue(policies.isEmpty());
    }

    @Test
    void listScheduledQueries_nullList() throws IOException, InterruptedException {
        respondWith("{\"queries\": null}");
        List<Query> queries = client.listScheduledQueries();
        assertTrue(queries.isEmpty());
    }

    @Test
    void listPolicies_emptyArray() throws IOException, InterruptedException {
        respondWith("{\"policies\": []}");
        List<Policy> policies = client.listPolicies();
        assertTrue(policies.isEmpty());
    }

    @Test
    void listScheduledQueries_emptyArray() throws IOException, InterruptedException {
        respondWith("{\"queries\": []}");
        List<Query> queries = client.listScheduledQueries();
        assertTrue(queries.isEmpty());
    }

    @Test
    void listPoliciesAsync_nullList() throws Exception {
        respondAsyncWith("{\"policies\": null}");
        List<Policy> policies = client.listPoliciesAsync().get();
        assertTrue(policies.isEmpty());
    }

    @Test
    void listScheduledQueriesAsync_nullList() throws Exception {
        respondAsyncWith("{\"queries\": null}");
        List<Query> queries = client.listScheduledQueriesAsync().get();
        assertTrue(queries.isEmpty());
    }

    private void respondAsyncWith(String body) {
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.body()).thenReturn(body);
        when(httpClient.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(CompletableFuture.completedFuture(response));
    }
}
