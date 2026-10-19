package com.openframe.api.service.device;

import com.openframe.api.config.DeviceLogProperties;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.device.DeviceLogEntry;
import com.openframe.api.dto.device.DeviceLogFilterCriteria;
import com.openframe.api.dto.device.DeviceLogLevel;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.service.tenant.TenantDomainService;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;
import com.openframe.core.logs.AgentLogBucket;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.loki.client.LogQl;
import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.model.LokiDirection;
import com.openframe.data.loki.model.LokiLogEntry;
import com.openframe.data.repository.organization.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.toSet;

// The tenant domain pinning the stream selector comes from TenantDomainService, never from a caller, so no argument
// reaching this service can widen the query past its own tenant.
@Service
@Slf4j
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.loki.enabled", havingValue = "true")
public class DeviceLogService {

    static final Duration DEFAULT_LOOKBACK = Duration.ofDays(7);
    // A whole tenant produces far more lines than one device, so an unbounded query defaults to a shorter window.
    static final Duration DEFAULT_TENANT_LOOKBACK = Duration.ofDays(1);
    static final Duration MAX_RANGE = Duration.ofDays(30);
    static final int MAX_DEVICES = 50;
    static final int MAX_ORGANIZATIONS = 50;
    static final int MAX_SEARCH_LENGTH = 256;
    static final int MAX_SEARCH_TERMS = 5;
    static final int DEFAULT_PAGE_SIZE = 100;
    static final int MAX_PAGE_SIZE = 500;
    // Loki's max_entries_limit_per_query on prod
    static final int MAX_LINES_PER_TIMESTAMP = 5000;

    private static final String AGENT_LOGS_JOB = "agent-logs";
    private static final String CASE_INSENSITIVE = "(?i)";
    private static final long NANOS_PER_SECOND = 1_000_000_000L;

    private final LokiClient lokiClient;
    private final DeviceService deviceService;
    private final TenantDomainService tenantDomainService;
    private final DeviceLogProperties properties;
    private final OrganizationRepository organizationRepository;

    public GenericQueryResult<DeviceLogEntry> queryDeviceLogs(String machineId,
                                                              DeviceLogFilterCriteria filter,
                                                              CursorPaginationCriteria pagination) {
        // singletonList, not List.of: a null id must reach validateDevices and come back as a 400, not an NPE
        return queryLogs(Collections.singletonList(machineId), filter, pagination);
    }

    public GenericQueryResult<DeviceLogEntry> queryLogs(List<String> machineIds,
                                                        DeviceLogFilterCriteria filter,
                                                        CursorPaginationCriteria pagination) {
        return queryLogs(machineIds, null, filter, pagination);
    }

    // The organization filter relies on the organization_id metadata the agent sends with each batch, so it only
    // matches lines written since agents started sending it.
    public GenericQueryResult<DeviceLogEntry> queryLogs(List<String> machineIds,
                                                        List<String> organizationIds,
                                                        DeviceLogFilterCriteria filter,
                                                        CursorPaginationCriteria pagination) {
        List<String> devices = validateDevices(machineIds);
        List<String> organizations = validateOrganizations(organizationIds);
        verifyDevicesExist(devices);
        verifyOrganizationsExist(organizations);

        DeviceLogFilterCriteria criteria = filter != null ? filter : new DeviceLogFilterCriteria();
        CursorPaginationCriteria page = pagination != null ? pagination : new CursorPaginationCriteria();
        DeviceLogCursor after = DeviceLogCursor.fromRaw(page.getCursor());
        validateSearch(criteria);

        Instant to = criteria.getTo() != null ? criteria.getTo() : Instant.now();
        Duration lookback = devices.isEmpty() ? DEFAULT_TENANT_LOOKBACK : DEFAULT_LOOKBACK;
        Instant from = criteria.getFrom() != null ? criteria.getFrom() : to.minus(lookback);
        validateRange(from, to);

        long startNanos = toNanos(from);
        // Loki's end is exclusive: 1 ns past the inclusive upper bound, or the cursor's timestamp itself, whose lines
        // the previous page returned in full
        long endNanos = toNanos(to) + 1;
        if (after != null) {
            if (after.timestampNanos() <= startNanos) {
                return result(List.of(), false, true);
            }
            endNanos = Math.min(endNanos, after.timestampNanos());
        }

        String tenantDomain = tenantDomainService.getTenantDomain();
        String query = buildQuery(tenantDomain, devices, organizations, criteria, bucketed(from));
        int pageSize = pageSize(page.getLimit());
        log.debug("Querying device logs for machineIds: {}, organizationIds: {}, query: {}, start: {}, end: {}",
                devices, organizations, query, startNanos, endNanos);

        // One extra line tells whether there is a next page
        int queryLimit = pageSize + 1;
        List<LokiLogEntry> entries = lokiClient.queryRange(query, startNanos, endNanos, queryLimit,
                LokiDirection.BACKWARD, tenantDomain);
        List<LokiLogEntry> pageEntries = wholeTimestampsOnly(entries, pageSize, query, tenantDomain);
        List<DeviceLogEntry> items = toItems(pageEntries);
        boolean hasNextPage = entries.size() > pageSize;
        boolean hasPreviousPage = after != null;

        return result(items, hasNextPage, hasPreviousPage);
    }

