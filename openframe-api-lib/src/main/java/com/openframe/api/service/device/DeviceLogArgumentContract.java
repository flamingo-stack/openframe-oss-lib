package com.openframe.api.service.device;

import lombok.Value;
import lombok.experimental.Accessors;

import com.openframe.core.validation.tool.ToolArgumentCondition;
import com.openframe.core.validation.tool.ToolArgumentContract;
import com.openframe.core.validation.tool.ToolArgumentProperty;
import com.openframe.core.validation.tool.ToolArgumentRule;
import com.openframe.core.validation.tool.ToolConstraintViolation;

import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;
import java.util.function.UnaryOperator;

import static com.openframe.core.validation.tool.ToolArgumentConditions.countMatching;
import static com.openframe.core.validation.tool.ToolArgumentConditions.field;
import static com.openframe.core.validation.tool.ToolArgumentConditions.hasText;
import static com.openframe.core.validation.tool.ToolArgumentConditions.nonNull;
import static com.openframe.core.validation.tool.ToolArgumentConditions.rule;
import static com.openframe.core.validation.tool.ToolArgumentConditions.runtimeOnly;
import static com.openframe.core.validation.tool.ToolArgumentConditions.when;
import static org.springframework.util.CollectionUtils.isEmpty;

/** Shares Loki's pure query limits with admission and schema consumers; tenant/resource checks remain in the service. */
public final class DeviceLogArgumentContract {

    public static final String BLANK_MACHINE_ID_MESSAGE =
            "machineIds must not contain blank values";
    private static final Duration DEFAULT_LOOKBACK = Duration.ofDays(7);
    private static final Duration DEFAULT_TENANT_LOOKBACK = Duration.ofDays(1);
    private static final Duration MAX_RANGE = Duration.ofDays(30);
    private static final int MAX_IDS = 50;
    private static final int MAX_SEARCH_LENGTH = 256;
    private static final int MAX_SEARCH_TERMS = 5;
    private static final long NANOS_PER_SECOND = 1_000_000_000L;
    private static final List<ToolArgumentRule<DeviceLogQueryArguments>> ID_RULES = unchangedIdRules();
    private static final List<ToolArgumentRule<DeviceLogQueryArguments>> EMPTY_MACHINE_IDS_AS_ABSENT_RULES = normalizedIdRules();

    public ToolArgumentContract<DeviceLogQueryArguments> contract() {
        Instant now = Instant.now();
        return contract(now);
    }

    public ToolArgumentContract<DeviceLogQueryArguments> contract(Instant now) {
        return buildContract(now, ID_RULES);
    }

    public ToolArgumentContract<DeviceLogQueryArguments> contractWithEmptyMachineIdsAsAbsent() {
        Instant now = Instant.now();
        return buildContract(now, EMPTY_MACHINE_IDS_AS_ABSENT_RULES);
    }

    private static ToolArgumentContract<DeviceLogQueryArguments> buildContract(Instant now,
                                                                              List<ToolArgumentRule<DeviceLogQueryArguments>> idRules) {
        List<ToolArgumentRule<DeviceLogQueryArguments>> rules = new ArrayList<>(idRules);
        List<ToolArgumentRule<DeviceLogQueryArguments>> contains = termRules("contains", DeviceLogQueryArguments::contains);
        List<ToolArgumentRule<DeviceLogQueryArguments>> excludes = termRules("excludes", DeviceLogQueryArguments::excludes);
        List<ToolArgumentRule<DeviceLogQueryArguments>> range = rangeRules(now);
        rules.addAll(contains);
        rules.addAll(excludes);
        rules.addAll(range);
        ToolArgumentRule<DeviceLogQueryArguments> cursor = cursorRule();
        rules.add(cursor);
        return new ToolArgumentContract<>(DeviceLogQueryArguments.class, rules);
    }

    public List<ToolConstraintViolation> violations(DeviceLogQueryArguments arguments, Instant now) {
        ToolArgumentContract<DeviceLogQueryArguments> contract = contract(now);
        return contract.violations(arguments);
    }

