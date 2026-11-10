package com.openframe.data.repository.rmm.software;

import java.util.Optional;

public interface DeviceSoftwareAggregationRepository {

    Optional<SoftwareTitleRollup> rollUpTitle(String tenantId, Long softwareTitleId);

    Optional<CveRollup> rollUpCve(String tenantId, String cveId);
}
