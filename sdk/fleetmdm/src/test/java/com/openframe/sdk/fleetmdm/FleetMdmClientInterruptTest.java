package com.openframe.sdk.fleetmdm;

import com.openframe.sdk.fleetmdm.exception.FleetMdmApiException;
import com.openframe.sdk.fleetmdm.exception.FleetMdmException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The client does not declare {@code InterruptedException} any more, so the thread's interrupt flag
 * is the only thing left telling a caller that its thread is being shut down: it has to survive the
 * wrapping into {@link FleetMdmException}, on every method, not just the ones a caller remembered.
 */
class FleetMdmClientInterruptTest {

    private HttpClient httpClient;
    private FleetMdmClient client;

    @BeforeEach
    void setUp() {
        httpClient = mock(HttpClient.class);
        client = new FleetMdmClient("https://fleet.test.com", "test-token", httpClient);
    }

    @AfterEach
    void clearInterruptFlag() {
        Thread.interrupted();
    }

    @SuppressWarnings("unchecked")
    private void sendThrows(Exception e) throws Exception {
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenThrow(e);
    }

    @Test
    void interruptedDirectCallRestoresTheInterruptFlag() throws Exception {
        sendThrows(new InterruptedException("shutting down"));

        FleetMdmException thrown = assertThrows(FleetMdmException.class, () -> client.getQueryById(7));

        assertTrue(thrown.getMessage().contains("Interrupted while trying to fetch Fleet query 7"), thrown.getMessage());
        assertInstanceOf(InterruptedException.class, thrown.getCause());
        assertTrue(Thread.currentThread().isInterrupted(), "interrupt flag must be re-armed");
    }

    @Test
    void interruptedCallThroughTheSharedRequestHelperAlsoRestoresTheFlag() throws Exception {
        sendThrows(new InterruptedException("shutting down"));

        FleetMdmException thrown = assertThrows(FleetMdmException.class, () -> client.listPolicies());

        assertTrue(thrown.getMessage().contains("Interrupted while trying to list Fleet policies"), thrown.getMessage());
        assertTrue(Thread.currentThread().isInterrupted(), "interrupt flag must be re-armed");
    }

    @Test
    void ioFailureIsWrappedAndLeavesTheFlagAlone() throws Exception {
        sendThrows(new IOException("connection reset"));

        FleetMdmException thrown = assertThrows(FleetMdmException.class, () -> client.getPolicyById(3));

        assertFalse(thrown instanceof FleetMdmApiException, "an I/O failure is not an API status");
        assertTrue(thrown.getMessage().contains("Failed to fetch Fleet policy 3"), thrown.getMessage());
        assertInstanceOf(IOException.class, thrown.getCause());
        assertFalse(Thread.currentThread().isInterrupted());
    }

    @Test
    @SuppressWarnings("unchecked")
    void apiStatusKeepsItsOwnTypeInsteadOfBeingWrapped() throws Exception {
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(401);
        when(response.body()).thenReturn("{\"error\":\"unauthorized\"}");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);

        FleetMdmApiException thrown = assertThrows(FleetMdmApiException.class, () -> client.getHostById(1));

        assertEquals(401, thrown.getStatusCode());
    }
}
