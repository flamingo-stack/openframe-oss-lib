package com.openframe.core.validation.tool;

import lombok.Value;
import lombok.experimental.Accessors;

import jakarta.validation.ConstraintValidatorContext;
import java.util.List;

import static java.util.stream.Collectors.joining;

/** Owns ordered argument checks shared by runtime validation and model schemas. */
@Value
@Accessors(fluent = true)
public class ToolArgumentContract<T> {

    private final Class<T> targetType;
    private final List<ToolArgumentRule<T>> rules;

    public ToolArgumentContract(Class<T> targetType, List<ToolArgumentRule<T>> rules) {
        this.targetType = targetType;
        this.rules = List.copyOf(rules);
    }

    public List<ToolConstraintViolation> violations(T value) {
        return value == null ? List.of() : rules.stream().flatMap(rule -> rule.violations(value).stream()).toList();
    }

    public String description() {
        return rules.stream().map(ToolArgumentRule::violation).map(ToolArgumentContract::describe).distinct().collect(joining("\n"));
    }

    private static String describe(ToolConstraintViolation violation) {
        return violation.field() + ": " + violation.message();
    }

    public boolean isValid(T value, ConstraintValidatorContext context) {
        return ToolConstraintViolation.apply(context, violations(value));
    }
}
