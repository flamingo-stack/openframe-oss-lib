package com.openframe.management.service;

import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolApiKey;
import com.openframe.data.document.tool.ToolCredentials;
import com.openframe.data.document.tool.ToolUrl;
import com.openframe.data.document.tool.ToolUrlType;
import com.openframe.data.repository.tenant.TenantRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.exception.FleetMdmApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetWindowsMdmAddressServiceTest {

    private static final String TENANT_ID = "3f1a9b2c-0000-4d5e-8f00-000000000001";
    private static final String FLEET_API_URL = "http://fleet-service.platform.svc.cluster.local";

    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private TenantRepository tenantRepository;
    @Mock private FleetMdmClient fleetClient;

    private final List<String[]> clientsBuilt = new ArrayList<>();
    private FleetWindowsMdmAddressService service;

    @BeforeEach
    void setUp() {
        service = new FleetWindowsMdmAddressService(tenantIdProvider, tenantRepository) {
            @Override
            FleetMdmClient newClient(String apiUrl, String apiToken, String tenantId) {
                clientsBuilt.add(new String[]{apiUrl, apiToken, tenantId});
                return fleetClient;
            }
        };
        lenient().when(tenantIdProvider.isTenantRegistered()).thenReturn(true);
        lenient().when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
    }

    @Test
    void syncIfNeeded_writesTheTenantDomainAddressOncePerPod() {
        // setup
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Optional.of(tenant("Acme.OpenFrame.ai")));

        // execution
        service.syncIfNeeded(fleetTool("token-1"));
        service.syncIfNeeded(fleetTool("token-1"));

        // verifications
        verify(fleetClient, times(1)).setWindowsMdmServerUrl("https://acme.openframe.ai/mdm");
        assertThat(clientsBuilt)
                .containsExactly(new String[]{FLEET_API_URL + ":8080", "token-1", TENANT_ID});
    }

    @Test
    void syncIfNeeded_withoutAnApiToken_waitsForTheSetup() {
        // setup
        IntegratedTool tool = fleetTool(null);

        // execution
        service.syncIfNeeded(tool);

        // verifications
        verifyNoInteractions(tenantRepository, fleetClient);
    }

    @Test
    void syncIfNeeded_tenantNotRegistered_writesNothing() {
        // setup
        when(tenantIdProvider.isTenantRegistered()).thenReturn(false);

        // execution
        service.syncIfNeeded(fleetTool("token-1"));

        // verifications
        verifyNoInteractions(tenantRepository, fleetClient);
    }

    @Test
    void syncIfNeeded_tenantWithoutADomain_retriesOnALaterTick() {
        // setup
        when(tenantRepository.findById(TENANT_ID))
                .thenReturn(Optional.of(tenant(" ")))
                .thenReturn(Optional.of(tenant("acme.openframe.ai")));

        // execution
        service.syncIfNeeded(fleetTool("token-1"));
        service.syncIfNeeded(fleetTool("token-1"));

        // verifications
        verify(fleetClient, times(1)).setWindowsMdmServerUrl("https://acme.openframe.ai/mdm");
    }

    @Test
    void syncIfNeeded_fleetRefuses_isRetriedOnTheNextTick() {
        // setup
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Optional.of(tenant("acme.openframe.ai")));
        doThrow(new FleetMdmApiException("unsupported key provided", 400, "{}"))
                .doNothing()
                .when(fleetClient).setWindowsMdmServerUrl(anyString());

        // execution / verifications
        assertThatThrownBy(() -> service.syncIfNeeded(fleetTool("token-1"))).isInstanceOf(FleetMdmApiException.class);
        service.syncIfNeeded(fleetTool("token-1"));
        service.syncIfNeeded(fleetTool("token-1"));
        verify(fleetClient, times(2)).setWindowsMdmServerUrl("https://acme.openframe.ai/mdm");
    }

    @Test
    void syncIfNeeded_unknownTenant_writesNothing() {
        // setup
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Optional.empty());

        // execution
        service.syncIfNeeded(fleetTool("token-1"));

        // verifications
        verify(fleetClient, never()).setWindowsMdmServerUrl(any());
    }

    private static Tenant tenant(String domain) {
        Tenant tenant = new Tenant();
        tenant.setId(TENANT_ID);
        tenant.setDomain(domain);
        return tenant;
    }

    private static IntegratedTool fleetTool(String token) {
        ToolCredentials credentials = new ToolCredentials();
        if (token != null) {
            ToolApiKey apiKey = new ToolApiKey();
            apiKey.setKey(token);
            credentials.setApiKey(apiKey);
        }
        IntegratedTool tool = new IntegratedTool();
        tool.setToolUrls(List.of(ToolUrl.builder().url(FLEET_API_URL).port("8080").type(ToolUrlType.API).build()));
        tool.setCredentials(credentials);
        return tool;
    }
}