    public PreparedQuery prepare(DeviceLogQueryArguments arguments, Instant now) {
        List<ToolConstraintViolation> violations = violations(arguments, now);
        rejectFirst(violations);
        Instant to = effectiveTo(arguments, now);
        Instant from = effectiveFrom(arguments, to);
        List<String> machineIds = arguments.machineIds();
        List<String> organizationIds = arguments.organizationIds();
        List<String> machines = usableIds(machineIds);
        List<String> organizations = usableIds(organizationIds);
        long startNanos = toNanos(from);
        long endNanos = inclusiveEndNanos(to);
        String cursor = arguments.cursor();
        Long cursorNanos = parseCursor(cursor).orElse(null);
        return new PreparedQuery(machines, organizations, from, to, startNanos, endNanos, cursorNanos);
    }

    public List<String> normalizeMachineIds(List<String> machineIds) {
        DeviceLogQueryArguments arguments = new DeviceLogQueryArguments(machineIds, null, null, null, null, null, null);
        return normalizeIds(arguments, machineIds);
    }

    public List<String> normalizeOrganizationIds(List<String> organizationIds) {
        DeviceLogQueryArguments arguments = new DeviceLogQueryArguments(null, organizationIds, null, null, null, null, null);
        return normalizeIds(arguments, organizationIds);
    }

    public Optional<List<String>> normalizeMachineIdsForQuery(List<String> machineIds) {
        DeviceLogQueryArguments arguments = new DeviceLogQueryArguments(machineIds, null, null, null, null, null, null);
        ToolArgumentContract<DeviceLogQueryArguments> contract = new ToolArgumentContract<>(DeviceLogQueryArguments.class, EMPTY_MACHINE_IDS_AS_ABSENT_RULES);
        List<ToolConstraintViolation> violations = contract.violations(arguments);
        rejectFirst(violations);
        return trimQueryIds(machineIds);
    }

    private static List<ToolArgumentRule<DeviceLogQueryArguments>> rangeRules(Instant now) {
        String defaults = "Omitted 'to' defaults to execution time; omitted 'from' defaults to 'to' minus "
                + DEFAULT_LOOKBACK.toDays() + " days for named devices or " + DEFAULT_TENANT_LOOKBACK.toDays() + " day for all devices.";
        String rangeMessage = "Time range cannot exceed " + MAX_RANGE.toDays() + " days. " + defaults;
        String fromMessage = "Timestamp out of range: from must fit signed-long epoch nanoseconds";
        String toMessage = "Timestamp out of range: to and its inclusive end (to plus one nanosecond) must fit signed-long epoch nanoseconds";
        ToolArgumentCondition<DeviceLogQueryArguments> ordered = runtimeOnly(arguments -> isOrderedRange(arguments, now));
        ToolArgumentCondition<DeviceLogQueryArguments> bounded = runtimeOnly(arguments -> isBoundedRange(arguments, now));
        ToolArgumentCondition<DeviceLogQueryArguments> from = runtimeOnly(arguments -> isRepresentableFrom(arguments, now));
        ToolArgumentCondition<DeviceLogQueryArguments> to = runtimeOnly(arguments -> isRepresentableTo(arguments, now));
        ToolArgumentRule<DeviceLogQueryArguments> orderRule = rule(ordered, "from", "'from' must be before 'to'. " + defaults);
        ToolArgumentRule<DeviceLogQueryArguments> rangeRule = rule(bounded, "from", rangeMessage);
        ToolArgumentRule<DeviceLogQueryArguments> fromRule = rule(from, "from", fromMessage);
        ToolArgumentRule<DeviceLogQueryArguments> toRule = rule(to, "to", toMessage);
        return List.of(orderRule, rangeRule, fromRule, toRule);
    }

    private static ToolArgumentRule<DeviceLogQueryArguments> cursorRule() {
        ToolArgumentCondition<String> valid = runtimeOnly(DeviceLogArgumentContract::isValidCursor);
        ToolArgumentCondition<DeviceLogQueryArguments> cursor = field("cursor", DeviceLogQueryArguments::cursor, valid);
        return rule(cursor, "cursor", "Invalid cursor: decoded value must be a positive signed-long integer");
    }

