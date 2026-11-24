package com.openframe.data.repository.rmm.software;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface DeviceSoftwareAggregationRepository {

    Optional<SoftwareTitleRollup> rollUpTitle(String tenantId, Long softwareTitleId);

    Optional<CveRollup> rollUpCve(String tenantId, String cveId);

    List<String> machineIdsWithCve(String tenantId, String cveId);

    Map<Long, List<String>> machineIdsByTitleWithCve(String tenantId, String cveId);

    List<String> machineIdsWithTitle(String tenantId, Long softwareTitleId);
}
