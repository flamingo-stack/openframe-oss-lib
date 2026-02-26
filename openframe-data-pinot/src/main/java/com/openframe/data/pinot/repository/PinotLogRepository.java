package com.openframe.data.pinot.repository;

import com.openframe.data.pinot.model.LogProjection;
import com.openframe.data.pinot.model.OrganizationOption;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface PinotLogRepository {

    List<LogProjection> findLogs(
            LocalDate startDate,
            LocalDate endDate,
            List<String> toolTypes,
            List<String> eventTypes,
            List<String> severities,
            List<String> organizationIds,
            String deviceId,
            String cursor,
            int limit,
            String sortField,
            String sortDirection
    );

    List<LogProjection> searchLogs(
            LocalDate startDate,
            LocalDate endDate,
            List<String> toolTypes,
            List<String> eventTypes,
            List<String> severities,
            List<String> organizationIds,
            String deviceId,
            String searchTerm,
            String cursor,
            int limit,
            String sortField,
            String sortDirection
    );

    List<String> getToolTypeOptions(
            LocalDate startDate,
            LocalDate endDate,
            List<String> toolTypes,
            List<String> eventTypes,
            List<String> severities,
            List<String> organizationIds
    );

    List<String> getEventTypeOptions(
            LocalDate startDate,
            LocalDate endDate,
            List<String> toolTypes,
            List<String> eventTypes,
            List<String> severities,
            List<String> organizationIds
    );

    List<String> getSeverityOptions(
            LocalDate startDate,
            LocalDate endDate,
            List<String> toolTypes,
            List<String> eventTypes,
            List<String> severities,
            List<String> organizationIds
    );

    List<String> getAvailableDateRanges(
            List<String> toolTypes,
            List<String> eventTypes,
            List<String> severities,
            List<String> organizationIds
    );

    List<OrganizationOption> getOrganizationOptions(
            LocalDate startDate,
            LocalDate endDate,
            List<String> toolTypes,
            List<String> eventTypes,
            List<String> severities
    );

    /**
     * Check if a field is sortable in the underlying data store
     *
     * @param field the field name to check
     * @return true if the field can be used for sorting
     */
    boolean isSortableField(String field);

    /**
     * Get the default field to use for sorting
     *
     * @return the default sort field name
     */
    String getDefaultSortField();
} 