    private static List<String> normalizeIds(DeviceLogQueryArguments arguments, List<String> ids) {
        ToolArgumentContract<DeviceLogQueryArguments> contract = new ToolArgumentContract<>(DeviceLogQueryArguments.class, ID_RULES);
        List<ToolConstraintViolation> violations = contract.violations(arguments);
        rejectFirst(violations);
        return usableIds(ids);
    }

    private static List<ToolArgumentRule<DeviceLogQueryArguments>> unchangedIdRules() {
        UnaryOperator<ToolArgumentCondition<Collection<String>>> presence = UnaryOperator.identity();
        UnaryOperator<ToolArgumentCondition<List<String>>> bounds = UnaryOperator.identity();
        return idRules(presence, bounds, "omit it to query every device");
    }

    private static List<ToolArgumentRule<DeviceLogQueryArguments>> normalizedIdRules() {
        List<ToolArgumentRule<DeviceLogQueryArguments>> rules = new ArrayList<>();
        ToolArgumentProperty<DeviceLogQueryArguments, List<String>> property = new ToolArgumentProperty<>("machineIds", DeviceLogQueryArguments::machineIds);
        ToolArgumentCondition<DeviceLogQueryArguments> present = nonNull();
        ToolArgumentCondition<String> usable = hasText();
        ToolConstraintViolation violation = new ToolConstraintViolation("machineIds", BLANK_MACHINE_ID_MESSAGE);
        ToolArgumentRule<DeviceLogQueryArguments> nonblank = new ToolArgumentRule.Each<>(property, present, usable, violation);
        List<ToolArgumentRule<DeviceLogQueryArguments>> normalized = idRules(DeviceLogArgumentContract::normalizedPresence,
                DeviceLogArgumentContract::normalizedBounds, "omit it to use the request's default device scope");
        List<ToolArgumentRule<DeviceLogQueryArguments>> described = normalized.stream().map(DeviceLogArgumentContract::describeTrimmedIds).toList();
        rules.add(nonblank);
        rules.addAll(described);
        return List.copyOf(rules);
    }

    private static ToolArgumentRule<DeviceLogQueryArguments> describeTrimmedIds(ToolArgumentRule<DeviceLogQueryArguments> rule) {
        ToolConstraintViolation violation = rule.violation();
        if (!"machineIds".equals(violation.field())) {
            return rule;
        }
        String message = "Null or an empty machineIds list is treated as omitted. For a nonempty list: "
                + violation.message() + ". IDs are trimmed first; duplicates and IDs blank after trimming do not count.";
        ToolConstraintViolation described = new ToolConstraintViolation("machineIds", message);
        ToolArgumentCondition<DeviceLogQueryArguments> condition = rule.condition();
        return new ToolArgumentRule.Single<>(condition, described);
    }

    private static List<ToolArgumentRule<DeviceLogQueryArguments>> idRules(UnaryOperator<ToolArgumentCondition<Collection<String>>> machineIdsView,
                                                                         UnaryOperator<ToolArgumentCondition<List<String>>> machineIdsBounds,
                                                                         String machineIdsOmissionDescription) {
        List<ToolArgumentRule<DeviceLogQueryArguments>> rules = new ArrayList<>();
        UnaryOperator<ToolArgumentCondition<Collection<String>>> unchanged = UnaryOperator.identity();
        UnaryOperator<ToolArgumentCondition<List<String>>> unchangedBounds = UnaryOperator.identity();
        List<ToolArgumentRule<DeviceLogQueryArguments>> machines = idRules("machineIds", DeviceLogQueryArguments::machineIds,
                "device", machineIdsView, machineIdsBounds, machineIdsOmissionDescription);
        List<ToolArgumentRule<DeviceLogQueryArguments>> organizations = idRules("organizationIds", DeviceLogQueryArguments::organizationIds,
                "organization", unchanged, unchangedBounds, "omit it to query every organization");
        rules.addAll(machines);
        rules.addAll(organizations);
        return List.copyOf(rules);
    }

