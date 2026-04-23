package com.openframe.data.pinot.repository;

import com.openframe.data.pinot.model.LogProjection;
import com.openframe.data.pinot.model.OrganizationOption;
import lombok.extern.slf4j.Slf4j;
import org.apache.pinot.client.Connection;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@Repository
public class PinotClientLogRepository extends AbstractPinotRepository implements PinotLogRepository {

    private static final List<String> SORTABLE_COLUMNS = List.of(
            "eventTimestamp",
            "severity",
            "eventType",
            "toolType",
            "organizationId",
            "deviceId",
            "ingestDay"
    );

    private static final String DEFAULT_SORT_COLUMN = "eventTimestamp";
    private static final String PRIMARY_KEY_FIELD = "toolEventId";

    @Value("${pinot.tables.logs.name:logs}")
    private String logsTable;

    public PinotClientLogRepository(@Qualifier("pinotBrokerConnection") Connection pinotConnection) {
        super(pinotConnection);
    }

    @Override
    public List<LogProjection> findLogs(String tenantId, LocalDate startDate, LocalDate endDate, List<String> toolTypes, List<String> eventTypes,
                                        List<String> severities, List<String> organizationIds, String deviceId, String cursor, int limit,
                                        String sortField, String sortDirection) {
        PinotQueryBuilder queryBuilder = new PinotQueryBuilder(logsTable, tenantId)
                .select("toolEventId", "ingestDay", "toolType", "eventType", "severity", "userId", "deviceId", "hostname", "organizationId", "organizationName", "summary", "eventTimestamp")
                .whereDateRange("eventTimestamp", startDate, endDate)
                .whereIn("toolType", toolTypes)
                .whereIn("eventType", eventTypes)
                .whereIn("severity", severities)
                .whereIn("organizationId", organizationIds)
                .whereEquals("deviceId", deviceId)
                .whereCursor(cursor)
                .orderBySortInput(sortField, sortDirection, PRIMARY_KEY_FIELD)
                .limit(limit);

        return executeLogQuery(queryBuilder.build());
    }

    @Override
    public List<LogProjection> searchLogs(String tenantId, LocalDate startDate, LocalDate endDate, List<String> toolTypes, List<String> eventTypes,
                                          List<String> severities, List<String> organizationIds, String deviceId, String searchTerm, String cursor, int limit,
                                          String sortField, String sortDirection) {
        PinotQueryBuilder queryBuilder = new PinotQueryBuilder(logsTable, tenantId)
                .select("toolEventId", "ingestDay", "toolType", "eventType", "severity", "userId", "deviceId", "hostname", "organizationId", "organizationName", "summary", "eventTimestamp")
                .whereDateRange("eventTimestamp", startDate, endDate)
                .whereIn("toolType", toolTypes)
                .whereIn("eventType", eventTypes)
                .whereIn("severity", severities)
                .whereIn("organizationId", organizationIds)
                .whereEquals("deviceId", deviceId)
                .whereRelevanceLogSearch(searchTerm)
                .whereCursor(cursor)
                .orderBySortInput(sortField, sortDirection, PRIMARY_KEY_FIELD)
                .limit(limit);

        return executeLogQuery(queryBuilder.build());
    }

    @Override
    public List<String> getEventTypeOptions(String tenantId, LocalDate startDate, LocalDate endDate, List<String> toolTypes, List<String> eventTypes, List<String> severities, List<String> organizationIds) {
        PinotQueryBuilder queryBuilder = new PinotQueryBuilder(logsTable, tenantId)
                .select("eventType")
                .distinct()
                .whereDateRange("eventTimestamp", startDate, endDate)
                .whereIn("toolType", toolTypes)
                .whereIn("severity", severities)
                .whereIn("organizationId", organizationIds)
                .orderBy("eventType");

        return executeSingleColumnQuery(queryBuilder.build());
    }

    @Override
    public List<String> getSeverityOptions(String tenantId, LocalDate startDate, LocalDate endDate, List<String> toolTypes, List<String> eventTypes, List<String> severities, List<String> organizationIds) {
        PinotQueryBuilder queryBuilder = new PinotQueryBuilder(logsTable, tenantId)
                .select("severity")
                .distinct()
                .whereDateRange("eventTimestamp", startDate, endDate)
                .whereIn("toolType", toolTypes)
                .whereIn("eventType", eventTypes)
                .whereIn("organizationId", organizationIds)
                .orderBy("severity");

        return executeSingleColumnQuery(queryBuilder.build());
    }

