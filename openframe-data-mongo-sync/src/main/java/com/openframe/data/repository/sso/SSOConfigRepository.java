package com.openframe.data.repository.sso;

import com.openframe.data.document.sso.SSOConfig;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

// NOTE: SSOConfig is intentionally NOT tenant-scoped. SSO provider configuration
// (e.g. provider name/settings, enabled flag) is a global, deployment-wide
// configuration and is not per-tenant data, so this repository is a plain
// @Repository rather than a @TenantAwareRepository over a TenantScoped document.
@Repository
public interface SSOConfigRepository extends MongoRepository<SSOConfig, String> {

    Optional<SSOConfig> findByProvider(String provider);

    List<SSOConfig> findByEnabledTrue();
}