    private static List<ToolArgumentRule<DeviceLogQueryArguments>> idRules(String name,
                                                                         Function<DeviceLogQueryArguments, List<String>> accessor,
                                                                         String resource,
                                                                         UnaryOperator<ToolArgumentCondition<Collection<String>>> inputView,
                                                                         UnaryOperator<ToolArgumentCondition<List<String>>> boundsView,
                                                                         String omissionDescription) {
        ToolArgumentCondition<String> usable = hasText();
        ToolArgumentCondition<Collection<String>> anyUsable = new ToolArgumentCondition.CollectionItems<>(usable, ToolArgumentCondition.Quantifier.ANY);
        ToolArgumentCondition<Collection<String>> supplied = nonNull();
        ToolArgumentCondition<Collection<String>> suppliedIds = when(supplied, anyUsable);
        ToolArgumentCondition<Collection<String>> viewedIds = inputView.apply(suppliedIds);
        ToolArgumentCondition<DeviceLogQueryArguments> present = field(name, accessor::apply, viewedIds);
        ToolArgumentCondition<List<String>> maximumIds = runtimeOnly(DeviceLogArgumentContract::isBoundedIds);
        ToolArgumentCondition<List<String>> viewedBounds = boundsView.apply(maximumIds);
        ToolArgumentCondition<DeviceLogQueryArguments> bounded = field(name, accessor, viewedBounds);
        String requiredMessage = name + " must name at least one " + resource + "; " + omissionDescription;
        String limitMessage = "Cannot query more than " + MAX_IDS + " " + resource + "s at once (distinct nonblank IDs)";
        ToolArgumentRule<DeviceLogQueryArguments> requiredRule = rule(present, name, requiredMessage);
        ToolArgumentRule<DeviceLogQueryArguments> limitRule = rule(bounded, name, limitMessage);
        return List.of(requiredRule, limitRule);
    }

    private static ToolArgumentCondition<Collection<String>> normalizedPresence(ToolArgumentCondition<Collection<String>> condition) {
        return runtimeOnly(ids -> isSatisfiedAfterTrim(condition, ids));
    }

    private static ToolArgumentCondition<List<String>> normalizedBounds(ToolArgumentCondition<List<String>> condition) {
        return runtimeOnly(ids -> isSatisfiedAfterTrim(condition, ids));
    }

    private static boolean isSatisfiedAfterTrim(ToolArgumentCondition<? super List<String>> condition, Collection<String> ids) {
        Optional<List<String>> normalized = trimQueryIds(ids);
        return normalized.map(condition::isSatisfiedBy).orElseGet(() -> condition.isSatisfiedBy(null));
    }

    private static Optional<List<String>> trimQueryIds(Collection<String> ids) {
        if (isEmpty(ids)) {
            return Optional.empty();
        }
        List<String> normalized = ids.stream().map(id -> id == null ? null : id.trim()).distinct().toList();
        return Optional.of(normalized);
    }

    private static List<ToolArgumentRule<DeviceLogQueryArguments>> termRules(String name,
                                                                           Function<DeviceLogQueryArguments, List<String>> accessor) {
        ToolArgumentCondition<String> usable = hasText();
        ToolArgumentCondition<Collection<String>> count = countMatching(usable, MAX_SEARCH_TERMS);
        ToolArgumentCondition<DeviceLogQueryArguments> boundedCount = field(name, accessor::apply, count);
        ToolArgumentCondition<String> utf16Length = runtimeOnly(DeviceLogArgumentContract::isBoundedTerm);
        ToolArgumentCondition<String> usedLength = when(usable, utf16Length);
        ToolArgumentProperty<DeviceLogQueryArguments, List<String>> property = new ToolArgumentProperty<>(name, accessor);
        String lengthMessage = name + " terms cannot exceed " + MAX_SEARCH_LENGTH + " UTF-16 code units";
        String countMessage = name + " cannot hold more than " + MAX_SEARCH_TERMS + " terms; blank terms are ignored";
        ToolConstraintViolation violation = new ToolConstraintViolation(name, lengthMessage);
        ToolArgumentCondition<DeviceLogQueryArguments> present = nonNull();
        ToolArgumentRule<DeviceLogQueryArguments> length = new ToolArgumentRule.Each<>(property, present, usedLength, violation);
        ToolArgumentRule<DeviceLogQueryArguments> countRule = rule(boundedCount, name, countMessage);
        return List.of(length, countRule);
    }

    private static boolean isBoundedTerm(String term) {
        return term.length() <= MAX_SEARCH_LENGTH;
    }

