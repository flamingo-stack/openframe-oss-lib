package com.openframe.stream.service;

import com.openframe.data.service.IntegratedToolService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.support.PropertySourcesPlaceholderConfigurer;
import org.springframework.core.env.MapPropertySource;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Backward compatibility of the {@link FleetBaseUrlResolver} seam under real Spring wiring: the
 * resolver is an OPTIONAL constructor dependency, so per-tenant-cluster deployments — which
 * publish no such bean, exactly as they publish no {@link ClusterTenantIdResolver} — must still
 * start the context and must keep using the static {@code fleet.mdm.base-url} unchanged.
 * Shared-plane deployments that do publish a resolver bean get it injected.
 */
class FleetMdmCacheServiceWiringTest {

    private static final String STATIC_URL = "http://fleet-service.platform.svc.cluster.local:8080";

    @Configuration
    static class TenantClusterConfig {
        @Bean
        static PropertySourcesPlaceholderConfigurer placeholders() {
            return new PropertySourcesPlaceholderConfigurer();
        }

        @Bean
        IntegratedToolService integratedToolService() {
            return mock(IntegratedToolService.class);
        }
    }

    /** Shared plane: the only place a FleetBaseUrlResolver implementation is deployed. */
    @Configuration
    static class SharedClusterConfig extends TenantClusterConfig {
        @Bean
        FleetBaseUrlResolver fleetBaseUrlResolver() {
            return tenantId -> "tenant-a".equals(tenantId) ? "http://tenant-a.internal/fleet-enrichment" : null;
        }
    }

    private AnnotationConfigApplicationContext contextOf(Class<?> config) {
        AnnotationConfigApplicationContext ctx = new AnnotationConfigApplicationContext();
        ctx.getEnvironment().getPropertySources().addFirst(new MapPropertySource(
                "test", Map.of("fleet.mdm.base-url", STATIC_URL, "TENANT_ID", "tenant-a")));
        ctx.register(config);
        // Register the real @Service class so Spring uses its own constructor — the point of the
        // test is that the constructor's @Autowired(required = false) params tolerate absent beans.
        ctx.register(FleetMdmCacheService.class);
        ctx.refresh();
        return ctx;
    }

    @Test
    @DisplayName("tenant cluster (no FleetBaseUrlResolver bean): context starts, static base url kept")
    void startsWithoutResolverBean() {
        try (AnnotationConfigApplicationContext ctx = contextOf(TenantClusterConfig.class)) {
            FleetMdmCacheService cache = ctx.getBean(FleetMdmCacheService.class);
            assertThat(cache.baseUrlFor("tenant-a")).isEqualTo(STATIC_URL);
            assertThat(cache.baseUrlFor(null)).isEqualTo(STATIC_URL);
        }
    }

    @Test
    @DisplayName("shared cluster (resolver bean present): per-tenant url used, static kept as fallback")
    void usesResolverBeanWhenPresent() {
        try (AnnotationConfigApplicationContext ctx = contextOf(SharedClusterConfig.class)) {
            FleetMdmCacheService cache = ctx.getBean(FleetMdmCacheService.class);
            assertThat(cache.baseUrlFor("tenant-a")).isEqualTo("http://tenant-a.internal/fleet-enrichment");
            assertThat(cache.baseUrlFor("unknown")).isEqualTo(STATIC_URL);
        }
    }
}
