package com.openframe.sdk.fleetmdm;

import com.openframe.sdk.fleetmdm.model.LoginRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetMdmClientTenantHeaderTest {

    private static final String TENANT_ID = "3f2c9a1e-0000-0000-0000-tenant";

    @Mock HttpClient httpClient;
    @Mock HttpResponse<String> httpResponse;

    private HttpRequest sentRequest(FleetMdmClient client) throws Exception {
        when(httpResponse.statusCode()).thenReturn(404);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(httpResponse);

        client.getHostById(1);

        ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient).send(captor.capture(), any(HttpResponse.BodyHandler.class));
        return captor.getValue();
    }

    @Test
    void sendsTenantHeaderWhenTenantIdProvided() throws Exception {
        FleetMdmClient client = new FleetMdmClient("https://fleet.example.com", "token", TENANT_ID, httpClient);

        HttpRequest request = sentRequest(client);

        assertEquals(List.of(TENANT_ID), request.headers().allValues(FleetMdmClient.TENANT_ID_HEADER));
    }

    @Test
    void sendsNoTenantHeaderWithoutTenantId() throws Exception {
        FleetMdmClient client = new FleetMdmClient("https://fleet.example.com", "token", httpClient);

        HttpRequest request = sentRequest(client);

        assertTrue(request.headers().allValues(FleetMdmClient.TENANT_ID_HEADER).isEmpty());
    }

    @Test
    void sendsNoTenantHeaderForBlankTenantId() throws Exception {
        FleetMdmClient client = new FleetMdmClient("https://fleet.example.com", "token", " ", httpClient);

        HttpRequest request = sentRequest(client);

        assertTrue(request.headers().allValues(FleetMdmClient.TENANT_ID_HEADER).isEmpty());
    }

    @Test
    void setupClientSendsTenantHeaderWhenTenantIdProvided() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn("{\"token\":\"t\"}");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(httpResponse);
        FleetMdmSetupClient setupClient =
                new FleetMdmSetupClient("https://fleet.example.com", TENANT_ID, httpClient);

        setupClient.login(new LoginRequest());

        ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient).send(captor.capture(), any(HttpResponse.BodyHandler.class));
        assertEquals(List.of(TENANT_ID), captor.getValue().headers().allValues(FleetMdmClient.TENANT_ID_HEADER));
    }

    @Test
    void setupClientSendsNoTenantHeaderWithoutTenantId() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn("{\"token\":\"t\"}");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(httpResponse);
        FleetMdmSetupClient setupClient = new FleetMdmSetupClient("https://fleet.example.com", null, httpClient);

        setupClient.login(new LoginRequest());

        ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient).send(captor.capture(), any(HttpResponse.BodyHandler.class));
        assertTrue(captor.getValue().headers().allValues(FleetMdmClient.TENANT_ID_HEADER).isEmpty());
    }

    @Test
    void validateRejectsBlankTenantIdWhenMultiTenancyEnabled() {
        assertThrows(IllegalStateException.class, () -> FleetTenantHeader.validate(true, " "));
        assertThrows(IllegalStateException.class, () -> FleetTenantHeader.validate(true, null));
        assertEquals(TENANT_ID, FleetTenantHeader.validate(true, TENANT_ID));
        assertEquals(null, FleetTenantHeader.validate(false, null));
    }
}
