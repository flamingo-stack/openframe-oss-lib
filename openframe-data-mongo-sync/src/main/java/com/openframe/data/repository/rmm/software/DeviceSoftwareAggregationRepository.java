package com.openframe.data.repository.rmm.software;

import java.util.Optional;

// Read-model rollups computed inside Mongo from the connected device_software rows, so a projector never loads the rows
public interface DeviceSoftwareAggregationRepository {

    Optional<SoftwareTitleRollup> rollUpTitle(String tenantId, Long softwareTitleId);

    Optional<CveRollup> rollUpCve(String tenantId, String cveId);
}
