package com.openframe.gateway.service;

import com.openframe.gateway.config.prop.FleetMultiTenancyProperties;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FleetEndpointAllowlistTest {

    private static final String FLEET = "fleetmdm-server";

    /** A representative slice of the configured Fleet allowlist (see the gateway dev config). */
    private static final List<String> FLEET_ENDPOINTS = List.of(
            "GET /api/{v}/fleet/hosts",
            "GET /api/{v}/fleet/hosts/count",
            "GET /api/{v}/fleet/hosts/{id}",
            "GET /api/{v}/fleet/hosts/{id}/policies",
            "POST /api/{v}/fleet/policies/delete",
            "POST /api/{v}/fleet/queries/run",
            "DELETE /api/{v}/fleet/labels/id/{id}",
            "PUT /api/{v}/fleet/queries/{id}/hosts"
    );

    private FleetEndpointAllowlist allowlist(boolean enabled, List<String> endpoints) {
        FleetMultiTenancyProperties props = new FleetMultiTenancyProperties();
        props.setEnabled(enabled);
        props.setAllowedEndpoints(endpoints);
        return new FleetEndpointAllowlist(props);
    }

    @Test
    void allowsFleetEndpointsInTheConfiguredList() {
        FleetEndpointAllowlist a = allowlist(true, FLEET_ENDPOINTS);
        assertThat(a.isAllowed(FLEET, HttpMethod.GET, "/api/latest/fleet/hosts")).isTrue();
        assertThat(a.isAllowed(FLEET, HttpMethod.GET, "/api/v1/fleet/hosts/count")).isTrue();
        assertThat(a.isAllowed(FLEET, HttpMethod.GET, "/api/latest/fleet/hosts/1")).isTrue();
        assertThat(a.isAllowed(FLEET, HttpMethod.GET, "/api/latest/fleet/hosts/1/policies")).isTrue();
        assertThat(a.isAllowed(FLEET, HttpMethod.POST, "/api/latest/fleet/policies/delete")).isTrue();
        assertThat(a.isAllowed(FLEET, HttpMethod.POST, "/api/latest/fleet/queries/run")).isTrue();
        assertThat(a.isAllowed(FLEET, HttpMethod.DELETE, "/api/latest/fleet/labels/id/5")).isTrue();
        assertThat(a.isAllowed(FLEET, HttpMethod.PUT, "/api/v1/fleet/queries/9/hosts")).isTrue();
    }

    @Test
    void blocksFleetEndpointsNotInTheList() {
        FleetEndpointAllowlist a = allowlist(true, FLEET_ENDPOINTS);
        assertThat(a.isAllowed(FLEET, HttpMethod.GET, "/api/latest/fleet/software")).isFalse();
        assertThat(a.isAllowed(FLEET, HttpMethod.GET, "/api/latest/fleet/vulnerabilities")).isFalse();
        assertThat(a.isAllowed(FLEET, HttpMethod.GET, "/api/latest/fleet/os_versions")).isFalse();
        assertThat(a.isAllowed(FLEET, HttpMethod.GET, "/api/latest/fleet/activities")).isFalse();
        assertThat(a.isAllowed(FLEET, HttpMethod.GET, "/api/latest/fleet/users")).isFalse();
        assertThat(a.isAllowed(FLEET, HttpMethod.POST, "/api/latest/fleet/hosts/transfer")).isFalse();
    }

    @Test
    void blocksAllowedFleetPathUnderAWrongMethod() {
        FleetEndpointAllowlist a = allowlist(true, FLEET_ENDPOINTS);
        assertThat(a.isAllowed(FLEET, HttpMethod.GET, "/api/latest/fleet/hosts/1")).isTrue();
        assertThat(a.isAllowed(FLEET, HttpMethod.DELETE, "/api/latest/fleet/hosts/1")).isFalse();
    }

    @Test
    void doesNotFilterOtherTools() {
        FleetEndpointAllowlist a = allowlist(true, FLEET_ENDPOINTS);
        assertThat(a.isAllowed("tactical-rmm", HttpMethod.POST, "/anything/at/all")).isTrue();
        assertThat(a.isAllowed("meshcentral-server", HttpMethod.DELETE, "/api/whatever")).isTrue();
    }

    @Test
    void doesNotFilterWhenMultiTenancyDisabled() {
        FleetEndpointAllowlist a = allowlist(false, FLEET_ENDPOINTS);
        assertThat(a.isAllowed(FLEET, HttpMethod.GET, "/api/latest/fleet/software")).isTrue();
        assertThat(a.isAllowed(FLEET, HttpMethod.POST, "/api/latest/fleet/hosts/transfer")).isTrue();
    }

    @Test
    void enabledWithEmptyListBlocksAllFleetRequests() {
        // Fail closed: enabling the flag without configuring the list blocks the Fleet proxy entirely.
        FleetEndpointAllowlist a = allowlist(true, List.of());
        assertThat(a.isAllowed(FLEET, HttpMethod.GET, "/api/latest/fleet/hosts")).isFalse();
    }

    @Test
    void isAllowed_extraEndpoint_allowedNextToTheSharedList() {
        // setup
        FleetMultiTenancyProperties props = new FleetMultiTenancyProperties();
        props.setEnabled(true);
        props.setAllowedEndpoints(FLEET_ENDPOINTS);
        props.setExtraAllowedEndpoints(List.of("POST /api/{v}/fleet/trigger"));
        FleetEndpointAllowlist allowlist = new FleetEndpointAllowlist(props);

        // execution
        boolean extraAllowed = allowlist.isAllowed(FLEET, HttpMethod.POST, "/api/latest/fleet/trigger");
        boolean sharedAllowed = allowlist.isAllowed(FLEET, HttpMethod.GET, "/api/latest/fleet/hosts");
        boolean otherAllowed = allowlist.isAllowed(FLEET, HttpMethod.POST, "/api/latest/fleet/hosts/transfer");

        // verifications
        assertThat(extraAllowed).isTrue();
        assertThat(sharedAllowed).isTrue();
        assertThat(otherAllowed).isFalse();
    }

    @Test
    void isAllowed_noExtraEndpoints_triggerBlocked() {
        // setup
        FleetEndpointAllowlist allowlist = allowlist(true, FLEET_ENDPOINTS);

        // execution
        boolean allowed = allowlist.isAllowed(FLEET, HttpMethod.POST, "/api/latest/fleet/trigger");

        // verifications
        assertThat(allowed).isFalse();
    }
}
