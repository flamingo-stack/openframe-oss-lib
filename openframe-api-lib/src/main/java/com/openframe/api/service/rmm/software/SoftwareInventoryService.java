package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareOnDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilityResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@ConditionalOnProperty(name = "openframe.software-management.enabled", havingValue = "true")
public class SoftwareInventoryService {

    public Optional<SoftwareResponse> findById(String softwareId) {
        log.debug("[software-mgmt stub] findById softwareId={}", softwareId);
        return Optional.empty();
    }

    public List<SoftwareResponse> listSoftware(Object filter, String search, Object pagination, Object sort) {
        log.debug("[software-mgmt stub] listSoftware");
        return List.of();
    }

    public long countSoftware(Object filter, String search) {
        return 0L;
    }

    public List<SoftwareOnDeviceResponse> listDevicesForSoftware(String softwareId,
                                                                 Object filter, String search,
                                                                 Object pagination, Object sort) {
        log.debug("[software-mgmt stub] listDevicesForSoftware softwareId={}", softwareId);
        return List.of();
    }

    public long countDevicesForSoftware(String softwareId, Object filter, String search) {
        return 0L;
    }

    public List<SoftwareVulnerabilityResponse> listVulnerabilitiesForSoftware(String softwareId,
                                                                              Object filter, String search,
                                                                              Object pagination, Object sort) {
        log.debug("[software-mgmt stub] listVulnerabilitiesForSoftware softwareId={}", softwareId);
        return List.of();
    }

    public long countVulnerabilitiesForSoftware(String softwareId, Object filter, String search) {
        return 0L;
    }
}
