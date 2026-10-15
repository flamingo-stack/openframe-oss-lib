package com.openframe.core.validation.tool;

import java.util.Collection;
import java.util.List;
import java.util.function.Function;
import java.util.function.Predicate;

/** Composes shared checks without coupling argument classes to schema serialization. */
public final class ToolArgumentConditions {

    private ToolArgumentConditions() {
    }

    @SafeVarargs
    public static <T> ToolArgumentCondition<T> all(ToolArgumentCondition<T>... conditions) {
        return new ToolArgumentCondition.All<>(List.of(conditions));
    }

    @SafeVarargs
    public static <T> ToolArgumentCondition<T> any(ToolArgumentCondition<T>... conditions) {
        return new ToolArgumentCondition.Any<>(List.of(conditions));
    }

    public static <T> ToolArgumentCondition<T> not(ToolArgumentCondition<T> condition) {
        return new ToolArgumentCondition.Not<>(condition);
    }

    public static <T> ToolArgumentCondition<T> when(ToolArgumentCondition<T> condition, ToolArgumentCondition<T> consequence) {
        return new ToolArgumentCondition.When<>(condition, consequence);
    }

    public static <T, V> ToolArgumentCondition<T> field(String name, Function<T, V> accessor, ToolArgumentCondition<V> condition) {
        return new ToolArgumentCondition.Field<>(new ToolArgumentProperty<>(name, accessor), condition);
    }

    public static <T> ToolArgumentCondition<T> nonNull() {
        return new ToolArgumentCondition.Value<>(ToolArgumentValueKind.NON_NULL, Boolean.TRUE);
    }

    public static <T> ToolArgumentCondition<T> hasText() {
        return new ToolArgumentCondition.Value<>(ToolArgumentValueKind.HAS_TEXT, Boolean.TRUE);
    }

    public static <T> ToolArgumentCondition<T> nonEmpty() {
        return new ToolArgumentCondition.Value<>(ToolArgumentValueKind.NON_EMPTY, Boolean.TRUE);
    }

    public static <T> ToolArgumentCondition<T> equalTo(T expected) {
        return new ToolArgumentCondition.Value<>(ToolArgumentValueKind.EQUALS, expected);
    }

    public static <T> ToolArgumentCondition<T> positive() {
        return new ToolArgumentCondition.Value<>(ToolArgumentValueKind.POSITIVE, Boolean.TRUE);
    }

    public static <T> ToolArgumentCondition<T> multipleOf(long divisor) {
        return new ToolArgumentCondition.Value<>(ToolArgumentValueKind.MULTIPLE_OF, divisor);
    }

    public static <T> ToolArgumentCondition<T> pattern(String pattern) {
        return new ToolArgumentCondition.Value<>(ToolArgumentValueKind.PATTERN, pattern);
    }

    public static <T> ToolArgumentCondition<T> notTrimEmpty() {
        return new ToolArgumentCondition.Value<>(ToolArgumentValueKind.NOT_TRIM_EMPTY, Boolean.TRUE);
    }

    public static <T> ToolArgumentCondition<T> notTrimBlank() {
        return new ToolArgumentCondition.Value<>(ToolArgumentValueKind.NOT_TRIM_BLANK, Boolean.TRUE);
    }

    public static <T> ToolArgumentCondition<Collection<T>> countMatching(ToolArgumentCondition<T> condition, int maximum) {
        return new ToolArgumentCondition.CountMatching<>(condition, maximum);
    }

    public static <T> ToolArgumentCondition<T> runtimeOnly(Predicate<T> predicate) {
        return new ToolArgumentCondition.RuntimeOnly<>(predicate);
    }

    public static <T> ToolArgumentRule<T> rule(ToolArgumentCondition<T> condition, String field, String message) {
        return new ToolArgumentRule.Single<>(condition, new ToolConstraintViolation(field, message));
    }
}
