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
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

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
    static final int MAX_SEARCH_TERMS = 5;
    static final int DEFAULT_PAGE_SIZE = 100;
    static final int MAX_PAGE_SIZE = 500;
    // Loki's max_entries_limit_per_query on prod
    static final int MAX_LINES_PER_TIMESTAMP = 5000;

    private static final String AGENT_LOGS_JOB = "agent-logs";
    private static final String CASE_INSENSITIVE = "(?i)";
    /** Lookaround and backreferences: Java compiles them, Loki's RE2 engine rejects them. */
    private static final Pattern UNSUPPORTED_REGEX = Pattern.compile("\\(\\?[=!<]|\\\\[1-9]");
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
        CursorPaginationCriteria page = pagination != null ? pagination : new CursorPaginationCriteria();
        DeviceLogCursor after = DeviceLogCursor.fromRaw(page.getCursor());
        validateSearch(criteria);

        Instant to = criteria.getTo() != null ? criteria.getTo() : Instant.now();
        Instant from = criteria.getFrom() != null ? criteria.getFrom() : to.minus(DEFAULT_LOOKBACK);
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

        String query = buildQuery(resolveTenantDomain(), machineId, criteria);
        int pageSize = pageSize(page.getLimit());
        log.debug("Querying device logs for machineId: {}, query: {}, start: {}, end: {}", machineId, query, startNanos, endNanos);

        // One extra line tells whether there is a next page
        int queryLimit = pageSize + 1;
        List<LokiLogEntry> entries = lokiClient.queryRange(query, startNanos, endNanos, queryLimit, LokiDirection.BACKWARD);
        List<LokiLogEntry> pageEntries = wholeTimestampsOnly(entries, pageSize, query);
        List<DeviceLogEntry> items = toItems(pageEntries);
        boolean hasNextPage = entries.size() > pageSize;
        boolean hasPreviousPage = after != null;

        return result(items, hasNextPage, hasPreviousPage);
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
        // Line filters before the metadata filter: the cheapest stage runs first
        appendTermFilters(query, " |~ ", criteria.getContains());
        appendTermFilters(query, " !~ ", criteria.getExcludes());
        if (StringUtils.hasText(criteria.getRegex())) {
            query.append(" |~ ").append(LogQl.quote(CASE_INSENSITIVE + criteria.getRegex()));
        }
        return query.append(" | machine_id=").append(LogQl.quote(machineId)).toString();
    }

    /**
     * One line filter per term, so several terms narrow the result instead of being matched as one phrase.
     */
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
     * Loki cuts a result at the limit without regard to timestamps, and does not guarantee which of the lines sharing
     * the cut timestamp it keeps. The page therefore ends before that timestamp, and the next page starts with all of
     * its lines. When one timestamp fills the whole page, its lines are fetched in full instead.
     */
    private List<LokiLogEntry> wholeTimestampsOnly(List<LokiLogEntry> entries, int pageSize, String query) {
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
        return lokiClient.queryRange(query, cutNanos, cutNanos + 1, MAX_LINES_PER_TIMESTAMP, LokiDirection.BACKWARD);
    }

    private static List<DeviceLogEntry> toItems(List<LokiLogEntry> entries) {
        List<DeviceLogEntry> items = new ArrayList<>(entries.size());
        for (LokiLogEntry entry : entries) {
            items.add(DeviceLogEntry.builder()
                    .timestamp(entry.timestamp())
                    .agentTimestamp(parseInstant(entry.labels().get("agent_ts")))
                    .level(entry.labels().get("level"))
                    .message(entry.line())
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

    /**
     * Larger than the shared 100-item cap: the agent ships up to 50 lines a minute per device, so 100 lines cover
     * only a couple of minutes of a busy device.
     */
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
        validateRegex(criteria.getRegex());
    }

    private static void validateTerms(List<String> terms, String field) {
        if (terms == null) {
            return;
        }
        if (terms.size() > MAX_SEARCH_TERMS) {
            throw new IllegalArgumentException(field + " cannot hold more than " + MAX_SEARCH_TERMS + " terms");
        }
        for (String term : terms) {
            if (term != null && term.length() > MAX_SEARCH_LENGTH) {
                throw new IllegalArgumentException(field + " terms cannot exceed " + MAX_SEARCH_LENGTH + " characters");
            }
        }
    }

    /**
     * Rejected here rather than at Loki, so a mistyped pattern reads as a bad request instead of a failed query.
     */
    private static void validateRegex(String regex) {
        if (!StringUtils.hasText(regex)) {
            return;
        }
        if (regex.length() > MAX_SEARCH_LENGTH) {
            throw new IllegalArgumentException("regex cannot exceed " + MAX_SEARCH_LENGTH + " characters");
        }
        if (UNSUPPORTED_REGEX.matcher(regex).find()) {
            throw new IllegalArgumentException("regex cannot use lookaround or backreferences");
        }
        try {
            Pattern.compile(regex);
        } catch (PatternSyntaxException e) {
            throw new IllegalArgumentException("regex is not valid: " + e.getDescription());
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
