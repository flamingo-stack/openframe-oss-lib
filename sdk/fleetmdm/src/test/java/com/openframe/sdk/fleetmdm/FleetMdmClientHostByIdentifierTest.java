package com.openframe.sdk.fleetmdm;

import com.openframe.sdk.fleetmdm.exception.FleetMdmApiException;
import com.openframe.sdk.fleetmdm.exception.FleetMdmArgumentException;
import com.openframe.sdk.fleetmdm.exception.FleetMdmNotFoundException;
import com.openframe.sdk.fleetmdm.model.Host;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetMdmClientHostByIdentifierTest {

    private static final String BASE_URL = "https://fleet.example.com";
    private static final String TENANT_ID = "tenant-1";
    private static final String HARDWARE_UUID = "5C0B4A3E-1F2D-4E6A-9B8C-7D6E5F4A3B2C";
    private static final String INSTANCE_ID = "6f1d2c3b-4a5e-4f60-9a7b-8c9d0e1f2a3b";

    @Mock private HttpClient httpClient;
    @Mock private HttpResponse<String> httpResponse;

    @Captor private ArgumentCaptor<HttpRequest> requestCaptor;

    private FleetMdmClient client;

    @BeforeEach
    void setUp() {
        client = new FleetMdmClient(BASE_URL, "token", TENANT_ID, httpClient);
    }

    @Test
    void getHostByIdentifier_hostFound_parsesHostAndSendsTenantHeader() throws IOException, InterruptedException {
        // setup
        String body = """
                { "host": { "id": 42, "uuid": "%s", "osquery_host_id": "%s", "osquery_version": "5.12.0" } }
                """.formatted(HARDWARE_UUID, INSTANCE_ID);
        stubResponse(200, body);

        // execution
        Host host = client.getHostByIdentifier(INSTANCE_ID);

        // verifications
        assertThat(host)
                .extracting(Host::getId, Host::getUuid, Host::getOsqueryHostId, Host::getOsqueryVersion)
                .containsExactly(42L, HARDWARE_UUID, INSTANCE_ID, "5.12.0");
        verify(httpClient).send(requestCaptor.capture(), any(HttpResponse.BodyHandler.class));
        assertThat(requestCaptor.getValue().uri())
                .hasToString(BASE_URL + "/api/v1/fleet/hosts/identifier/" + INSTANCE_ID + "?exclude_software=true");
        assertThat(requestCaptor.getValue().headers().allValues(FleetMdmClient.TENANT_ID_HEADER))
                .containsExactly(TENANT_ID);
    }

    @Test
    void getHostByIdentifier_notFound_throwsNotFound() throws IOException, InterruptedException {
        // setup
        stubStatus(404);

        // execution
        FleetMdmNotFoundException ex = assertThrows(FleetMdmNotFoundException.class, () -> client.getHostByIdentifier(INSTANCE_ID));

        // verifications
        assertThat(ex.getMessage()).contains(INSTANCE_ID);
        assertThat(ex.getStatusCode()).isEqualTo(404);
    }

    @Test
    void getHostByIdentifier_unauthorized_throwsApiException() throws IOException, InterruptedException {
        // setup
        stubResponse(401, "unauthorized");

        // execution
        FleetMdmApiException ex = assertThrows(FleetMdmApiException.class, () -> client.getHostByIdentifier(INSTANCE_ID));

        // verifications
        assertThat(ex.getMessage()).contains("Authentication failed");
    }

    @Test
    void getHostByIdentifier_serverError_throwsApiException() throws IOException, InterruptedException {
        // setup
        stubResponse(500, "boom");

        // execution
        FleetMdmApiException ex = assertThrows(FleetMdmApiException.class, () -> client.getHostByIdentifier(INSTANCE_ID));

        // verifications
        assertThat(ex.getMessage()).contains("Failed to fetch host");
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void getHostByIdentifier_blankIdentifier_rejectedWithoutRequest(String identifier) {
        // setup

        // execution
        FleetMdmArgumentException ex = assertThrows(FleetMdmArgumentException.class, () -> client.getHostByIdentifier(identifier));

        // verifications
        assertThat(ex.getMessage()).contains("identifier");
        verifyNoInteractions(httpClient);
    }

    @Test
    void getHostByIdentifier_reservedCharacters_identifierEncodedInPath() throws IOException, InterruptedException {
        // setup
        stubResponse(200, """
                { "host": { "id": 7 } }
                """);

        // execution
        client.getHostByIdentifier("a/b#c");

        // verifications
        verify(httpClient).send(requestCaptor.capture(), any(HttpResponse.BodyHandler.class));
        assertThat(requestCaptor.getValue().uri())
                .hasToString(BASE_URL + "/api/v1/fleet/hosts/identifier/a%2Fb%23c?exclude_software=true");
    }

    private void stubStatus(int status) throws IOException, InterruptedException {
        when(httpResponse.statusCode()).thenReturn(status);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(httpResponse);
    }

    private void stubResponse(int status, String body) throws IOException, InterruptedException {
        stubStatus(status);
        when(httpResponse.body()).thenReturn(body);
    }
}
