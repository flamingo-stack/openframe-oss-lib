package com.openframe.data.service.rmm.software;

import com.openframe.data.document.rmm.software.SoftwareSettings;
import com.openframe.data.repository.rmm.software.SoftwareSettingsRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

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
        SoftwareSettings settings = get();
        settings.setUpdateExistingChocolateyPackages(updateExistingChocolateyPackages);
        return softwareSettingsRepository.save(settings);
    }
}
