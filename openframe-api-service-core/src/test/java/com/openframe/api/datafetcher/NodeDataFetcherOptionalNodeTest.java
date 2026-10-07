package com.openframe.api.datafetcher;

import com.openframe.api.dto.rmm.software.SoftwareBundleResponse;
import com.openframe.api.relay.RelayIdCodec;
import com.openframe.api.service.InstalledAgentService;
import com.openframe.api.service.TagService;
import com.openframe.api.service.ToolConnectionService;
import com.openframe.api.service.ToolService;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.schedule.ScheduleRunService;
import com.openframe.api.service.rmm.schedule.ScheduleScriptService;
import com.openframe.api.service.rmm.script.ScriptExecutionService;
import com.openframe.api.service.rmm.script.ScriptService;
import com.openframe.api.service.rmm.software.SoftwareBundleService;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.repository.tenant.TenantRepository;
import com.openframe.data.service.OrganizationService;
import graphql.relay.Relay;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tenant and SoftwareBundle nodes depend on beans that exist only in some deployments: a missing bean must
 * resolve the node to null instead of failing, a present bean must be queried by the decoded raw id.
 */
@ExtendWith(MockitoExtension.class)
class NodeDataFetcherOptionalNodeTest {

    private static final Relay RELAY = new Relay();

    @Mock private DeviceService deviceService;
    @Mock private OrganizationService organizationService;
    @Mock private ToolService toolService;
    @Mock private TagService tagService;
    @Mock private ToolConnectionService toolConnectionService;
    @Mock private InstalledAgentService installedAgentService;
    @Mock private ScriptService scriptService;
    @Mock private ScriptExecutionService scriptExecutionService;
    @Mock private ScheduleScriptService scheduleScriptService;
    @Mock private ScheduleRunService scheduleRunService;
    @Mock private TenantRepository tenantRepository;
    @Mock private SoftwareBundleService softwareBundleService;

    @Test
    @DisplayName("node(Tenant): returns the tenant from the repository when the repository bean exists")
    void tenant_repositoryPresent_returnsTenant() {
        Tenant tenant = Tenant.builder().id("t-1").build();
        when(tenantRepository.findById("t-1")).thenReturn(Optional.of(tenant));

        Object node = fetcher(tenantRepository, null).node(RELAY.toGlobalId("Tenant", "t-1"));

        assertThat(node).isSameAs(tenant);
    }

    @Test
    @DisplayName("node(Tenant): returns null when the repository bean exists but the tenant does not")
    void tenant_repositoryPresent_unknownId_returnsNull() {
        when(tenantRepository.findById("missing")).thenReturn(Optional.empty());

        assertThat(fetcher(tenantRepository, null).node(RELAY.toGlobalId("Tenant", "missing"))).isNull();
    }

    @Test
    @DisplayName("node(Tenant): returns null when no TenantRepository bean is deployed")
    void tenant_repositoryAbsent_returnsNull() {
        assertThat(fetcher(null, null).node(RELAY.toGlobalId("Tenant", "t-1"))).isNull();
    }

    @Test
    @DisplayName("node(SoftwareBundle): returns the bundle from the service when the service bean exists")
    void softwareBundle_servicePresent_returnsBundle() {
        SoftwareBundleResponse bundle = SoftwareBundleResponse.builder().build();
        when(softwareBundleService.findById("b-1")).thenReturn(Optional.of(bundle));

        Object node = fetcher(null, softwareBundleService).node(RELAY.toGlobalId("SoftwareBundle", "b-1"));

        assertThat(node).isSameAs(bundle);
    }

    @Test
    @DisplayName("node(SoftwareBundle): returns null when no SoftwareBundleService bean is deployed")
    void softwareBundle_serviceAbsent_returnsNull() {
        assertThat(fetcher(null, null).node(RELAY.toGlobalId("SoftwareBundle", "b-1"))).isNull();
    }

    @Test
    @DisplayName("nodes: a missing optional bean yields null for its ids without failing the rest")
    void nodes_mixedPresence_resolvesEachIndependently() {
        Tenant tenant = Tenant.builder().id("t-1").build();
        when(tenantRepository.findById("t-1")).thenReturn(Optional.of(tenant));

        List<Object> nodes = fetcher(tenantRepository, null).nodes(List.of(
                RELAY.toGlobalId("Tenant", "t-1"),
                RELAY.toGlobalId("SoftwareBundle", "b-1")));

        assertThat(nodes).containsExactly(tenant, null);
    }

    private NodeDataFetcher fetcher(TenantRepository tenants, SoftwareBundleService bundles) {
        return new NodeDataFetcher(deviceService, organizationService, toolService, tagService,
                toolConnectionService, installedAgentService, scriptService, scriptExecutionService,
                scheduleScriptService, scheduleRunService, providerOf(tenants), providerOf(bundles), new RelayIdCodec());
    }

    @SuppressWarnings("unchecked")
    private static <T> ObjectProvider<T> providerOf(T bean) {
        ObjectProvider<T> provider = mock(ObjectProvider.class);
        lenient().when(provider.getIfAvailable()).thenReturn(bean);
        return provider;
    }
}
