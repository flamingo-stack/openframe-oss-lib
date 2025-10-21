package com.openframe.data.repository.pinot;

import com.openframe.data.model.pinot.LogProjection;
import com.openframe.data.model.pinot.OrganizationOption;
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
            int limit
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
            int limit
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
} 