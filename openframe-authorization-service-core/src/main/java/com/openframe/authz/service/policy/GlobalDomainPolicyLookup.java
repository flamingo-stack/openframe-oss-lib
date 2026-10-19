package com.openframe.authz.service.policy;

import java.util.Optional;

// Default implementation returns empty; SaaS Auth Server provides a real implementation.
public interface GlobalDomainPolicyLookup {
	Optional<String> findTenantIdByDomainIfAutoAllowed(String domain);
}



