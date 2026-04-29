package com.openframe.data.service;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.repository.clientconfiguration.OpenFrameClientConfigurationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class OpenFrameClientConfigurationService {

    public static final String DEFAULT_ID = "default";

    private final OpenFrameClientConfigurationRepository repository;

    public OpenFrameClientConfiguration get() {
        return findCurrent()
                .orElseThrow(() -> new IllegalStateException("No openframe client configuration found"));
    }

    public Optional<OpenFrameClientConfiguration> findById(String id) {
        return repository.findById(id);
    }

    /**
     * Returns the current pod's client configuration. On SaaS pods, the tenant-scoped
     * MongoTemplate filters findAll() by the bound tenant, so this returns that tenant's
     * row (whose _id is a tenant-scoped composite like "{tenantId}:default" after the
     * migration). On OSS there is only one row, so findFirst() returns it directly.
     */
    public Optional<OpenFrameClientConfiguration> findCurrent() {
        return repository.findAll().stream().findFirst();
    }

    public OpenFrameClientConfiguration save(OpenFrameClientConfiguration config) {
        return repository.save(config);
    }
}