    @Override
    public List<String> getToolTypeOptions(String tenantId, LocalDate startDate, LocalDate endDate, List<String> toolTypes, List<String> eventTypes, List<String> severities, List<String> organizationIds) {
        PinotQueryBuilder queryBuilder = new PinotQueryBuilder(logsTable, tenantId)
                .select("toolType")
                .distinct()
                .whereDateRange("eventTimestamp", startDate, endDate)
                .whereIn("eventType", eventTypes)
                .whereIn("severity", severities)
                .whereIn("organizationId", organizationIds)
                .orderBy("toolType");

        return executeSingleColumnQuery(queryBuilder.build());
    }

    @Override
    public List<String> getAvailableDateRanges(String tenantId, List<String> toolTypes, List<String> eventTypes, List<String> severities, List<String> organizationIds) {
        PinotQueryBuilder queryBuilder = new PinotQueryBuilder(logsTable, tenantId)
                .select("ingestDay")
                .distinct()
                .whereIn("toolType", toolTypes)
                .whereIn("eventType", eventTypes)
                .whereIn("severity", severities)
                .whereIn("organizationId", organizationIds)
                .orderBy("ingestDay");

        return executeSingleColumnQuery(queryBuilder.build());
    }

    @Override
    public List<OrganizationOption> getOrganizationOptions(String tenantId, LocalDate startDate, LocalDate endDate,
                                                           List<String> toolTypes, List<String> eventTypes, List<String> severities) {
        PinotQueryBuilder queryBuilder = new PinotQueryBuilder(logsTable, tenantId)
                .select("organizationId", "organizationName")
                .distinct()
                .whereDateRange("eventTimestamp", startDate, endDate)
                .whereIn("toolType", toolTypes)
                .whereIn("eventType", eventTypes)
                .whereIn("severity", severities)
                .orderBy("organizationName");

        return executeQuery(queryBuilder.build(), resultSet -> rowIndex -> {
            String organizationId = resultSet.getString(rowIndex, 0);
            String organizationName = resultSet.getString(rowIndex, 1);
            if (organizationId == null || organizationId.trim().isEmpty()) {
                return null;
            }
            return OrganizationOption.builder()
                    .id(organizationId)
                    .name(organizationName != null ? organizationName : organizationId)
                    .build();
        }).stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    @Override
    public boolean isSortableField(String field) {
        if (field == null || field.trim().isEmpty()) {
            return false;
        }
        return SORTABLE_COLUMNS.contains(field.trim());
    }

    @Override
    public String getDefaultSortField() {
        return DEFAULT_SORT_COLUMN;
    }

    private List<LogProjection> executeLogQuery(String query) {
        return executeQuery(query, resultSet -> {
            Map<String, Integer> columnIndexMap = buildColumnIndexMap(resultSet);
            return rowIndex -> {
                LogProjection projection = new LogProjection();
                projection.toolEventId = resultSet.getString(rowIndex, columnIndexMap.get("toolEventId"));
                projection.ingestDay = resultSet.getString(rowIndex, columnIndexMap.get("ingestDay"));
                projection.toolType = resultSet.getString(rowIndex, columnIndexMap.get("toolType"));
                projection.eventType = resultSet.getString(rowIndex, columnIndexMap.get("eventType"));
                projection.severity = resultSet.getString(rowIndex, columnIndexMap.get("severity"));
                projection.userId = resultSet.getString(rowIndex, columnIndexMap.get("userId"));
                projection.deviceId = resultSet.getString(rowIndex, columnIndexMap.get("deviceId"));
                projection.hostname = resultSet.getString(rowIndex, columnIndexMap.get("hostname"));
                projection.organizationId = resultSet.getString(rowIndex, columnIndexMap.get("organizationId"));
                projection.organizationName = resultSet.getString(rowIndex, columnIndexMap.get("organizationName"));
                projection.summary = resultSet.getString(rowIndex, columnIndexMap.get("summary"));
                projection.eventTimestamp = Instant.ofEpochMilli(resultSet.getLong(rowIndex, columnIndexMap.get("eventTimestamp")));
                return projection;
            };
        });
    }
}
