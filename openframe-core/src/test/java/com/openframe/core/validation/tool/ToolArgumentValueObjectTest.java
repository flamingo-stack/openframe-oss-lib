package com.openframe.core.validation.tool;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static com.openframe.core.validation.tool.ToolArgumentConditions.hasText;
import static com.openframe.core.validation.tool.ToolArgumentConditions.rule;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ToolArgumentValueObjectTest {

    @Test
    void compositeConditions_mutatedSource_retainsImmutableSnapshot() {
        // setup
        ToolArgumentCondition<String> required = hasText();
        List<ToolArgumentCondition<String>> source = new ArrayList<>(List.of(required));
        ToolArgumentCondition.All<String> all = new ToolArgumentCondition.All<>(source);
        ToolArgumentCondition.Any<String> any = new ToolArgumentCondition.Any<>(source);

        // execution
        source.clear();

        // verifications
        assertThat(all.conditions()).containsExactly(required);
        assertThat(any.conditions()).containsExactly(required);
        assertThatThrownBy(() -> all.conditions().add(required)).isInstanceOf(UnsupportedOperationException.class).hasMessage((String) null);
    }

    @Test
    void contract_mutatedSource_preservesRulesAndStructuralEquality() {
        // setup
        ToolArgumentCondition<String> required = hasText();
        ToolArgumentRule<String> check = rule(required, "query", "must contain text");
        List<ToolArgumentRule<String>> source = new ArrayList<>(List.of(check));
        ToolArgumentContract<String> contract = new ToolArgumentContract<>(String.class, source);
        ToolArgumentContract<String> equivalent = new ToolArgumentContract<>(String.class, List.of(check));

        // execution
        source.clear();

        // verifications
        assertThat(contract.rules()).containsExactly(check);
        assertThat(contract).isEqualTo(equivalent).hasSameHashCodeAs(equivalent);
        assertThatThrownBy(() -> contract.rules().clear()).isInstanceOf(UnsupportedOperationException.class).hasMessage((String) null);
    }

    @Test
    void violation_equalComponents_preservesStructuralEquality() {
        // setup
        ToolConstraintViolation first = new ToolConstraintViolation("query", "must contain text");
        ToolConstraintViolation equivalent = new ToolConstraintViolation("query", "must contain text");

        // execution
        boolean same = first.equals(equivalent);

        // verifications
        assertThat(same).isTrue();
        assertThat(first).hasSameHashCodeAs(equivalent);
    }
}
