package com.openframe.test.tests;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.api.DeviceLogApi;
import com.openframe.test.data.dto.device.DeviceLogConnection;
import com.openframe.test.data.dto.device.DeviceLogEdge;
import com.openframe.test.data.dto.device.DeviceLogEntry;
import com.openframe.test.data.dto.device.DeviceLogFilterInput;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.shared.GraphqlError;
import com.openframe.test.data.generator.DeviceGenerator;
import com.openframe.test.helpers.ai.RunId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

// Device agent logs behind the device Logs tab (CP-50), read-only: one tenant window is pinned in case 1 and the filter and paging cases read inside it.
@Tag("saas")
@Tag("device-logs")
@DisplayName("Device logs")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class DeviceLogsTest extends BaseTest {

    private static final String WINDOWS_HOSTNAME = "vm115982";
    private static final List<String> LEVELS = List.of("DEBUG", "INFO", "WARN", "ERROR");
    private static final int DEFAULT_PAGE = 100;
    private static final int PAGE = 5;
    private static final Duration TENANT_LOOKBACK = Duration.ofDays(1);
    private static final Duration DEVICE_LOOKBACK = Duration.ofDays(7);
    private static final Duration MAX_RANGE = Duration.ofDays(30);
    // Allowance for clock skew between this runner and the api-service when checking the default windows.
    private static final Duration SKEW = Duration.ofMinutes(5);
    private static final Pattern WORD = Pattern.compile("[A-Za-z]{5,}");

    private static Instant windowTo;
    private static Instant windowFrom;
    private static List<DeviceLogEntry> tenantPage;

    @Tag("feature")
    @Test
    @DisplayName("A tenant-wide page is newest first, within the default 24-hour window")
    @Order(1)
    public void testTenantWidePage() {
        Instant now = Instant.now();
        DeviceLogConnection defaultWindow = DeviceLogApi.deviceLogs(null, null, null, null);
        List<DeviceLogEntry> defaultEntries = defaultWindow.nodes();
        assertThat(defaultEntries).as("first defaults to %d lines", DEFAULT_PAGE).hasSizeLessThanOrEqualTo(DEFAULT_PAGE);
        assertThat(defaultEntries).extracting(DeviceLogEntry::timestampInstant)
                .as("With no device named, from defaults to 24 hours before now")
                .allMatch(timestamp -> !timestamp.isBefore(now.minus(TENANT_LOOKBACK).minus(SKEW)));
        assertNewestFirst(defaultEntries, "the default tenant window");
        assertThat(defaultWindow.getPageInfo().getHasPreviousPage()).as("A first page has no previous page").isFalse();

        // An empty default window is widened to the 30-day limit rather than skipped.
        windowTo = now.truncatedTo(ChronoUnit.SECONDS);
        windowFrom = windowTo.minus(defaultEntries.isEmpty() ? MAX_RANGE : TENANT_LOOKBACK);
        DeviceLogConnection pinned = DeviceLogApi.deviceLogs(null, window().build(), DEFAULT_PAGE, null);
        List<DeviceLogEntry> entries = pinned.nodes();
        assertThat(entries).as("The tenant holds log lines between %s and %s", windowFrom, windowTo).isNotEmpty();
        assertNewestFirst(entries, "the pinned tenant window");
        assertThat(entries).extracting(DeviceLogEntry::timestampInstant).as("from and to are inclusive bounds")
                .allMatch(timestamp -> !timestamp.isBefore(windowFrom) && !timestamp.isAfter(windowTo));
        assertThat(entries).extracting(DeviceLogEntry::getLevel).as("Every line carries one of the four levels").isSubsetOf(LEVELS);
        assertThat(entries).extracting(DeviceLogEntry::getMessage).as("Every line carries a message").doesNotContainNull();
        assertThat(pinned.getEdges()).extracting(DeviceLogEdge::getCursor).as("Every edge carries a cursor").allMatch(cursor -> cursor != null && !cursor.isBlank());
        assertThat(pinned.getPageInfo().getStartCursor()).as("startCursor is the first edge's cursor").isEqualTo(pinned.getEdges().getFirst().getCursor());
        assertThat(pinned.getPageInfo().getEndCursor()).as("endCursor is the last edge's cursor").isEqualTo(pinned.getEdges().getLast().getCursor());
        tenantPage = entries;
    }

    @Tag("feature")
    @Test
    @DisplayName("levels returns only lines of the requested levels")
    @Order(2)
    public void testLevelsFilter() {
        requireTenantPage();
        List<String> present = tenantPage.stream().map(DeviceLogEntry::getLevel).distinct().toList();
        String level = present.getFirst();

        List<DeviceLogEntry> single = DeviceLogApi.deviceLogs(null, window().levels(List.of(level)).build(), DEFAULT_PAGE, null).nodes();
        assertThat(single).as("levels [%s] finds the %s lines seen unfiltered", level, level).isNotEmpty();
        assertThat(single).extracting(DeviceLogEntry::getLevel).as("levels [%s] returns only %s lines", level, level).containsOnly(level);
        assertNewestFirst(single, "levels [" + level + "]");

        List<String> others = LEVELS.stream().filter(other -> !other.equals(level)).toList();
        List<DeviceLogEntry> rest = DeviceLogApi.deviceLogs(null, window().levels(others).build(), DEFAULT_PAGE, null).nodes();
        assertThat(rest).extracting(DeviceLogEntry::getLevel).as("levels %s never returns a %s line", others, level).doesNotContain(level);
        if (present.size() > 1) {
            assertThat(rest).as("levels %s finds the other levels seen unfiltered (%s)", others, present).isNotEmpty();
        }
    }

    @Tag("feature")
    @Test
    @DisplayName("contains and excludes match case-insensitively and literally")
    @Order(3)
    public void testContainsAndExcludes() {
        requireTenantPage();
        String term = tenantPage.stream()
                .map(entry -> WORD.matcher(entry.getMessage()))
                .filter(Matcher::find)
                .map(Matcher::group)
                .findFirst().orElse(null);
        assertThat(term).as("A line of the pinned window holds a word to search for").isNotNull();
        String flipped = flipCase(term);

        List<DeviceLogEntry> containing = DeviceLogApi.deviceLogs(null, window().contains(List.of(flipped)).build(), DEFAULT_PAGE, null).nodes();
        assertThat(containing).as("contains ['%s'] finds the lines holding '%s'", flipped, term).isNotEmpty();
        assertThat(containing).extracting(DeviceLogEntry::getMessage).as("contains ['%s'] matches regardless of case", flipped)
                .allMatch(message -> message.toLowerCase(Locale.ROOT).contains(term.toLowerCase(Locale.ROOT)));

        List<DeviceLogEntry> excluding = DeviceLogApi.deviceLogs(null, window().excludes(List.of(flipped)).build(), DEFAULT_PAGE, null).nodes();
        assertThat(excluding).extracting(DeviceLogEntry::getMessage).as("excludes ['%s'] drops every line holding '%s'", flipped, term)
                .noneMatch(message -> message.toLowerCase(Locale.ROOT).contains(term.toLowerCase(Locale.ROOT)));
        if (tenantPage.stream().anyMatch(entry -> !entry.getMessage().toLowerCase(Locale.ROOT).contains(term.toLowerCase(Locale.ROOT)))) {
            assertThat(excluding).as("excludes ['%s'] keeps the lines without it", flipped).isNotEmpty();
        }

        // As a regex ".*" would match every line; matched literally it keeps only lines holding those two characters.
        List<DeviceLogEntry> literal = DeviceLogApi.deviceLogs(null, window().contains(List.of(".*")).build(), DEFAULT_PAGE, null).nodes();
        assertThat(literal).extracting(DeviceLogEntry::getMessage).as("contains ['.*'] is matched literally, not as a regex")
                .allMatch(message -> message.contains(".*"));
    }

    @Tag("feature")
    @Test
    @DisplayName("first/after pages towards older lines without overlap")
    @Order(4)
    public void testPagination() {
        requireTenantPage();
        assumeTrue(tenantPage.size() > 2 * PAGE, "The pinned window holds more than two pages of " + PAGE + " lines");

        DeviceLogConnection first = DeviceLogApi.deviceLogs(null, window().build(), PAGE, null);
        assertThat(first.getEdges()).as("first: %d answers at most %d lines", PAGE, PAGE).isNotEmpty().hasSizeLessThanOrEqualTo(PAGE);
        assertThat(first.getPageInfo().getHasNextPage()).as("The first page has a next page").isTrue();
        assertThat(first.getPageInfo().getHasPreviousPage()).as("The first page has no previous page").isFalse();
        assertThat(first.getPageInfo().getEndCursor()).as("endCursor is the last edge's cursor").isEqualTo(first.getEdges().getLast().getCursor());

        DeviceLogConnection second = DeviceLogApi.deviceLogs(null, window().build(), PAGE, first.getPageInfo().getEndCursor());
        assertThat(second.getEdges()).as("The second page is not empty").isNotEmpty().hasSizeLessThanOrEqualTo(PAGE);
        assertThat(second.getPageInfo().getHasPreviousPage()).as("A page read with after has a previous page").isTrue();

        Instant oldestOfFirst = first.nodes().getLast().timestampInstant();
        Instant newestOfSecond = second.nodes().getFirst().timestampInstant();
        assertThat(newestOfSecond).as("A page never splits a timestamp, so the second starts strictly older than the first ends")
                .isBefore(oldestOfFirst);
        List<DeviceLogEntry> both = new ArrayList<>(first.nodes());
        both.addAll(second.nodes());
        assertNewestFirst(both, "two consecutive pages");
    }

    @Tag("feature")
    @Test
    @DisplayName("A range over 30 days and an empty or oversized machineIds list are refused")
    @Order(5)
    public void testRangeAndDeviceListRefused() {
        Instant to = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        DeviceLogFilterInput tooLong = DeviceLogFilterInput.builder()
                .from(to.minus(MAX_RANGE).minus(Duration.ofHours(1)).toString()).to(to.toString()).build();
        List<GraphqlError> rangeErrors = DeviceLogApi.attemptDeviceLogsErrors(null, tooLong, null, null);
        assertThat(codes(rangeErrors)).as("A 30-day-and-an-hour range is a VALIDATION_ERROR").containsExactly("VALIDATION_ERROR");
        assertThat(rangeErrors).extracting(GraphqlError::getMessage).as("The refusal names the limit").contains("Time range cannot exceed 30 days");

        DeviceLogFilterInput inverted = DeviceLogFilterInput.builder().from(to.toString()).to(to.minus(Duration.ofHours(1)).toString()).build();
        assertThat(codes(DeviceLogApi.attemptDeviceLogsErrors(null, inverted, null, null)))
                .as("from after to is a VALIDATION_ERROR").containsExactly("VALIDATION_ERROR");

        List<GraphqlError> emptyErrors = DeviceLogApi.attemptDeviceLogsErrors(List.of(), null, null, null);
        assertThat(codes(emptyErrors)).as("An empty machineIds list is a VALIDATION_ERROR, not a tenant-wide read").containsExactly("VALIDATION_ERROR");
        assertThat(emptyErrors).extracting(GraphqlError::getMessage).as("The refusal says to omit machineIds instead")
                .contains("machineIds must name at least one device; omit it to query every device");

        RunId runId = RunId.next();
        List<String> tooMany = IntStream.rangeClosed(1, 51).mapToObj(i -> "no-such-machine-" + runId + "-" + i).toList();
        List<GraphqlError> tooManyErrors = DeviceLogApi.attemptDeviceLogsErrors(tooMany, null, null, null);
        assertThat(codes(tooManyErrors)).as("51 machineIds is a VALIDATION_ERROR").containsExactly("VALIDATION_ERROR");
        assertThat(tooManyErrors).extracting(GraphqlError::getMessage).as("The refusal names the limit").contains("Cannot query more than 50 devices at once");
    }

    @Tag("feature")
    @Test
    @DisplayName("An unknown device, too many search terms and a malformed cursor are refused")
    @Order(6)
    public void testInvalidArgumentsRefused() {
        String unknown = "no-such-machine-" + RunId.next();
        assertThat(codes(DeviceLogApi.attemptDeviceLogsErrors(List.of(unknown), null, null, null)))
                .as("A machineId the tenant does not hold is DEVICE_NOT_FOUND").containsExactly("DEVICE_NOT_FOUND");

        DeviceLogFilterInput sixTerms = DeviceLogFilterInput.builder().contains(List.of("a", "b", "c", "d", "e", "f")).build();
        assertThat(codes(DeviceLogApi.attemptDeviceLogsErrors(null, sixTerms, null, null)))
                .as("Six contains terms is a VALIDATION_ERROR").containsExactly("VALIDATION_ERROR");

        DeviceLogFilterInput longTerm = DeviceLogFilterInput.builder().excludes(List.of("x".repeat(257))).build();
        assertThat(codes(DeviceLogApi.attemptDeviceLogsErrors(null, longTerm, null, null)))
                .as("A 257-character excludes term is a VALIDATION_ERROR").containsExactly("VALIDATION_ERROR");

        assertThat(codes(DeviceLogApi.attemptDeviceLogsErrors(null, null, PAGE, "not-a-cursor")))
                .as("A cursor deviceLogs did not issue is a VALIDATION_ERROR, not a silent restart at page one").containsExactly("VALIDATION_ERROR");
    }

    @Tag("feature")
    @Tag("needs-device")
    @Test
    @DisplayName("Naming the enrolled Windows box returns only its lines, within the default 7-day window")
    @Order(7)
    public void testSingleDeviceLogs() {
        Machine box = DeviceApi.getDevices(DeviceGenerator.osDevicesFilter("WINDOWS")).stream()
                .filter(device -> WINDOWS_HOSTNAME.equalsIgnoreCase(device.getHostname()))
                .findFirst().orElse(null);
        assumeTrue(box != null, "The enrolled Windows box " + WINDOWS_HOSTNAME + " is listed");
        String machineId = box.getMachineId();

        Instant now = Instant.now();
        List<DeviceLogEntry> defaultWindow = DeviceLogApi.deviceLogs(List.of(machineId), null, DEFAULT_PAGE, null).nodes();
        assertThat(defaultWindow).extracting(DeviceLogEntry::getMachineId).as("Naming %s returns only its lines", machineId).allMatch(machineId::equals);
        assertThat(defaultWindow).extracting(DeviceLogEntry::timestampInstant)
                .as("With a device named, from defaults to 7 days before now")
                .allMatch(timestamp -> !timestamp.isBefore(now.minus(DEVICE_LOOKBACK).minus(SKEW)));
        assertNewestFirst(defaultWindow, WINDOWS_HOSTNAME + "'s default window");

        Instant to = now.truncatedTo(ChronoUnit.SECONDS);
        DeviceLogFilterInput month = DeviceLogFilterInput.builder().from(to.minus(MAX_RANGE).toString()).to(to.toString()).build();
        List<DeviceLogEntry> widened = DeviceLogApi.deviceLogs(List.of(machineId), month, DEFAULT_PAGE, null).nodes();
        assertThat(widened).as("%s shipped log lines in the last 30 days", WINDOWS_HOSTNAME).isNotEmpty();
        assertThat(widened).extracting(DeviceLogEntry::getMachineId).as("The 30-day window holds only %s's lines", machineId).containsOnly(machineId);
        assertThat(widened).extracting(DeviceLogEntry::getHostname).as("Its lines carry its hostname")
                .allMatch(hostname -> hostname == null || WINDOWS_HOSTNAME.equalsIgnoreCase(hostname));

        List<DeviceLogEntry> deprecated = DeviceLogApi.deviceLogsByMachineId(machineId, month, DEFAULT_PAGE).nodes();
        assertThat(deprecated).extracting(DeviceLogEntry::getMachineId).as("The deprecated machineId argument also narrows to %s", machineId)
                .isNotEmpty().containsOnly(machineId);
    }

    private static void requireTenantPage() {
        assumeTrue(tenantPage != null && !tenantPage.isEmpty(), "Case 1 pinned a tenant window holding log lines");
    }

    private static DeviceLogFilterInput.DeviceLogFilterInputBuilder window() {
        return DeviceLogFilterInput.builder().from(windowFrom.toString()).to(windowTo.toString());
    }

    private static void assertNewestFirst(List<DeviceLogEntry> entries, String what) {
        List<Instant> timestamps = entries.stream().map(DeviceLogEntry::timestampInstant).toList();
        assertThat(timestamps).as("Lines of %s are sorted newest first by ingestion timestamp", what)
                .isSortedAccordingTo((a, b) -> b.compareTo(a));
    }

    private static String flipCase(String term) {
        StringBuilder flipped = new StringBuilder(term.length());
        for (char c : term.toCharArray()) {
            flipped.append(Character.isUpperCase(c) ? Character.toLowerCase(c) : Character.toUpperCase(c));
        }
        return flipped.toString();
    }

    // Codes of the errors that carry one; graphql-java's code-less errors are dropped.
    private static List<Object> codes(List<GraphqlError> errors) {
        return errors.stream()
                .map(error -> error.getExtensions() == null ? null : error.getExtensions().get("code"))
                .filter(Objects::nonNull)
                .toList();
    }
}
