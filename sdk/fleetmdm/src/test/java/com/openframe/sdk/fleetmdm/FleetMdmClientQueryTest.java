package com.openframe.sdk.fleetmdm;

import com.openframe.sdk.fleetmdm.exception.FleetMdmApiException;
import com.openframe.sdk.fleetmdm.model.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Unit tests for Fleet MDM Client query-related methods
 */
public class FleetMdmClientQueryTest {

    private FleetMdmClient client;
    private HttpClient mockHttpClient;

    @BeforeEach
    public void setUp() {
        mockHttpClient = mock(HttpClient.class);
        client = new FleetMdmClient("https://fleet.test.com", "test-token", mockHttpClient);
    }

    @Test
    public void testGetQueryById_Success() throws IOException, InterruptedException {
        // Arrange
        String jsonResponse = """
            {
              "query": {
                "id": 2,
                "name": "System Info Query",
                "description": "Get system info",
                "query": "SELECT * FROM system_info",
                "created_at": "2024-01-02T12:00:00Z",
                "updated_at": "2024-01-02T12:00:00Z",
                "saved": true,
                "interval": 0,
                "automations_enabled": false
              }
            }
            """;
        
        @SuppressWarnings("unchecked")
        HttpResponse<String> mockResponse = (HttpResponse<String>) mock(HttpResponse.class);
        when(mockResponse.statusCode()).thenReturn(200);
        when(mockResponse.body()).thenReturn(jsonResponse);
        when(mockHttpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(mockResponse);
        
        // Act
        Query query = client.getQueryById(2L);
        
        // Assert
        assertNotNull(query);
        assertEquals(2L, query.getId());
        assertEquals("System Info Query", query.getName());
        assertEquals("Get system info", query.getDescription());
        assertEquals("SELECT * FROM system_info", query.getQuery());
        assertTrue(query.getSaved());
        assertEquals(0, query.getInterval());
        assertFalse(query.getAutomationsEnabled());
        assertFalse(query.isScheduled()); // Not scheduled because interval is 0
    }

    @Test
    public void testGetQueryById_NotFound() throws IOException, InterruptedException {
        // Arrange
        @SuppressWarnings("unchecked")
        HttpResponse<String> mockResponse = (HttpResponse<String>) mock(HttpResponse.class);
        when(mockResponse.statusCode()).thenReturn(404);
        when(mockResponse.body()).thenReturn("{\"message\":\"Query not found\"}");
        when(mockHttpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(mockResponse);
        
        // Act
        Query query = client.getQueryById(999L);
        
        // Assert
        assertNull(query);
    }

    @Test
    public void testGetQueryById_Unauthorized() throws IOException, InterruptedException {
        // Arrange
        @SuppressWarnings("unchecked")
        HttpResponse<String> mockResponse = (HttpResponse<String>) mock(HttpResponse.class);
        when(mockResponse.statusCode()).thenReturn(401);
        when(mockResponse.body()).thenReturn("{\"message\":\"Unauthorized\"}");
        when(mockHttpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(mockResponse);
        
        // Act & Assert
        FleetMdmApiException exception = assertThrows(FleetMdmApiException.class, () -> {
            client.getQueryById(1L);
        });
        assertTrue(exception.getMessage().contains("Authentication failed"));
    }

}

