package com.openframe.sdk.fleetmdm;

import com.openframe.sdk.fleetmdm.exception.FleetMdmApiException;
import com.openframe.sdk.fleetmdm.model.VulnerabilitiesResponse;
import com.openframe.sdk.fleetmdm.model.Vulnerability;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetMdmClientVulnerabilitiesTest {

    private static final String TENANT_ID = "3f2c9a1e-0000-0000-0000-tenant";
    private static final String REALISTIC_BODY = """
            {
              "vulnerabilities": [
                {
                  "cve": "CVE-2022-30190",
                  "created_at": "2022-06-01T00:15:00Z",
                  "hosts_count": 1234,
                  "hosts_count_updated_at": "2022-06-13T17:32:00Z",
                  "details_link": "https://msrc.microsoft.com/update-guide/en-US/vulnerability/CVE-2022-30190",
                  "cvss_score": 7.8,
                  "epss_probability": 0.9729,
                  "cisa_known_exploit": false
                },
                {
                  "cve": "CVE-2018-16463",
                  "created_at": "2018-12-31T00:15:00Z",
                  "hosts_count": 12,
                  "hosts_count_updated_at": "2022-06-13T17:32:00Z"
                }
              ],
              "count": 2,
              "counts_updated_at": "2022-06-13T17:32:00Z",
              "meta": {
                "has_next_results": false,
                "has_previous_results": false
              }
            }
            """;

    @Mock private HttpClient httpClient;
    @Mock private HttpResponse<String> httpResponse;

    @Captor private ArgumentCaptor<HttpRequest> requestCaptor;

    @Test
    void listVulnerabilities_realisticBody_parsedIgnoringUnknownFields() throws Exception {
        // setup
        stubResponse(200, REALISTIC_BODY);
        FleetMdmClient client = new FleetMdmClient("https://fleet.example.com", "token", httpClient);

        // execution
        VulnerabilitiesResponse response = client.listVulnerabilities(0, 20);

        // verifications
        assertEquals(2L, response.getCount());
        assertEquals("2022-06-13T17:32:00Z", response.getCountsUpdatedAt());
        List<Vulnerability> vulnerabilities = response.getVulnerabilities();
        assertEquals(2, vulnerabilities.size());
        assertEquals("CVE-2022-30190", vulnerabilities.get(0).getCve());
        assertEquals("2022-06-13T17:32:00Z", vulnerabilities.get(0).getHostsCountUpdatedAt());
        assertEquals("CVE-2018-16463", vulnerabilities.get(1).getCve());
    }

    @Test
    void listVulnerabilities_emptyList_deserializedWithZeroCount() throws Exception {
        // setup
        stubResponse(200, "{\"vulnerabilities\": [], \"count\": 0}");
        FleetMdmClient client = new FleetMdmClient("https://fleet.example.com", "token", httpClient);

        // execution
        VulnerabilitiesResponse response = client.listVulnerabilities(0, 20);

        // verifications
        assertTrue(response.getVulnerabilities().isEmpty());
        assertEquals(0L, response.getCount());
    }

    @Test
    void listVulnerabilities_nullList_deserializedWithZeroCount() throws Exception {
        // setup
        stubResponse(200, "{\"vulnerabilities\": null, \"count\": 0}");
        FleetMdmClient client = new FleetMdmClient("https://fleet.example.com", "token", httpClient);

        // execution
        VulnerabilitiesResponse response = client.listVulnerabilities(0, 20);

        // verifications
        assertNull(response.getVulnerabilities());
        assertEquals(0L, response.getCount());
    }

    @Test
    void listVulnerabilities_tenantClient_sendsPaginationAndTenantHeader() throws Exception {
        // setup
        stubResponse(200, "{\"vulnerabilities\": [], \"count\": 0}");
        FleetMdmClient client = new FleetMdmClient("https://fleet.example.com", "token", TENANT_ID, httpClient);

        // execution
        client.listVulnerabilities(0, 1);

        // verifications
        verify(httpClient).send(requestCaptor.capture(), any(HttpResponse.BodyHandler.class));
        HttpRequest request = requestCaptor.getValue();
        String url = request.uri().toString();
        assertTrue(url.contains("/api/latest/fleet/vulnerabilities"));
        assertTrue(url.contains("page=0&per_page=1"));
        assertEquals(List.of(TENANT_ID), request.headers().allValues(FleetMdmClient.TENANT_ID_HEADER));
    }

    @Test
    void listVulnerabilities_non200Response_throwsFleetMdmApiException() throws Exception {
        // setup
        stubResponse(500, "{\"message\": \"internal error\"}");
        FleetMdmClient client = new FleetMdmClient("https://fleet.example.com", "token", httpClient);

        // execution
        FleetMdmApiException ex = assertThrows(FleetMdmApiException.class, () -> client.listVulnerabilities(0, 20));

        // verifications
        assertTrue(ex.getMessage().contains("list Fleet vulnerabilities failed with HTTP 500"));
        assertEquals(500, ex.getStatusCode());
    }

    private void stubResponse(int statusCode, String body) throws Exception {
        when(httpResponse.statusCode()).thenReturn(statusCode);
        when(httpResponse.body()).thenReturn(body);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(httpResponse);
    }
}
