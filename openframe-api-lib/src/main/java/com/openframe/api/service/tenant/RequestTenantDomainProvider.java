package com.openframe.api.service.tenant;

import java.util.Optional;

/**
 * The tenant domain the gateway stamped on the request being served, for transports that have one.
 * <p>
 * Implemented in the transport layer so this module stays free of HTTP: api-lib knows only that a domain may be
 * obtainable from the current request, not that it arrives in a header.
 */
public interface RequestTenantDomainProvider {

    /**
     * Empty whenever no gateway-routed request is in scope - a scheduled job, a NATS consumer, an actuator probe or
     * a local run without a gateway in front.
     */
    Optional<String> currentTenantDomain();
}
