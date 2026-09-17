package com.openframe.sdk.fleetmdm;

import com.openframe.sdk.fleetmdm.model.FleetSoftware;
import com.openframe.sdk.fleetmdm.model.FleetVulnerability;
import com.openframe.sdk.fleetmdm.model.Host;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetMdmClientTest {

    @Mock HttpClient httpClient;
    @Mock HttpResponse<String> httpResponse;

    FleetMdmClient client;

    @BeforeEach
    void setUp() {
        client = new FleetMdmClient("https://fleet.example.com", "token", httpClient);
    }

    @Test
    void getHostById_success() throws IOException, InterruptedException {
        String body = """
            { "host": { "id": 1, "hostname": "mac" } }
            """;
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(body);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(httpResponse);

        Host host = client.getHostById(1);
        assertNotNull(host);
        assertEquals(1L, host.getId());
        assertEquals("mac", host.getHostname());
    }

    @Test
    void getHostById_hostContainsVulnerableSoftware_preservesDeviceVulnerabilityFields() throws Exception {
        // setup
        String body = """
                {
                  "host": {
                    "id": 1,
                    "hostname": "windows-device",
                    "software": [
                      {
                        "id": 42,
                        "name": "Example Browser",
                        "version": "1.2.3",
                        "source": "apps",
                        "vendor": "Example Corp",
                        "vulnerabilities": [
                          {
                            "cve": "CVE-2026-1234",
                            "details_link": "https://example.com/CVE-2026-1234",
                            "created_at": "2026-09-17T10:00:00Z",
                            "cvss_score": 9.8,
                            "epss_probability": 0.95,
                            "cisa_known_exploit": true,
                            "cve_published": "2026-09-16T00:00:00Z",
                            "resolved_in_version": "1.2.4"
                          },
                          {
                            "cve": "CVE-2026-5678",
                            "details_link": "https://example.com/CVE-2026-5678",
                            "created_at": "2026-09-17T11:00:00Z",
                            "cvss_score": null,
                            "epss_probability": null,
                            "cisa_known_exploit": null,
                            "cve_published": null,
                            "resolved_in_version": null
                          }
                        ]
                      }
                    ]
                  }
                }
                """;
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(body);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(httpResponse);

        // execution
        Host host = client.getHostById(1);

        // verifications
        List<FleetSoftware> software = host.getSoftware();
        assertEquals(1, software.size());
        FleetSoftware application = software.get(0);
        assertEquals(42L, application.getId());
        assertEquals("Example Browser", application.getName());
        assertEquals("1.2.3", application.getVersion());
        assertEquals("apps", application.getSource());
        assertEquals("Example Corp", application.getVendor());

        List<FleetVulnerability> vulnerabilities = application.getVulnerabilities();
        assertEquals(2, vulnerabilities.size());
        FleetVulnerability premiumVulnerability = vulnerabilities.get(0);
        assertEquals("CVE-2026-1234", premiumVulnerability.getCve());
        assertEquals("https://example.com/CVE-2026-1234", premiumVulnerability.getDetailsLink());
        assertEquals("2026-09-17T10:00:00Z", premiumVulnerability.getCreatedAt());
        assertEquals(9.8, premiumVulnerability.getCvssScore());
        assertEquals(0.95, premiumVulnerability.getEpssProbability());
        assertEquals(true, premiumVulnerability.getCisaKnownExploit());
        assertEquals("2026-09-16T00:00:00Z", premiumVulnerability.getCvePublished());
        assertEquals("1.2.4", premiumVulnerability.getResolvedInVersion());

        FleetVulnerability standardVulnerability = vulnerabilities.get(1);
        assertNull(standardVulnerability.getCvssScore());
        assertNull(standardVulnerability.getEpssProbability());
        assertNull(standardVulnerability.getCisaKnownExploit());
        assertNull(standardVulnerability.getCvePublished());
        assertNull(standardVulnerability.getResolvedInVersion());
    }

    @Test
    void getHostById_notFound() throws IOException, InterruptedException {
        when(httpResponse.statusCode()).thenReturn(404);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(httpResponse);

        Host host = client.getHostById(42);
        assertNull(host);
    }

    @Test
    void getHostById_error() throws IOException, InterruptedException {
        when(httpResponse.statusCode()).thenReturn(500);
        when(httpResponse.body()).thenReturn("err");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(httpResponse);

        assertThrows(RuntimeException.class, () -> client.getHostById(1));
    }
}
