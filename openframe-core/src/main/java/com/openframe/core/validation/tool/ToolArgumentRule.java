package com.openframe.core.validation.tool;

import lombok.Value;
import lombok.experimental.Accessors;

import java.util.Collection;
import java.util.List;

/** Keeps diagnostics alongside their predicates, including repeated item failures. */
public sealed interface ToolArgumentRule<T> {

    ToolArgumentCondition<T> condition();

    ToolConstraintViolation violation();

    List<ToolConstraintViolation> violations(T value);

    @Value
    @Accessors(fluent = true)
    public static class Single<T> implements ToolArgumentRule<T> {

        private final ToolArgumentCondition<T> condition;
        private final ToolConstraintViolation violation;

        public List<ToolConstraintViolation> violations(T value) {
            return condition.isSatisfiedBy(value) ? List.of() : List.of(violation);
        }
    }

    @Value
    @Accessors(fluent = true)
    public static class Each<T, V> implements ToolArgumentRule<T> {

        private final ToolArgumentProperty<T, ? extends Collection<V>> property;
        private final ToolArgumentCondition<T> guard;
        private final ToolArgumentCondition<V> itemCondition;
        private final ToolConstraintViolation violation;

        public ToolArgumentCondition<T> condition() {
            ToolArgumentCondition.CollectionItems<V> items = new ToolArgumentCondition.CollectionItems<>(itemCondition, ToolArgumentCondition.Quantifier.ALL);
            ToolArgumentProperty<T, Collection<V>> collection = new ToolArgumentProperty<>(property.name(), property.accessor()::apply);
            ToolArgumentCondition<T> field = new ToolArgumentCondition.Field<>(collection, items);
            return new ToolArgumentCondition.When<>(guard, field);
        }

        public List<ToolConstraintViolation> violations(T value) {
            if (!guard.isSatisfiedBy(value)) {
                return List.of();
            }
            Collection<V> values = property.accessor().apply(value);
            return values == null ? List.of() : values.stream().filter(item -> !itemCondition.isSatisfiedBy(item)).map(item -> violation).toList();
        }
    }
}
