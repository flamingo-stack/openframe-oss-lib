package com.openframe.api.service.device;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.device.DeviceLogEntry;
import com.openframe.api.dto.device.DeviceLogFilterCriteria;
import com.openframe.api.dto.device.DeviceLogLevel;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.core.exception.InternalException;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.loki.client.LogQl;
import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.model.LokiDirection;
import com.openframe.data.loki.model.LokiLogEntry;
import com.openframe.data.repository.tenant.TenantRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static java.util.stream.Collectors.joining;

/**
 * Device agent logs, read from Loki where {@code openframe-saas-logs-stream} writes them as
 * {@code {job="agent-logs", tenant_domain, level}} streams with {@code machine_id}, {@code hostname},
 * {@code agent_ts} and {@code count} as structured metadata.
 */
@Service
@Slf4j
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.loki.enabled", havingValue = "true")
public class DeviceLogService {

    static final Duration DEFAULT_LOOKBACK = Duration.ofDays(7);
    static final Duration MAX_RANGE = Duration.ofDays(30);
    static final int MAX_SEARCH_LENGTH = 256;

    private static final String AGENT_LOGS_JOB = "agent-logs";
    private static final long NANOS_PER_SECOND = 1_000_000_000L;

    private final LokiClient lokiClient;
    private final DeviceService deviceService;
    private final TenantIdProvider tenantIdProvider;
    private final TenantRepository tenantRepository;
    private final Map<String, String> tenantDomains = new ConcurrentHashMap<>();

    /**
     * Logs of one device, newest first.
     * <p>
     * Tenant isolation does not rely on anything in the request: the device must be visible to this tenant,
     * and the stream selector is pinned to this tenant's own domain from the {@code tenants} collection.
     */
    public GenericQueryResult<DeviceLogEntry> queryDeviceLogs(String machineId,
                                                              DeviceLogFilterCriteria filter,
                                                              CursorPaginationCriteria pagination) {
        deviceService.findByMachineId(machineId)
                .orElseThrow(() -> new DeviceNotFoundException("Machine not found: " + machineId));

        DeviceLogFilterCriteria criteria = filter != null ? filter : new DeviceLogFilterCriteria();
        CursorPaginationCriteria page = (pagination != null ? pagination : new CursorPaginationCriteria()).normalize();
        DeviceLogCursor after = DeviceLogCursor.fromRaw(page.getCursor());
        validateSearch(criteria.getSearch());

        Instant to = criteria.getTo() != null ? criteria.getTo() : Instant.now();
        Instant from = criteria.getFrom() != null ? criteria.getFrom() : to.minus(DEFAULT_LOOKBACK);
        validateRange(from, to);

        long startNanos = toNanos(from);
        // Loki's end is exclusive while both the filter's upper bound and the cursor entry are inclusive
        long endNanos = toNanos(to) + 1;
        int skip = 0;
        if (after != null) {
            if (after.timestampNanos() < startNanos) {
                return result(List.of(), false, true);
            }
            endNanos = Math.min(endNanos, after.timestampNanos() + 1);
            skip = after.skip();
        }

        String query = buildQuery(resolveTenantDomain(), machineId, criteria);
        int pageSize = page.getLimit();
        log.debug("Querying device logs for machineId: {}, query: {}, start: {}, end: {}", machineId, query, startNanos, endNanos);

        // One extra entry tells whether there is a next page
        List<LokiLogEntry> entries = lokiClient.queryRange(query, startNanos, endNanos, pageSize + skip + 1,
                LokiDirection.BACKWARD);
        List<LokiLogEntry> remaining = dropReturned(entries, after);

        return result(toItems(remaining.subList(0, Math.min(pageSize, remaining.size())), after),
                remaining.size() > pageSize, after != null);
    }

    static String buildQuery(String tenantDomain, String machineId, DeviceLogFilterCriteria criteria) {
        StringBuilder query = new StringBuilder("{job=").append(LogQl.quote(AGENT_LOGS_JOB))
                .append(", tenant_domain=").append(LogQl.quote(tenantDomain));
        List<DeviceLogLevel> levels = criteria.getLevels();
        if (levels != null && !levels.isEmpty()) {
            String alternatives = levels.stream().distinct().map(Enum::name).collect(joining("|"));
            query.append(", level=~").append(LogQl.quote(alternatives));
        }
        query.append('}');
        if (StringUtils.hasText(criteria.getSearch())) {
            // Line filter before the metadata filter: the cheapest stage runs first
            query.append(" |~ ").append(LogQl.quote("(?i)" + LogQl.regexLiteral(criteria.getSearch())));
        }
        return query.append(" | machine_id=").append(LogQl.quote(machineId)).toString();
    }

    /**
     * Cached for the life of the pod: a tenant pod serves one tenant and tenant domains never change. A missing
     * domain is not cached, so a tenant that is still being provisioned recovers on the next call.
     */
    private String resolveTenantDomain() {
        String tenantId = tenantIdProvider.getTenantId();
        String domain = tenantDomains.computeIfAbsent(tenantId, this::findTenantDomain);
        if (domain == null) {
            log.error("Cannot query device logs: tenant {} has no domain", tenantId);
            throw new InternalException("Device logs are not available for this tenant");
        }
        return domain;
    }

    private String findTenantDomain(String tenantId) {
        return tenantRepository.findById(tenantId)
                .map(Tenant::getDomain)
                .filter(StringUtils::hasText)
                .orElse(null);
    }

    /**
     * Drops the entries at the cursor's timestamp that earlier pages already returned; they come first
     * because the query ends right after that timestamp.
     */
    private static List<LokiLogEntry> dropReturned(List<LokiLogEntry> entries, DeviceLogCursor after) {
        int index = 0;
        if (after != null) {
            while (index < entries.size() && index < after.skip()
                    && entries.get(index).timestampNanos() == after.timestampNanos()) {
                index++;
            }
        }
        return entries.subList(index, entries.size());
    }

    private static List<DeviceLogEntry> toItems(List<LokiLogEntry> entries, DeviceLogCursor after) {
        List<DeviceLogEntry> items = new ArrayList<>(entries.size());
        long runTimestamp = after != null ? after.timestampNanos() : Long.MIN_VALUE;
        int runLength = after != null ? after.skip() : 0;
        for (LokiLogEntry entry : entries) {
            if (entry.timestampNanos() != runTimestamp) {
                runTimestamp = entry.timestampNanos();
                runLength = 0;
            }
            runLength++;
            items.add(DeviceLogEntry.builder()
                    .timestamp(entry.timestamp())
                    .agentTimestamp(parseInstant(entry.labels().get("agent_ts")))
                    .level(entry.labels().get("level"))
                    .message(entry.line())
                    .hostname(entry.labels().get("hostname"))
                    .count(parseLong(entry.labels().get("count")))
                    .cursor(new DeviceLogCursor(runTimestamp, runLength).encode())
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

    private static void validateSearch(String search) {
        if (search != null && search.length() > MAX_SEARCH_LENGTH) {
            throw new IllegalArgumentException("search cannot exceed " + MAX_SEARCH_LENGTH + " characters");
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
