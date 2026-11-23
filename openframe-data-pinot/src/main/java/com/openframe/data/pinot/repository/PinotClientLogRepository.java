package com.openframe.data.pinot.repository;

import com.openframe.data.pinot.model.LogProjection;
import com.openframe.data.pinot.model.LogSortPosition;
import com.openframe.data.pinot.model.OrganizationOption;
import com.openframe.data.pinot.repository.exception.PinotQueryException;
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
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Repository
public class PinotClientLogRepository extends AbstractPinotRepository implements PinotLogRepository {

    private static final String TIMESTAMP_COLUMN = "eventTimestamp";

    private static final Map<String, Function<LogProjection, String>> TEXT_SORT_VALUES = Map.of(
            "severity", row -> row.severity,
            "eventType", row -> row.eventType,
            "toolType", row -> row.toolType,
            "organizationId", row -> row.organizationId,
            "deviceId", row -> row.deviceId,
            "ingestDay", row -> row.ingestDay
    );

    private static final String DEFAULT_SORT_COLUMN = TIMESTAMP_COLUMN;
    private static final String PRIMARY_KEY_FIELD = "toolEventId";
    private static final String SORT_ASC = "ASC";
    private static final String SORT_DESC = "DESC";
    private static final String NOT_SORTABLE_MESSAGE = "Logs cannot be sorted by the requested field";

    /**
     * Explicit upper bound for the filter-option queries. Pinot applies its own default of 10 to any query that
     * does not set a LIMIT, so without this a facet silently returns only the first 10 values in ORDER BY order -
     * an organization whose name sorts eleventh simply never appears in the Source filter. 10000 is the builder's
     * maximum and is comfortably above the number of distinct values any of these facets can hold.
     */
    private static final int MAX_FILTER_OPTIONS = 10000;

    @Value("${pinot.tables.logs.name:logs}")
    private String logsTable;

    public PinotClientLogRepository(@Qualifier("pinotBrokerConnection") Connection pinotConnection) {
        super(pinotConnection);
    }

    @Override
    public List<LogProjection> findLogs(String tenantId, LocalDate startDate, LocalDate endDate, Instant timestampFrom, Instant timestampTo,
                                        List<String> toolTypes, List<String> eventTypes,
                                        List<String> severities, List<String> organizationIds, String deviceId, LogSortPosition position, int limit,
                                        String sortField, String sortDirection, boolean backward) {
        PinotQueryBuilder queryBuilder = new PinotQueryBuilder(logsTable, tenantId)
                .select("toolEventId", "ingestDay", "toolType", "eventType", "severity", "userId", "deviceId", "hostname", "nickname", "executionSource", "scriptCreationSource", "organizationId", "organizationName", "summary", "eventTimestamp")
                .whereDateRange("eventTimestamp", startDate, endDate)
                .whereTimestampRange("eventTimestamp", timestampFrom, timestampTo)
                .whereIn("toolType", toolTypes)
                .whereIn("eventType", eventTypes)
                .whereIn("severity", severities)
                .whereIn("organizationId", organizationIds)
                .whereEquals("deviceId", deviceId);

        String query = pageQuery(queryBuilder, position, limit, sortField, sortDirection, backward);
        return executeLogQuery(query);
    }

