package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.filter.SoftwareActionQueryFilter;
import com.openframe.data.document.rmm.software.SoftwareActionSummary;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface SoftwareActionAggregationRepository {

    List<SoftwareActionSummary> findPage(String tenantId, SoftwareActionQueryFilter filter, String search,
                                         String sortField, Sort.Direction direction, int skip, int limit);

    long count(String tenantId, SoftwareActionQueryFilter filter, String search);

    Map<String, Integer> facet(String tenantId, SoftwareActionQueryFilter filter, String search, String field);

    Optional<SoftwareActionSummary> findByExecutionId(String tenantId, String executionId);

    boolean isSortableField(String field);

    String getDefaultSortField();
}