    // A window that starts before the bucket cutover is queried unbucketed in full rather than split: the cursor is
    // a timestamp alone and paging assumes one Loki result set, so merging two would reopen the gap-and-duplicate bug.
    private boolean bucketed(Instant from) {
        Instant cutover = properties.getBucketCutover();
        return cutover != null && !from.isBefore(cutover);
    }

    static String buildQuery(String tenantDomain, List<String> machineIds, DeviceLogFilterCriteria criteria,
                             boolean bucketed) {
        return buildQuery(tenantDomain, machineIds, List.of(), criteria, bucketed);
    }

    static String buildQuery(String tenantDomain, List<String> machineIds, List<String> organizationIds,
                             DeviceLogFilterCriteria criteria, boolean bucketed) {
        StringBuilder query = new StringBuilder("{job=").append(LogQl.quote(AGENT_LOGS_JOB))
                .append(", tenant_domain=").append(LogQl.quote(tenantDomain));
        List<DeviceLogLevel> levels = criteria.getLevels();
        if (levels != null && !levels.isEmpty()) {
            String alternatives = levels.stream().distinct().map(Enum::name).collect(joining("|"));
            query.append(", level=~").append(LogQl.quote(alternatives));
        }
        if (bucketed) {
            appendBucketMatcher(query, machineIds);
        }
        query.append('}');
        // Line filters before the metadata filter: the cheapest stage runs first
        appendTermFilters(query, " |~ ", criteria.getContains());
        appendTermFilters(query, " !~ ", criteria.getExcludes());
        appendDeviceFilter(query, machineIds);
        appendMetadataFilter(query, "organization_id", organizationIds);
        return query.toString();
    }

    // A set spanning every bucket, or no devices at all, adds nothing to the selector and is left off.
    private static void appendBucketMatcher(StringBuilder query, List<String> machineIds) {
        if (machineIds.isEmpty()) {
            return;
        }
        Set<String> buckets = new TreeSet<>();
        for (String machineId : machineIds) {
            buckets.add(AgentLogBucket.label(machineId));
        }
        if (buckets.size() >= AgentLogBucket.BUCKET_COUNT) {
            return;
        }
        query.append(", bucket=~").append(LogQl.quote(String.join("|", buckets)));
    }

    // Several devices chain with "or" instead of a regex alternation: no escaping, and no dependence on how Loki
    // anchors a label-filter regex.
    private static void appendDeviceFilter(StringBuilder query, List<String> machineIds) {
        appendMetadataFilter(query, "machine_id", machineIds);
    }

