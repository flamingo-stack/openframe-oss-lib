package com.openframe.api.service.device;

import com.openframe.api.service.device.DeviceLogArgumentContract.PreparedQuery;
import com.openframe.core.validation.tool.ToolConstraintViolation;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class DeviceLogArgumentContractTest {

    private static final Instant NOW = Instant.parse("2026-10-14T12:00:00Z");
    private static final Instant FROM = NOW.minus(Duration.ofDays(1));
    private static final Instant MAX_TIMESTAMP = Instant.ofEpochSecond(9_223_372_036L, 854_775_807L);

    @ParameterizedTest
    @MethodSource("invalidArguments")
    void violations_invalidPureArguments_reportsField(DeviceLogQueryArguments arguments, String field) {
        // setup
        DeviceLogArgumentContract contract = new DeviceLogArgumentContract();

        // execution
        List<ToolConstraintViolation> violations = contract.violations(arguments, NOW);

        // verifications
        assertThat(violations).extracting("field").contains(field);
    }

    @ParameterizedTest
    @MethodSource("validArguments")
    void violations_executionAcceptedBoundaries_acceptsArguments(DeviceLogQueryArguments arguments) {
        // setup
        DeviceLogArgumentContract contract = new DeviceLogArgumentContract();

        // execution
        List<ToolConstraintViolation> violations = contract.violations(arguments, NOW);

        // verifications
        assertThat(violations).isEmpty();
    }

    @Test
    void prepare_deviceQueryWithoutBounds_usesSevenDayWindow() {
        // setup
        DeviceLogArgumentContract contract = new DeviceLogArgumentContract();
        DeviceLogQueryArguments arguments = arguments(List.of("machine"), null, null, null, null, null, null);

        // execution
        PreparedQuery query = contract.prepare(arguments, NOW);

        // verifications
        assertThat(query.from()).isEqualTo(NOW.minus(Duration.ofDays(7)));
        assertThat(query.to()).isEqualTo(NOW);
    }

    @Test
    void prepare_tenantQueryWithoutBounds_usesOneDayWindow() {
        // setup
        DeviceLogArgumentContract contract = new DeviceLogArgumentContract();
        DeviceLogQueryArguments arguments = arguments(null, null, null, null, null, null, null);

        // execution
        PreparedQuery query = contract.prepare(arguments, NOW);

        // verifications
        assertThat(query.from()).isEqualTo(FROM);
        assertThat(query.to()).isEqualTo(NOW);
    }

    @Test
    void prepare_invalidTerms_rejectsBeforeExecution() {
        // setup
        DeviceLogArgumentContract contract = new DeviceLogArgumentContract();
        DeviceLogQueryArguments arguments = arguments(null, null, List.of("a", "b", "c", "d", "e", "f"), null, FROM, NOW, null);

        // execution
        Throwable execution = catchThrowable(() -> contract.prepare(arguments, NOW));

        // verifications
        assertThat(execution).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("5 terms");
    }

    @Test
    void prepare_largestSupportedInclusiveTimestamp_keepsEndWithinLong() {
        // setup
        DeviceLogArgumentContract contract = new DeviceLogArgumentContract();
        Instant to = MAX_TIMESTAMP.minusNanos(1);
        Instant from = to.minus(Duration.ofDays(1));
        DeviceLogQueryArguments arguments = arguments(null, null, null, null, from, to, null);

        // execution
        PreparedQuery query = contract.prepare(arguments, NOW);

        // verifications
        assertThat(query.endNanos()).isEqualTo(Long.MAX_VALUE);
    }

    @Test
    void contractWithEmptyMachineIdsAsAbsent_emptyList_acceptsParserView() {
        // setup
        DeviceLogArgumentContract contract = new DeviceLogArgumentContract();
        DeviceLogQueryArguments arguments = arguments(List.of(), null, null, null, FROM, NOW, null);

        // execution
        List<ToolConstraintViolation> violations = contract.contractWithEmptyMachineIdsAsAbsent().violations(arguments);

        // verifications
        assertThat(violations).isEmpty();
    }

    @Test
    void contractWithEmptyMachineIdsAsAbsent_description_keepsOmissionScopeContextNeutral() {
        // setup
        DeviceLogArgumentContract contract = new DeviceLogArgumentContract();

        // execution
        String description = contract.contractWithEmptyMachineIdsAsAbsent().description();

        // verifications
        assertThat(description).contains("request's default device scope").doesNotContain("omit it to query every device");
    }

    @Test
    void contract_description_preservesRawApiOmissionScope() {
        // setup
        DeviceLogArgumentContract contract = new DeviceLogArgumentContract();

        // execution
        String description = contract.contract().description();

        // verifications
        assertThat(description).contains("omit it to query every device");
    }

    @ParameterizedTest
    @MethodSource("invalidQueryMachineIds")
    void normalizeMachineIdsForQuery_invalidNativeIds_rejectsBeforeExecution(List<String> ids, String message) {
        // setup
        DeviceLogArgumentContract contract = new DeviceLogArgumentContract();

        // execution
        Throwable failure = catchThrowable(() -> contract.normalizeMachineIdsForQuery(ids));

        // verifications
        assertThat(failure).isInstanceOf(IllegalArgumentException.class).hasMessageContaining(message);
    }

    @ParameterizedTest
    @MethodSource("validQueryMachineIds")
    void normalizeMachineIdsForQuery_nativeRepresentation_matchesExecution(List<String> ids, List<String> expected) {
        // setup
        DeviceLogArgumentContract contract = new DeviceLogArgumentContract();

        Optional<List<String>> expectedIds = Optional.ofNullable(expected);

        // execution
        Optional<List<String>> normalized = contract.normalizeMachineIdsForQuery(ids);

        // verifications
        assertThat(normalized).isEqualTo(expectedIds);
    }

    @ParameterizedTest
    @MethodSource("invalidQueryMachineIds")
    void contractWithEmptyMachineIdsAsAbsent_invalidNativeIds_reportsField(List<String> ids, String message) {
        // setup
        DeviceLogArgumentContract contract = new DeviceLogArgumentContract();
        DeviceLogQueryArguments arguments = arguments(ids, null, null, null, FROM, NOW, null);

        // execution
        List<ToolConstraintViolation> violations = contract.contractWithEmptyMachineIdsAsAbsent().violations(arguments);

        // verifications
        assertThat(violations).extracting("field").contains("machineIds");
    }

    @Test
    void cursorTimestamp_absentCursor_returnsEmptyOptional() {
        // setup
        String cursor = null;

        // execution
        Optional<Long> timestamp = DeviceLogArgumentContract.cursorTimestamp(cursor);

        // verifications
        assertThat(timestamp).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"1", "+1", "9223372036854775807"})
    void cursorTimestamp_validCursor_returnsTimestamp(String cursor) {
        // setup
        long expected = Long.parseLong(cursor);

        // execution
        Optional<Long> timestamp = DeviceLogArgumentContract.cursorTimestamp(cursor);

        // verifications
        assertThat(timestamp).contains(expected);
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "garbage", "9223372036854775808"})
    void cursorTimestamp_invalidCursor_preservesRejectionMessage(String cursor) {
        // setup
        String expectedMessage = "Invalid cursor";

        // execution
        Throwable failure = catchThrowable(() -> DeviceLogArgumentContract.cursorTimestamp(cursor));

        // verifications
        assertThat(failure).isInstanceOf(IllegalArgumentException.class).hasMessage(expectedMessage);
    }

    private Stream<Arguments> invalidArguments() {
        return Stream.of(
                Arguments.of(arguments(distinctIds(51), null, null, null, FROM, NOW, null), "machineIds"),
                Arguments.of(arguments(null, distinctIds(51), null, null, FROM, NOW, null), "organizationIds"),
                Arguments.of(arguments(Arrays.asList(null, "", " "), null, null, null, FROM, NOW, null), "machineIds"),
                Arguments.of(arguments(List.of(), null, null, null, FROM, NOW, null), "machineIds"),
                Arguments.of(arguments(null, List.of(" "), null, null, FROM, NOW, null), "organizationIds"),
                Arguments.of(arguments(null, null, List.of("a", "b", "c", "d", "e", "f"), null, FROM, NOW, null), "contains"),
                Arguments.of(arguments(null, null, null, List.of("a", "b", "c", "d", "e", "f"), FROM, NOW, null), "excludes"),
                Arguments.of(arguments(null, null, List.of("x".repeat(257)), null, FROM, NOW, null), "contains"),
                Arguments.of(arguments(null, null, null, List.of("😀".repeat(129)), FROM, NOW, null), "excludes"),
                Arguments.of(arguments(null, null, null, null, NOW, NOW, null), "from"),
                Arguments.of(arguments(null, null, null, null, NOW, null, null), "from"),
                Arguments.of(arguments(null, null, null, null, NOW.plusSeconds(1), NOW, null), "from"),
                Arguments.of(arguments(null, null, null, null, NOW.minus(Duration.ofDays(30)).minusNanos(1), NOW, null), "from"),
                Arguments.of(arguments(null, null, null, null, Instant.MIN, NOW, null), "from"),
                Arguments.of(arguments(null, null, null, null, null, Instant.MAX, null), "to"),
                Arguments.of(arguments(null, null, null, null, null, MAX_TIMESTAMP, null), "to"),
                Arguments.of(arguments(null, null, null, null, FROM, NOW, "0"), "cursor"),
                Arguments.of(arguments(null, null, null, null, FROM, NOW, "-1"), "cursor"),
                Arguments.of(arguments(null, null, null, null, FROM, NOW, "garbage"), "cursor"),
                Arguments.of(arguments(null, null, null, null, FROM, NOW, "9223372036854775808"), "cursor"));
    }

    private Stream<DeviceLogQueryArguments> validArguments() {
        return Stream.of(
                arguments(null, null, null, null, null, null, null),
                arguments(distinctIds(50), distinctIds(50), null, null, FROM, NOW, null),
                arguments(Collections.nCopies(51, "machine"), null, null, null, FROM, NOW, null),
                arguments(null, Collections.nCopies(51, "organization"), null, null, FROM, NOW, null),
                arguments(null, null, Arrays.asList("a", "b", "c", "d", "e", null, "", " "), null, FROM, NOW, null),
                arguments(null, null, List.of(" ".repeat(257)), null, FROM, NOW, null),
                arguments(null, null, List.of("x".repeat(256)), List.of("😀".repeat(128)), FROM, NOW, null),
                arguments(null, null, null, null, NOW.minus(Duration.ofDays(30)), NOW, null),
                arguments(null, null, null, null, NOW.minus(Duration.ofDays(30)), null, null),
                arguments(null, null, null, null, FROM, NOW, "+1"),
                arguments(null, null, null, null, FROM, NOW, Long.toString(Long.MAX_VALUE)));
    }

    private List<String> distinctIds(int count) {
        return IntStream.range(0, count).mapToObj(index -> "id-" + index).toList();
    }

    private Stream<Arguments> invalidQueryMachineIds() {
        return Stream.of(
                Arguments.of(Arrays.asList("machine", null), "must not contain blank values"),
                Arguments.of(List.of("machine", " "), "must not contain blank values"),
                Arguments.of(List.of("\u0000"), "must name at least one device"),
                Arguments.of(List.of("\u2003"), "must not contain blank values"),
                Arguments.of(distinctIds(51), "Cannot query more than 50 devices"));
    }

    private Stream<Arguments> validQueryMachineIds() {
        return Stream.of(Arguments.of(null, null), Arguments.of(List.of(), null),
                Arguments.of(List.of(" machine ", "machine"), List.of("machine")),
                Arguments.of(List.of("\u0000", "machine"), List.of("", "machine")),
                Arguments.of(Collections.nCopies(51, " machine "), List.of("machine")),
                Arguments.of(differentWhitespaceIds(), List.of("machine")),
                Arguments.of(List.of(" machine "), List.of(" machine ")));
    }

    private DeviceLogQueryArguments arguments(List<String> machines, List<String> organizations,
                                                    List<String> contains, List<String> excludes, Instant from,
                                                    Instant to, String cursor) {
        return new DeviceLogQueryArguments(machines, organizations, contains, excludes, from, to, cursor);
    }

    private List<String> differentWhitespaceIds() {
        return IntStream.rangeClosed(1, 51).mapToObj(count -> " ".repeat(count) + "machine").toList();
    }
}
