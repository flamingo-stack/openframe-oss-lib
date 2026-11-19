package com.openframe.external.service;

import com.openframe.core.exception.BaseException;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.ForbiddenException;
import com.openframe.core.exception.InternalException;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.external.config.FleetProxyProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FleetProxyGuardTest {

    private static final String FLEET = "fleetmdm-server";
    private static final String TENANT_ID = "tenant-a";
    private static final List<String> ALLOWED = List.of(
            "GET /api/{v}/fleet/hosts",
            "GET /api/{v}/fleet/hosts/{id:[0-9]+}",
            "GET /api/{v}/fleet/hosts/identifier/{identifier}",
            "GET /api/{v}/fleet/hosts/{id:[0-9]+}/software"
    );

    @Mock
    private TenantIdProvider tenantIdProvider;

    @Test
    void shouldGuard_fleetToolAndEnabled_true() {
        // setup
        FleetProxyGuard guard = guard(true, ALLOWED);

        // execution
        boolean shouldGuard = guard.shouldGuard(FLEET);

        // verifications
        assertThat(shouldGuard).isTrue();
    }

    @Test
    void shouldGuard_otherTool_false() {
        // setup
        FleetProxyGuard guard = guard(true, ALLOWED);

        // execution
        boolean shouldGuard = guard.shouldGuard("tactical-rmm");

        // verifications
        assertThat(shouldGuard).isFalse();
    }

    @Test
    void shouldGuard_multiTenancyDisabled_false() {
        // setup
        FleetProxyGuard guard = guard(false, ALLOWED);

        // execution
        boolean shouldGuard = guard.shouldGuard(FLEET);

        // verifications
        assertThat(shouldGuard).isFalse();
    }

    @Test
    void shouldGuard_defaultProperties_false() {
        // setup
        FleetProxyGuard guard = new FleetProxyGuard(new FleetProxyProperties(), tenantIdProvider);

        // execution
        boolean shouldGuard = guard.shouldGuard(FLEET);

        // verifications
        assertThat(shouldGuard).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/v1/fleet/hosts",
            "/api/latest/fleet/hosts/42",
            "/api/v1/fleet/hosts/identifier/4C4C4544-0042-3510-8051-B4C04F4E3732",
            "/api/v1/fleet/hosts/42/software"
    })
    void requireAllowed_eachOfTheFourEndpoints_passes(String toolPath) {
        // setup
        FleetProxyGuard guard = guard(true, ALLOWED);

        // execution
        Throwable thrown = catchThrowable(() -> guard.requireAllowed("GET", toolPath));

        // verifications
        assertThat(thrown).isNull();
    }

    @ParameterizedTest
    @CsvSource({
            "POST, /api/v1/fleet/hosts/42/refetch",
            "GET, /api/v1/fleet/queries",
            "GET, /api/v1/fleet/hosts/42/foo",
            "DELETE, /api/v1/fleet/hosts/42",
            "HEAD, /api/v1/fleet/hosts",
            "GET, /api/v1/fleet/software",
            "GET, /api/v1/fleet/hosts/count",
            "GET, /api/v1/fleet/hosts/report",
            "GET, /api/v1/fleet/hosts/summary/software",
            "GET, /api/v1/fleet/hosts/42/",
            "GET, /api/v1/fleet//hosts",
            "GET, /API/V1/FLEET/HOSTS",
            "GET, /"
    })
    void requireAllowed_offListEndpoint_throwsEndpointNotAllowed(String method, String toolPath) {
        // setup
        FleetProxyGuard guard = guard(true, ALLOWED);

        // execution
        Throwable thrown = catchThrowable(() -> guard.requireAllowed(method, toolPath));

        // verifications
        assertEndpointNotAllowed(thrown);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/v1/fleet/hosts/../software",
            "/api/v1/fleet/hosts/%2e%2e/software",
            "/api/v1/fleet/hosts/%2E%2E/software",
            "/api/v1/fleet/hosts/./software",
            "/api/v1/fleet/hosts/1%2F..%2Fqueries/software",
            "/api/v1/fleet/hosts/1%5C..%5Cqueries/software",
            "/api/v1/fleet/hosts/42;x=1/software",
            "/api/v1/fleet/hosts/identifier/..",
            "/api/v1/fleet/hosts/identifier/.",
            "/api/v1/fleet/hosts/identifier/a%2F..%2F..%2Fsoftware",
            "/api/v1/fleet/hosts/identifier/a%5C..%5Csoftware"
    })
    void requireAllowed_dotOrEncodedSeparatorSegment_throwsEndpointNotAllowed(String toolPath) {
        // setup
        FleetProxyGuard guard = guard(true, ALLOWED);

        // execution
        Throwable thrown = catchThrowable(() -> guard.requireAllowed("GET", toolPath));

        // verifications
        assertEndpointNotAllowed(thrown);
    }

    @Test
    void requireAllowed_enabledWithEmptyList_throwsEndpointNotAllowed() {
        // setup
        FleetProxyGuard guard = guard(true, List.of());

        // execution
        Throwable thrown = catchThrowable(() -> guard.requireAllowed("GET", "/api/v1/fleet/hosts"));

        // verifications
        assertEndpointNotAllowed(thrown);
    }

    @Test
    void requireAllowed_offListEndpoint_messageNamesMethodAndPath() {
        // setup
        FleetProxyGuard guard = guard(true, ALLOWED);

        // execution
        Throwable thrown = catchThrowable(() -> guard.requireAllowed("POST", "/api/v1/fleet/hosts/42/refetch"));

        // verifications
        assertThat(thrown).hasMessageContaining("POST /api/v1/fleet/hosts/42/refetch");
    }

    @Test
    void tenantId_fromProvider_returned() {
        // setup
        FleetProxyGuard guard = guard(true, ALLOWED);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);

        // execution
        String tenantId = guard.tenantId();

        // verifications
        assertThat(tenantId).isEqualTo(TENANT_ID);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "  "})
    void tenantId_blank_throwsInternal(String blank) {
        // setup
        FleetProxyGuard guard = guard(true, ALLOWED);
        when(tenantIdProvider.getTenantId()).thenReturn(blank);

        // execution
        Throwable thrown = catchThrowable(guard::tenantId);

        // verifications
        assertThat(thrown).isInstanceOf(InternalException.class).hasMessageContaining("tenant");
    }

    @Test
    void tenantId_null_throwsInternal() {
        // setup
        FleetProxyGuard guard = guard(true, ALLOWED);
        when(tenantIdProvider.getTenantId()).thenReturn(null);

        // execution
        Throwable thrown = catchThrowable(guard::tenantId);

        // verifications
        assertThat(thrown).isInstanceOf(InternalException.class).hasMessageContaining("tenant");
    }

    private FleetProxyGuard guard(boolean enabled, List<String> allowed) {
        FleetProxyProperties properties = new FleetProxyProperties();
        properties.setEnabled(enabled);
        properties.setAllowedEndpoints(allowed);
        return new FleetProxyGuard(properties, tenantIdProvider);
    }

    private static void assertEndpointNotAllowed(Throwable thrown) {
        assertThat(thrown).isInstanceOf(ForbiddenException.class);
        assertThat(((BaseException) thrown).getErrorCode()).isEqualTo(ErrorCode.ENDPOINT_NOT_ALLOWED);
        assertThat(((BaseException) thrown).getHttpStatus()).isEqualTo(HttpStatus.FORBIDDEN);
    }
}
