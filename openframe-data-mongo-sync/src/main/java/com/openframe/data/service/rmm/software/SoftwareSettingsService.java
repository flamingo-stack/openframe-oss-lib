package com.openframe.data.service.rmm.software;

import com.openframe.data.document.rmm.software.SoftwareSettings;
import com.openframe.data.repository.rmm.software.SoftwareSettingsRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class SoftwareSettingsService {

    private final SoftwareSettingsRepository softwareSettingsRepository;
    private final TenantIdProvider tenantIdProvider;

    public SoftwareSettings get() {
        String tenantId = tenantIdProvider.getTenantId();
        return softwareSettingsRepository.findByTenantId(tenantId)
                .orElseGet(() -> SoftwareSettings.builder().tenantId(tenantId).build());
    }

    public boolean updatesExistingChocolateyPackages() {
        return get().isUpdateExistingChocolateyPackages();
    }

    public SoftwareSettings update(boolean updateExistingChocolateyPackages) {
        try {
            return save(updateExistingChocolateyPackages);
        } catch (DuplicateKeyException e) {
            log.debug("Software settings of the tenant were created concurrently, updating the stored document");
            return save(updateExistingChocolateyPackages);
        }
    }

    private SoftwareSettings save(boolean updateExistingChocolateyPackages) {
        SoftwareSettings settings = get();
        settings.setUpdateExistingChocolateyPackages(updateExistingChocolateyPackages);
        return softwareSettingsRepository.save(settings);
    }
}
