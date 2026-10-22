package com.openframe.core.validation.tool;

import org.junit.jupiter.api.Test;

import java.util.List;

import static com.openframe.core.validation.tool.ToolArgumentConditions.rule;
import static com.openframe.core.validation.tool.ToolArgumentConditions.runtimeOnly;
import static org.assertj.core.api.Assertions.assertThat;

class ToolArgumentContractDescriptionTest {

    @Test
    void description_repeatedDiagnostics_describesDistinctRulesWithoutEvaluation() {
        // setup
        ToolArgumentCondition<String> condition = runtimeOnly(this::shouldNeverEvaluate);
        ToolArgumentRule<String> first = rule(condition, "first", "required");
        ToolArgumentRule<String> second = rule(condition, "second", "required");
        ToolArgumentContract<String> contract = new ToolArgumentContract<>(String.class, List.of(first, first, second));

        // execution
        String description = contract.description();

        // verifications
        assertThat(description).isEqualTo("first: required\nsecond: required");
    }

    private boolean shouldNeverEvaluate(String value) {
        throw new AssertionError("Metadata must not evaluate runtime predicates");
    }
}