    private static boolean isBoundedIds(List<String> ids) {
        return usableIds(ids).size() <= MAX_IDS;
    }

    private static List<String> usableIds(List<String> ids) {
        return ids == null ? List.of() : ids.stream().filter(org.springframework.util.StringUtils::hasText).distinct().toList();
    }

    private static Instant effectiveTo(DeviceLogQueryArguments arguments, Instant now) {
        return arguments.to() == null ? now : arguments.to();
    }

    private static Instant effectiveFrom(DeviceLogQueryArguments arguments, Instant to) {
        List<String> machineIds = arguments.machineIds();
        List<String> machines = usableIds(machineIds);
        Duration lookback = machines.isEmpty() ? DEFAULT_TENANT_LOOKBACK : DEFAULT_LOOKBACK;
        return arguments.from() == null ? to.minus(lookback) : arguments.from();
    }

    private static boolean isOrderedRange(DeviceLogQueryArguments arguments, Instant now) {
        try {
            return resolveWindow(arguments, now).isOrdered();
        } catch (DateTimeException exception) {
            return false;
        }
    }

    private static boolean isBoundedRange(DeviceLogQueryArguments arguments, Instant now) {
        try {
            return resolveWindow(arguments, now).isBounded();
        } catch (DateTimeException exception) {
            return false;
        }
    }

    private static Window resolveWindow(DeviceLogQueryArguments arguments, Instant now) {
        Instant to = effectiveTo(arguments, now);
        Instant from = effectiveFrom(arguments, to);
        return new Window(from, to);
    }

    private static boolean isRepresentableFrom(DeviceLogQueryArguments arguments, Instant now) {
        try {
            return resolveWindow(arguments, now).isRepresentableFrom();
        } catch (ArithmeticException | DateTimeException exception) {
            return false;
        }
    }

    private static boolean isRepresentableTo(DeviceLogQueryArguments arguments, Instant now) {
        try {
            return resolveWindow(arguments, now).isRepresentableTo();
        } catch (ArithmeticException | DateTimeException exception) {
            return false;
        }
    }

    private static long toNanos(Instant instant) {
        long seconds = instant.getEpochSecond();
        int nanos = instant.getNano();
        long secondsNanos = Math.multiplyExact(seconds, NANOS_PER_SECOND);
        return Math.addExact(secondsNanos, nanos);
    }

    private static long inclusiveEndNanos(Instant to) {
        long nanos = toNanos(to);
        return Math.addExact(nanos, 1);
    }

    private static boolean isValidCursor(String cursor) {
        try {
            Optional<Long> nanos = parseCursor(cursor);
            return nanos.map(timestamp -> timestamp > 0).orElse(true);
        } catch (NumberFormatException exception) {
            return false;
        }
    }

    public static Optional<Long> cursorTimestamp(String cursor) {
        if (!isValidCursor(cursor)) {
            throw new IllegalArgumentException("Invalid cursor");
        }
        return parseCursor(cursor);
    }

    private static Optional<Long> parseCursor(String cursor) {
        return Optional.ofNullable(cursor).map(Long::valueOf);
    }

    private static void rejectFirst(List<ToolConstraintViolation> violations) {
        if (!violations.isEmpty()) {
            ToolConstraintViolation violation = violations.getFirst();
            String message = violation.message();
            throw new IllegalArgumentException(message);
        }
    }

    @Value
    @Accessors(fluent = true)
    public static class PreparedQuery {

        private final List<String> machineIds;
        private final List<String> organizationIds;
        private final Instant from;
        private final Instant to;
        private final long startNanos;
        private final long endNanos;
        private final Long cursorNanos;

    }

    @Value
    @Accessors(fluent = true)
    private static class Window {

        private final Instant from;
        private final Instant to;

        boolean isOrdered() {
            return from.isBefore(to);
        }

        boolean isBounded() {
            return Duration.between(from, to).compareTo(MAX_RANGE) <= 0;
        }

        boolean isRepresentableFrom() {
            toNanos(from);
            return true;
        }

        boolean isRepresentableTo() {
            inclusiveEndNanos(to);
            return true;
        }
    }
}
