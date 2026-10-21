package com.openframe.core.validation.tool;

import java.util.Collection;
import java.util.function.Function;
import java.util.function.Predicate;

/** Composes shared checks without coupling argument classes to schema serialization. */
public final class ToolArgumentConditions {

    private ToolArgumentConditions() {
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
