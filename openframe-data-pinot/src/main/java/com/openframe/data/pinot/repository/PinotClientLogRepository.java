package com.openframe.data.pinot.repository;

import com.openframe.data.pinot.model.LogProjection;
import com.openframe.data.pinot.model.OrganizationOption;
import lombok.extern.slf4j.Slf4j;
import org.apache.pinot.client.Connection;
import org.apache.pinot.client.ResultSet;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import static org.springframework.util.StringUtils.hasText;

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
    public List<LogProjection> findLogs(String tenantId, LocalDate startDate, LocalDate endDate, Instant timestampFrom, Instant timestampTo,
                                        List<String> toolTypes, List<String> eventTypes,
                                        List<String> severities, List<String> organizationIds, String deviceId, String cursor, int limit,
                                        String sortField, String sortDirection) {
        PinotQueryBuilder queryBuilder = new PinotQueryBuilder(logsTable, tenantId)
                .select("toolEventId", "ingestDay", "toolType", "eventType", "severity", "userId", "deviceId", "hostname", "nickname", "organizationId", "organizationName", "summary", "eventTimestamp")
                .whereDateRange("eventTimestamp", startDate, endDate)
                .whereTimestampRange("eventTimestamp", timestampFrom, timestampTo)
                .whereIn("toolType", toolTypes)
                .whereIn("eventType", eventTypes)
                .whereIn("severity", severities)
                .whereIn("organizationId", organizationIds)
                .whereEquals("deviceId", deviceId)
                .whereCursor(cursor, sortDirection)
                .orderBySortInput(sortField, sortDirection, PRIMARY_KEY_FIELD)
                .limit(limit);

        return executeLogQuery(queryBuilder.build());
    }

    @Override
    public List<LogProjection> searchLogs(String tenantId, LocalDate startDate, LocalDate endDate, Instant timestampFrom, Instant timestampTo,
                                          List<String> toolTypes, List<String> eventTypes,
                                          List<String> severities, List<String> organizationIds, String deviceId, String searchTerm, String cursor, int limit,
                                          String sortField, String sortDirection) {
        PinotQueryBuilder queryBuilder = new PinotQueryBuilder(logsTable, tenantId)
                .select("toolEventId", "ingestDay", "toolType", "eventType", "severity", "userId", "deviceId", "hostname", "nickname", "organizationId", "organizationName", "summary", "eventTimestamp")
                .whereDateRange("eventTimestamp", startDate, endDate)
                .whereTimestampRange("eventTimestamp", timestampFrom, timestampTo)
                .whereIn("toolType", toolTypes)
                .whereIn("eventType", eventTypes)
                .whereIn("severity", severities)
                .whereIn("organizationId", organizationIds)
                .whereEquals("deviceId", deviceId)
                .whereRelevanceLogSearch(searchTerm)
                .whereCursor(cursor, sortDirection)
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

    // Most devices have no nickname: Pinot stores the schema default (empty string) for those rows,
    // and the API contract is an absent nickname, not an empty one.
    private String readNickname(ResultSet resultSet, int rowIndex, Map<String, Integer> columnIndexMap) {
        String nickname = readString(resultSet, rowIndex, columnIndexMap, "nickname");
        if (!hasText(nickname)) {
            return null;
        }
        return nickname;
    }

    private List<LogProjection> executeLogQuery(String query) {
        return executeQuery(query, resultSet -> {
            Map<String, Integer> columnIndexMap = buildColumnIndexMap(resultSet);
            return rowIndex -> {
                LogProjection projection = new LogProjection();
                projection.toolEventId = readString(resultSet, rowIndex, columnIndexMap, "toolEventId");
                projection.ingestDay = readString(resultSet, rowIndex, columnIndexMap, "ingestDay");
                projection.toolType = readString(resultSet, rowIndex, columnIndexMap, "toolType");
                projection.eventType = readString(resultSet, rowIndex, columnIndexMap, "eventType");
                projection.severity = readString(resultSet, rowIndex, columnIndexMap, "severity");
                projection.userId = readString(resultSet, rowIndex, columnIndexMap, "userId");
                projection.deviceId = readString(resultSet, rowIndex, columnIndexMap, "deviceId");
                projection.hostname = readString(resultSet, rowIndex, columnIndexMap, "hostname");
                projection.nickname = readNickname(resultSet, rowIndex, columnIndexMap);
                projection.organizationId = readString(resultSet, rowIndex, columnIndexMap, "organizationId");
                projection.organizationName = readString(resultSet, rowIndex, columnIndexMap, "organizationName");
                projection.summary = readString(resultSet, rowIndex, columnIndexMap, "summary");
                projection.eventTimestamp = Instant.ofEpochMilli(resultSet.getLong(rowIndex, columnIndexMap.get("eventTimestamp")));
                return projection;
            };
        });
    }
}