    private static void appendMetadataFilter(StringBuilder query, String key, List<String> values) {
        if (values.isEmpty()) {
            return;
        }
        query.append(" | ");
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                query.append(" or ");
            }
            query.append(key).append('=').append(LogQl.quote(values.get(i)));
        }
    }

    // A list that is present but holds no usable id is rejected: it is far more likely a client that failed to load
    // its device picker than a deliberate tenant-wide query.
    private static List<String> validateDevices(List<String> machineIds) {
        if (machineIds == null) {
            return List.of();
        }
        List<String> devices = machineIds.stream().filter(StringUtils::hasText).distinct().toList();
        if (devices.isEmpty()) {
            throw new IllegalArgumentException("machineIds must name at least one device; omit it to query every device");
        }
        if (devices.size() > MAX_DEVICES) {
            throw new IllegalArgumentException("Cannot query more than " + MAX_DEVICES + " devices at once");
        }
        return devices;
    }

    private static List<String> validateOrganizations(List<String> organizationIds) {
        if (organizationIds == null) {
            return List.of();
        }
        List<String> organizations = organizationIds.stream().filter(StringUtils::hasText).distinct().toList();
        if (organizations.isEmpty()) {
            throw new IllegalArgumentException(
                    "organizationIds must name at least one organization; omit it to query every organization");
        }
        if (organizations.size() > MAX_ORGANIZATIONS) {
            throw new IllegalArgumentException("Cannot query more than " + MAX_ORGANIZATIONS + " organizations at once");
        }
        return organizations;
    }

    // Organization is tenant-scoped, so an id from another tenant is a 404 here, the same as a typo.
    private void verifyOrganizationsExist(List<String> organizationIds) {
        if (organizationIds.isEmpty()) {
            return;
        }
        Set<String> found = organizationRepository.findByOrganizationIdIn(new LinkedHashSet<>(organizationIds)).stream()
                .map(Organization::getOrganizationId)
                .collect(toSet());
        for (String organizationId : organizationIds) {
            if (!found.contains(organizationId)) {
                throw new NotFoundException(ErrorCode.ORGANIZATION_NOT_FOUND, "Organization not found: " + organizationId);
            }
        }
    }

    private void verifyDevicesExist(List<String> machineIds) {
        if (machineIds.isEmpty()) {
            return;
        }
        Set<String> found = deviceService.findByMachineIds(machineIds).stream()
                .map(Machine::getMachineId)
                .collect(toSet());
        for (String machineId : machineIds) {
            if (!found.contains(machineId)) {
                throw new DeviceNotFoundException("Machine not found: " + machineId);
            }
        }
    }

    private static void appendTermFilters(StringBuilder query, String operator, List<String> terms) {
        if (terms == null) {
            return;
        }
        for (String term : terms) {
            if (StringUtils.hasText(term)) {
                query.append(operator).append(LogQl.quote(CASE_INSENSITIVE + LogQl.regexLiteral(term)));
            }
        }
    }

    // Loki cuts a result at the limit without regard to timestamps and does not guarantee which of the lines sharing
    // the cut timestamp it keeps, so the page ends before that timestamp unless one timestamp fills the whole page.
    private List<LokiLogEntry> wholeTimestampsOnly(List<LokiLogEntry> entries, int pageSize, String query,
                                                  String tenantDomain) {
        if (entries.size() <= pageSize) {
            return entries;
        }
        long cutNanos = entries.get(pageSize).timestampNanos();
        int end = pageSize;
        while (end > 0 && entries.get(end - 1).timestampNanos() == cutNanos) {
            end--;
        }
        if (end > 0) {
            return entries.subList(0, end);
        }
        return lokiClient.queryRange(query, cutNanos, cutNanos + 1, MAX_LINES_PER_TIMESTAMP, LokiDirection.BACKWARD,
                tenantDomain);
    }

    private static List<DeviceLogEntry> toItems(List<LokiLogEntry> entries) {
        List<DeviceLogEntry> items = new ArrayList<>(entries.size());
        for (LokiLogEntry entry : entries) {
            items.add(DeviceLogEntry.builder()
                    .timestamp(entry.timestamp())
                    .agentTimestamp(parseInstant(entry.labels().get("agent_ts")))
                    .level(entry.labels().get("level"))
                    .message(entry.line())
                    .machineId(entry.labels().get("machine_id"))
                    .organizationId(entry.labels().get("organization_id"))
                    .hostname(entry.labels().get("hostname"))
                    .count(parseLong(entry.labels().get("count")))
                    .cursor(new DeviceLogCursor(entry.timestampNanos()).encode())
                    .build());
        }
        return items;
    }

    private static GenericQueryResult<DeviceLogEntry> result(List<DeviceLogEntry> items, boolean hasNextPage,
                                                             boolean hasPreviousPage) {
        return GenericQueryResult.<DeviceLogEntry>builder()
                .items(items)
                .pageInfo(PageInfo.builder()
                        .hasNextPage(hasNextPage)
                        .hasPreviousPage(hasPreviousPage)
                        .startCursor(items.isEmpty() ? null : items.get(0).getCursor())
                        .endCursor(items.isEmpty() ? null : items.get(items.size() - 1).getCursor())
                        .build())
                .build();
    }

    // Larger than the shared 100-item cap: the agent ships up to 50 lines a minute per device.
    private static int pageSize(Integer requested) {
        if (requested == null) {
            return DEFAULT_PAGE_SIZE;
        }
        int atLeastOneLine = Math.max(requested, 1);
        return Math.min(atLeastOneLine, MAX_PAGE_SIZE);
    }

    private static void validateSearch(DeviceLogFilterCriteria criteria) {
        validateTerms(criteria.getContains(), "contains");
        validateTerms(criteria.getExcludes(), "excludes");
    }

    // Counts only the terms that reach the query: blank ones are skipped when the filters are built.
    private static void validateTerms(List<String> terms, String field) {
        if (terms == null) {
            return;
        }
        int used = 0;
        for (String term : terms) {
            if (!StringUtils.hasText(term)) {
                continue;
            }
            if (term.length() > MAX_SEARCH_LENGTH) {
                throw new IllegalArgumentException(field + " terms cannot exceed " + MAX_SEARCH_LENGTH + " characters");
            }
            used++;
        }
        if (used > MAX_SEARCH_TERMS) {
            throw new IllegalArgumentException(field + " cannot hold more than " + MAX_SEARCH_TERMS + " terms");
        }
    }

    private static void validateRange(Instant from, Instant to) {
        if (!from.isBefore(to)) {
            throw new IllegalArgumentException("'from' must be before 'to'");
        }
        if (Duration.between(from, to).compareTo(MAX_RANGE) > 0) {
            throw new IllegalArgumentException("Time range cannot exceed " + MAX_RANGE.toDays() + " days");
        }
    }

    private static long toNanos(Instant instant) {
        try {
            return Math.addExact(Math.multiplyExact(instant.getEpochSecond(), NANOS_PER_SECOND), instant.getNano());
        } catch (ArithmeticException e) {
            throw new IllegalArgumentException("Timestamp out of range: " + instant);
        }
    }

    private static Instant parseInstant(String value) {
        if (value == null) {
            return null;
        }
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static Long parseLong(String value) {
        if (value == null) {
            return null;
        }
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