    @Override
    public List<LogProjection> searchLogs(String tenantId, LocalDate startDate, LocalDate endDate, Instant timestampFrom, Instant timestampTo,
                                          List<String> toolTypes, List<String> eventTypes,
                                          List<String> severities, List<String> organizationIds, String deviceId, String searchTerm, LogSortPosition position, int limit,
                                          String sortField, String sortDirection, boolean backward) {
        PinotQueryBuilder queryBuilder = new PinotQueryBuilder(logsTable, tenantId)
                .select("toolEventId", "ingestDay", "toolType", "eventType", "severity", "userId", "deviceId", "hostname", "nickname", "executionSource", "scriptCreationSource", "organizationId", "organizationName", "summary", "eventTimestamp")
                .whereDateRange("eventTimestamp", startDate, endDate)
                .whereTimestampRange("eventTimestamp", timestampFrom, timestampTo)
                .whereIn("toolType", toolTypes)
                .whereIn("eventType", eventTypes)
                .whereIn("severity", severities)
                .whereIn("organizationId", organizationIds)
                .whereEquals("deviceId", deviceId)
                .whereRelevanceLogSearch(searchTerm);

        String query = pageQuery(queryBuilder, position, limit, sortField, sortDirection, backward);
        return executeLogQuery(query);
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
                .orderBy("eventType")
                .limit(MAX_FILTER_OPTIONS);

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
                .orderBy("severity")
                .limit(MAX_FILTER_OPTIONS);

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
                .orderBy("toolType")
                .limit(MAX_FILTER_OPTIONS);

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
                .orderBy("ingestDay")
                .limit(MAX_FILTER_OPTIONS);

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
                .orderBy("organizationName")
                .limit(MAX_FILTER_OPTIONS);

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
    public LogSortPosition sortPositionOf(LogProjection row, String sortField) {
        requireSortable(sortField);
        if (TIMESTAMP_COLUMN.equals(sortField)) {
            long timestampMillis = row.eventTimestamp.toEpochMilli();
            return LogSortPosition.ofTimestamp(timestampMillis, row.toolEventId);
        }
        String textValue = TEXT_SORT_VALUES.get(sortField).apply(row);
        return LogSortPosition.ofText(textValue, row.toolEventId);
    }

    @Override
    public boolean isSortableField(String field) {
        if (field == null || field.trim().isEmpty()) {
            return false;
        }
        return isSortableColumn(field.trim());
    }

    @Override
    public String getDefaultSortField() {
        return DEFAULT_SORT_COLUMN;
    }

    private String pageQuery(PinotQueryBuilder filteredQuery, LogSortPosition position, int limit,
                             String sortField, String sortDirection, boolean backward) {
        requireSortable(sortField);
        String fetchDirection = fetchDirection(sortDirection, backward);
        seekPast(filteredQuery, position, sortField, fetchDirection);
        return filteredQuery
                .orderBySortInput(sortField, fetchDirection, PRIMARY_KEY_FIELD)
                .limit(limit)
                .build();
    }

    private void seekPast(PinotQueryBuilder filteredQuery, LogSortPosition position, String sortField,
                          String fetchDirection) {
        if (position == null) {
            return;
        }
        String toolEventId = position.getToolEventId();
        if (position.isTimestamp()) {
            long timestampMillis = position.getTimestampMillis();
            filteredQuery.whereKeysetAfter(sortField, timestampMillis, PRIMARY_KEY_FIELD, toolEventId, fetchDirection);
            return;
        }
        String textValue = position.getTextValue();
        filteredQuery.whereKeysetAfter(sortField, textValue, PRIMARY_KEY_FIELD, toolEventId, fetchDirection);
    }

    private String fetchDirection(String sortDirection, boolean backward) {
        boolean descending = SORT_DESC.equalsIgnoreCase(sortDirection);
        return descending == backward ? SORT_ASC : SORT_DESC;
    }

    private void requireSortable(String sortField) {
        if (!isSortableColumn(sortField)) {
            throw new PinotQueryException(NOT_SORTABLE_MESSAGE);
        }
    }

    private boolean isSortableColumn(String column) {
        return TIMESTAMP_COLUMN.equals(column) || (column != null && TEXT_SORT_VALUES.containsKey(column));
    }

    // Optional columns store the schema default (empty string) when absent, and the API contract is an
    // absent field, not an empty one.
    private String readOptionalString(ResultSet resultSet, int rowIndex, Map<String, Integer> columnIndexMap,
                                      String column) {
        String value = readString(resultSet, rowIndex, columnIndexMap, column);
        if (!hasText(value)) {
            return null;
        }
        return value;
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
                projection.nickname = readOptionalString(resultSet, rowIndex, columnIndexMap, "nickname");
                projection.executionSource = readOptionalString(resultSet, rowIndex, columnIndexMap, "executionSource");
                projection.scriptCreationSource = readOptionalString(resultSet, rowIndex, columnIndexMap, "scriptCreationSource");
                projection.organizationId = readString(resultSet, rowIndex, columnIndexMap, "organizationId");
                projection.organizationName = readString(resultSet, rowIndex, columnIndexMap, "organizationName");
                projection.summary = readString(resultSet, rowIndex, columnIndexMap, "summary");
                projection.eventTimestamp = Instant.ofEpochMilli(resultSet.getLong(rowIndex, columnIndexMap.get("eventTimestamp")));
                return projection;
            };
        });
    }
}
