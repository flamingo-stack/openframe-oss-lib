package com.openframe.authz.service.policy;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
@ConditionalOnMissingBean(value = GlobalDomainPolicyLookup.class, ignored = NoopGlobalDomainPolicyLookup.class)
public class NoopGlobalDomainPolicyLookup implements GlobalDomainPolicyLookup {
	@Override
	public Optional<String> findTenantIdByDomainIfAutoAllowed(String domain) {
		return Optional.empty();
	}
}
