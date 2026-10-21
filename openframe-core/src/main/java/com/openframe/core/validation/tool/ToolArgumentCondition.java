package com.openframe.core.validation.tool;

import lombok.experimental.Accessors;

import java.util.Collection;
import java.util.function.Predicate;

/** Represents a shared argument validation predicate. */
public sealed interface ToolArgumentCondition<T> {

    boolean isSatisfiedBy(T value);

    @lombok.Value
    @Accessors(fluent = true)
    public static class When<T> implements ToolArgumentCondition<T> {

        private final ToolArgumentCondition<T> condition;
        private final ToolArgumentCondition<T> consequence;

        public boolean isSatisfiedBy(T value) {
            return !condition.isSatisfiedBy(value) || consequence.isSatisfiedBy(value);
        }
    }

    @lombok.Value
    @Accessors(fluent = true)
    public static class Field<T, V> implements ToolArgumentCondition<T> {

        private final ToolArgumentProperty<T, V> property;
        private final ToolArgumentCondition<V> condition;

        public boolean isSatisfiedBy(T value) {
            return condition.isSatisfiedBy(property.accessor().apply(value));
        }
    }

    @lombok.Value
    @Accessors(fluent = true)
    public static class CollectionItems<T> implements ToolArgumentCondition<Collection<T>> {

        private final ToolArgumentCondition<T> condition;
        private final Quantifier quantifier;

        public boolean isSatisfiedBy(Collection<T> value) {
            if (value == null) {
                return quantifier == Quantifier.ALL;
            }
            return quantifier == Quantifier.ALL ? value.stream().allMatch(condition::isSatisfiedBy) : value.stream().anyMatch(condition::isSatisfiedBy);
        }
    }

    @lombok.Value
    @Accessors(fluent = true)
    public static class CountMatching<T> implements ToolArgumentCondition<Collection<T>> {

        private final ToolArgumentCondition<T> condition;
        private final int maximum;

        public boolean isSatisfiedBy(Collection<T> value) {
            return value == null || value.stream().filter(condition::isSatisfiedBy).count() <= maximum;
        }
    }

    @lombok.Value
    @Accessors(fluent = true)
    public static class Value<T> implements ToolArgumentCondition<T> {

        private final ToolArgumentValueKind kind;
        private final Object operand;

        public boolean isSatisfiedBy(T value) {
            return switch (kind) {
                case NON_NULL -> value != null;
                case HAS_TEXT, NOT_TRIM_EMPTY, NOT_TRIM_BLANK, PATTERN -> ToolArgumentValuePatterns.isMatchingValue(kind, operand, value);
            };
        }
    }

    @lombok.Value
    @Accessors(fluent = true)
    public static class RuntimeOnly<T> implements ToolArgumentCondition<T> {

        private final Predicate<T> predicate;

        public boolean isSatisfiedBy(T value) {
            return predicate.test(value);
        }
    }

    enum Quantifier {
        ALL, ANY
    }
}
