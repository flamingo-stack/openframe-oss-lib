package com.openframe.authz.service.policy;

import java.util.Optional;

/**
 * Abstraction for looking up global domain policy (per-tenant) without hard dependency.
 * Default implementation returns empty; SaaS Auth Server provides a real implementation.
 */
public interface GlobalDomainPolicyLookup {
	Optional<String> findTenantIdByDomainIfAutoAllowed(String domain);
}


